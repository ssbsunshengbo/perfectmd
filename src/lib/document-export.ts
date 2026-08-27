/**
 * document-export.ts
 *
 * Utilities for saving/exporting the current document.
 *   - saveAsMarkdown  – saves as .md file via Tauri native dialog, browser fallback
 *   - exportAsPdf     – renders editor HTML to PDF and saves via native dialog
 */

import { contentToExportHtml, contentToMarkdown } from './content-format'
import { jsPDF } from 'jspdf'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeFileBaseName(name: string): string {
  return (name || 'Untitled').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Untitled'
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function browserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

// ---------------------------------------------------------------------------
// Save As Markdown
// ---------------------------------------------------------------------------

/**
 * Save the current document as a Markdown file.
 * Returns 'saved' when the file was written via Tauri, 'cancelled' when the
 * user dismissed the dialog, or 'fallback' when the browser download was used.
 */
export async function saveAsMarkdown(
  content: string,
  title: string,
): Promise<'saved' | 'cancelled' | 'fallback'> {
  const markdown = contentToMarkdown(content, title)
  const safeTitle = sanitizeFileBaseName(title)

  if (isTauriRuntime()) {
    try {
      const [{ save }, { writeTextFile }] = await Promise.all([
        import('@tauri-apps/plugin-dialog'),
        import('@tauri-apps/plugin-fs'),
      ])
      const savePath = await save({
        defaultPath: `${safeTitle}.md`,
        filters: [{ name: 'Markdown', extensions: ['md', 'txt'] }],
      })
      if (!savePath) return 'cancelled'
      await writeTextFile(savePath, markdown)
      return 'saved'
    } catch {
      // Tauri plugins not yet registered or unavailable – fall through to browser
    }
  }

  browserDownload(
    new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
    `${safeTitle}.md`,
  )
  return 'fallback'
}

// ---------------------------------------------------------------------------
// Export PDF (real text PDF, selectable/copyable)
// ---------------------------------------------------------------------------

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Unable to read image data'))
    reader.readAsDataURL(blob)
  })
}

async function resolvePdfImageSources(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'))
  if (!images.length) return

  const { getImageBlob, IMAGE_PROTOCOL } = await import('@/store/editor-store')
  for (const image of images) {
    const source = image.getAttribute('src')?.trim() || ''
    if (!source || source.startsWith('data:')) continue

    try {
      if (source.startsWith(IMAGE_PROTOCOL)) {
        const stored = await getImageBlob(source.slice(IMAGE_PROTOCOL.length))
        if (stored) image.setAttribute('src', await blobToDataUrl(stored.blob))
        continue
      }

      // Object URLs can occur in older documents. Remote images are included
      // only when their server permits CORS access.
      if (source.startsWith('blob:') || /^https?:\/\//i.test(source)) {
        const response = await fetch(source)
        if (response.ok) image.setAttribute('src', await blobToDataUrl(await response.blob()))
      }
    } catch {
      // Leave unresolved images untouched so text export still succeeds.
    }
  }
}

async function setupExportDom(content: string): Promise<HTMLElement> {
  const root = document.createElement('div')
  root.innerHTML = contentToExportHtml(content)
  root
    .querySelectorAll('.code-controls, .code-copy-btn, .code-wrap-toggle, .code-copy-toast, [data-code-lang-select], [data-code-wrap-toggle]')
    .forEach((el) => el.remove())
  root.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'))
  await resolvePdfImageSources(root)
  return root
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\u200B/g, '').replace(/\s+/g, ' ').trim()
}

type RgbColor = [number, number, number]
type InlineStyle = {
  color?: RgbColor
  backgroundColor?: RgbColor
  monospace?: boolean
  italic?: boolean
  bold?: boolean
  linkHref?: string
  fontSize?: number
  lineHeight?: number
}
type InlineSegment = { text: string; style: InlineStyle; isLineBreak?: boolean }

