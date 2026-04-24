/**
 * Convert editor HTML to Markdown while preserving compatibility.
 * - Prioritizes standard markdown syntax for headings/lists/code/links/tables.
 * - Keeps unsupported styles (color/font-size/background) as inline HTML spans.
 * - Preserves code block language and line breaks.
 */

import { normalizeCodeLanguage } from './code-languages'
import { extractCodeBlockText, normalizeCodeBlockText } from './code-block-text'

interface StyleInfo {
  color?: string
  backgroundColor?: string
  fontSize?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  code?: boolean
}

export interface ExportBinaryAsset {
  relativePath: string
  mimeType: string
  base64Data: string
}

export interface MarkdownExportPayload {
  markdown: string
  assets: ExportBinaryAsset[]
}

export interface DocxInlineStyleDefinition {
  styleId: string
  color?: string
  backgroundColor?: string
  fontSizeHalfPoints?: number
}

export interface DocxExportPayload {
  title: string
  html: string
  assets: ExportBinaryAsset[]
  inlineStyles: DocxInlineStyleDefinition[]
}

interface MarkdownConvertOptions {
  includeTitleHeading?: boolean
  preserveImageStyles?: boolean
}

function parseStyle(styleStr: string): StyleInfo {
  const style: StyleInfo = {}
  const parts = styleStr.split(';').map((s) => s.trim()).filter(Boolean)
  for (const part of parts) {
    const [key, value] = part.split(':').map((s) => s.trim())
    if (!value) continue
    if (key === 'color') style.color = value
    if (key === 'background-color' || key === 'background') style.backgroundColor = value
    if (key === 'font-size') style.fontSize = value
  }
  return style
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function extensionFromMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase()
  if (normalized === 'image/jpeg') return 'jpg'
  if (normalized === 'image/svg+xml') return 'svg'
  if (normalized === 'image/x-icon') return 'ico'
  if (normalized === 'image/heic') return 'heic'
  if (normalized === 'image/heif') return 'heif'
  const [, subtype = 'bin'] = normalized.split('/')
  return subtype.replace(/[^a-z0-9]+/g, '') || 'bin'
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } | null {
  const match = dataUrl.match(/^data:([^;,]+)?;base64,(.+)$/i)
  if (!match) return null
  return {
    mimeType: (match[1] || 'application/octet-stream').trim().toLowerCase(),
    base64Data: match[2],
  }
}

