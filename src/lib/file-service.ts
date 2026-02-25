// File system service - works in both Web and Tauri environments
import { htmlToMarkdown } from './html-to-markdown'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

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

// Export to PDF
export async function exportToPdf(title: string, content: string): Promise<boolean> {
  if (isTauri()) {
    return exportToPdfTauri(title, content)
  } else {
    return exportToPdfWeb(title, content)
  }
}

async function exportToPdfWeb(title: string, content: string): Promise<boolean> {
  try {
    // Convert HTML content to Markdown text
    const markdownContent = htmlToMarkdown(content)
    
    // Create a temporary container for rendering
    const container = document.createElement('div')
    container.style.cssText = `
      position: fixed;
      left: -9999px;
      top: 0;
      width: 210mm;
      padding: 20mm;
      background: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #333;
    `
    
    // Create styled content
    container.innerHTML = `
      <h1 style="font-size: 24pt; margin-bottom: 20pt; color: #111;">${title}</h1>
      <div style="white-space: pre-wrap; word-wrap: break-word;">${markdownContent}</div>
    `
    
    document.body.appendChild(container)
    
    // Convert to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    })
    
    document.body.removeChild(container)
    
    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })
    
    // Add image to PDF (A4: 210mm x 297mm)
    const imgWidth = 210
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const pageHeight = 297
    let heightLeft = imgHeight
    let position = 0
    
    // Add first page
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
    
    // Add more pages if needed
    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }
    
    // Save the PDF
    pdf.save(`${title}.pdf`)
    
    return true
  } catch (error) {
    console.error('Failed to export PDF:', error)
    return false
  }
}

async function exportToPdfTauri(title: string, content: string): Promise<boolean> {
  try {
    console.log('Starting PDF export...')
    const { save } = await import('@tauri-apps/plugin-dialog')
    
    console.log('Opening save dialog...')
    // Let user choose where to save
    const filePath = await save({
      defaultPath: `${title}.pdf`,
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    })

    if (!filePath) {
      console.log('User cancelled save dialog')
      return false // User cancelled
    }

    console.log('User selected path:', filePath)
    
    // Convert HTML content to Markdown text
    const markdownContent = htmlToMarkdown(content)
    console.log('Content length:', markdownContent.length)
    
    // Create PDF using jsPDF's text rendering (more reliable than html2canvas)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })
    
    // Set font
    pdf.setFont('helvetica')
    
    // Add title
    pdf.setFontSize(24)
    pdf.text(title, 20, 30)
    
    // Add content
    pdf.setFontSize(12)
    const pageWidth = 210
    const pageHeight = 297
    const margin = 20
    const maxWidth = pageWidth - 2 * margin
    const lineHeight = 7
    let y = 50
    
    // Split content into lines and handle pagination
    const lines = markdownContent.split('\n')
    
    for (const line of lines) {
      // Check if we need a new page
      if (y > pageHeight - margin) {
        pdf.addPage()
        y = margin
      }
      
      // Handle empty lines
      if (!line.trim()) {
        y += lineHeight / 2
        continue
      }
      
      // Handle headers
      if (line.startsWith('# ')) {
        pdf.setFontSize(20)
        pdf.setFont('helvetica', 'bold')
        const text = line.substring(2)
        const splitText = pdf.splitTextToSize(text, maxWidth)
        pdf.text(splitText, margin, y)
        y += splitText.length * lineHeight + 3
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'normal')
      } else if (line.startsWith('## ')) {
        pdf.setFontSize(16)
        pdf.setFont('helvetica', 'bold')
        const text = line.substring(3)
        const splitText = pdf.splitTextToSize(text, maxWidth)
        pdf.text(splitText, margin, y)
        y += splitText.length * lineHeight + 2
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'normal')
      } else if (line.startsWith('### ')) {
        pdf.setFontSize(14)
        pdf.setFont('helvetica', 'bold')
        const text = line.substring(4)
        const splitText = pdf.splitTextToSize(text, maxWidth)
        pdf.text(splitText, margin, y)
        y += splitText.length * lineHeight + 2
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'normal')
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // List items
        const text = '• ' + line.substring(2)
        const splitText = pdf.splitTextToSize(text, maxWidth - 5)
        pdf.text(splitText, margin + 5, y)
        y += splitText.length * lineHeight
      } else {
        // Regular text
        const splitText = pdf.splitTextToSize(line, maxWidth)
        pdf.text(splitText, margin, y)
        y += splitText.length * lineHeight
      }
    }
    
    // Get PDF as base64 and convert to Uint8Array
    console.log('Generating PDF binary...')
    const pdfBase64 = pdf.output('datauristring')
    // Extract base64 data from data URI
    const base64Data = pdfBase64.split(',')[1]
    const binaryString = atob(base64Data)
    const pdfData = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      pdfData[i] = binaryString.charCodeAt(i)
    }
    console.log('PDF size:', pdfData.length, 'bytes')
    
    // Save using Tauri fs
    console.log('Writing file to:', filePath)
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    await writeFile(filePath, pdfData)
    console.log('PDF saved successfully!')
    
    return true
  } catch (error) {
    console.error('Failed to export PDF:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    throw error // Re-throw to let caller know the error
  }
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