function parseCssColor(input: string | null | undefined): RgbColor | undefined {
  if (!input) return undefined
  const color = input.trim().toLowerCase()
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const value = hex[1]
    if (value.length === 3) {
      return [
        parseInt(value[0] + value[0], 16),
        parseInt(value[1] + value[1], 16),
        parseInt(value[2] + value[2], 16),
      ]
    }
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ]
  }
  const rgb = color.match(/^rgba?\(([^)]+)\)$/)
  if (!rgb) return undefined
  const parts = rgb[1].split(',').map((part) => Number(part.trim()))
  if (parts.length < 3 || parts.slice(0, 3).some((v) => Number.isNaN(v))) return undefined
  return [
    Math.max(0, Math.min(255, Math.round(parts[0]))),
    Math.max(0, Math.min(255, Math.round(parts[1]))),
    Math.max(0, Math.min(255, Math.round(parts[2]))),
  ]
}

function pushInlineText(segments: InlineSegment[], text: string, style: InlineStyle): void {
  const cleaned = text.replace(/\u200B/g, '')
  if (!cleaned) return
  segments.push({ text: cleaned, style })
}

function parsePxNumber(input: string | null | undefined): number | undefined {
  if (!input) return undefined
  const m = String(input).trim().match(/^([0-9]+(?:\.[0-9]+)?)px$/i)
  if (!m) return undefined
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function parseCssLineHeight(input: string | null | undefined): number | undefined {
  if (!input) return undefined
  const value = String(input).trim()
  if (!value || value === 'normal') return undefined
  const px = parsePxNumber(value)
  if (px) return px
  const unitless = Number(value)
  return Number.isFinite(unitless) && unitless > 0 ? unitless : undefined
}

function hasCjk(text: string): boolean {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(text)
}

function normalizePdfInlineText(text: string): string {
  return text.replace(/\u200B/g, '').replace(/\r/g, '').replace(/[ \t\f\v]+/g, ' ')
}

function collectInlineSegments(node: Node, inherited: InlineStyle = {}): InlineSegment[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || ''
    return text ? [{ text, style: inherited }] : []
  }
  if (!(node instanceof HTMLElement)) return []
  if (node.tagName === 'BR') return [{ text: '\n', style: inherited, isLineBreak: true }]

  const style: InlineStyle = { ...inherited }
  const nodeColor = parseCssColor(node.style.color)
  if (nodeColor) style.color = nodeColor
  const nodeBg = parseCssColor(node.style.backgroundColor)
  if (nodeBg) style.backgroundColor = nodeBg

  if (node.tagName === 'CODE') style.monospace = true
  if (node.tagName === 'EM' || node.tagName === 'I') style.italic = true
  if (node.tagName === 'STRONG' || node.tagName === 'B') style.bold = true
  if (node.tagName === 'A') {
    const href = node.getAttribute('href')?.trim()
    if (href) style.linkHref = href
  }
  const inlineFontSize = parsePxNumber(node.style.fontSize)
  if (inlineFontSize) style.fontSize = inlineFontSize
  const inlineLineHeight = parseCssLineHeight(node.style.lineHeight)
  if (inlineLineHeight) style.lineHeight = inlineLineHeight
  const weight = Number(node.style.fontWeight)
  if (node.style.fontWeight === 'bold' || (!Number.isNaN(weight) && weight >= 600)) {
    style.bold = true
  }

  if (node.classList.contains('formula-inline')) {
    const latex = (node.getAttribute('data-latex') || '').trim()
    const fallback = normalizeWhitespace(node.textContent || '')
    const formulaText = latex || fallback
    return formulaText ? [{ text: formulaText, style: { ...style, italic: true } }] : []
  }

  const segments: InlineSegment[] = []
  Array.from(node.childNodes).forEach((child) => {
    segments.push(...collectInlineSegments(child, style))
  })
  return segments
}

