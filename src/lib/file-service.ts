// File system service - works in both Web and Tauri environments
import { htmlToMarkdown } from './html-to-markdown'

export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size?: number
  modifiedAt?: string
}

export interface DirectoryContent {
  path: string
  files: FileInfo[]
}

// Check if running in Tauri
export const isTauri = (): boolean => {
  if (typeof window === 'undefined') return false
  return '__TAURI__' in window || '__TAURI_INTERNALS__' in window
}

// Convert Markdown to HTML for the rich text editor
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '<p><br></p>'
  
  const lines = markdown.split('\n')
  const htmlParts: string[] = []
  let inCodeBlock = false
  let codeContent: string[] = []
  let codeLanguage = ''
  let inList = false
  let listType = ''
  let listItems: string[] = []
  let inBlockquote = false
  let blockquoteLines: string[] = []
  
  const processInline = (text: string): string => {
    return text
      // Escape HTML entities first
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Bold **text** or __text__
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      // Italic *text* or _text_ (not preceded by * or _)
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
      .replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>')
      // Strikethrough ~~text~~
      .replace(/~~(.+?)~~/g, '<s>$1</s>')
      // Underline ++text++
      .replace(/\+\+(.+?)\+\+/g, '<u>$1</u>')
      // Inline code `text`
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      // Links [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      // Images ![alt](url)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
  }
  
  const flushList = () => {
    if (inList && listItems.length > 0) {
      const tag = listType === 'ul' ? 'ul' : 'ol'
      htmlParts.push(`<${tag}>${listItems.map(item => `<li>${item}</li>`).join('')}</${tag}>`)
      listItems = []
      inList = false
      listType = ''
    }
  }
  
  const flushBlockquote = () => {
    if (inBlockquote && blockquoteLines.length > 0) {
      htmlParts.push(`<blockquote>${blockquoteLines.join('<br>')}</blockquote>`)
      blockquoteLines = []
      inBlockquote = false
    }
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Code block with language
    const codeBlockMatch = line.match(/^```(\w*)$/)
    if (codeBlockMatch) {
      if (inCodeBlock) {
        htmlParts.push(`<pre><code>${codeContent.join('\n')}</code></pre>`)
        codeContent = []
        codeLanguage = ''
        inCodeBlock = false
      } else {
        flushList()
        flushBlockquote()
        inCodeBlock = true
        codeLanguage = codeBlockMatch[1] || ''
      }
      continue
    }
    
    if (inCodeBlock) {
      codeContent.push(line.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
      continue
    }
    
    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushList()
      flushBlockquote()
      htmlParts.push('<hr>')
      continue
    }
    
    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      flushList()
      flushBlockquote()
      const level = headingMatch[1].length
      const text = processInline(headingMatch[2])
      htmlParts.push(`<h${level}>${text}</h${level}>`)
      continue
    }
    
    // Blockquote
    if (line.startsWith('> ')) {
      flushList()
      inBlockquote = true
      const text = processInline(line.substring(2))
      blockquoteLines.push(text)
      continue
    }
    
    // Unordered list
    const ulMatch = line.match(/^[-*+]\s+(.+)$/)
    if (ulMatch) {
      flushBlockquote()
      if (!inList || listType !== 'ul') {
        flushList()
        inList = true
        listType = 'ul'
      }
      listItems.push(processInline(ulMatch[1]))
      continue
    }
    
    // Ordered list
    const olMatch = line.match(/^(\d+)\.\s+(.+)$/)
    if (olMatch) {
      flushBlockquote()
      if (!inList || listType !== 'ol') {
        flushList()
        inList = true
        listType = 'ol'
      }
      listItems.push(processInline(olMatch[2]))
      continue
    }
    
    // Empty line
    if (line.trim() === '') {
      flushList()
      flushBlockquote()
      continue
    }
    
    // Regular paragraph
    flushList()
    flushBlockquote()
    const text = processInline(line)
    htmlParts.push(`<p>${text}</p>`)
  }
  
  // Flush remaining content
  flushList()
  flushBlockquote()
  
  // Handle code block not closed
  if (inCodeBlock && codeContent.length > 0) {
    htmlParts.push(`<pre><code>${codeContent.join('\n')}</code></pre>`)
  }
  
  return htmlParts.length > 0 ? htmlParts.join('') : '<p><br></p>'
}

// Import MD file
export async function importMarkdownFile(): Promise<{ content: string; name: string; isHtml: boolean } | null> {
  if (isTauri()) {
    return importMarkdownFileTauri()
  } else {
    return importMarkdownFileWeb()
  }
}

async function importMarkdownFileWeb(): Promise<{ content: string; name: string; isHtml: boolean } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.md,.markdown,.txt'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      const markdown = await file.text()
      const html = markdownToHtml(markdown)
      resolve({ content: html, name: file.name.replace(/\.(md|markdown|txt)$/, ''), isHtml: true })
    }
    input.click()
  })
}

async function importMarkdownFileTauri(): Promise<{ content: string; name: string; isHtml: boolean } | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const { readFile } = await import('@tauri-apps/plugin-fs')

    const selected = await open({
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    })

    if (!selected || typeof selected !== 'string') {
      return null
    }

    const content = await readFile(selected)
    const decoder = new TextDecoder()
    const markdown = decoder.decode(content)
    const html = markdownToHtml(markdown)

    const name = selected.split(/[/\\]/).pop()?.replace(/\.(md|markdown|txt)$/, '') || 'Untitled'

    return { content: html, name, isHtml: true }
  } catch (error) {
    console.error('Failed to import file:', error)
    return null
  }
}

// Export to PDF - with path selection and Chinese support
export async function exportToPdf(title: string, content: string): Promise<boolean> {
  try {
    const html2pdf = (await import('html2pdf.js')).default
    
    // Create a completely isolated container
    const container = document.createElement('div')
    container.id = 'pdf-export-container'
    container.style.cssText = `
      position: fixed;
      left: -9999px;
      top: 0;
      width: 210mm;
      background: #ffffff;
      font-family: "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "WenQuanYi Micro Hei", sans-serif;
      color: #333333;
      padding: 20mm;
      box-sizing: border-box;
    `
    
    // Add internal styles (no external CSS, no oklch/lab colors)
    const styleEl = document.createElement('style')
    styleEl.textContent = `
      * { all: initial; }
      * { box-sizing: border-box; display: block; }
      html, body, div { display: block; }
      h1 { font-size: 24pt; font-weight: bold; margin: 0 0 20pt 0; padding-bottom: 10pt; border-bottom: 2px solid #333333; display: block; }
      h2 { font-size: 18pt; font-weight: bold; margin: 20pt 0 10pt 0; display: block; }
      h3 { font-size: 14pt; font-weight: bold; margin: 15pt 0 8pt 0; display: block; }
      h4 { font-size: 12pt; font-weight: bold; margin: 10pt 0 5pt 0; display: block; }
      p { margin: 10pt 0; line-height: 1.6; display: block; }
      ul { margin: 10pt 0; padding-left: 20pt; display: block; }
      ol { margin: 10pt 0; padding-left: 20pt; display: block; }
      li { margin: 5pt 0; display: list-item; }
      blockquote { margin: 15pt 0; padding: 10pt 15pt; border-left: 4px solid #666666; background: #f5f5f5; display: block; }
      code { font-family: "Fira Code", Consolas, Monaco, monospace; background: #f0f0f0; padding: 2pt 6pt; border-radius: 3pt; font-size: 10pt; display: inline; }
      pre { margin: 15pt 0; padding: 15pt; background: #2d2d2d; color: #f8f8f2; border-radius: 5pt; overflow-x: auto; display: block; }
      pre code { background: transparent; color: inherit; padding: 0; }
      table { width: 100%; border-collapse: collapse; margin: 15pt 0; display: table; }
      th { border: 1px solid #cccccc; padding: 8pt; background: #f5f5f5; font-weight: bold; display: table-cell; }
      td { border: 1px solid #cccccc; padding: 8pt; display: table-cell; }
      a { color: #0066cc; text-decoration: underline; display: inline; }
      strong, b { font-weight: bold; display: inline; }
      em, i { font-style: italic; display: inline; }
      hr { border: none; border-top: 1px solid #cccccc; margin: 20pt 0; display: block; }
      img { max-width: 100%; display: block; }
      br { display: block; }
    `
    container.appendChild(styleEl)
    
    // Create content wrapper
    const contentWrapper = document.createElement('div')
    contentWrapper.style.cssText = 'font-family: "PingFang SC", "Microsoft YaHei", sans-serif; color: #333333; background: #ffffff;'
    
    // Add title
    const titleEl = document.createElement('h1')
    titleEl.textContent = title
    contentWrapper.appendChild(titleEl)
    
    // Clean and add content
    const cleanedHtml = cleanHtmlForPdf(content)
    const contentEl = document.createElement('div')
    contentEl.innerHTML = cleanedHtml
    contentWrapper.appendChild(contentEl)
    
    container.appendChild(contentWrapper)
    document.body.appendChild(container)
    
    // PDF options
    const opt = {
      margin: [20, 20, 20, 20],
      filename: `${title}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { 
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 800,
        backgroundColor: '#ffffff',
        // Ignore certain CSS properties
        onclone: (clonedDoc: Document) => {
          // Remove all stylesheets from cloned document
          const styleSheets = clonedDoc.querySelectorAll('link[rel="stylesheet"], style:not(#pdf-export-container style)')
          styleSheets.forEach(el => el.remove())
          
          // Remove all class and style attributes from all elements
          const allElements = clonedDoc.querySelectorAll('*')
          allElements.forEach((el: Element) => {
            el.removeAttribute('class')
            // Only keep safe inline styles
            const style = el.getAttribute('style')
            if (style) {
              const safeStyles = ['font-weight', 'font-style', 'text-decoration', 'text-align']
              let newStyle = ''
              safeStyles.forEach(s => {
                const match = style.match(new RegExp(s + '\\s*:\\s*([^;]+)', 'i'))
                if (match) {
                  newStyle += `${s}:${match[1]};`
                }
              })
              if (newStyle) {
                el.setAttribute('style', newStyle)
              } else {
                el.removeAttribute('style')
              }
            }
          })
        }
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait' 
      }
    }
    
    // Generate PDF as blob
    const pdfBlob = await html2pdf().set(opt).from(container).outputPdf('blob')
    
    // Clean up container
    document.body.removeChild(container)
    
    // In Tauri, use save dialog to select path
    if (isTauri()) {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeBinaryFile } = await import('@tauri-apps/plugin-fs')
      
      const filePath = await save({
        defaultPath: `${title}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })
      
      if (!filePath) {
        return false // User cancelled
      }
      
      // Convert blob to ArrayBuffer
      const arrayBuffer = await pdfBlob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      
      await writeBinaryFile(filePath, uint8Array)
      return true
    } else {
      // In web, trigger download
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      return true
    }
  } catch (error) {
    console.error('Failed to export PDF:', error)
    throw error
  }
}

// Escape HTML text
function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Clean HTML content for PDF export
function cleanHtmlForPdf(html: string): string {
  // Remove style attributes that might contain problematic colors
  let cleaned = html.replace(/\s*style\s*=\s*["'][^"']*["']/gi, (match) => {
    // Only keep basic styles that are safe
    const safeStyles = ['font-weight', 'font-style', 'text-decoration', 'text-align']
    let result = ''
    safeStyles.forEach(style => {
      const regex = new RegExp(style + '\\s*:\\s*([^;]+)', 'i')
      const m = match.match(regex)
      if (m) {
        result += `${style}:${m[1]};`
      }
    })
    return result ? ` style="${result}"` : ''
  })
  
  // Remove class attributes (they might apply problematic CSS)
  cleaned = cleaned.replace(/\s*class\s*=\s*["'][^"']*["']/gi, '')
  
  return cleaned
}

// Save markdown file
export async function saveMarkdownFile(
  content: string,
  defaultName: string
): Promise<string | null> {
  if (isTauri()) {
    return saveMarkdownFileTauri(content, defaultName)
  } else {
    return saveMarkdownFileWeb(content, defaultName)
  }
}

async function saveMarkdownFileWeb(content: string, defaultName: string): Promise<string | null> {
  try {
    // Convert HTML content to Markdown format for compatibility
    const markdownContent = htmlToMarkdown(content)
    
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${defaultName}.md`
    a.click()
    URL.revokeObjectURL(url)
    return defaultName
  } catch (error) {
    console.error('Failed to save file:', error)
    return null
  }
}

async function saveMarkdownFileTauri(
  content: string,
  defaultName: string
): Promise<string | null> {
  try {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')

    console.log('Opening save dialog...')
    const filePath = await save({
      defaultPath: `${defaultName}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })

    if (!filePath) {
      console.log('Save dialog cancelled by user')
      return null
    }

    console.log('User selected path:', filePath)

    // Convert HTML content to Markdown format for compatibility
    const markdownContent = htmlToMarkdown(content)
    
    // Use writeTextFile for simpler string content handling
    await writeTextFile(filePath, markdownContent)
    
    console.log('File saved successfully:', filePath)
    return filePath
  } catch (error) {
    console.error('Failed to save file:', error)
    // Handle Tauri errors which may not be standard Error objects
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'string' 
        ? error 
        : JSON.stringify(error)
    throw new Error(`Save failed: ${errorMessage}`)
  }
}

// Directory management (Tauri only)
export async function openDirectory(): Promise<string | null> {
  if (!isTauri()) {
    alert('Directory management is only available in the desktop app')
    return null
  }

  try {
    const { open } = await import('@tauri-apps/plugin-dialog')

    const selected = await open({
      directory: true,
      multiple: false,
    })

    if (!selected || typeof selected !== 'string') {
      return null
    }

    return selected
  } catch (error) {
    console.error('Failed to open directory:', error)
    return null
  }
}

export async function readDirectory(dirPath: string): Promise<FileInfo[] | null> {
  if (!isTauri()) {
    return null
  }

  try {
    const { readDir } = await import('@tauri-apps/plugin-fs')

    const entries = await readDir(dirPath)
    const files: FileInfo[] = entries.map((entry) => ({
      name: entry.name,
      path: `${dirPath}/${entry.name}`,
      isDirectory: entry.isDirectory,
    }))

    // Sort: directories first, then by name
    files.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })

    return files
  } catch (error) {
    console.error('Failed to read directory:', error)
    return null
  }
}

export async function readFileContent(filePath: string): Promise<string | null> {
  if (!isTauri()) {
    return null
  }

  try {
    const { readFile } = await import('@tauri-apps/plugin-fs')

    const content = await readFile(filePath)
    const decoder = new TextDecoder()
    return decoder.decode(content)
  } catch (error) {
    console.error('Failed to read file:', error)
    return null
  }
}

export async function saveFileToPath(
  filePath: string,
  content: string
): Promise<boolean> {
  if (!isTauri()) {
    return false
  }

  try {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    
    // Convert HTML to Markdown for .md files
    let contentToSave = content || ''
    if (filePath.endsWith('.md')) {
      contentToSave = htmlToMarkdown(content)
    }
    
    await writeTextFile(filePath, contentToSave)
    return true
  } catch (error) {
    console.error('Failed to save file:', error)
    return false
  }
}

export async function createFile(
  dirPath: string,
  fileName: string,
  content: string = ''
): Promise<string | null> {
  if (!isTauri()) {
    return null
  }

  try {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')

    const filePath = `${dirPath}/${fileName}`
    
    // Convert HTML to Markdown for .md files
    let contentToSave = content
    if (fileName.endsWith('.md')) {
      contentToSave = htmlToMarkdown(content)
    }
    
    await writeTextFile(filePath, contentToSave)

    return filePath
  } catch (error) {
    console.error('Failed to create file:', error)
    return null
  }
}

// Generate printable HTML
function generatePrintableHtml(title: string, markdown: string): string {
  // Simple markdown to HTML conversion for printing
  const html = markdown
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`(.*?)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Lists
    .replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
    }
    h1, h2, h3 { margin-top: 1.5em; margin-bottom: 0.5em; }
    h1 { font-size: 2em; border-bottom: 2px solid #eee; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 8px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    a { color: #667eea; text-decoration: none; }
    li { margin: 0.5em 0; }
    blockquote { border-left: 4px solid #667eea; padding-left: 1em; margin-left: 0; color: #666; }
    @media print {
      body { margin: 0; padding: 20px; }
      a { color: inherit; }
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>${html}</p>
</body>
</html>
  `
}
