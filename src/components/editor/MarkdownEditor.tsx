'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { FloatingToolbar } from './FloatingToolbar'

interface MarkdownEditorProps {
  content: string
  onChange: (content: string) => void
}

interface FormatState {
  heading: string | null // 'h1', 'h2', 'h3', or null
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  bulletList: boolean
  orderedList: boolean
}

// Font size steps for increase/decrease
const FONT_SIZE_STEP = 4
const MIN_FONT_SIZE = 10
const MAX_FONT_SIZE = 72
const DEFAULT_FONT_SIZE = 16

export function MarkdownEditor({ content, onChange }: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [toolbarState, setToolbarState] = useState({
    visible: false,
    position: { top: 0, left: 0 },
  })
  const [formatState, setFormatState] = useState<FormatState>({ 
    heading: null,
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    bulletList: false,
    orderedList: false,
  })
  const isInternalChange = useRef(false)

  // Sync content to editor when it changes externally
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      const currentHtml = editorRef.current.innerHTML
      // Only update if the content is different and editor is not focused
      if (document.activeElement !== editorRef.current && currentHtml !== content) {
        editorRef.current.innerHTML = content || '<p><br></p>'
      }
    }
    isInternalChange.current = false
  }, [content])

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && content) {
      editorRef.current.innerHTML = content
    }
  }, [])

  // Detect current format from selection
  const detectFormatState = useCallback((node: Node | null): FormatState => {
    const state: FormatState = {
      heading: null,
      bold: false,
      italic: false,
      underline: false,
      strikethrough: false,
      bulletList: false,
      orderedList: false,
    }
    
    if (!node) return state
    
    // Check formatting using queryCommandState
    state.bold = document.queryCommandState('bold')
    state.italic = document.queryCommandState('italic')
    state.underline = document.queryCommandState('underline')
    state.strikethrough = document.queryCommandState('strikeThrough')
    state.bulletList = document.queryCommandState('insertUnorderedList')
    state.orderedList = document.queryCommandState('insertOrderedList')
    
    // Get the element to check for heading
    let element: Element | null = node.nodeType === Node.TEXT_NODE 
      ? node.parentElement 
      : node as Element
    
    // Walk up the DOM tree to find heading
    while (element && element !== editorRef.current) {
      const tagName = element.tagName.toLowerCase()
      
      if (tagName === 'h1') {
        state.heading = 'h1'
        break
      } else if (tagName === 'h2') {
        state.heading = 'h2'
        break
      } else if (tagName === 'h3') {
        state.heading = 'h3'
        break
      }
      
      element = element.parentElement
    }
    
    return state
  }, [])

  // Handle text selection - show/hide toolbar
  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection()
    
    // Hide toolbar if no selection or collapsed selection
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setToolbarState((prev) => ({ ...prev, visible: false }))
      return
    }

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()

    // Check if selection is within editor
    if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
      // Detect current format
      const detectedFormat = detectFormatState(range.commonAncestorContainer)
      setFormatState(detectedFormat)
      
      setToolbarState({
        visible: true,
        position: {
          top: rect.top - 50 + window.scrollY,
          left: rect.left + rect.width / 2,
        },
      })
    } else {
      setToolbarState((prev) => ({ ...prev, visible: false }))
    }
  }, [detectFormatState])

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [handleSelectionChange])

  // Handle input changes
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true
      const newContent = editorRef.current.innerHTML
      onChange(newContent)
    }
  }, [onChange])

  // Get current font size from a node (handles both Element and Text nodes)
  const getFontSizeFromNode = useCallback((node: Node | null): number => {
    if (!node) return DEFAULT_FONT_SIZE
    
    // If it's a text node, get its parent element
    let element: Element | null = node.nodeType === Node.TEXT_NODE 
      ? node.parentElement 
      : node as Element
    
    // Walk up the DOM tree to find a font-size style
    while (element && element !== editorRef.current) {
      const fontSize = window.getComputedStyle(element).fontSize
      const parsed = parseInt(fontSize, 10)
      if (!isNaN(parsed) && parsed > 0) {
        return parsed
      }
      element = element.parentElement
    }
    
    return DEFAULT_FONT_SIZE
  }, [])

  // Helper to select an element and show toolbar
  const selectElementAndShowToolbar = useCallback((element: HTMLElement) => {
    const selection = window.getSelection()
    if (!selection) return
    
    const range = document.createRange()
    range.selectNodeContents(element)
    selection.removeAllRanges()
    selection.addRange(range)
    
    // Update toolbar position after a brief delay to let DOM update
    requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect()
      setToolbarState({
        visible: true,
        position: {
          top: rect.top - 50 + window.scrollY,
          left: rect.left + rect.width / 2,
        },
      })
    })
  }, [])

  // Apply style to selected text
  const applyStyle = useCallback((style: string, value?: string) => {
    const selection = window.getSelection()
    if (!selection) return

    const range = selection.getRangeAt(0)
    const selectedText = selection.toString()

    switch (style) {
      case 'bold':
        document.execCommand('bold', false)
        break
      case 'italic':
        document.execCommand('italic', false)
        break
      case 'underline':
        document.execCommand('underline', false)
        break
      case 'strikethrough':
        document.execCommand('strikeThrough', false)
        break
      case 'color': {
        if (value === 'inherit') {
          // Simple approach: set color to black (default color)
          // This works reliably instead of trying to remove color styles
          const isDarkMode = document.documentElement.classList.contains('dark')
          const defaultColor = isDarkMode ? '#ffffff' : '#000000'
          document.execCommand('foreColor', false, defaultColor)
        } else {
          document.execCommand('foreColor', false, value)
        }
        break
      }
      case 'highlight':
        document.execCommand('hiliteColor', false, value)
        break
      case 'fontSize': {
        const fontSpan = document.createElement('span')
        fontSpan.className = 'font-size-span'
        fontSpan.style.fontSize = value || '16px'
        fontSpan.textContent = selectedText
        range.deleteContents()
        range.insertNode(fontSpan)
        selectElementAndShowToolbar(fontSpan)
        handleInput()
        return
      }
      case 'fontSizeIncrease': {
        const currentSize = getFontSizeFromNode(range.commonAncestorContainer)
        const newSize = Math.min(currentSize + FONT_SIZE_STEP, MAX_FONT_SIZE)
        const fontSpan = document.createElement('span')
        fontSpan.className = 'font-size-span'
        fontSpan.style.fontSize = `${newSize}px`
        fontSpan.textContent = selectedText
        range.deleteContents()
        range.insertNode(fontSpan)
        selectElementAndShowToolbar(fontSpan)
        handleInput()
        return
      }
      case 'fontSizeDecrease': {
        const currentSize = getFontSizeFromNode(range.commonAncestorContainer)
        const newSize = Math.max(currentSize - FONT_SIZE_STEP, MIN_FONT_SIZE)
        const fontSpan = document.createElement('span')
        fontSpan.className = 'font-size-span'
        fontSpan.style.fontSize = `${newSize}px`
        fontSpan.textContent = selectedText
        range.deleteContents()
        range.insertNode(fontSpan)
        selectElementAndShowToolbar(fontSpan)
        handleInput()
        return
      }
      case 'code': {
        const codeSpan = document.createElement('code')
        codeSpan.className = 'inline-code'
        codeSpan.textContent = selectedText
        range.deleteContents()
        range.insertNode(codeSpan)
        break
      }
      case 'heading': {
        const headingTag = `h${value || '1'}`
        document.execCommand('formatBlock', false, `<${headingTag}>`)
        // Update format state
        setFormatState({ heading: headingTag })
        break
      }
      case 'list':
        if (value === 'bullet') {
          document.execCommand('insertUnorderedList', false)
        } else {
          document.execCommand('insertOrderedList', false)
        }
        break
      case 'quote':
        document.execCommand('formatBlock', false, '<blockquote>')
        setFormatState({ heading: null })
        break
      case 'link': {
        const linkUrl = prompt('Enter URL:', 'https://')
        if (linkUrl) {
          document.execCommand('createLink', false, linkUrl)
        }
        break
      }
      case 'hr':
        document.execCommand('insertHorizontalRule', false)
        break
      case 'normal':
        document.execCommand('formatBlock', false, '<p>')
        setFormatState({ heading: null })
        break
    }

    // Trigger content update
    handleInput()
    setToolbarState((prev) => ({ ...prev, visible: false }))
  }, [handleInput, getFontSizeFromNode, selectElementAndShowToolbar])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault()
          applyStyle('bold')
          break
        case 'i':
          e.preventDefault()
          applyStyle('italic')
          break
        case 'u':
          e.preventDefault()
          applyStyle('underline')
          break
        case 's':
          e.preventDefault()
          const event = new CustomEvent('save-document')
          window.dispatchEvent(event)
          break
      }
    }

    // Handle Tab for indentation
    if (e.key === 'Tab') {
      e.preventDefault()
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;')
    }
  }, [applyStyle])

  return (
    <div className="relative h-full">
      <FloatingToolbar
        onApplyStyle={applyStyle}
        position={toolbarState.position}
        visible={toolbarState.visible}
        formatState={formatState}
      />
      
      <div
        ref={editorRef}
        contentEditable
        className="prose-editor h-full min-h-[calc(100vh-200px)] p-8 outline-none focus:outline-none overflow-auto"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        suppressContentEditableWarning
        data-placeholder="Start writing..."
      />
      
      <style jsx global>{`
        .prose-editor:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
          position: absolute;
          left: 2rem;
          top: 2rem;
        }
        
        .prose-editor {
          line-height: 1.8;
          font-size: 16px;
        }
        
        /* Font size spans - maintain consistent line height */
        .prose-editor .font-size-span {
          display: inline;
          line-height: 1.5;
          vertical-align: baseline;
        }
        
        .prose-editor .inline-code,
        .prose-editor code {
          background-color: rgba(135, 131, 120, 0.15);
          color: #eb5757;
          padding: 0.2em 0.4em;
          margin: 0;
          font-size: 85%;
          border-radius: 3px;
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
        }
        
        .prose-editor h1 {
          font-size: 2em;
          font-weight: 700;
          margin-bottom: 0.5em;
          margin-top: 0.5em;
          color: var(--foreground);
          line-height: 1.2;
        }
        
        .prose-editor h2 {
          font-size: 1.5em;
          font-weight: 600;
          margin-bottom: 0.5em;
          margin-top: 0.5em;
          color: var(--foreground);
          line-height: 1.3;
        }
        
        .prose-editor h3 {
          font-size: 1.25em;
          font-weight: 600;
          margin-bottom: 0.5em;
          margin-top: 0.5em;
          color: var(--foreground);
          line-height: 1.4;
        }
        
        .prose-editor pre {
          background-color: #1e1e1e;
          color: #d4d4d4;
          padding: 1em;
          border-radius: 6px;
          overflow-x: auto;
        }
        
        .prose-editor pre code {
          background-color: transparent;
          color: inherit;
          padding: 0;
        }
        
        .prose-editor blockquote {
          border-left: 3px solid var(--border);
          padding-left: 1em;
          color: var(--muted-foreground);
          margin: 1em 0;
          background-color: rgba(0,0,0,0.05);
          padding: 0.5em 1em;
          border-radius: 0 4px 4px 0;
        }
        
        .dark .prose-editor blockquote {
          background-color: rgba(255,255,255,0.05);
        }
        
        .prose-editor ul,
        .prose-editor ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        
        .prose-editor ul {
          list-style-type: disc;
        }
        
        .prose-editor ol {
          list-style-type: decimal;
        }
        
        .prose-editor li {
          margin: 0.25em 0;
          display: list-item;
        }
        
        .prose-editor ul ul {
          list-style-type: circle;
        }
        
        .prose-editor ul ul ul {
          list-style-type: square;
        }
        
        .prose-editor ol ol {
          list-style-type: lower-alpha;
        }
        
        .prose-editor ol ol ol {
          list-style-type: lower-roman;
        }
        
        .prose-editor a {
          color: #3b82f6;
          text-decoration: underline;
        }
        
        .prose-editor hr {
          border: none;
          border-top: 1px solid var(--border);
          margin: 2em 0;
        }
        
        .prose-editor img {
          max-width: 100%;
          height: auto;
          border-radius: 6px;
        }
        
        .prose-editor table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        
        .prose-editor th,
        .prose-editor td {
          border: 1px solid var(--border);
          padding: 0.5em 1em;
        }
        
        .prose-editor th {
          background-color: var(--muted);
          font-weight: 600;
        }
        
        .prose-editor strong,
        .prose-editor b {
          font-weight: 600;
        }
        
        .prose-editor em,
        .prose-editor i {
          font-style: italic;
        }
        
        .prose-editor u {
          text-decoration: underline;
        }
        
        .prose-editor s,
        .prose-editor strike,
        .prose-editor del {
          text-decoration: line-through;
        }
      `}</style>
    </div>
  )
}