function splitTokenToFit(pdf: jsPDF, token: string, maxWidth: number): string[] {
  if (!token) return []
  if (pdf.getTextWidth(token) <= maxWidth) return [token]
  const result: string[] = []
  let current = ''
  for (const ch of Array.from(token)) {
    const next = `${current}${ch}`
    if (current && pdf.getTextWidth(next) > maxWidth) {
      result.push(current)
      current = ch
    } else {
      current = next
    }
  }
  if (current) result.push(current)
  return result
}

function drawInlineSegments(
  ctx: PdfCtx,
  segments: InlineSegment[],
  opts: { fontSize: number; lineHeight: number; leftIndent?: number; spacingAfter?: number },
): void {
  const leftIndent = opts.leftIndent || 0
  const baseLineStep = opts.fontSize * opts.lineHeight
  const startX = ctx.left + leftIndent
  const maxX = ctx.left + ctx.width
  const maxY = ctx.pageHeight - ctx.bottom
  let x = startX
  let y = ctx.y
  let currentLineStep = baseLineStep
  let hasDrawnAnyGlyph = false

  const ensureLocalLineSpace = () => {
    if (y + currentLineStep <= maxY) return
    ctx.pdf.addPage()
    y = ctx.top
  }

  const newLine = () => {
    y += currentLineStep
    currentLineStep = baseLineStep
    ensureLocalLineSpace()
    x = startX
  }

  ensureLocalLineSpace()

  for (const segment of segments) {
    if (segment.isLineBreak) {
      newLine()
      continue
    }
    const raw = normalizePdfInlineText(segment.text)
    if (!raw) continue
    const style = segment.style
    const effectiveFontSize = style.fontSize || opts.fontSize
    const lineFactor = style.lineHeight && style.lineHeight > 3
      ? style.lineHeight / Math.max(1, effectiveFontSize)
      : style.lineHeight || opts.lineHeight
    const segmentStep = effectiveFontSize * lineFactor
    currentLineStep = Math.max(currentLineStep, segmentStep)
    const preferItalic = !!style.italic
    const preferBold = !!style.bold
    const textColor = style.linkHref
      ? ([25, 101, 214] as RgbColor)
      : style.color || ([30, 39, 51] as RgbColor)
    const bgColor = style.backgroundColor
    const pieces = raw.split(/(\n|\s+)/)

    for (let piece of pieces) {
      if (!piece) continue
      if (piece === '\n') {
        newLine()
        continue
      }
      if (/^\s+$/.test(piece)) {
        if (x <= startX) continue
        piece = ' '
      }

      const pieceFontName = style.monospace
        ? 'courier'
        : hasCjk(piece)
          ? ctx.cjkFontName
          : ctx.latinFontName
      const canUseItalic = !(pieceFontName === ctx.cjkFontName && hasCjk(piece))
      let fontWeight: 'normal' | 'italic' | 'bold' | 'bolditalic' = 'normal'
      if (preferBold && preferItalic && canUseItalic) fontWeight = 'bolditalic'
      else if (preferBold) fontWeight = pieceFontName === ctx.cjkFontName ? 'normal' : 'bold'
      else if (preferItalic && canUseItalic) fontWeight = 'italic'
      ctx.pdf.setFont(pieceFontName, fontWeight)
      ctx.pdf.setFontSize(effectiveFontSize)
      const chunks = splitTokenToFit(ctx.pdf, piece, Math.max(12, maxX - x))

      for (const chunk of chunks) {
        const chunkWidth = ctx.pdf.getTextWidth(chunk)
        if (x + chunkWidth > maxX && x > startX) {
          newLine()
        }
        if (bgColor) {
          ctx.pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2])
          ctx.pdf.rect(x, y + 1, chunkWidth, segmentStep - 2, 'F')
        }
        ctx.pdf.setTextColor(textColor[0], textColor[1], textColor[2])
        ctx.pdf.text(chunk, x, y, { baseline: 'top' })
        if (preferBold && fontWeight === 'normal' && pieceFontName === ctx.cjkFontName) {
          // Fallback for fonts without bold face (e.g. bundled CJK regular).
          ctx.pdf.text(chunk, x + 0.35, y, { baseline: 'top' })
        }
        if (style.linkHref) {
          ctx.pdf.setDrawColor(textColor[0], textColor[1], textColor[2])
          ctx.pdf.line(x, y + segmentStep - 1.5, x + chunkWidth, y + segmentStep - 1.5)
          ctx.pdf.link(x, y, chunkWidth, segmentStep, { url: style.linkHref })
        }
        hasDrawnAnyGlyph = hasDrawnAnyGlyph || chunk.trim().length > 0
        x += chunkWidth
      }
    }
  }

  ctx.pdf.setTextColor(30, 39, 51)
  const consumedHeight = hasDrawnAnyGlyph ? currentLineStep : 0
  ctx.y = y + consumedHeight + (opts.spacingAfter ?? opts.fontSize * 0.45)
}

function collectInlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent || '').replace(/\u200B/g, '')
  if (!(node instanceof HTMLElement)) return ''
  if (node.tagName === 'BR') return '\n'
  if (node.classList.contains('formula-inline')) {
    const latex = (node.getAttribute('data-latex') || node.textContent || '').trim()
    return latex ? `$${latex}$` : ''
  }
  if (node.tagName === 'CODE') {
    return `\`${(node.textContent || '').trim()}\``
  }
  return Array.from(node.childNodes).map(collectInlineText).join('')
}

type PdfCtx = {
  pdf: jsPDF
  pageWidth: number
  pageHeight: number
  left: number
  right: number
  top: number
  bottom: number
  width: number
  y: number
  fontName: string
  latinFontName: string
  cjkFontName: string
  hasBoldFont: boolean
}

const CJK_FONT_FILE = 'LXGWWenKai-Regular.ttf'
const CJK_FONT_NAME = 'LxgwWenKai'
let cjkFontBase64Cache: string | null = null

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk)
    binary += String.fromCharCode(...slice)
  }
  return btoa(binary)
}

async function ensurePdfCjkFont(pdf: jsPDF): Promise<boolean> {
  try {
    if (!cjkFontBase64Cache) {
      const fontResponse = await fetch('/fonts/LXGWWenKai-Regular.ttf', { cache: 'force-cache' })
      if (!fontResponse.ok) return false
      const fontBuffer = await fontResponse.arrayBuffer()
      cjkFontBase64Cache = bufferToBase64(fontBuffer)
    }
    pdf.addFileToVFS(CJK_FONT_FILE, cjkFontBase64Cache)
    pdf.addFont(CJK_FONT_FILE, CJK_FONT_NAME, 'normal')
    pdf.setFont(CJK_FONT_NAME, 'normal')
    return true
  } catch {
    return false
  }
}

function ensureSpace(ctx: PdfCtx, needed: number): void {
  if (ctx.y + needed <= ctx.pageHeight - ctx.bottom) return
  ctx.pdf.addPage()
  ctx.y = ctx.top
}

function drawWrappedParagraph(
  ctx: PdfCtx,
  text: string,
  opts: { fontSize: number; lineHeight: number; leftIndent?: number; isBold?: boolean; spacingAfter?: number; fontName?: string },
): void {
  const raw = text.replace(/\r/g, '')
  const normalized = raw.split('\n').map((line) => line.replace(/[ \t\f\v]+/g, ' ').trimEnd())
  const leftIndent = opts.leftIndent || 0
  const availableWidth = Math.max(40, ctx.width - leftIndent)
  const targetFont = opts.fontName || (hasCjk(raw) ? ctx.cjkFontName : ctx.latinFontName)
  const targetWeight = opts.isBold && targetFont !== ctx.cjkFontName ? 'bold' : 'normal'
  ctx.pdf.setFont(targetFont, targetWeight)
  ctx.pdf.setFontSize(opts.fontSize)
  const step = opts.fontSize * opts.lineHeight
  normalized.forEach((line) => {
    const para = line.trim()
    if (!para) {
      ctx.y += step * 0.65
      return
    }
    const wrapped = ctx.pdf.splitTextToSize(para, availableWidth)
    ensureSpace(ctx, wrapped.length * step)
    ctx.pdf.text(wrapped, ctx.left + leftIndent, ctx.y, { baseline: 'top' })
    if (opts.isBold && targetFont === ctx.cjkFontName) {
      wrapped.forEach((segment, idx) => {
        ctx.pdf.text(segment, ctx.left + leftIndent + 0.35, ctx.y + idx * step, { baseline: 'top' })
      })
    }
    ctx.y += wrapped.length * step
  })
  ctx.y += opts.spacingAfter ?? opts.fontSize * 0.45
}