function normalizeInlineLatex(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  let normalized = trimmed
    .replace(/^\$+/, '')
    .replace(/\$+$/, '')
    .replace(/\r\n?/g, ' ')
    .replace(/\s+/g, ' ')
    // Some serialized HTML may contain escaped backslashes (\\frac); convert
    // command-style double slashes back to single slash for LaTeX.
    .replace(/\\\\([a-zA-Z])/g, '\\$1')
    .replace(/\\\\\{/g, '\\{')
    .replace(/\\\\\}/g, '\\}')
    .replace(/\u200B/g, '')
  // Tolerate incomplete fraction authored in editor dialogs (e.g. \frac{a})
  // so downstream editors like Typora won't throw parse errors.
  normalized = normalized.replace(/\\frac\s*\{([^{}]*)\}(?!\s*\{)/g, '\\frac{$1}{}')
  return normalized
}

function detectCodeLanguage(source: Element): string {
  const wrapper = source.closest('.code-block-wrapper') as HTMLElement | null
  const dataLang =
    wrapper?.getAttribute('data-code-language') ||
    source.getAttribute('data-language') ||
    source.querySelector('code')?.getAttribute('data-language') ||
    ''
  const normalizedDataLang = normalizeCodeLanguage(dataLang)
  if (normalizedDataLang !== 'plaintext') return normalizedDataLang
  const className = source.className || source.querySelector('code')?.className || ''
  const match = className.match(/language-([a-z0-9_+-]+)/i)
  const normalizedClassLang = normalizeCodeLanguage(match?.[1] || '')
  return normalizedClassLang === 'plaintext' ? '' : normalizedClassLang
}

function stripEditorOnlyNodes(root: ParentNode): void {
  root
    .querySelectorAll('.code-controls, .code-copy-btn, .code-wrap-toggle, .code-copy-toast, [data-copy-code-btn], [data-code-lang-select], [data-code-wrap-toggle]')
    .forEach((node) => node.remove())
}

function applyInlineStyles(text: string, style: StyleInfo): string {
  if (!text) return ''
  const hasColor = style.color && style.color !== 'inherit'
  const hasBg = style.backgroundColor && style.backgroundColor !== 'transparent'
  const hasFontSize = style.fontSize
  if (!hasColor && !hasBg && !hasFontSize) return text
  let styleAttr = ''
  if (hasColor) styleAttr += `color:${style.color};`
  if (hasBg) styleAttr += `background-color:${style.backgroundColor};`
  if (hasFontSize) styleAttr += `font-size:${style.fontSize};`
  return `<span style="${styleAttr}">${text}</span>`
}

function applyTextFormatting(text: string, style: StyleInfo): string {
  if (!text) return ''
  let result = text
  if (style.code) result = `\`${result}\``
  if (style.strikethrough) result = `~~${result}~~`
  if (style.underline) result = `<u>${result}</u>`
  if (style.bold) result = `**${result}**`
  if (style.italic) result = `*${result}*`
  return result
}

function convertTable(table: Element): string {
  const rows = table.querySelectorAll('tr')
  if (!rows.length) return ''
  let result = '\n'
  let headerProcessed = false
  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('th, td')
    const cellContents = Array.from(cells).map((cell) => (cell.textContent || '').trim())
    result += `| ${cellContents.join(' | ')} |\n`
    if (!headerProcessed && (row.querySelector('th') || rowIndex === 0)) {
      result += `| ${cellContents.map(() => '---').join(' | ')} |\n`
      headerProcessed = true
    }
  })
  return `${result}\n`
}

function renderImageElement(element: Element, options: MarkdownConvertOptions): string {
  const src = (element.getAttribute('src') || '').trim()
  const alt = (element.getAttribute('alt') || '').trim()
  if (!options.preserveImageStyles) {
    return `![${alt}](${src})`
  }

  const imageElement = element as HTMLElement
  const widthStyle = imageElement.style.width.trim()
  const heightStyle = imageElement.style.height.trim()
  const maxWidthStyle = imageElement.style.maxWidth.trim()
  const widthAttr = (element.getAttribute('width') || '').trim()
  const heightAttr = (element.getAttribute('height') || '').trim()

  const attrs = [`src="${escapeHtmlAttribute(src)}"`]
  if (alt) attrs.push(`alt="${escapeHtmlAttribute(alt)}"`)

  if (widthAttr) attrs.push(`width="${escapeHtmlAttribute(widthAttr)}"`)
  else if (/^\d+(?:\.\d+)?px$/i.test(widthStyle)) attrs.push(`width="${escapeHtmlAttribute(widthStyle.replace(/px$/i, ''))}"`)

  if (heightAttr) attrs.push(`height="${escapeHtmlAttribute(heightAttr)}"`)
  else if (/^\d+(?:\.\d+)?px$/i.test(heightStyle)) attrs.push(`height="${escapeHtmlAttribute(heightStyle.replace(/px$/i, ''))}"`)

  const styleParts: string[] = []
  if (widthStyle && !/^\d+(?:\.\d+)?px$/i.test(widthStyle)) styleParts.push(`width:${widthStyle}`)
  if (heightStyle && !/^\d+(?:\.\d+)?px$/i.test(heightStyle)) styleParts.push(`height:${heightStyle}`)
  if (maxWidthStyle) styleParts.push(`max-width:${maxWidthStyle}`)
  if (styleParts.length > 0) attrs.push(`style="${escapeHtmlAttribute(styleParts.join(';'))}"`)

  return `<img ${attrs.join(' ')} />`
}

