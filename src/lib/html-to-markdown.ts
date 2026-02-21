/**
 * Convert HTML to Markdown with style preservation
 * Preserves inline styles like color, background, font-size as HTML spans
 */

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

function parseStyle(styleStr: string): StyleInfo {
  const style: StyleInfo = {}
  const parts = styleStr.split(';').map(s => s.trim()).filter(Boolean)
  
  for (const part of parts) {
    const [key, value] = part.split(':').map(s => s.trim())
    if (key === 'color' && value) {
      style.color = value
    } else if (key === 'background-color' && value) {
      style.backgroundColor = value
    } else if (key === 'background' && value) {
      style.backgroundColor = value
    } else if (key === 'font-size' && value) {
      style.fontSize = value
    }
  }
  
  return style
}

function applyInlineStyles(text: string, style: StyleInfo): string {
  if (!text) return ''
  
  // Check if we need to wrap with span for styles
  const hasColor = style.color && style.color !== 'inherit'
  const hasBg = style.backgroundColor && style.backgroundColor !== 'transparent'
  const hasFontSize = style.fontSize
  
  if (!hasColor && !hasBg && !hasFontSize) {
    return text
  }
  
  let styleAttr = ''
  if (hasColor) styleAttr += `color:${style.color};`
  if (hasBg) styleAttr += `background-color:${style.backgroundColor};`
  if (hasFontSize) styleAttr += `font-size:${style.fontSize};`
  
  return `<span style="${styleAttr}">${text}</span>`
}

function applyTextFormatting(text: string, style: StyleInfo): string {
  if (!text) return ''
  
  let result = text
  
  // Apply formatting in order: code > strikethrough > underline > bold > italic
  // But we'll apply them as they appear in the style
  
  if (style.code) {
    result = `\`${result}\``
  }
  if (style.strikethrough) {
    result = `~~${result}~~`
  }
  if (style.underline) {
    result = `<u>${result}</u>`
  }
  if (style.bold) {
    result = `**${result}**`
  }
  if (style.italic) {
    result = `*${result}*`
  }
  
  return result
}

function processNode(node: Node, inheritedStyle: StyleInfo = {}): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || ''
    // Return whitespace as-is, only apply formatting to non-empty text
    if (!text) return ''
    
    // Apply text formatting (bold, italic, etc.)
    let result = applyTextFormatting(text, inheritedStyle)
    // Then apply inline styles (color, bg, font-size)
    result = applyInlineStyles(result, inheritedStyle)
    
    return result
  }
  
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  
  const element = node as Element
  const tagName = element.tagName.toLowerCase()
  
  // Merge styles
  const style: StyleInfo = { ...inheritedStyle }
  
  // Check inline style attribute
  const styleAttr = element.getAttribute('style')
  if (styleAttr) {
    const parsedStyle = parseStyle(styleAttr)
    Object.assign(style, parsedStyle)
  }
  
  // Check tag-based styles
  if (tagName === 'b' || tagName === 'strong') {
    style.bold = true
  }
  if (tagName === 'i' || tagName === 'em') {
    style.italic = true
  }
  if (tagName === 'u') {
    style.underline = true
  }
  if (tagName === 's' || tagName === 'del' || tagName === 'strike') {
    style.strikethrough = true
  }
  if (tagName === 'code') {
    style.code = true
  }
  
  // Check font color (from foreColor command)
  const colorAttr = element.getAttribute('color')
  if (colorAttr) {
    style.color = colorAttr
  }
  
  // Check background color from bgcolor attribute
  const bgColorAttr = element.getAttribute('bgcolor')
  if (bgColorAttr) {
    style.backgroundColor = bgColorAttr
  }
  
  // Get children content
  let childrenContent = ''
  for (const child of node.childNodes) {
    childrenContent += processNode(child, style)
  }
  
  // If children content is empty or only whitespace, don't add formatting
  if (!childrenContent.trim()) {
    return childrenContent // Return whitespace as-is
  }
  
  // Apply tag transformations
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
    case 'div':
      return `\n${childrenContent.trim()}\n\n`
    case 'br':
      return '\n'
    case 'hr':
      return '\n---\n\n'
    case 'blockquote':
      const bqLines = childrenContent.trim().split('\n')
      return '\n' + bqLines.map(line => `> ${line}`).join('\n') + '\n\n'
    case 'ul':
      return '\n' + childrenContent + '\n'
    case 'ol':
      return '\n' + childrenContent + '\n'
    case 'li':
      const parentList = element.parentElement?.tagName.toLowerCase()
      if (parentList === 'ol') {
        const siblings = Array.from(element.parentElement?.children || [])
        const index = siblings.indexOf(element) + 1
        return `${index}. ${childrenContent.trim()}\n`
      }
      return `- ${childrenContent.trim()}\n`
    case 'b':
    case 'strong':
      // Already handled via style.bold, just return children
      return childrenContent
    case 'i':
    case 'em':
      // Already handled via style.italic
      return childrenContent
    case 'u':
      // Already handled via style.underline
      return childrenContent
    case 's':
    case 'del':
    case 'strike':
      // Already handled via style.strikethrough
      return childrenContent
    case 'code':
      // Already handled via style.code
      return childrenContent
    case 'pre':
      return `\n\`\`\`\n${childrenContent.trim()}\n\`\`\`\n\n`
    case 'a':
      const href = element.getAttribute('href') || ''
      return `[${childrenContent}](${href})`
    case 'img':
      const src = element.getAttribute('src') || ''
      const alt = element.getAttribute('alt') || ''
      return `![${alt}](${src})`
    case 'span':
    case 'font':
      // Just return children with styles applied (already done)
      return childrenContent
    case 'table':
      return convertTable(element)
    default:
      return childrenContent
  }
}

function convertTable(table: Element): string {
  const rows = table.querySelectorAll('tr')
  if (rows.length === 0) return ''
  
  let result = '\n'
  let headerProcessed = false
  
  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('th, td')
    const cellContents = Array.from(cells).map(cell => cell.textContent?.trim() || '')
    
    // Add row
    result += '| ' + cellContents.join(' | ') + ' |\n'
    
    // Add header separator after first row
    if (!headerProcessed && (row.querySelector('th') || rowIndex === 0)) {
      result += '| ' + cellContents.map(() => '---').join(' | ') + ' |\n'
      headerProcessed = true
    }
  })
  
  return result + '\n'
}

export function htmlToMarkdown(html: string, title: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  
  let markdown = `# ${title}\n\n`
  
  for (const child of doc.body.childNodes) {
    markdown += processNode(child)
  }
  
  // Clean up extra newlines and empty formatting
  markdown = markdown
    .replace(/\*\*\s*\*\*/g, '')  // Remove empty bold
    .replace(/\*\s*\*/g, '')       // Remove empty italic
    .replace(/~~\s*~~/g, '')        // Remove empty strikethrough
    .replace(/<u>\s*<\/u>/g, '')   // Remove empty underline
    .replace(/`\s*`/g, '')         // Remove empty code
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '\n')
  
  return markdown
}

/**
 * Export document with proper encoding
 */
export function downloadMarkdown(html: string, title: string): void {
  const markdown = htmlToMarkdown(html, title)
  
  // Create blob with UTF-8 encoding
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
