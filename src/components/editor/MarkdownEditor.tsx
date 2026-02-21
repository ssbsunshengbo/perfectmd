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
  const shouldResetInlineTypingRef = useRef(false)

  // Handle input changes
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true
      const newContent = editorRef.current.innerHTML
      onChange(newContent)
    }
  }, [onChange])

  const getTextBeforeCaretInBlock = useCallback((block: HTMLElement, selection: Selection): string => {
    if (!selection.rangeCount) return ''
    const range = selection.getRangeAt(0).cloneRange()
    const textRange = document.createRange()
    textRange.selectNodeContents(block)
    textRange.setEnd(range.endContainer, range.endOffset)
    return textRange.toString().replace(/\u00a0/g, ' ')
  }, [])

  const getCurrentBlock = useCallback((selection: Selection): HTMLElement | null => {
    const anchor = selection.anchorNode
    if (!anchor || !editorRef.current) return null
    const element = anchor.nodeType === Node.ELEMENT_NODE ? anchor as Element : anchor.parentElement
    if (!element) return null
    const block = element.closest('p, div, h1, h2, h3, h4, h5, h6, blockquote, li')
    if (!block || !editorRef.current.contains(block)) return null

    // If caret is directly inside the root contentEditable (common on first line),
    // wrap the current text node into a <p> so markdown shortcut logic can work.
    if (block === editorRef.current) {
      const editor = editorRef.current
      if (!selection.rangeCount) return null
      const range = selection.getRangeAt(0)

      const wrapTextNodeAsParagraph = (textNode: Text, caretOffset: number) => {
        const p = document.createElement('p')
        editor.insertBefore(p, textNode)
        p.appendChild(textNode)
        const r = document.createRange()
        const safeOffset = Math.max(0, Math.min(caretOffset, textNode.length))
        r.setStart(textNode, safeOffset)
        r.collapse(true)
        selection.removeAllRanges()
        selection.addRange(r)
        return p
      }

      if (range.startContainer.nodeType === Node.TEXT_NODE && range.startContainer.parentNode === editor) {
        return wrapTextNodeAsParagraph(range.startContainer as Text, range.startOffset)
      }

      if (range.startContainer === editor) {
        const before = editor.childNodes[range.startOffset - 1] || null
        const at = editor.childNodes[range.startOffset] || null

        const createParagraphAtCaret = () => {
          const p = document.createElement('p')
          p.appendChild(document.createElement('br'))
          if (at) {
            editor.insertBefore(p, at)
          } else {
            editor.appendChild(p)
          }

          // If caret is around <br>-based line break, remove nearby break marker
          // so the new block cleanly represents the current line.
          if (before && before.nodeName === 'BR' && before.parentNode === editor) {
            editor.removeChild(before)
          } else if (at && at.nodeName === 'BR' && at.parentNode === editor) {
            editor.removeChild(at)
          }

          const r = document.createRange()
          r.selectNodeContents(p)
          r.collapse(true)
          selection.removeAllRanges()
          selection.addRange(r)
          return p
        }

        // At a visual line boundary represented by <br>, current line should be
        // treated as a new block instead of wrapping previous line content.
        if ((before && before.nodeName === 'BR') || (at && at.nodeName === 'BR')) {
          return createParagraphAtCaret()
        }

        // Important safety rule:
        // never fall back to the previous text node here, otherwise shortcut
        // parsing can target the previous line by mistake.
        if (at && at.nodeType === Node.TEXT_NODE && at.parentNode === editor) {
          const textNode = at as Text
          return wrapTextNodeAsParagraph(textNode, 0)
        }

        // If caret is at the end and there is no "at" text node, create a fresh
        // paragraph for the current line to avoid binding to previous content.
        if (!at) {
          return createParagraphAtCaret()
        }
      }

      // Empty editor: create a default paragraph block.
      if (editor.childNodes.length === 0) {
        const p = document.createElement('p')
        p.appendChild(document.createElement('br'))
        editor.appendChild(p)
        const r = document.createRange()
        r.selectNodeContents(p)
        r.collapse(true)
        selection.removeAllRanges()
        selection.addRange(r)
        return p
      }

      return null
    }

    return block as HTMLElement
  }, [])

  const deleteCharsBeforeCaret = useCallback((selection: Selection, count: number): boolean => {
    if (count <= 0 || !selection.rangeCount) return false

    const caretRange = selection.getRangeAt(0)
    const endContainer = caretRange.endContainer
    const endOffset = caretRange.endOffset

    if (endContainer.nodeType !== Node.TEXT_NODE) {
      return false
    }

    if (endOffset < count) {
      return false
    }

    const deleteRange = document.createRange()
    deleteRange.setStart(endContainer, endOffset - count)
    deleteRange.setEnd(endContainer, endOffset)
    deleteRange.deleteContents()
    return true
  }, [])

  const deleteMarkdownTrigger = useCallback((selection: Selection, triggerText: string): boolean => {
    return deleteCharsBeforeCaret(selection, triggerText.length)
  }, [deleteCharsBeforeCaret])

  // Ensure the caret's current line lives in its own isolated block element.
  // If the block also contains earlier content (previous lines separated by <br>),
  // split it so that earlier content stays in the original block and the caret
  // ends up in a brand-new <p>. Returns the isolated block, or null on failure.
  const ensureIsolatedBlock = useCallback((): HTMLElement | null => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection || !selection.rangeCount) return null

    const range = selection.getRangeAt(0)

    // Walk up from caret to find the nearest block-level ancestor inside editor
    let blockEl: HTMLElement | null = null
    let cur: Node | null = range.startContainer
    while (cur && cur !== editor) {
      if (cur.nodeType === Node.ELEMENT_NODE) {
        const tag = (cur as HTMLElement).tagName.toLowerCase()
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'li'].includes(tag)) {
          blockEl = cur as HTMLElement
          break
        }
      }
      cur = cur.parentNode
    }

    if (!blockEl || blockEl === editor) return null

    // Is there meaningful text before the caret inside this block?
    const checkRange = document.createRange()
    checkRange.selectNodeContents(blockEl)
    checkRange.setEnd(range.startContainer, range.startOffset)
    const textBefore = checkRange.toString().trim()

    if (textBefore.length === 0) {
      // Nothing before caret – block is already isolated for our purposes
      return blockEl
    }

    // --- Block has earlier content: split it ---
    // Extract everything from caret to end-of-block into a DocumentFragment
    const extractRange = document.createRange()
    extractRange.setStart(range.startContainer, range.startOffset)
    extractRange.setEnd(blockEl, blockEl.childNodes.length)
    const fragment = extractRange.extractContents()

    // Remove trailing <br>(s) left in the original block (they were line separators)
    while (blockEl.lastChild && blockEl.lastChild.nodeName === 'BR') {
      blockEl.removeChild(blockEl.lastChild)
    }
    if (!blockEl.innerHTML.trim()) {
      blockEl.innerHTML = '<br>'
    }

    // Create a new <p> and put the extracted content in it
    const newBlock = document.createElement('p')
    newBlock.appendChild(fragment)
    if (!newBlock.innerHTML.trim()) {
      newBlock.innerHTML = '<br>'
    }

    blockEl.parentNode!.insertBefore(newBlock, blockEl.nextSibling)

    // Place caret at the start of the new block
    const r = document.createRange()
    r.selectNodeContents(newBlock)
    r.collapse(true)
    selection.removeAllRanges()
    selection.addRange(r)

    return newBlock
  }, [])

  // Replace a block element's tag (e.g. <p> → <h1>) while keeping its children
  const convertBlockTag = useCallback((block: HTMLElement, newTag: string) => {
    const selection = window.getSelection()
    const newBlock = document.createElement(newTag)

    while (block.firstChild) {
      newBlock.appendChild(block.firstChild)
    }
    block.parentNode!.replaceChild(newBlock, block)

    if (!newBlock.innerHTML.trim()) {
      newBlock.innerHTML = '<br>'
    }

    if (selection) {
      const r = document.createRange()
      r.selectNodeContents(newBlock)
      r.collapse(true)
      selection.removeAllRanges()
      selection.addRange(r)
    }
  }, [])

  const applyMarkdownShortcut = useCallback((e: React.KeyboardEvent): boolean => {
    if (!editorRef.current) return false
    const selection = window.getSelection()
    if (!selection || !selection.isCollapsed) return false

    const block = getCurrentBlock(selection)
    if (!block) return false

    const beforeCaret = getTextBeforeCaretInBlock(block, selection)
    const currentLine = (beforeCaret.split('\n').pop() || '').trim()

    if (e.key === ' ') {
      const tagMap: Record<string, string> = {
        '#': 'h1',
        '##': 'h2',
        '###': 'h3',
        '>': 'blockquote',
      }

      if (tagMap[currentLine]) {
        e.preventDefault()
        if (!deleteMarkdownTrigger(selection, currentLine)) return false
        // Isolate the current line into its own block, then convert its tag
        const isolated = ensureIsolatedBlock()
        if (isolated) {
          convertBlockTag(isolated, tagMap[currentLine])
        }
        handleInput()
        return true
      }

      if (currentLine === '-' || currentLine === '*') {
        e.preventDefault()
        if (!deleteMarkdownTrigger(selection, currentLine)) return false
        ensureIsolatedBlock()
        document.execCommand('insertUnorderedList', false)
        handleInput()
        return true
      }

      if (currentLine === '1.') {
        e.preventDefault()
        if (!deleteMarkdownTrigger(selection, currentLine)) return false
        ensureIsolatedBlock()
        document.execCommand('insertOrderedList', false)
        handleInput()
        return true
      }
    }

    if (e.key === 'Enter' && (currentLine === '---' || currentLine === '***')) {
      e.preventDefault()
      if (!deleteMarkdownTrigger(selection, currentLine)) return false
      document.execCommand('insertHorizontalRule', false)
      document.execCommand('insertParagraph', false)
      handleInput()
      return true
    }

    return false
  }, [convertBlockTag, deleteMarkdownTrigger, ensureIsolatedBlock, getCurrentBlock, getTextBeforeCaretInBlock, handleInput])

  const clearInlineTypingState = useCallback(() => {
    // Avoid forcing "bold" off globally; headings rely on their own bold style.
    const commands: Array<'italic' | 'strikeThrough' | 'underline'> = [
      'italic',
      'strikeThrough',
      'underline',
    ]
    for (const command of commands) {
      if (document.queryCommandState(command)) {
        document.execCommand(command, false)
      }
    }
  }, [])

  const clearColorTypingState = useCallback(() => {
    // Reset color/highlight typing state for subsequent input.
    const isDarkMode = document.documentElement.classList.contains('dark')
    const defaultColor = isDarkMode ? '#ffffff' : '#000000'
    document.execCommand('foreColor', false, defaultColor)
    document.execCommand('hiliteColor', false, 'transparent')
  }, [])

  const isSelectionInsideHeading = useCallback((): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return false
    let node: Node | null = selection.anchorNode
    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = (node as HTMLElement).tagName.toLowerCase()
        if (tag === 'h1' || tag === 'h2' || tag === 'h3') return true
      }
      node = node.parentNode
    }
    return false
  }, [])

  const applyInlineMarkdownShortcut = useCallback((e: React.KeyboardEvent): boolean => {
    if (e.key !== ' ') return false

    const selection = window.getSelection()
    if (!selection || !selection.isCollapsed || !selection.rangeCount) return false

    const range = selection.getRangeAt(0)
    if (range.startContainer.nodeType !== Node.TEXT_NODE) return false

    const textNode = range.startContainer as Text
    const offset = range.startOffset
    const before = textNode.data.slice(0, offset)

    type InlineMatch = {
      regex: RegExp
      build: (match: RegExpMatchArray) => HTMLElement
      resetCommands?: Array<'bold' | 'italic' | 'strikeThrough' | 'underline'>
    }

    const patterns: InlineMatch[] = [
      {
        // **bold**
        regex: /\*\*([^*\n][^*\n]*?)\*\*$/,
        build: (m) => {
          const el = document.createElement('strong')
          el.textContent = m[1]
          return el
        },
        resetCommands: ['bold'],
      },
      {
        // *italic*
        regex: /(?<!\*)\*([^*\n]+)\*$/,
        build: (m) => {
          const el = document.createElement('em')
          el.textContent = m[1]
          return el
        },
        resetCommands: ['italic'],
      },
      {
        // _italic_
        regex: /(?<!_)_([^_\n]+)_$/,
        build: (m) => {
          const el = document.createElement('em')
          el.textContent = m[1]
          return el
        },
        resetCommands: ['italic'],
      },
      {
        // ~~strikethrough~~ or ～～strikethrough～～
        regex: /(~~|～～)([^~～\n]+)\1$/,
        build: (m) => {
          const el = document.createElement('s')
          el.textContent = m[2]
          return el
        },
        resetCommands: ['strikeThrough'],
      },
      {
        // `inline code`
        regex: /`([^`\n]+)`$/,
        build: (m) => {
          const el = document.createElement('code')
          el.className = 'inline-code'
          el.textContent = m[1]
          return el
        },
      },
      {
        // ++underline++
        regex: /\+\+([^+\n]+)\+\+$/,
        build: (m) => {
          const el = document.createElement('u')
          el.textContent = m[1]
          return el
        },
        resetCommands: ['underline'],
      },
      {
        // <u>underline</u>
        regex: /<u>([^<\n]+)<\/u>$/i,
        build: (m) => {
          const el = document.createElement('u')
          el.textContent = m[1]
          return el
        },
        resetCommands: ['underline'],
      },
      {
        // [label](url)
        regex: /\[([^\]\n]+)\]\(([^)\s]+)\)$/,
        build: (m) => {
          const el = document.createElement('a')
          el.textContent = m[1]
          el.href = m[2]
          el.target = '_blank'
          el.rel = 'noopener noreferrer'
          return el
        },
      },
    ]

    for (const pattern of patterns) {
      const match = before.match(pattern.regex)
      if (!match) continue

      const fullMatch = match[0]
      const replaceStart = offset - fullMatch.length

      if (replaceStart < 0) return false

      e.preventDefault()

      const replaceRange = document.createRange()
      replaceRange.setStart(textNode, replaceStart)
      replaceRange.setEnd(textNode, offset)
      replaceRange.deleteContents()

      const fragment = document.createDocumentFragment()
      const formattedNode = pattern.build(match)
      const trailingSpace = document.createTextNode(' ')
      fragment.appendChild(formattedNode)
      fragment.appendChild(trailingSpace)

      replaceRange.insertNode(fragment)

      const inlineTags = new Set(['strong', 'b', 'em', 'i', 's', 'del', 'code', 'a', 'u', 'span', 'font'])
      const caretRange = document.createRange()
      // Place caret after the plain trailing space, then force it out of any
      // inline formatting ancestor so future input is unformatted text.
      caretRange.setStartAfter(trailingSpace)
      caretRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(caretRange)

      let node: Node | null = selection.anchorNode
      while (node && node !== editorRef.current) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement
          const tag = el.tagName.toLowerCase()
          if (inlineTags.has(tag) && el.parentNode) {
            const outRange = document.createRange()
            outRange.setStartAfter(el)
            outRange.collapse(true)
            selection.removeAllRanges()
            selection.addRange(outRange)
            break
          }
        }
        node = node.parentNode
      }

      // Some browsers keep a hidden typing style state after rich-text edits.
      // Explicitly disable command-based inline styles so following input stays plain.
      if (pattern.resetCommands) {
        for (const command of pattern.resetCommands) {
          if (document.queryCommandState(command)) {
            document.execCommand(command, false)
          }
        }
      }
      const inHeading = isSelectionInsideHeading()
      if (!inHeading) {
        clearInlineTypingState()
      }

      // Force next printable input to start outside inline-format context.
      shouldResetInlineTypingRef.current = !inHeading

      handleInput()
      return true
    }

    return false
  }, [clearInlineTypingState, handleInput, isSelectionInsideHeading])

  const ensureCaretOutsideInlineFormatting = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return

    let node: Node | null = selection.anchorNode
    let inlineAncestor: HTMLElement | null = null
    const inlineTags = new Set(['strong', 'b', 'em', 'i', 's', 'del', 'code', 'a', 'u', 'span', 'font'])

    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement
        if (inlineTags.has(el.tagName.toLowerCase())) {
          inlineAncestor = el
        }
      }
      node = node.parentNode
    }

    if (inlineAncestor && inlineAncestor.parentNode) {
      const range = document.createRange()
      range.setStartAfter(inlineAncestor)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }, [])

  const isCaretInsideInlineFormatting = useCallback((): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return false

    let node: Node | null = selection.anchorNode
    const inlineTags = new Set(['strong', 'b', 'em', 'i', 's', 'del', 'code', 'a', 'u', 'span', 'font'])

    while (node && node !== editorRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement
        if (inlineTags.has(el.tagName.toLowerCase())) {
          return true
        }
      }
      node = node.parentNode
    }
    return false
  }, [])

  const insertPlainTextAtCaret = useCallback((text: string) => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return
    const range = selection.getRangeAt(0)
    range.deleteContents()
    const textNode = document.createTextNode(text)
    range.insertNode(textNode)
    const nextRange = document.createRange()
    nextRange.setStart(textNode, textNode.length)
    nextRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(nextRange)
  }, [])

  const insertCleanParagraphAfterCurrentBlock = useCallback((): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return false

    const currentBlock = getCurrentBlock(selection)
    const editor = editorRef.current
    if (!currentBlock || currentBlock === editor) return false

    const newP = document.createElement('p')
    newP.appendChild(document.createElement('br'))
    currentBlock.parentNode?.insertBefore(newP, currentBlock.nextSibling)

    const range = document.createRange()
    range.selectNodeContents(newP)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    return true
  }, [getCurrentBlock])

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
    // Make Enter always create a new <p> block instead of inserting <br>,
    // so each line lives in its own block element.
    try { document.execCommand('defaultParagraphSeparator', false, 'p') } catch { /* ignore */ }
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

  const wrapSelectionWithStyle = useCallback(
    (property: 'color' | 'backgroundColor', value: string, clearToken: string): boolean => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || !selection.rangeCount) return false

      const range = selection.getRangeAt(0)
      const extracted = range.extractContents()
      const span = document.createElement('span')

      if (value === clearToken) {
        span.style[property] = property === 'color' ? 'inherit' : 'transparent'
      } else {
        span.style[property] = value
      }

      span.appendChild(extracted)
      range.insertNode(span)

      // Collapse caret to end so subsequent typing starts outside selection.
      const caret = document.createRange()
      caret.setStartAfter(span)
      caret.collapse(true)
      selection.removeAllRanges()
      selection.addRange(caret)

      return true
    },
    []
  )

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
        // Avoid enabling persistent typing color when no text is selected.
        if (selection.isCollapsed || !selectedText) {
          break
        }
        wrapSelectionWithStyle('color', value || 'inherit', 'inherit')
        // Prevent following typing from inheriting color style context.
        selection.collapseToEnd()
        ensureCaretOutsideInlineFormatting()
        clearInlineTypingState()
        break
      }
      case 'highlight':
        // Avoid enabling persistent typing highlight when no text is selected.
        if (selection.isCollapsed || !selectedText) {
          break
        }
        wrapSelectionWithStyle('backgroundColor', value || 'transparent', 'transparent')
        selection.collapseToEnd()
        ensureCaretOutsideInlineFormatting()
        clearInlineTypingState()
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
        setFormatState((prev) => ({ ...prev, heading: headingTag }))
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
        setFormatState((prev) => ({ ...prev, heading: null }))
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
        setFormatState((prev) => ({ ...prev, heading: null }))
        break
    }

    // Trigger content update
    handleInput()
    setToolbarState((prev) => ({ ...prev, visible: false }))
  }, [clearInlineTypingState, ensureCaretOutsideInlineFormatting, handleInput, getFontSizeFromNode, selectElementAndShowToolbar, wrapSelectionWithStyle])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const inBulletList = document.queryCommandState('insertUnorderedList')
      const inOrderedList = document.queryCommandState('insertOrderedList')
      // Keep native behavior inside lists; otherwise force a clean paragraph break
      // to avoid inheriting previous-line formatting context.
      if (!inBulletList && !inOrderedList) {
        e.preventDefault()
        ensureCaretOutsideInlineFormatting()
        clearInlineTypingState()
        clearColorTypingState()
        if (!insertCleanParagraphAfterCurrentBlock()) {
          document.execCommand('insertParagraph', false)
        }
        shouldResetInlineTypingRef.current = false
        handleInput()
        return
      }
    }

    // When caret is still inside inline formatting context (common after frequent
    // color/inline style operations), force Enter to break out first. This avoids
    // new-line markdown shortcuts accidentally affecting the previous line.
    if (e.key === 'Enter' && !e.shiftKey && isCaretInsideInlineFormatting()) {
      e.preventDefault()
      ensureCaretOutsideInlineFormatting()
      clearInlineTypingState()
      document.execCommand('insertParagraph', false)
      shouldResetInlineTypingRef.current = false
      handleInput()
      return
    }

    if (shouldResetInlineTypingRef.current) {
      if (e.key === 'Enter') {
        const inBulletList = document.queryCommandState('insertUnorderedList')
        const inOrderedList = document.queryCommandState('insertOrderedList')
        if (inBulletList || inOrderedList) {
          shouldResetInlineTypingRef.current = false
          return
        }
        e.preventDefault()
        ensureCaretOutsideInlineFormatting()
        clearInlineTypingState()
        clearColorTypingState()
        if (!insertCleanParagraphAfterCurrentBlock()) {
          document.execCommand('insertParagraph', false)
        }
        shouldResetInlineTypingRef.current = false
        handleInput()
        return
      } else if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        const stillInsideInline = isCaretInsideInlineFormatting()
        shouldResetInlineTypingRef.current = false
        if (stillInsideInline) {
          e.preventDefault()
          ensureCaretOutsideInlineFormatting()
          clearInlineTypingState()
          clearColorTypingState()
          insertPlainTextAtCaret(e.key)
          handleInput()
          return
        }
      }
    }

    if (applyInlineMarkdownShortcut(e)) return
    if (applyMarkdownShortcut(e)) return

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
  }, [applyInlineMarkdownShortcut, applyMarkdownShortcut, applyStyle, clearColorTypingState, clearInlineTypingState, ensureCaretOutsideInlineFormatting, handleInput, insertCleanParagraphAfterCurrentBlock, insertPlainTextAtCaret, isCaretInsideInlineFormatting])

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