function renderTable(ctx: PdfCtx, table: HTMLTableElement): void {
  const rows = Array.from(table.querySelectorAll('tr')).map((tr) =>
    Array.from(tr.children).map((cell) => normalizeWhitespace(cell.textContent || '')),
  )
  if (!rows.length) return
  const colCount = Math.max(...rows.map((r) => r.length), 1)
  const colWidth = ctx.width / colCount
  const fontSize = 10.5
  const lineHeight = 1.35
  ctx.pdf.setFontSize(fontSize)
  const step = fontSize * lineHeight
  rows.forEach((row, rowIndex) => {
    const cellLines = row.map((cell) => {
      ctx.pdf.setFont(hasCjk(cell) ? ctx.cjkFontName : ctx.latinFontName, rowIndex === 0 && !hasCjk(cell) ? 'bold' : 'normal')
      return ctx.pdf.splitTextToSize(cell || ' ', colWidth - 10)
    })
    const rowHeight = Math.max(...cellLines.map((lines) => Math.max(1, lines.length))) * step + 8
    ensureSpace(ctx, rowHeight + 2)
    row.forEach((_, colIndex) => {
      const x = ctx.left + colIndex * colWidth
      const y = ctx.y
      if (rowIndex === 0) {
        ctx.pdf.setFillColor(238, 242, 246)
        ctx.pdf.rect(x, y, colWidth, rowHeight, 'F')
      }
      ctx.pdf.setDrawColor(207, 214, 222)
      ctx.pdf.rect(x, y, colWidth, rowHeight)
      const cell = row[colIndex] || ''
      ctx.pdf.setFont(hasCjk(cell) ? ctx.cjkFontName : ctx.latinFontName, rowIndex === 0 && !hasCjk(cell) ? 'bold' : 'normal')
      ctx.pdf.text(cellLines[colIndex], x + 5, y + 5, { baseline: 'top' })
    })
    ctx.y += rowHeight
  })
  ctx.y += 10
}

function renderList(ctx: PdfCtx, listEl: HTMLElement, level = 0): void {
  const items = Array.from(listEl.children).filter((el): el is HTMLLIElement => el.tagName === 'LI')
  items.forEach((item, index) => {
    const marker = listEl.tagName === 'OL' ? `${index + 1}.` : '•'
    const itemTextParts: string[] = []
    item.childNodes.forEach((child) => {
      if (child instanceof HTMLElement && (child.tagName === 'UL' || child.tagName === 'OL')) return
      itemTextParts.push(collectInlineText(child))
    })
    const itemText = normalizeWhitespace(itemTextParts.join(' '))
    drawWrappedParagraph(ctx, `${marker} ${itemText}`, {
      fontSize: 12,
      lineHeight: 1.5,
      leftIndent: level * 16,
      spacingAfter: 2,
    })
    Array.from(item.children).forEach((child) => {
      if ((child.tagName === 'UL' || child.tagName === 'OL') && child instanceof HTMLElement) {
        renderList(ctx, child, level + 1)
      }
    })
  })
  ctx.y += 4
}

