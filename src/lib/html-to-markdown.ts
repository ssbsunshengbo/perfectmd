/**
 * Convert editor HTML to Markdown while preserving compatibility.
 * - Prioritizes standard markdown syntax for headings/lists/code/links/tables.
 * - Keeps unsupported styles (color/font-size/background) as inline HTML spans.
 * - Preserves code block language and line breaks.
 */

import { normalizeCodeLanguage } from './code-languages'

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

function normalizeCodeText(text: string): string {
  return text.replace(/\u200B/g, '').replace(/\r\n?/g, '\n').replace(/\n$/, '')
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

function processNode(node: Node, inheritedStyle: StyleInfo = {}): string {
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
    const codeText = normalizeCodeText(code?.textContent || '')
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
    childrenContent += processNode(child, style)
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
      const codeText = normalizeCodeText(codeEl?.textContent || element.textContent || '')
      const lang = detectCodeLanguage(codeEl || element)
      return `\n\`\`\`${lang}\n${codeText}\n\`\`\`\n\n`
    }
    case 'a': {
      const href = element.getAttribute('href') || ''
      return `[${childrenContent || href}](${href})`
    }
    case 'img': {
      const src = element.getAttribute('src') || ''
      const alt = element.getAttribute('alt') || ''
      return `![${alt}](${src})`
    }
    case 'table':
      return convertTable(element)
    default:
      return childrenContent
  }
}

export function htmlToMarkdown(html: string, title: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Remove editor-only controls before conversion.
  doc.body
    .querySelectorAll('.code-controls, .code-copy-btn, .code-wrap-toggle, .code-copy-toast, [data-copy-code-btn], [data-code-lang-select], [data-code-wrap-toggle]')
    .forEach((node) => node.remove())

  let markdown = `# ${title}\n\n`
  for (const child of doc.body.childNodes) {
    markdown += processNode(child)
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
  return {
    markdown: htmlToMarkdown(prepared.html, title),
    assets: prepared.assets,
  }
}
