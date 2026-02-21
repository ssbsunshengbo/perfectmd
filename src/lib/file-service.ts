// File system service - works in both Web and Tauri environments

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

// Import MD file
export async function importMarkdownFile(): Promise<{ content: string; name: string } | null> {
  if (isTauri()) {
    return importMarkdownFileTauri()
  } else {
    return importMarkdownFileWeb()
  }
}

async function importMarkdownFileWeb(): Promise<{ content: string; name: string } | null> {
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
      const content = await file.text()
      resolve({ content, name: file.name.replace(/\.(md|markdown|txt)$/, '') })
    }
    input.click()
  })
}

async function importMarkdownFileTauri(): Promise<{ content: string; name: string } | null> {
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
    const text = decoder.decode(content)

    const name = selected.split(/[/\\]/).pop()?.replace(/\.(md|markdown|txt)$/, '') || 'Untitled'

    return { content: text, name }
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
    // Create a printable HTML version
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Please allow popups to export PDF')
      return false
    }

    const html = generatePrintableHtml(title, content)
    printWindow.document.write(html)
    printWindow.document.close()

    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print()
    }, 500)

    return true
  } catch (error) {
    console.error('Failed to export PDF:', error)
    return false
  }
}

async function exportToPdfTauri(title: string, content: string): Promise<boolean> {
  try {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const { writeFile } = await import('@tauri-apps/plugin-fs')

    const filePath = await save({
      defaultPath: `${title}.html`,
      filters: [{ name: 'HTML', extensions: ['html'] }],
    })

    if (!filePath) {
      return false
    }

    const html = generatePrintableHtml(title, content)
    const encoder = new TextEncoder()
    await writeFile(filePath, encoder.encode(html))

    return true
  } catch (error) {
    console.error('Failed to export:', error)
    return false
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
    const blob = new Blob([content], { type: 'text/markdown' })
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
    const { writeFile } = await import('@tauri-apps/plugin-fs')

    const filePath = await save({
      defaultPath: `${defaultName}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })

    if (!filePath) {
      return null
    }

    const encoder = new TextEncoder()
    await writeFile(filePath, encoder.encode(content))

    return filePath
  } catch (error) {
    console.error('Failed to save file:', error)
    return null
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
    const { writeFile } = await import('@tauri-apps/plugin-fs')

    const encoder = new TextEncoder()
    await writeFile(filePath, encoder.encode(content))

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
    const { writeFile } = await import('@tauri-apps/plugin-fs')

    const filePath = `${dirPath}/${fileName}`
    const encoder = new TextEncoder()
    await writeFile(filePath, encoder.encode(content))

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