function processNode(node: Node, inheritedStyle: StyleInfo = {}, options: MarkdownConvertOptions = {}): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || ''
    if (!text) return ''
    let result = applyTextFormatting(text, inheritedStyle)
    result = applyInlineStyles(result, inheritedStyle)
    return result
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const element = node as Element
  const tagName = element.tagName.toLowerCase()

  if (tagName === 'div' && element.classList.contains('code-block-wrapper')) {
    const code = element.querySelector('pre.editor-code-block code, pre code') as HTMLElement | null
    const codeText = extractCodeBlockText(code || element)
    const lang = detectCodeLanguage(code || element)
    return `\n\`\`\`${lang}\n${codeText}\n\`\`\`\n\n`
  }

  // Preserve formulas as standard inline math for Markdown editors.
  if (element.classList.contains('formula-inline')) {
    const latex = normalizeInlineLatex(
      element.getAttribute('data-latex') ||
      (element as HTMLElement).dataset?.latex ||
      ''
    )
    if (!latex) return ''
    // Export formula blocks in $$...$$ form for maximum compatibility across
    // markdown editors (including Typora configurations that do not render
    // inline $...$ by default).
    return `\n$$\n${latex}\n$$\n`
  }

  const style: StyleInfo = { ...inheritedStyle }
  const styleAttr = element.getAttribute('style')
  if (styleAttr) Object.assign(style, parseStyle(styleAttr))

  if (tagName === 'b' || tagName === 'strong') style.bold = true
  if (tagName === 'i' || tagName === 'em') style.italic = true
  if (tagName === 'u') style.underline = true
  if (tagName === 's' || tagName === 'del' || tagName === 'strike') style.strikethrough = true
  if (tagName === 'code') style.code = true

  const colorAttr = element.getAttribute('color')
  if (colorAttr) style.color = colorAttr
  const bgColorAttr = element.getAttribute('bgcolor')
  if (bgColorAttr) style.backgroundColor = bgColorAttr

  let childrenContent = ''
  for (const child of node.childNodes) {
    childrenContent += processNode(child, style, options)
  }

  switch (tagName) {
    case 'h1':
      return `\n# ${childrenContent.trim()}\n\n`
    case 'h2':
      return `\n## ${childrenContent.trim()}\n\n`
    case 'h3':
      return `\n### ${childrenContent.trim()}\n\n`
    case 'h4':
      return `\n#### ${childrenContent.trim()}\n\n`
    case 'h5':
      return `\n##### ${childrenContent.trim()}\n\n`
    case 'h6':
      return `\n###### ${childrenContent.trim()}\n\n`
    case 'p':
    case 'div': {
      if (!childrenContent.trim()) return '\n'
      const blockText = childrenContent.replace(/\n+$/, '')
      return `${blockText}\n\n`
    }
    case 'br':
      return '  \n'
    case 'hr':
      return '\n---\n\n'
    case 'blockquote': {
      const bqLines = childrenContent.trim().split('\n')
      return `${bqLines.map((line) => `> ${line}`).join('\n')}\n\n`
    }
    case 'ul':
    case 'ol':
      return `\n${childrenContent}\n`
    case 'li': {
      const item = childrenContent.replace(/\n+$/, '').trim()
      const parentList = element.parentElement?.tagName.toLowerCase()
      if (parentList === 'ol') {
        const siblings = Array.from(element.parentElement?.children || [])
        const index = siblings.indexOf(element) + 1
        return `${index}. ${item}\n`
      }
      return `- ${item}\n`
    }
    case 'pre': {
      const codeEl = element.querySelector('code') as HTMLElement | null
      const codeText = codeEl ? extractCodeBlockText(codeEl) : normalizeCodeBlockText(element.textContent || '')
      const lang = detectCodeLanguage(codeEl || element)
      return `\n\`\`\`${lang}\n${codeText}\n\`\`\`\n\n`
    }
    case 'a': {
      const href = element.getAttribute('href') || ''
      return `[${childrenContent || href}](${href})`
    }
    case 'img':
      return renderImageElement(element, options)
    case 'table':
      return convertTable(element)
    default:
      return childrenContent
  }
}