function parseImageDimension(value: string | null | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function getPdfImageFormat(source: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (/^data:image\/jpe?g/i.test(source)) return 'JPEG'
  if (/^data:image\/webp/i.test(source)) return 'WEBP'
  return 'PNG'
}

function renderImage(ctx: PdfCtx, image: HTMLImageElement): void {
  const source = image.getAttribute('src')?.trim() || ''
  if (!source.startsWith('data:image/')) return

  try {
    const properties = ctx.pdf.getImageProperties(source)
    const intrinsicWidth = Number(properties.width) || 1
    const intrinsicHeight = Number(properties.height) || 1
    const requestedWidth = parseImageDimension(image.style.width) || parseImageDimension(image.getAttribute('width'))
    const requestedHeight = parseImageDimension(image.style.height) || parseImageDimension(image.getAttribute('height'))
    const storedRatio = parseImageDimension(image.getAttribute('data-pmd-ratio')) || parseImageDimension(image.getAttribute('alt')) || 1
    const scale = Math.max(0.1, Math.min(4, storedRatio))

    let width = requestedWidth ? requestedWidth * 0.75 : Math.min(ctx.width, intrinsicWidth * 0.75) * scale
    let height = requestedHeight ? requestedHeight * 0.75 : width * (intrinsicHeight / intrinsicWidth)
    if (requestedWidth && !requestedHeight) height = width * (intrinsicHeight / intrinsicWidth)
    if (requestedHeight && !requestedWidth) width = height * (intrinsicWidth / intrinsicHeight)

    const maxImageHeight = ctx.pageHeight - ctx.top - ctx.bottom
    const shrink = Math.min(1, ctx.width / Math.max(width, 1), maxImageHeight / Math.max(height, 1))
    width *= shrink
    height *= shrink
    ensureSpace(ctx, height + 12)
    ctx.pdf.addImage(source, getPdfImageFormat(source), ctx.left, ctx.y, width, height, undefined, 'FAST')
    ctx.y += height + 12
  } catch {
    // Unsupported image data should not make the rest of the PDF unavailable.
  }
}

function renderNode(ctx: PdfCtx, node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = normalizeWhitespace(node.textContent || '')
    if (text) {
      drawWrappedParagraph(ctx, text, { fontSize: 12.5, lineHeight: 1.6 })
    }
    return
  }
  if (!(node instanceof HTMLElement)) return

  const tag = node.tagName
  if (tag === 'P') {
    const nestedList = node.querySelector(':scope > ul, :scope > ol')
    const paragraphSegments: InlineSegment[] = []
    const flushParagraphText = () => {
      if (!paragraphSegments.length) return
      drawInlineSegments(ctx, paragraphSegments, { fontSize: 12.5, lineHeight: 1.64, spacingAfter: 8 })
      paragraphSegments.length = 0
    }

    Array.from(node.childNodes).forEach((child) => {
      if (child instanceof HTMLElement && (child.tagName === 'UL' || child.tagName === 'OL')) return
      if (child instanceof HTMLElement && child.tagName === 'IMG') {
        // Markdown images are commonly emitted inside a paragraph by marked.
        // Flush surrounding text first so the image keeps its document order.
        flushParagraphText()
        renderImage(ctx, child as HTMLImageElement)
        return
      }
      paragraphSegments.push(...collectInlineSegments(child))
    })
    flushParagraphText()
    if (nestedList instanceof HTMLElement) renderList(ctx, nestedList)
    return
  }
  if (tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6') {
    const level = Number(tag.substring(1))
    const sizeMap = [0, 24, 20, 17, 15, 14, 13]
    drawWrappedParagraph(ctx, normalizeWhitespace(node.textContent || ''), {
      fontSize: sizeMap[level] || 13,
      lineHeight: 1.35,
      isBold: true,
      spacingAfter: 8,
    })
    return
  }
  if (tag === 'UL' || tag === 'OL') {
    renderList(ctx, node)
    return
  }
  if (tag === 'PRE') {
    const codeText = (node.textContent || '').replace(/\u200B/g, '')
    const lines = codeText.split('\n')
    const fontSize = 10.5
    const lineStep = fontSize * 1.45
    const boxHeight = Math.max(lineStep + 10, lines.length * lineStep + 10)
    ensureSpace(ctx, boxHeight + 10)
    ctx.pdf.setFillColor(248, 250, 252)
    ctx.pdf.setDrawColor(211, 217, 224)
    ctx.pdf.roundedRect(ctx.left, ctx.y, ctx.width, boxHeight, 4, 4, 'FD')
    ctx.pdf.setFont(hasCjk(codeText) ? ctx.cjkFontName : 'courier', 'normal')
    ctx.pdf.setFontSize(fontSize)
    const wrapped = ctx.pdf.splitTextToSize(codeText || ' ', ctx.width - 12)
    ctx.pdf.text(wrapped, ctx.left + 6, ctx.y + 6, { baseline: 'top' })
    ctx.y += boxHeight + 10
    return
  }
  if (tag === 'TABLE') {
    renderTable(ctx, node as HTMLTableElement)
    return
  }
  if (tag === 'IMG') {
    renderImage(ctx, node as HTMLImageElement)
    return
  }
  if (tag === 'HR') {
    ensureSpace(ctx, 12)
    ctx.pdf.setDrawColor(220, 225, 232)
    ctx.pdf.line(ctx.left, ctx.y + 4, ctx.left + ctx.width, ctx.y + 4)
    ctx.y += 12
    return
  }
  if (tag === 'BLOCKQUOTE') {
    const quoteText = normalizeWhitespace(node.textContent || '')
    ensureSpace(ctx, 24)
    ctx.pdf.setDrawColor(180, 192, 208)
    ctx.pdf.line(ctx.left + 1, ctx.y, ctx.left + 1, ctx.y + 18)
    drawWrappedParagraph(ctx, quoteText, {
      fontSize: 12,
      lineHeight: 1.55,
      leftIndent: 10,
      spacingAfter: 8,
    })
    return
  }
  if (node.classList.contains('formula-inline')) {
    const latex = (node.getAttribute('data-latex') || '').trim()
    const text = latex || normalizeWhitespace(node.textContent || '')
    if (text) {
      drawWrappedParagraph(ctx, text, {
        fontSize: 12,
        lineHeight: 1.5,
        spacingAfter: 8,
      })
    }
    return
  }

  Array.from(node.childNodes).forEach((child) => renderNode(ctx, child))
}

