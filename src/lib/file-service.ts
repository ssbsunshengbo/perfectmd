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

// Export to PDF - uses system print dialog
export async function exportToPdf(title: string, content: string): Promise<boolean> {
  try {
    // Convert HTML content to Markdown
    const markdownContent = htmlToMarkdown(content)
    
    // Generate printable HTML with proper styling
    const printHtml = generatePrintableHtml(title, markdownContent)
    
    // Create a hidden iframe for printing
    const printFrame = document.createElement('iframe')
    printFrame.style.position = 'fixed'
    printFrame.style.right = '0'
    printFrame.style.bottom = '0'
    printFrame.style.width = '0'
    printFrame.style.height = '0'
    printFrame.style.border = 'none'
    printFrame.style.opacity = '0'
    
    document.body.appendChild(printFrame)
    
    const printDoc = printFrame.contentDocument || printFrame.contentWindow?.document
    
    if (!printDoc) {
      document.body.removeChild(printFrame)
      return false
    }
    
    printDoc.open()
    printDoc.write(printHtml)
    printDoc.close()
    
    // Wait for content to load then print
    return new Promise((resolve) => {
      const doPrint = () => {
        try {
          printFrame.contentWindow?.focus()
          printFrame.contentWindow?.print()
          
          // Clean up after print dialog opens
          setTimeout(() => {
            try {
              document.body.removeChild(printFrame)
            } catch (e) {}
          }, 1000)
          
          resolve(true)
        } catch (e) {
          console.error('Print failed:', e)
          try {
            document.body.removeChild(printFrame)
          } catch (err) {}
          resolve(false)
        }
      }
      
      // Wait for iframe to load
      printFrame.onload = () => {
        setTimeout(doPrint, 100)
      }
      
      // Fallback if onload doesn't fire
      setTimeout(() => {
        if (printFrame.parentNode) {
          doPrint()
        }
      }, 500)
    })
  } catch (error) {
    console.error('Failed to export PDF:', error)
    throw error
  }
}

// Generate printable HTML with proper Chinese font support
function generatePrintableHtml(title: string, markdown: string): string {
  // Convert markdown to HTML with proper formatting
  const htmlContent = markdownToHtmlForPrint(markdown)
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "WenQuanYi Micro Hei", sans-serif;
      font-size: 12pt;
      line-height: 1.8;
      color: #333;
      max-width: 210mm;
      margin: 0 auto;
      padding: 20mm;
      background: white;
    }
    
    h1 {
      font-size: 24pt;
      font-weight: bold;
      margin-bottom: 20pt;
      color: #111;
      padding-bottom: 10pt;
      border-bottom: 2px solid #333;
    }
    
    h2 {
      font-size: 18pt;
      font-weight: bold;
      margin-top: 20pt;
      margin-bottom: 10pt;
      color: #222;
    }
    
    h3 {
      font-size: 14pt;
      font-weight: bold;
      margin-top: 15pt;
      margin-bottom: 8pt;
      color: #333;
    }
    
    p {
      margin: 10pt 0;
      text-align: justify;
    }
    
    ul, ol {
      margin: 10pt 0;
      padding-left: 20pt;
    }
    
    li {
      margin: 5pt 0;
    }
    
    blockquote {
      margin: 15pt 0;
      padding: 10pt 15pt;
      border-left: 4px solid #666;
      background: #f5f5f5;
      color: #555;
    }
    
    code {
      font-family: "SF Mono", "Fira Code", Consolas, Monaco, monospace;
      background: #f0f0f0;
      padding: 2pt 6pt;
      border-radius: 3pt;
      font-size: 10pt;
    }
    
    pre {
      margin: 15pt 0;
      padding: 15pt;
      background: #2d2d2d;
      color: #f8f8f2;
      border-radius: 5pt;
      overflow-x: auto;
      font-family: "SF Mono", "Fira Code", Consolas, Monaco, monospace;
      font-size: 10pt;
      line-height: 1.5;
    }
    
    pre code {
      background: transparent;
      padding: 0;
      color: inherit;
    }
    
    hr {
      border: none;
      border-top: 1px solid #ccc;
      margin: 20pt 0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15pt 0;
    }
    
    th, td {
      border: 1px solid #ccc;
      padding: 8pt;
      text-align: left;
    }
    
    th {
      background: #f5f5f5;
      font-weight: bold;
    }
    
    a {
      color: #0066cc;
      text-decoration: none;
    }
    
    @media print {
      body {
        padding: 0;
      }
      
      @page {
        margin: 20mm;
        size: A4 portrait;
      }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${htmlContent}
</body>
</html>`
}

// Convert markdown to HTML for printing
function markdownToHtmlForPrint(markdown: string): string {
  if (!markdown) return ''
  
  const lines = markdown.split('\n')
  const htmlParts: string[] = []
  let inCodeBlock = false
  let codeContent: string[] = []
  let inList = false
  let listType = ''
  let listItems: string[] = []
  
  const processInline = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  }
  
  const flushList = () => {
    if (inList && listItems.length > 0) {
      const tag = listType === 'ul' ? 'ul' : 'ol'
      htmlParts.push(`<${tag}>${listItems.map(item => `<li>${item}</li>`).join('')}</${tag}>`)
      listItems = []
      inList = false
    }
  }
  
  for (const line of lines) {
    // Code block
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        htmlParts.push(`<pre><code>${codeContent.join('\n')}</code></pre>`)
        codeContent = []
        inCodeBlock = false
      } else {
        flushList()
        inCodeBlock = true
      }
      continue
    }
    
    if (inCodeBlock) {
      codeContent.push(escapeHtml(line))
      continue
    }
    
    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushList()
      htmlParts.push('<hr>')
      continue
    }
    
    // Headings
    if (line.startsWith('# ')) {
      flushList()
      htmlParts.push(`<h1>${processInline(line.substring(2))}</h1>`)
    } else if (line.startsWith('## ')) {
      flushList()
      htmlParts.push(`<h2>${processInline(line.substring(3))}</h2>`)
    } else if (line.startsWith('### ')) {
      flushList()
      htmlParts.push(`<h3>${processInline(line.substring(4))}</h3>`)
    } else if (line.startsWith('#### ')) {
      flushList()
      htmlParts.push(`<h4>${processInline(line.substring(5))}</h4>`)
    }
    // List items
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList || listType !== 'ul') {
        flushList()
        inList = true
        listType = 'ul'
      }
      listItems.push(processInline(line.substring(2)))
    } else if (/^\d+\.\s/.test(line)) {
      if (!inList || listType !== 'ol') {
        flushList()
        inList = true
        listType = 'ol'
      }
      listItems.push(processInline(line.replace(/^\d+\.\s/, '')))
    }
    // Blockquote
    else if (line.startsWith('> ')) {
      flushList()
      htmlParts.push(`<blockquote>${processInline(line.substring(2))}</blockquote>`)
    }
    // Empty line
    else if (line.trim() === '') {
      flushList()
    }
    // Regular paragraph
    else {
      flushList()
      htmlParts.push(`<p>${processInline(line)}</p>`)
    }
  }
  
  flushList()
  
  if (inCodeBlock && codeContent.length > 0) {
    htmlParts.push(`<pre><code>${codeContent.join('\n')}</code></pre>`)
  }
  
  return htmlParts.join('\n')
}

// Escape HTML entities
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
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