export function htmlToMarkdown(html: string, title: string, options: MarkdownConvertOptions = {}): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  stripEditorOnlyNodes(doc.body)

  const includeTitleHeading = options.includeTitleHeading ?? true
  let markdown = includeTitleHeading ? `# ${title}\n\n` : ''
  for (const child of doc.body.childNodes) {
    markdown += processNode(child, {}, options)
  }

  markdown = markdown
    .replace(/\*\*\s*\*\*/g, '')
    .replace(/\*\s*\*/g, '')
    .replace(/~~\s*~~/g, '')
    .replace(/<u>\s*<\/u>/g, '')
    .replace(/`\s*`/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '\n')

  return markdown
}

/**
 * Convert a Blob to a data URL string.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read blob'))
    reader.readAsDataURL(blob)
  })
}

async function resolveImageSourceToAsset(source: string, index: number): Promise<ExportBinaryAsset | null> {
  const trimmedSource = source.trim()
  if (!trimmedSource) return null

  if (trimmedSource.startsWith('http://') || trimmedSource.startsWith('https://')) {
    return null
  }

  let blob: Blob | null = null

  if (trimmedSource.startsWith('data:') || trimmedSource.startsWith('blob:')) {
    try {
      const response = await fetch(trimmedSource)
      blob = await response.blob()
    } catch {
      return null
    }
  } else {
    const { IMAGE_PROTOCOL, getImageBlob } = await import('@/store/editor-store')
    if (!trimmedSource.startsWith(IMAGE_PROTOCOL)) return null
    const imageId = trimmedSource.slice(IMAGE_PROTOCOL.length)
    try {
      const stored = await getImageBlob(imageId)
      blob = stored?.blob || null
    } catch {
      blob = null
    }
  }

  if (!blob) return null

  const dataUrl = await blobToDataUrl(blob)
  const parsed = parseDataUrl(dataUrl)
  if (!parsed) return null
  const extension = extensionFromMimeType(parsed.mimeType)

  return {
    relativePath: `assets/image-${index}.${extension}`,
    mimeType: parsed.mimeType,
    base64Data: parsed.base64Data,
  }
}

async function prepareHtmlForBinaryExport(html: string): Promise<{ html: string; assets: ExportBinaryAsset[] }> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const assets: ExportBinaryAsset[] = []

  const imageElements = Array.from(doc.body.querySelectorAll('img'))
  for (const [index, img] of imageElements.entries()) {
    const source = img.getAttribute('src') || ''
    const asset = await resolveImageSourceToAsset(source, index + 1)
    if (!asset) continue
    img.setAttribute('src', asset.relativePath)
    assets.push(asset)
  }

  return { html: doc.body.innerHTML, assets }
}

function resolveCssColor(color: string): string {
  if (typeof document === 'undefined' || !document.body) return color
  const probe = document.createElement('span')
  probe.style.color = color
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  probe.style.pointerEvents = 'none'
  document.body.appendChild(probe)
  const resolved = getComputedStyle(probe).color || color
  document.body.removeChild(probe)
  return resolved
}

function cssColorToHex(color: string | undefined): string | null {
  if (!color) return null
  const resolved = resolveCssColor(color).trim()
  if (!resolved || resolved === 'transparent' || resolved === 'inherit') return null

  const parts = resolved.match(/[\d.]+/g)
  if (!parts || parts.length < 3) return null

  const channels = parts.slice(0, 3).map((value) => Number(value))
  if (channels.some((value) => Number.isNaN(value))) return null

  const alpha = parts.length >= 4 ? Number(parts[3]) : 1
  if (!Number.isNaN(alpha) && alpha <= 0.01) return null

  const blended = channels.map((channel) => {
    if (Number.isNaN(alpha) || alpha >= 1) return channel
    return 255 * (1 - alpha) + channel * alpha
  })

  return blended
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0').toUpperCase())
    .join('')
}

function cssFontSizeToHalfPoints(fontSize: string | undefined): number | null {
  if (!fontSize) return null
  const trimmed = fontSize.trim()
  const match = trimmed.match(/^([\d.]+)(px|pt)$/i)
  if (!match) return null
  const value = Number(match[1])
  if (!Number.isFinite(value) || value <= 0) return null
  const unit = match[2].toLowerCase()
  const points = unit === 'pt' ? value : value * 0.75
  const halfPoints = Math.round(points * 2)
  return halfPoints > 0 ? halfPoints : null
}

function replaceFontWithSpan(element: Element): HTMLElement {
  const doc = element.ownerDocument
  const span = doc.createElement('span')
  Array.from(element.attributes).forEach((attribute) => {
    span.setAttribute(attribute.name, attribute.value)
  })
  while (element.firstChild) {
    span.appendChild(element.firstChild)
  }
  element.replaceWith(span)
  return span
}

function stripInlinePresentationAttrs(element: HTMLElement): void {
  element.style.removeProperty('color')
  element.style.removeProperty('background-color')
  element.style.removeProperty('background')
  element.style.removeProperty('font-size')
  if (!element.getAttribute('style')?.trim()) {
    element.removeAttribute('style')
  }
  element.removeAttribute('color')
  element.removeAttribute('bgcolor')
  element.removeAttribute('size')
}

function registerDocxInlineStyle(
  style: StyleInfo,
  registry: Map<string, DocxInlineStyleDefinition>
): string | null {
  const color = cssColorToHex(style.color)
  const backgroundColor = cssColorToHex(style.backgroundColor)
  const fontSizeHalfPoints = cssFontSizeToHalfPoints(style.fontSize)

  if (!color && !backgroundColor && !fontSizeHalfPoints) return null

  const styleKey = [color || '', backgroundColor || '', String(fontSizeHalfPoints || '')].join('|')
  const existing = registry.get(styleKey)
  if (existing) return existing.styleId

  const styleId = `PMDInlineStyle${registry.size + 1}`
  const definition: DocxInlineStyleDefinition = {
    styleId,
    ...(color ? { color } : {}),
    ...(backgroundColor ? { backgroundColor } : {}),
    ...(fontSizeHalfPoints ? { fontSizeHalfPoints } : {}),
  }
  registry.set(styleKey, definition)
  return styleId
}

function normalizeDocxCodeBlocks(doc: Document): void {
  const wrappers = Array.from(doc.body.querySelectorAll('.code-block-wrapper'))
  wrappers.forEach((wrapper) => {
    const lang = detectCodeLanguage(wrapper)
    const codeText = extractCodeBlockText(wrapper)
    const pre = doc.createElement('pre')
    const code = doc.createElement('code')
    if (lang) {
      code.className = `language-${lang} ${lang}`
      code.setAttribute('data-language', lang)
      pre.className = `language-${lang} ${lang}`
    }
    code.textContent = codeText
    pre.appendChild(code)
    wrapper.replaceWith(pre)
  })

  Array.from(doc.body.querySelectorAll('pre')).forEach((pre) => {
    const code = pre.querySelector('code')
    if (!code) return
    const lang = detectCodeLanguage(code)
    const codeText = extractCodeBlockText(code)
    code.textContent = codeText
    code.removeAttribute('data-highlighted')
    code.removeAttribute('data-highlight-theme')
    if (lang) {
      code.className = `language-${lang} ${lang}`
      code.setAttribute('data-language', lang)
      pre.className = `language-${lang} ${lang}`
    } else {
      code.removeAttribute('class')
      code.removeAttribute('data-language')
      pre.removeAttribute('class')
    }
  })
}

function replaceFormulaPlaceholders(doc: Document): void {
  Array.from(doc.body.querySelectorAll('.formula-inline')).forEach((element) => {
    const latex = normalizeInlineLatex(
      element.getAttribute('data-latex') ||
      (element as HTMLElement).dataset?.latex ||
      ''
    )
    if (!latex) {
      element.remove()
      return
    }
    element.replaceWith(doc.createTextNode(`$${latex}$`))
  })
}

function applyDocxInlineStyles(doc: Document): DocxInlineStyleDefinition[] {
  const registry = new Map<string, DocxInlineStyleDefinition>()

  Array.from(doc.body.querySelectorAll('font')).forEach((element) => {
    replaceFontWithSpan(element)
  })

  Array.from(doc.body.querySelectorAll<HTMLElement>('span, code, em, strong, b, i, u, s, del, mark, a')).forEach((element) => {
    if (element.closest('pre')) return

    const styleAttr = element.getAttribute('style')
    const style = styleAttr ? parseStyle(styleAttr) : {}
    const colorAttr = element.getAttribute('color')
    if (colorAttr) style.color = colorAttr
    const bgColorAttr = element.getAttribute('bgcolor')
    if (bgColorAttr) style.backgroundColor = bgColorAttr

    const styleId = registerDocxInlineStyle(style, registry)
    if (!styleId) return

    if (element.tagName.toLowerCase() === 'a') {
      const wrapper = doc.createElement('span')
      wrapper.setAttribute('custom-style', styleId)
      while (element.firstChild) {
        wrapper.appendChild(element.firstChild)
      }
      element.appendChild(wrapper)
      stripInlinePresentationAttrs(element)
      return
    }

    element.setAttribute('custom-style', styleId)
    stripInlinePresentationAttrs(element)
  })

  return Array.from(registry.values())
}

function buildDocxHtmlDocument(bodyHtml: string): string {
  return [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head><meta charset="utf-8" /></head>',
    `<body>${bodyHtml}</body>`,
    '</html>',
  ].join('')
}

/**
 * Resolve pmd-image:// references in HTML to data URLs for export.
 */