type ExportPdfResult = 'saved' | 'cancelled' | 'fallback'

export async function exportAsPdf(
  content: string,
  title: string,
): Promise<ExportPdfResult> {
  const safeTitle = sanitizeFileBaseName(title)

  try {
    const root = await setupExportDom(content)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true,
    })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const ctx: PdfCtx = {
      pdf,
      pageWidth,
      pageHeight,
      left: 42,
      right: 42,
      top: 42,
      bottom: 42,
      width: pageWidth - 84,
      y: 42,
      fontName: 'helvetica',
      latinFontName: 'helvetica',
      cjkFontName: 'helvetica',
      hasBoldFont: true,
    }
    const useCjkFont = await ensurePdfCjkFont(pdf)
    if (useCjkFont) {
      ctx.cjkFontName = CJK_FONT_NAME
    }
    renderNode(ctx, root)

    const pdfBytes = pdf.output('arraybuffer')
    const fileName = `${safeTitle}.pdf`

    if (isTauriRuntime()) {
      try {
        const [{ save }, { writeFile }] = await Promise.all([
          import('@tauri-apps/plugin-dialog'),
          import('@tauri-apps/plugin-fs'),
        ])
        const savePath = await save({
          defaultPath: fileName,
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        })
        if (!savePath) return 'cancelled'
        await writeFile(savePath, new Uint8Array(pdfBytes))
        return 'saved'
      } catch {
        return 'fallback'
      }
    }

    browserDownload(new Blob([pdfBytes], { type: 'application/pdf' }), fileName)
    return 'saved'
  } catch {
    return 'fallback'
  }
}
