/**
 * document-export.ts
 *
 * Utilities for saving/exporting the current document.
 *   - saveAsMarkdown  – saves as .md file via Tauri native dialog, browser fallback
 *   - exportAsPdf     – renders editor HTML to PDF and saves via native dialog
 */

import { htmlToMarkdown } from './html-to-markdown'

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
  const markdown = htmlToMarkdown(content, title)
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
// Export PDF (text-based print flow)
// ---------------------------------------------------------------------------

const PRINT_ROOT_ID = 'pmd-print-root'
const PRINT_STYLE_ID = 'pmd-print-style'
const PRINTING_CLASS = 'pmd-printing'

const PRINT_CSS = `
@page {
  size: A4;
  margin: 18mm 15mm 18mm 15mm;
}

@media print {
  body.${PRINTING_CLASS} > *:not(#${PRINT_ROOT_ID}) {
    display: none !important;
  }

  body.${PRINTING_CLASS} {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }
}

#${PRINT_ROOT_ID} {
  color: #1e2733;
  font-size: 13.5px;
  line-height: 1.68;
  font-family:
    'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Microsoft JhengHei',
    'Noto Sans CJK SC', 'Source Han Sans SC', 'WenQuanYi Micro Hei',
    'Helvetica Neue', Arial, sans-serif;
  background: #fff;
}

#${PRINT_ROOT_ID} * {
  box-shadow: none !important;
  text-shadow: none !important;
}

#${PRINT_ROOT_ID} p {
  margin: 0 0 0.72em !important;
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
}

#${PRINT_ROOT_ID} h1,
#${PRINT_ROOT_ID} h2,
#${PRINT_ROOT_ID} h3,
#${PRINT_ROOT_ID} h4,
#${PRINT_ROOT_ID} h5,
#${PRINT_ROOT_ID} h6 {
  margin: 1.05em 0 0.42em !important;
  padding: 0 !important;
  border: 0 !important;
  line-height: 1.34 !important;
  background: transparent !important;
  color: #132031 !important;
}

#${PRINT_ROOT_ID} h1 { font-size: 2em !important; }
#${PRINT_ROOT_ID} h2 { font-size: 1.62em !important; }
#${PRINT_ROOT_ID} h3 { font-size: 1.33em !important; }

#${PRINT_ROOT_ID} ul,
#${PRINT_ROOT_ID} ol {
  margin: 0.35em 0 0.72em !important;
  padding-left: 1.45em !important;
}

#${PRINT_ROOT_ID} pre {
  margin: 0.58em 0 0.9em !important;
  padding: 0.62em 0.72em !important;
  border: 1px solid #d3d9e0 !important;
  border-radius: 6px !important;
  background: #f8fafc !important;
  white-space: pre-wrap !important;
  overflow-wrap: anywhere !important;
  word-break: break-word !important;
  font-size: 12px !important;
  line-height: 1.5 !important;
  page-break-inside: avoid !important;
}

#${PRINT_ROOT_ID} table {
  width: 100% !important;
  border-collapse: collapse !important;
  margin: 0.65em 0 0.95em !important;
  table-layout: fixed !important;
  page-break-inside: avoid !important;
}

#${PRINT_ROOT_ID} th,
#${PRINT_ROOT_ID} td {
  border: 1px solid #cfd6de !important;
  padding: 6px 8px !important;
  text-align: left !important;
  vertical-align: top !important;
  overflow-wrap: anywhere !important;
}

#${PRINT_ROOT_ID} th {
  background: #eef2f6 !important;
}

#${PRINT_ROOT_ID} .formula-inline {
  border: 0 !important;
  background: transparent !important;
  padding: 0 !important;
}

#${PRINT_ROOT_ID} .katex-display {
  margin: 0.45em 0 !important;
}

#${PRINT_ROOT_ID} .code-controls,
#${PRINT_ROOT_ID} .code-copy-btn,
#${PRINT_ROOT_ID} .code-copy-toast,
#${PRINT_ROOT_ID} [data-code-lang-select] {
  display: none !important;
}
`

function setupPrintDom(content: string): { root: HTMLElement; styleEl: HTMLStyleElement } {
  const oldRoot = document.getElementById(PRINT_ROOT_ID)
  if (oldRoot) oldRoot.remove()
  const oldStyle = document.getElementById(PRINT_STYLE_ID)
  if (oldStyle) oldStyle.remove()

  const styleEl = document.createElement('style')
  styleEl.id = PRINT_STYLE_ID
  styleEl.textContent = PRINT_CSS
  document.head.appendChild(styleEl)

  const root = document.createElement('div')
  root.id = PRINT_ROOT_ID
  root.innerHTML = content
  root.querySelectorAll('.code-controls, .code-copy-btn, .code-copy-toast, [data-code-lang-select]').forEach((el) => el.remove())
  root.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'))
  document.body.appendChild(root)
  document.body.classList.add(PRINTING_CLASS)
  return { root, styleEl }
}

function cleanupPrintDom(root: HTMLElement, styleEl: HTMLStyleElement): void {
  document.body.classList.remove(PRINTING_CLASS)
  if (root.parentNode) root.remove()
  if (styleEl.parentNode) styleEl.remove()
}

type ExportPdfResult = 'saved' | 'cancelled' | 'fallback'

export async function exportAsPdf(
  content: string,
  title: string,
): Promise<ExportPdfResult> {
  const safeTitle = sanitizeFileBaseName(title)
  const prevTitle = document.title
  document.title = safeTitle
  const { root, styleEl } = setupPrintDom(content)

  try {
    const finished = await new Promise<boolean>((resolve) => {
      let settled = false
      const done = (ok: boolean) => {
        if (settled) return
        settled = true
        window.removeEventListener('afterprint', afterPrint)
        resolve(ok)
      }
      const afterPrint = () => done(true)
      window.addEventListener('afterprint', afterPrint, { once: true })
      // If runtime does not fire afterprint, still unblock and cleanup.
      window.setTimeout(() => done(false), 4000)
      // Important: call print synchronously from click-chain for Tauri/WebView.
      window.print()
    })
    if (!finished) return 'fallback'
    return 'saved'
  } catch {
    return 'fallback'
  } finally {
    window.setTimeout(() => {
      cleanupPrintDom(root, styleEl)
      document.title = prevTitle
    }, 100)
  }
}