async function resolveImagesForExport(html: string): Promise<string> {
  const { IMAGE_PROTOCOL, getImageBlob } = await import('@/store/editor-store')
  const regex = new RegExp(`${IMAGE_PROTOCOL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([a-f0-9-]+)`, 'g')
  const matches = [...html.matchAll(regex)]
  if (matches.length === 0) return html

  const uniqueIds = [...new Set(matches.map((m) => m[1]))]
  const urlMap = new Map<string, string>()

  for (const id of uniqueIds) {
    try {
      const stored = await getImageBlob(id)
      if (stored) {
        const dataUrl = await blobToDataUrl(stored.blob)
        urlMap.set(id, dataUrl)
      }
    } catch {
      // skip unresolvable images
    }
  }

  let result = html
  for (const [id, dataUrl] of urlMap) {
    result = result.replaceAll(`${IMAGE_PROTOCOL}${id}`, dataUrl)
  }
  return result
}

/**
 * Export document with proper encoding.
 * Resolves pmd-image:// references to inline data URLs before converting.
 */
export async function downloadMarkdown(html: string, title: string): Promise<void> {
  const resolvedHtml = await resolveImagesForExport(html)
  const markdown = htmlToMarkdown(resolvedHtml, title)
  
  const blob = new Blob([markdown], { 
    type: 'text/markdown;charset=utf-8' 
  })
  
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function prepareMarkdownExportPayload(html: string, title: string): Promise<MarkdownExportPayload> {
  const prepared = await prepareHtmlForBinaryExport(html)
  const body = htmlToMarkdown(prepared.html, title, {
    includeTitleHeading: false,
    preserveImageStyles: true,
  }).trim()
  const frontMatter = [
    '---',
    `title: ${JSON.stringify(title || 'Untitled')}`,
    'lang: zh-CN',
    '---',
    '',
  ].join('\n')
  return {
    markdown: body ? `${frontMatter}${body}\n` : `${frontMatter}\n`,
    assets: prepared.assets,
  }
}

export async function prepareDocxExportPayload(html: string, title: string): Promise<DocxExportPayload> {
  const prepared = await prepareHtmlForBinaryExport(html)
  const parser = new DOMParser()
  const doc = parser.parseFromString(prepared.html, 'text/html')

  stripEditorOnlyNodes(doc.body)
  replaceFormulaPlaceholders(doc)
  normalizeDocxCodeBlocks(doc)

  Array.from(doc.body.querySelectorAll('table')).forEach((table) => {
    table.setAttribute('custom-style', 'Table')
  })

  doc.body.querySelectorAll<HTMLElement>('*').forEach((element) => {
    element.removeAttribute('contenteditable')
    element.removeAttribute('spellcheck')
  })

  const inlineStyles = applyDocxInlineStyles(doc)

  return {
    title: title || 'Untitled',
    html: buildDocxHtmlDocument(doc.body.innerHTML),
    assets: prepared.assets,
    inlineStyles,
  }
}
