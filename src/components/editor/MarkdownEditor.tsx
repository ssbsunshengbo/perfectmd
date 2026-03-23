'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { TopToolbar } from './TopToolbar'
import katex from 'katex'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { open as openExternal } from '@tauri-apps/plugin-shell'
import hljs from 'highlight.js/lib/common'

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

const DEFAULT_FORMAT_STATE: FormatState = {
  heading: null,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  bulletList: false,
  orderedList: false,
}

// Font size steps for increase/decrease
const FONT_SIZE_STEP = 4
const MIN_FONT_SIZE = 10
const MAX_FONT_SIZE = 72
const DEFAULT_FONT_SIZE = 16
const CODE_LANGUAGES = [
  'plaintext',
  'javascript',
  'typescript',
  'python',
  'java',
  'go',
  'rust',
  'json',
  'bash',
  'html',
  'css',
  'sql',
]

export function MarkdownEditor({ content, onChange }: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const formulaTargetRef = useRef<HTMLElement | null>(null)
  const resizeDragRef = useRef<{
    startX: number
    startWidth: number
    startHeight: number
    ratio: number
    corner: 'se' | 'sw' | 'ne' | 'nw'
  } | null>(null)
  const [formatState, setFormatState] = useState<FormatState>(DEFAULT_FORMAT_STATE)
  const [isFormulaDialogOpen, setIsFormulaDialogOpen] = useState(false)
  const [formulaDraft, setFormulaDraft] = useState('')
  const [editingLink, setEditingLink] = useState<{
    element: HTMLAnchorElement | null
    text: string
    href: string
    range: Range | null
    position: { top: number; left: number }
  } | null>(null)
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null)
  const [imageOverlayRect, setImageOverlayRect] = useState<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)
  const isInternalChange = useRef(false)
  const shouldResetInlineTypingRef = useRef(false)
  const isComposingRef = useRef(false)

  const normalizeCodeBlockToPlainText = useCallback((codeEl: HTMLElement) => {
    const rawText = codeEl.textContent || ''
    codeEl.textContent = rawText
    codeEl.removeAttribute('data-highlighted')
    codeEl.classList.remove('hljs')
  }, [])

  const applySyntaxHighlight = useCallback((codeEl: HTMLElement, language: string, force = false) => {
    const selection = window.getSelection()
    if (!force && selection && selection.rangeCount) {
      const anchor = selection.anchorNode
      if (anchor && codeEl.contains(anchor)) {
        normalizeCodeBlockToPlainText(codeEl)
        return
      }
    }
    const rawText = codeEl.textContent || ''
    if (!rawText.trim() || language === 'plaintext') {
      normalizeCodeBlockToPlainText(codeEl)
      return
    }
    try {
      const highlighted = hljs.highlight(rawText, {
        language,
        ignoreIllegals: true,
      }).value
      codeEl.innerHTML = highlighted || rawText
      codeEl.setAttribute('data-highlighted', 'true')
      codeEl.classList.add('hljs')
    } catch {
      normalizeCodeBlockToPlainText(codeEl)
    }
  }, [normalizeCodeBlockToPlainText])

  const renderCodeHighlights = useCallback((editor: HTMLDivElement, force = false) => {
    const wrappers = editor.querySelectorAll('.code-block-wrapper')
    wrappers.forEach((wrapper) => {
      const codeEl = wrapper.querySelector('pre code') as HTMLElement | null
      if (!codeEl) return
      const langSelect = wrapper.querySelector('[data-code-lang-select="true"]') as HTMLSelectElement | null
      const lang = (langSelect?.value || wrapper.getAttribute('data-code-language') || 'plaintext').toLowerCase()
      wrapper.setAttribute('data-code-language', lang)
      codeEl.setAttribute('data-language', lang)
      applySyntaxHighlight(codeEl, lang, force)
    })
  }, [applySyntaxHighlight])

  const ensureCodeBlockControls = useCallback((editor: HTMLDivElement) => {
    const wrappers = editor.querySelectorAll('.code-block-wrapper')
    wrappers.forEach((wrapper) => {
      const codeEl = wrapper.querySelector('pre.editor-code-block code') as HTMLElement | null
      if (!codeEl) {
        wrapper.querySelectorAll('.code-controls, .code-copy-toast').forEach((node) => node.remove())
        return
      }
      let controls = wrapper.querySelector('.code-controls') as HTMLDivElement | null
      if (!controls) {
        controls = document.createElement('div')
        controls.className = 'code-controls'
        controls.setAttribute('contenteditable', 'false')
        wrapper.appendChild(controls)
      }

      let langSelect = controls.querySelector('[data-code-lang-select="true"]') as HTMLSelectElement | null
      if (!langSelect) {
        langSelect = document.createElement('select')
        langSelect.className = 'code-lang-select'
        langSelect.setAttribute('contenteditable', 'false')
        langSelect.setAttribute('data-code-lang-select', 'true')
        CODE_LANGUAGES.forEach((lang) => {
          const option = document.createElement('option')
          option.value = lang
          option.textContent = lang
          langSelect?.appendChild(option)
        })
        controls.appendChild(langSelect)
      }
      const currentLang = (wrapper.getAttribute('data-code-language') || 'plaintext').toLowerCase()
      if (CODE_LANGUAGES.includes(currentLang)) {
        langSelect.value = currentLang
      } else {
        langSelect.value = 'plaintext'
        wrapper.setAttribute('data-code-language', 'plaintext')
      }
      let copyBtn = controls.querySelector('[data-copy-code-btn="true"]') as HTMLButtonElement | null
      if (!copyBtn) {
        copyBtn = document.createElement('button')
        copyBtn.type = 'button'
        copyBtn.draggable = false
        copyBtn.className = 'code-copy-btn'
        copyBtn.setAttribute('contenteditable', 'false')
        copyBtn.setAttribute('data-copy-code-btn', 'true')
        copyBtn.title = 'Copy code'
        copyBtn.innerHTML = '⧉'
        controls.appendChild(copyBtn)
      }
      let copyToast = wrapper.querySelector('.code-copy-toast') as HTMLSpanElement | null
      if (!copyToast) {
        copyToast = document.createElement('span')
        copyToast.className = 'code-copy-toast'
        copyToast.setAttribute('contenteditable', 'false')
        copyToast.textContent = '复制成功'
        wrapper.appendChild(copyToast)
      }
    })
  }, [])

  // Handle input changes
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const editor = editorRef.current
      // Remove invisible ZWS anchors left by previous editing logic.
      // They cause double-backspace deletion and oversized caret rendering
      // after soft line breaks on some platforms.
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT)
      const textNodes: Text[] = []
      let current: Node | null = walker.nextNode()
      while (current) {
        textNodes.push(current as Text)
        current = walker.nextNode()
      }
      for (const textNode of textNodes) {
        if (!textNode.textContent) continue
        const cleaned = textNode.textContent.replace(/\u200B/g, '')
        if (cleaned === textNode.textContent) continue
        if (cleaned.length === 0) textNode.remove()
        else textNode.textContent = cleaned
      }

      const blockTags = new Set([
        'p', 'div', 'pre', 'blockquote', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table',
      ])
      const inlineTags = new Set([
        'span', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'code', 'a',
      ])

      const ensureParagraphBeforeNode = (node: Node) => {
        const previous = node.previousSibling
        if (
          previous &&
          previous.nodeType === Node.ELEMENT_NODE &&
          (previous as HTMLElement).tagName.toLowerCase() === 'p'
        ) {
          return previous as HTMLParagraphElement
        }
        const p = document.createElement('p')
        editor.insertBefore(p, node)
        return p
      }

      const children = Array.from(editor.childNodes)
      for (const node of children) {
        if (node.parentNode !== editor) continue

        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent || ''
          if (text === '') {
            editor.removeChild(node)
            continue
          }
          const p = ensureParagraphBeforeNode(node)
          p.appendChild(node)
          continue
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement
          const tag = el.tagName.toLowerCase()
          if (tag === 'br') {
            const p = ensureParagraphBeforeNode(node)
            p.appendChild(node)
            continue
          }
          if (!blockTags.has(tag) && inlineTags.has(tag)) {
            const p = ensureParagraphBeforeNode(node)
            p.appendChild(node)
            continue
          }
        }
      }

      // Unwrap headings that ended up inside <p>.
      // We intentionally keep lists inside paragraph blocks for the "paragraph box"
      // editing experience.
      const nestedBlocks = Array.from(editor.querySelectorAll(
        'p > h1, p > h2, p > h3, p > h4, p > h5, p > h6'
      ))
      for (const block of nestedBlocks) {
        const parentP = block.parentElement
        if (!parentP || parentP === editor || !parentP.parentNode) continue
        // Only unwrap if the <p> contains no other significant content
        const hasOtherContent = Array.from(parentP.childNodes).some((n) => {
          if (n === block) return false
          if (n.nodeType === Node.TEXT_NODE) return (n.textContent || '').trim().length > 0
          if (n.nodeName === 'BR') return false
          return true
        })
        if (!hasOtherContent) {
          parentP.parentNode.insertBefore(block, parentP.nextSibling)
          if (!(parentP.textContent || '').replace(/\u200b/g, '').trim()) {
            parentP.remove()
          }
        }
      }

      ensureCodeBlockControls(editor)

      isInternalChange.current = true
      const newContent = editor.innerHTML
      onChange(newContent)
    }
  }, [ensureCodeBlockControls, onChange])

  const scrollCaretIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      const selection = window.getSelection()
      if (!selection || !selection.rangeCount) return
      const anchorNode = selection.anchorNode
      const element = anchorNode?.nodeType === Node.TEXT_NODE
        ? anchorNode.parentElement
        : anchorNode as HTMLElement | null
      element?.scrollIntoView({ block: 'nearest' })
    })
  }, [])

  const restoreSavedSelection = useCallback((): Selection | null => {
    const selection = window.getSelection()
    const editor = editorRef.current
    if (!selection || !editor) return null

    if (selection.rangeCount > 0 && editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange()
      return selection
    }

    if (savedRangeRef.current) {
      selection.removeAllRanges()
      selection.addRange(savedRangeRef.current.cloneRange())
      return selection
    }

    editor.focus()
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
    savedRangeRef.current = range.cloneRange()
    return selection
  }, [])

  const ensureReadyCaretForEmptyEditor = useCallback(() => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection) return

    if (!editor.innerHTML.trim()) {
      editor.innerHTML = '<p><br></p>'
    }

    const firstParagraph = editor.querySelector('p') as HTMLParagraphElement | null
    const targetBlock = firstParagraph || editor
    const textNode = Array.from(targetBlock.childNodes).find((node) => node.nodeType === Node.TEXT_NODE) as Text | undefined

    const range = document.createRange()
    if (textNode) {
      range.setStart(textNode, 0)
    } else if (targetBlock.firstChild) {
      range.setStart(targetBlock, 0)
    } else {
      const anchor = document.createTextNode('')
      targetBlock.appendChild(anchor)
      range.setStart(anchor, 0)
    }
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    savedRangeRef.current = range.cloneRange()
  }, [])

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
    if ((e.nativeEvent as KeyboardEvent).isComposing || ((e.nativeEvent as KeyboardEvent).keyCode === 229)) {
      return false
    }
    if (!editorRef.current) return false
    const selection = window.getSelection()
    if (!selection || !selection.isCollapsed) return false

    const block = getCurrentBlock(selection)
    if (!block) return false
    const blockTag = block.tagName.toLowerCase()

    const beforeCaret = getTextBeforeCaretInBlock(block, selection)
    const currentLine = (beforeCaret.split('\n').pop() || '').replace(/\u200b/g, '').trim()

    if (e.key === ' ') {
      // Do not run block markdown shortcuts while already inside a heading.
      // This avoids IME candidate-confirm space accidentally retriggering
      // markdown transformations and dropping composing text.
      if (blockTag === 'h1' || blockTag === 'h2' || blockTag === 'h3') return false

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
        const listBlock = ensureIsolatedBlock()
        if (listBlock) {
          const ul = document.createElement('ul')
          const li = document.createElement('li')
          li.appendChild(document.createElement('br'))
          ul.appendChild(li)
          listBlock.parentNode?.replaceChild(ul, listBlock)
          const r = document.createRange()
          r.selectNodeContents(li)
          r.collapse(true)
          selection.removeAllRanges()
          selection.addRange(r)
        } else {
          document.execCommand('insertUnorderedList', false)
        }
        handleInput()
        return true
      }

      if (/^\d+\.$/.test(currentLine)) {
        e.preventDefault()
        if (!deleteMarkdownTrigger(selection, currentLine)) return false
        const listBlock = ensureIsolatedBlock()
        if (listBlock) {
          const ol = document.createElement('ol')
          const li = document.createElement('li')
          li.appendChild(document.createElement('br'))
          ol.appendChild(li)
          listBlock.parentNode?.replaceChild(ol, listBlock)
          const r = document.createRange()
          r.selectNodeContents(li)
          r.collapse(true)
          selection.removeAllRanges()
          selection.addRange(r)
        } else {
          document.execCommand('insertOrderedList', false)
        }
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

  const clearInlineTypingState = useCallback((includeBold = false) => {
    const commands: Array<'bold' | 'italic' | 'strikeThrough' | 'underline'> = [
      'italic',
      'strikeThrough',
      'underline',
    ]
    if (includeBold) {
      commands.unshift('bold')
    }
    for (const command of commands) {
      if (document.queryCommandState(command)) {
        document.execCommand(command, false)
      }
    }
  }, [])

  const clearColorTypingState = useCallback(() => {
    const editorColor = editorRef.current
      ? getComputedStyle(editorRef.current).color
      : 'inherit'
    const defaultColor = editorColor || 'inherit'
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
    const isSpaceTrigger = e.key === ' '
    const isPrintableTrigger =
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey

    if (!isSpaceTrigger && !isPrintableTrigger) return false

    const selection = window.getSelection()
    if (!selection || !selection.isCollapsed || !selection.rangeCount) return false

    const range = selection.getRangeAt(0)
    if (range.startContainer.nodeType !== Node.TEXT_NODE) return false

    const textNode = range.startContainer as Text
    const offset = range.startOffset
    const before = textNode.data.slice(0, offset)
    const candidate = isSpaceTrigger ? before : `${before}${e.key}`

    type InlineMatch = {
      regex: RegExp
      build: (match: RegExpMatchArray) => HTMLElement
      resetCommands?: Array<'bold' | 'italic' | 'strikeThrough' | 'underline'>
      triggerKeys?: string[]
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
        triggerKeys: [' ', '*'],
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
        triggerKeys: [' ', '*'],
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
        triggerKeys: [' ', '_'],
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
        triggerKeys: [' ', '~', '～'],
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
        triggerKeys: [' ', '`'],
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
        triggerKeys: [' ', '+'],
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
        triggerKeys: [' '],
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
        triggerKeys: [' ', ')'],
      },
      {
        // $inline formula$
        regex: /\$([^$\n]+)\$$/,
        build: (m) => {
          const el = document.createElement('span')
          el.contentEditable = 'false'
          el.className = 'formula-inline'
          const latex = (m[1] || '').trim()
          el.dataset.latex = latex
          if (!latex) {
            el.dataset.empty = 'true'
            try {
              katex.render('x', el, { throwOnError: false, displayMode: false })
            } catch {
              el.textContent = 'fx'
            }
            return el
          }
          try {
            katex.render(latex, el, { throwOnError: false, displayMode: false })
          } catch {
            el.textContent = latex
          }
          return el
        },
        triggerKeys: [' ', '$'],
      },
    ]

    for (const pattern of patterns) {
      if (pattern.triggerKeys && !pattern.triggerKeys.includes(e.key)) continue

      const match = candidate.match(pattern.regex)
      if (!match) continue

      const fullMatch = match[0]
      const replaceStart = offset - before.length + candidate.length - fullMatch.length

      if (replaceStart < 0) return false

      e.preventDefault()

      const replaceRange = document.createRange()
      replaceRange.setStart(textNode, replaceStart)
      replaceRange.setEnd(textNode, offset)
      replaceRange.deleteContents()

      const fragment = document.createDocumentFragment()
      const formattedNode = pattern.build(match)
      // Keep a dedicated plain-text caret anchor after the formatted node so
      // subsequent typing stays outside the inline style without needing an
      // extra visible space or keydown-time selection fixes.
      const caretAnchor = document.createTextNode('')
      fragment.appendChild(formattedNode)
      fragment.appendChild(caretAnchor)
      replaceRange.insertNode(fragment)

      const caretRange = document.createRange()
      caretRange.setStart(caretAnchor, 0)
      caretRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(caretRange)

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
        clearInlineTypingState(true)
      }

      shouldResetInlineTypingRef.current = false

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

  // Sync content to editor when it changes externally
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      const currentHtml = editorRef.current.innerHTML
      // Only update if the content is different and editor is not focused
      if (document.activeElement !== editorRef.current && currentHtml !== content) {
        editorRef.current.innerHTML = content || '<p><br></p>'
        ensureCodeBlockControls(editorRef.current)
        renderCodeHighlights(editorRef.current, true)
        if (!content) {
          savedRangeRef.current = null
        }
      }
    }
    isInternalChange.current = false
  }, [content, ensureCodeBlockControls, renderCodeHighlights])

  useEffect(() => {
    if (!editorRef.current || content) return
    ensureReadyCaretForEmptyEditor()
  }, [content, ensureReadyCaretForEmptyEditor])

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

  // Keep toolbar active state in sync with current selection/caret.
  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) {
      setFormatState(DEFAULT_FORMAT_STATE)
      return
    }

    const range = selection.getRangeAt(0)
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange()
      const detectedFormat = detectFormatState(range.commonAncestorContainer)
      setFormatState(detectedFormat)
    } else {
      setFormatState(DEFAULT_FORMAT_STATE)
    }
  }, [detectFormatState])

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [handleSelectionChange])

  const scrollToHeadingIndex = useCallback((index: number) => {
    if (!editorRef.current || index < 0) return
    const headings = editorRef.current.querySelectorAll('h1, h2, h3')
    const target = headings[index] as HTMLElement | undefined
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  useEffect(() => {
    const handleScrollToHeading = (event: Event) => {
      const customEvent = event as CustomEvent<{ index?: number }>
      const index = customEvent.detail?.index
      if (typeof index === 'number') {
        scrollToHeadingIndex(index)
      }
    }
    window.addEventListener('editor-scroll-to-heading', handleScrollToHeading)
    return () => {
      window.removeEventListener('editor-scroll-to-heading', handleScrollToHeading)
    }
  }, [scrollToHeadingIndex])

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

  const getFontSizeFromRange = useCallback((range: Range): number => {
    const nodesToCheck: Node[] = []
    if (range.startContainer) nodesToCheck.push(range.startContainer)
    if (range.endContainer && range.endContainer !== range.startContainer) {
      nodesToCheck.push(range.endContainer)
    }

    const cloned = range.cloneContents()
    const sizedInFragment = cloned.querySelector('.font-size-span') as HTMLElement | null
    if (sizedInFragment) {
      const parsed = parseInt(sizedInFragment.style.fontSize || '', 10)
      if (!Number.isNaN(parsed) && parsed > 0) return parsed
    }

    for (const node of nodesToCheck) {
      let current: Node | null = node
      while (current && current !== editorRef.current) {
        if (
          current.nodeType === Node.ELEMENT_NODE &&
          (current as HTMLElement).classList.contains('font-size-span')
        ) {
          const parsed = parseInt((current as HTMLElement).style.fontSize || '', 10)
          if (!Number.isNaN(parsed) && parsed > 0) return parsed
        }
        current = current.parentNode
      }
    }

    return getFontSizeFromNode(range.startContainer)
  }, [getFontSizeFromNode])

  // Helper to select an element and place current selection on it.
  const selectElement = useCallback((element: HTMLElement) => {
    const selection = window.getSelection()
    if (!selection) return
    
    const range = document.createRange()
    range.selectNodeContents(element)
    selection.removeAllRanges()
    selection.addRange(range)
  }, [])

  const wrapSelectionWithStyle = useCallback(
    (property: 'color' | 'backgroundColor', value: string, clearToken: string): boolean => {
      const selection = restoreSavedSelection()
      if (!selection || selection.isCollapsed || !selection.rangeCount) return false

      const range = selection.getRangeAt(0)
      const extracted = range.extractContents()

      // Remove existing inline color/highlight styles from extracted nodes
      // so switching color/highlight works consistently.
      const allElements = extracted.querySelectorAll('*')
      allElements.forEach((el) => {
        (el as HTMLElement).style.removeProperty(property === 'color' ? 'color' : 'background-color')
      })

      if (value === clearToken) {
        const marker = document.createTextNode('')
        range.insertNode(marker)
        marker.parentNode?.insertBefore(extracted, marker)
        const caret = document.createRange()
        caret.setStartAfter(marker)
        caret.collapse(true)
        marker.parentNode?.removeChild(marker)
        selection.removeAllRanges()
        selection.addRange(caret)
        savedRangeRef.current = caret.cloneRange()
        return true
      } else {
        const span = document.createElement('span')
        span.style[property] = value
        span.appendChild(extracted)
        range.insertNode(span)
        const caret = document.createRange()
        caret.setStartAfter(span)
        caret.collapse(true)
        selection.removeAllRanges()
        selection.addRange(caret)
        savedRangeRef.current = caret.cloneRange()
        return true
      }
    },
    [restoreSavedSelection]
  )

  const insertHtmlAtCaret = useCallback((html: string) => {
    restoreSavedSelection()
    document.execCommand('insertHTML', false, html)
    scrollCaretIntoView()
  }, [restoreSavedSelection, scrollCaretIntoView])

  const insertCodeBlockAtCaret = useCallback(() => {
    const selection = restoreSavedSelection()
    if (!selection || !selection.rangeCount) return
    const range = selection.getRangeAt(0)
    const currentBlock = getCurrentBlock(selection)
    const codeText = document.createTextNode('\n')
    const wrapper = document.createElement('div')
    wrapper.className = 'code-block-wrapper'
    const pre = document.createElement('pre')
    pre.className = 'editor-code-block'
    const code = document.createElement('code')
    code.setAttribute('data-language', 'plaintext')
    code.appendChild(codeText)
    pre.appendChild(code)
    wrapper.setAttribute('data-code-language', 'plaintext')
    const controls = document.createElement('div')
    controls.className = 'code-controls'
    controls.setAttribute('contenteditable', 'false')
    const langSelect = document.createElement('select')
    langSelect.className = 'code-lang-select'
    langSelect.setAttribute('contenteditable', 'false')
    langSelect.setAttribute('data-code-lang-select', 'true')
    CODE_LANGUAGES.forEach((lang) => {
      const option = document.createElement('option')
      option.value = lang
      option.textContent = lang
      langSelect.appendChild(option)
    })
    langSelect.value = 'plaintext'
    const copyButton = document.createElement('button')
    copyButton.type = 'button'
    copyButton.draggable = false
    copyButton.className = 'code-copy-btn'
    copyButton.setAttribute('contenteditable', 'false')
    copyButton.setAttribute('data-copy-code-btn', 'true')
    copyButton.title = 'Copy code'
    copyButton.innerHTML = '⧉'
    controls.appendChild(langSelect)
    controls.appendChild(copyButton)
    const copyToast = document.createElement('span')
    copyToast.className = 'code-copy-toast'
    copyToast.setAttribute('contenteditable', 'false')
    copyToast.textContent = '复制成功'
    wrapper.appendChild(pre)
    wrapper.appendChild(controls)
    wrapper.appendChild(copyToast)

    const paragraph = document.createElement('p')
    paragraph.appendChild(document.createElement('br'))

    if (!selection.isCollapsed) {
      range.deleteContents()
    }

    if (currentBlock && editorRef.current && currentBlock !== editorRef.current) {
      currentBlock.parentNode?.insertBefore(wrapper, currentBlock.nextSibling)
      currentBlock.parentNode?.insertBefore(paragraph, wrapper.nextSibling)
    } else if (editorRef.current) {
      editorRef.current.appendChild(wrapper)
      editorRef.current.appendChild(paragraph)
    } else {
      range.insertNode(paragraph)
      range.insertNode(wrapper)
    }

    const caret = document.createRange()
    caret.setStart(codeText, 0)
    caret.collapse(true)
    selection.removeAllRanges()
    selection.addRange(caret)
    savedRangeRef.current = caret.cloneRange()
    handleInput()
  }, [getCurrentBlock, handleInput, restoreSavedSelection])

  const isSelectionInsideCodeBlock = useCallback((): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return false
    const range = selection.getRangeAt(0)
    const nodesToCheck: Array<Node | null> = [
      selection.anchorNode,
      selection.focusNode,
      range.commonAncestorContainer,
    ]
    for (const node of nodesToCheck) {
      const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement | null
      if (!element) continue
      const pre = element.closest('pre.editor-code-block')
      if (pre && editorRef.current.contains(pre)) return true
    }
    return false
  }, [])

  const insertNewLineInCodeBlock = useCallback((): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return false
    const range = selection.getRangeAt(0)
    range.deleteContents()
    const newLineNode = document.createTextNode('\n')
    range.insertNode(newLineNode)

    const caret = document.createRange()
    caret.setStart(newLineNode, newLineNode.textContent?.length || 1)
    caret.collapse(true)
    selection.removeAllRanges()
    selection.addRange(caret)
    savedRangeRef.current = caret.cloneRange()
    return true
  }, [])

  const insertSoftBreakAtCaret = useCallback((): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return false
    document.execCommand('insertLineBreak', false)
    if (selection.rangeCount) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange()
    }
    return true
  }, [])

  const splitParagraphAtCaret = useCallback((): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return false

    const editor = editorRef.current
    const currentBlock = getCurrentBlock(selection)
    if (!currentBlock || currentBlock === editor) return false

    const placeCaretInBlockStart = (block: HTMLElement) => {
      const caret = document.createRange()
      caret.selectNodeContents(block)
      caret.collapse(true)
      selection.removeAllRanges()
      selection.addRange(caret)
      savedRangeRef.current = caret.cloneRange()
    }

    const blockContainsSoftBreak = currentBlock.tagName.toLowerCase() !== 'pre' && (
      !!currentBlock.querySelector('br') ||
      Array.from(currentBlock.childNodes).some((node) => node.nodeName === 'BR')
    )

    if (blockContainsSoftBreak) {
      const isolatedBlock = ensureIsolatedBlock()
      if (isolatedBlock && isolatedBlock !== currentBlock && isolatedBlock.parentNode) {
        const blankParagraph = document.createElement('p')
        blankParagraph.appendChild(document.createElement('br'))
        isolatedBlock.parentNode.insertBefore(blankParagraph, isolatedBlock)
        placeCaretInBlockStart(blankParagraph)
        return true
      }
    }

    const hasMeaningfulContent = (node: ParentNode): boolean => {
      const text = (node.textContent || '').replace(/\u200b/g, '').trim()
      return text.length > 0 || !!node.querySelector('img, table, hr, pre, ul, ol, blockquote')
    }

    const hasVisualBreak = (node: ParentNode): boolean => {
      const children = Array.from(node.childNodes)
      for (const child of children) {
        if (child.nodeType === Node.TEXT_NODE) {
          if ((child.textContent || '').includes('\n')) return true
          continue
        }
        if (child.nodeType === Node.ELEMENT_NODE) {
          const element = child as HTMLElement
          if (element.tagName.toLowerCase() === 'br') return true
          if (hasVisualBreak(element)) return true
        }
      }
      return false
    }

    const ensureBlockPlaceholder = (block: HTMLElement) => {
      if (!hasMeaningfulContent(block) && !block.querySelector('br')) {
        block.appendChild(document.createElement('br'))
      }
    }

    const inlineTags = new Set(['span', 'font', 'strong', 'em', 'b', 'i', 'u', 'a', 's', 'del', 'code'])
    const consumeLeadingVisualBreak = (node: ParentNode): boolean => {
      let child = node.firstChild
      while (child) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent || ''
          const withoutZwsp = text.replace(/\u200b/g, '')
          const leadingMatch = withoutZwsp.match(/^[\s\u00a0]*\n/)
          if (leadingMatch) {
            child.textContent = text.replace(/^([\u200b\s\u00a0]*)\n/, '$1')
            return true
          }
          if (withoutZwsp.trim()) return false
          const next = child.nextSibling
          child.parentNode?.removeChild(child)
          child = next
          continue
        }

        if (child.nodeType === Node.ELEMENT_NODE) {
          const element = child as HTMLElement
          const tag = element.tagName.toLowerCase()
          if (tag === 'br') {
            element.parentNode?.removeChild(element)
            return true
          }
          if (inlineTags.has(tag)) {
            const stripped = consumeLeadingVisualBreak(element)
            const shouldRemoveEmptyWrapper =
              !hasMeaningfulContent(element) &&
              !element.querySelector('br, img, table, hr, pre, ul, ol, blockquote')
            if (shouldRemoveEmptyWrapper) {
              element.parentNode?.removeChild(element)
            }
            if (stripped) return true
            child = shouldRemoveEmptyWrapper ? node.firstChild : element.nextSibling
            continue
          }
        }

        return false
      }

      return false
    }

    const consumeTrailingVisualBreak = (node: ParentNode): boolean => {
      let child = node.lastChild
      while (child) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent || ''
          const withoutZwsp = text.replace(/\u200b/g, '')
          const trailingMatch = withoutZwsp.match(/\n[\s\u00a0]*$/)
          if (trailingMatch) {
            child.textContent = text.replace(/\n([\u200b\s\u00a0]*)$/, '$1')
            return true
          }
          if (withoutZwsp.trim()) return false
          const previous = child.previousSibling
          child.parentNode?.removeChild(child)
          child = previous
          continue
        }

        if (child.nodeType === Node.ELEMENT_NODE) {
          const element = child as HTMLElement
          const tag = element.tagName.toLowerCase()
          if (tag === 'br') {
            element.parentNode?.removeChild(element)
            return true
          }
          if (inlineTags.has(tag)) {
            const stripped = consumeTrailingVisualBreak(element)
            const shouldRemoveEmptyWrapper =
              !hasMeaningfulContent(element) &&
              !element.querySelector('br, img, table, hr, pre, ul, ol, blockquote')
            if (shouldRemoveEmptyWrapper) {
              element.parentNode?.removeChild(element)
            }
            if (stripped) return true
            child = shouldRemoveEmptyWrapper ? node.lastChild : element.previousSibling
            continue
          }
        }

        return false
      }

      return false
    }

    let range = selection.getRangeAt(0)
    if (!range.collapsed) {
      range.deleteContents()
      range = selection.getRangeAt(0)
    }

    const splitMarker = document.createComment('enter-split-marker')
    range.insertNode(splitMarker)

    const previewBeforeRange = document.createRange()
    previewBeforeRange.selectNodeContents(currentBlock)
    previewBeforeRange.setEndBefore(splitMarker)
    const previewBefore = previewBeforeRange.cloneContents()
    const caretStartsAfterVisualBreak = consumeTrailingVisualBreak(previewBefore)

    const previewRange = document.createRange()
    previewRange.setStartAfter(splitMarker)
    previewRange.setEnd(currentBlock, currentBlock.childNodes.length)
    const previewTrailing = previewRange.cloneContents()
    const shouldInsertBlankLineBeforeTrailing = consumeLeadingVisualBreak(previewTrailing)

    const extractRange = document.createRange()
    extractRange.setStartAfter(splitMarker)
    extractRange.setEnd(currentBlock, currentBlock.childNodes.length)
    const trailingContent = extractRange.extractContents()
    splitMarker.parentNode?.removeChild(splitMarker)

    let hasTrailing = hasMeaningfulContent(trailingContent)
    const trailingContainsVisualBreak = hasVisualBreak(trailingContent)
    let leadingSoftBreak = false
    while (hasTrailing && consumeLeadingVisualBreak(trailingContent)) {
      leadingSoftBreak = true
      hasTrailing = hasMeaningfulContent(trailingContent)
    }

    if (caretStartsAfterVisualBreak) {
      while (consumeTrailingVisualBreak(currentBlock)) {
        // Remove the soft-break that visually belonged between the two lines
        // so the current block becomes the actual previous paragraph.
      }
    }

    ensureBlockPlaceholder(currentBlock)

    const newParagraph = document.createElement('p')
    newParagraph.appendChild(document.createElement('br'))
    currentBlock.parentNode?.insertBefore(newParagraph, currentBlock.nextSibling)

    if (hasTrailing) {
      if (
        leadingSoftBreak ||
        shouldInsertBlankLineBeforeTrailing ||
        trailingContainsVisualBreak ||
        caretStartsAfterVisualBreak
      ) {
        const trailingParagraph = document.createElement('p')
        trailingParagraph.appendChild(trailingContent)
        ensureBlockPlaceholder(trailingParagraph)
        newParagraph.parentNode?.insertBefore(trailingParagraph, newParagraph.nextSibling)
      } else {
        while (newParagraph.firstChild) newParagraph.removeChild(newParagraph.firstChild)
        newParagraph.appendChild(trailingContent)
        ensureBlockPlaceholder(newParagraph)
      }
    }

    const caret = document.createRange()
    placeCaretInBlockStart(newParagraph)
    return true
  }, [ensureIsolatedBlock, getCurrentBlock])

  const exitHeadingWithParagraph = useCallback((): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return false
    const anchor = selection.anchorNode
    const element = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor as HTMLElement | null
    const heading = element?.closest('h1, h2, h3, h4, h5, h6') as HTMLElement | null
    if (!heading || !editorRef.current.contains(heading)) return false

    const paragraph = document.createElement('p')
    paragraph.appendChild(document.createElement('br'))
    heading.parentNode?.insertBefore(paragraph, heading.nextSibling)

    const range = document.createRange()
    range.selectNodeContents(paragraph)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    savedRangeRef.current = range.cloneRange()
    return true
  }, [])

  const exitCurrentBlockWithNewParagraph = useCallback((): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return false
    const currentBlock = getCurrentBlock(selection)
    if (!currentBlock || currentBlock === editorRef.current) return false

    const newP = document.createElement('p')
    newP.appendChild(document.createElement('br'))
    currentBlock.parentNode?.insertBefore(newP, currentBlock.nextSibling)

    const range = document.createRange()
    range.selectNodeContents(newP)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    savedRangeRef.current = range.cloneRange()
    return true
  }, [getCurrentBlock])

  const getCurrentListItem = useCallback((): HTMLLIElement | null => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return null
    const range = selection.getRangeAt(0)
    const nodesToCheck: Array<Node | null> = [
      selection.anchorNode,
      selection.focusNode,
      range.commonAncestorContainer,
    ]
    for (const node of nodesToCheck) {
      const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement | null
      if (!element) continue
      const li = element.closest('li') as HTMLLIElement | null
      if (li && editorRef.current.contains(li)) return li
    }
    return null
  }, [])

  const isCaretInsideList = useCallback((): boolean => {
    return !!getCurrentListItem()
  }, [getCurrentListItem])

  const cleanupEmptyParagraphContainer = useCallback((node: Element | null) => {
    const paragraph = node?.tagName?.toLowerCase() === 'p' ? node as HTMLParagraphElement : null
    if (!paragraph || paragraph === editorRef.current) return
    const hasBlockChildren = paragraph.querySelector('ul, ol, pre, table, blockquote, h1, h2, h3, h4, h5, h6, hr, img')
    const normalizedText = (paragraph.textContent || '').replace(/\u200b/g, '').trim()
    if (!hasBlockChildren && normalizedText.length === 0) {
      paragraph.remove()
    }
  }, [])

  const handleListEnter = useCallback((): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return false
    const li = getCurrentListItem()
    if (!li) return false
    const list = li.parentElement as HTMLOListElement | HTMLUListElement | null
    if (!list || (list.tagName !== 'UL' && list.tagName !== 'OL')) return false

    const liText = (li.textContent || '').replace(/\u200b/g, '').trim()
    const isEmpty = liText.length === 0
    if (isEmpty) {
      const listParent = list.parentNode
      const listNextSibling = list.nextSibling
      const listContainer = list.parentElement?.tagName.toLowerCase() === 'p'
        ? list.parentElement as HTMLParagraphElement
        : null
      list.removeChild(li)
      if (list.children.length === 0) {
        list.remove()
      }
      const caret = document.createRange()
      if (listContainer) {
        const textOnly = (listContainer.textContent || '').replace(/\u200b/g, '').trim()
        const hasList = !!listContainer.querySelector('ul, ol')
        if (!hasList && textOnly.length === 0) {
          listContainer.innerHTML = '<br>'
        } else {
          listContainer.appendChild(document.createElement('br'))
        }
        caret.selectNodeContents(listContainer)
        caret.collapse(false)
      } else {
        const p = document.createElement('p')
        p.appendChild(document.createElement('br'))
        if (listParent) {
          listParent.insertBefore(p, listNextSibling)
        } else {
          editorRef.current.appendChild(p)
        }
        caret.selectNodeContents(p)
        caret.collapse(true)
      }
      selection.removeAllRanges()
      selection.addRange(caret)
      savedRangeRef.current = caret.cloneRange()
      return true
    }

    const newLi = document.createElement('li')
    newLi.appendChild(document.createElement('br'))
    li.parentNode?.insertBefore(newLi, li.nextSibling)
    const caret = document.createRange()
    caret.selectNodeContents(newLi)
    caret.collapse(true)
    selection.removeAllRanges()
    selection.addRange(caret)
    savedRangeRef.current = caret.cloneRange()
    return true
  }, [cleanupEmptyParagraphContainer, getCurrentListItem])

  const removeSingleEmptyListAtCaret = useCallback((): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return false
    const li = getCurrentListItem()
    if (!li) return false
    const list = li.parentElement as HTMLOListElement | HTMLUListElement | null
    if (!list || (list.tagName !== 'UL' && list.tagName !== 'OL')) return false
    if (list.children.length !== 1 || list.firstElementChild !== li) return false
    const liText = (li.textContent || '').replace(/\u200b/g, '').trim()
    if (liText.length > 0) return false

    const listContainer = list.parentElement?.tagName.toLowerCase() === 'p'
      ? list.parentElement
      : list
    const previous = listContainer?.previousElementSibling || null
    const next = listContainer?.nextElementSibling || null
    list.remove()
    cleanupEmptyParagraphContainer(listContainer)

    const caret = document.createRange()
    if (previous && previous.nodeType === Node.ELEMENT_NODE) {
      caret.selectNodeContents(previous)
      caret.collapse(false)
    } else if (next && next.nodeType === Node.ELEMENT_NODE) {
      caret.selectNodeContents(next)
      caret.collapse(true)
    } else {
      const p = document.createElement('p')
      p.appendChild(document.createElement('br'))
      editorRef.current.appendChild(p)
      caret.selectNodeContents(p)
      caret.collapse(true)
    }
    selection.removeAllRanges()
    selection.addRange(caret)
    savedRangeRef.current = caret.cloneRange()
    return true
  }, [cleanupEmptyParagraphContainer, getCurrentListItem])

  const getCurrentTableCell = useCallback((): HTMLTableCellElement | null => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return null
    const anchor = selection.anchorNode
    const element = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor as HTMLElement | null
    if (!element) return null
    const cell = element.closest('td, th') as HTMLTableCellElement | null
    if (!cell) return null
    return editorRef.current.contains(cell) ? cell : null
  }, [])

  const renderFormulaElement = useCallback((el: HTMLElement, latex: string) => {
    const normalized = latex.trim()
    el.dataset.latex = normalized
    el.classList.add('formula-inline')
    if (!normalized) {
      el.dataset.empty = 'true'
      try {
        katex.render('x', el, { throwOnError: false, displayMode: false })
      } catch {
        el.innerHTML = '<span class="formula-inline-placeholder">fx</span>'
      }
      return
    }
    delete el.dataset.empty
    try {
      katex.render(normalized, el, { throwOnError: false, displayMode: false })
    } catch {
      el.textContent = normalized
    }
  }, [])

  const recalcSelectedImageOverlay = useCallback((imageEl: HTMLImageElement | null = selectedImage) => {
    if (!imageEl || !editorRef.current) {
      setImageOverlayRect(null)
      return
    }
    if (!imageEl.isConnected) {
      setSelectedImage(null)
      setImageOverlayRect(null)
      return
    }
    const containerRect = editorRef.current.getBoundingClientRect()
    const imageRect = imageEl.getBoundingClientRect()
    setImageOverlayRect({
      top: imageRect.top - containerRect.top + editorRef.current.scrollTop + editorRef.current.offsetTop,
      left: imageRect.left - containerRect.left + editorRef.current.scrollLeft + editorRef.current.offsetLeft,
      width: imageRect.width,
      height: imageRect.height,
    })
  }, [selectedImage])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !selectedImage) return
    const handleRecalc = () => recalcSelectedImageOverlay()
    editor.addEventListener('scroll', handleRecalc)
    window.addEventListener('resize', handleRecalc)
    return () => {
      editor.removeEventListener('scroll', handleRecalc)
      window.removeEventListener('resize', handleRecalc)
    }
  }, [recalcSelectedImageOverlay, selectedImage])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeDragRef.current || !selectedImage) return
      e.preventDefault()
      const drag = resizeDragRef.current
      const dx = e.clientX - drag.startX
      const signX = drag.corner === 'sw' || drag.corner === 'nw' ? -1 : 1
      const nextWidth = Math.max(60, drag.startWidth + dx * signX)
      const nextHeight = Math.max(40, nextWidth / drag.ratio)
      selectedImage.style.width = `${Math.round(nextWidth)}px`
      selectedImage.style.height = `${Math.round(nextHeight)}px`
      selectedImage.removeAttribute('width')
      selectedImage.removeAttribute('height')
      recalcSelectedImageOverlay()
    }
    const handleMouseUp = () => {
      if (!resizeDragRef.current) return
      resizeDragRef.current = null
      handleInput()
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleInput, recalcSelectedImageOverlay, selectedImage])

  const handleEditorClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (!editorRef.current) return

    const placeCaretFromPoint = () => {
      const doc = document as Document & {
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
        caretRangeFromPoint?: (x: number, y: number) => Range | null
      }
      const selection = window.getSelection()
      if (!selection) return
      if (selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed) return

      let nextRange: Range | null = null
      const caretPosition = doc.caretPositionFromPoint?.(e.clientX, e.clientY)
      if (caretPosition) {
        nextRange = document.createRange()
        nextRange.setStart(caretPosition.offsetNode, caretPosition.offset)
        nextRange.collapse(true)
      } else {
        nextRange = doc.caretRangeFromPoint?.(e.clientX, e.clientY) || null
      }

      if (!nextRange || !editorRef.current?.contains(nextRange.startContainer)) return
      selection.removeAllRanges()
      selection.addRange(nextRange)
      savedRangeRef.current = nextRange.cloneRange()
    }

    const formula = target.closest('.formula-inline')
    if (formula) return

    const link = target.closest('a') as HTMLAnchorElement | null
    if (link && editorRef.current.contains(link)) {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault()
        const href = link.getAttribute('href') || link.href || ''
        if (href) {
          try {
            const anchor = document.createElement('a')
            anchor.href = href
            anchor.target = '_blank'
            anchor.rel = 'noopener noreferrer'
            document.body.appendChild(anchor)
            anchor.click()
            document.body.removeChild(anchor)
            return
          } catch {
            // Continue fallback
          }
          try {
            const openedWindow = window.open(href, '_blank', 'noopener,noreferrer')
            if (openedWindow) return
          } catch {
            // Continue fallback
          }
          void openExternal(href).catch(() => {
            // ignore
          })
        }
        return
      }
      e.preventDefault()
      const rect = link.getBoundingClientRect()
      const popoverWidth = 320
      const left = Math.max(8, Math.min(rect.left + rect.width / 2 - popoverWidth / 2, window.innerWidth - popoverWidth - 8))
      const top = Math.max(8, rect.bottom + 8)
      setEditingLink({
        element: link,
        text: link.textContent || '',
        href: link.getAttribute('href') || '',
        range: null,
        position: { top, left },
      })
      return
    }

    if (target.tagName === 'IMG') {
      const image = target as HTMLImageElement
      setSelectedImage(image)
      setEditingLink(null)
      recalcSelectedImageOverlay(image)
      return
    }

    setEditingLink(null)
    setSelectedImage(null)
    setImageOverlayRect(null)
    placeCaretFromPoint()
  }, [recalcSelectedImageOverlay])

  const openExternalUrl = useCallback((href: string) => {
    const url = href.trim()
    if (!url) return
    try {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      return
    } catch {
      // Continue to other fallbacks.
    }
    try {
      const openedWindow = window.open(url, '_blank', 'noopener,noreferrer')
      if (openedWindow) return
    } catch {
      // Continue to shell fallback.
    }
    try {
      void openExternal(url)
      return
    } catch {
      // ignore
    }
    // No-op fallback: keep editor stable even if platform blocks opening.
  }, [])

  const openFormulaDialog = useCallback((initialLatex: string, targetEl: HTMLElement | null) => {
    formulaTargetRef.current = targetEl
    setFormulaDraft(initialLatex)
    setIsFormulaDialogOpen(true)
  }, [])

  const saveFormulaFromDialog = useCallback(() => {
    const target = formulaTargetRef.current
    const latex = formulaDraft.trim()
    if (target) {
      renderFormulaElement(target, latex)
      handleInput()
    } else {
      const selection = restoreSavedSelection()
      if (!selection || !selection.rangeCount) {
        setIsFormulaDialogOpen(false)
        return
      }
      const range = selection.getRangeAt(0)
      const formula = document.createElement('span')
      formula.contentEditable = 'false'
      formula.className = 'formula-inline'
      renderFormulaElement(formula, latex)
      if (!selection.isCollapsed) {
        range.deleteContents()
      }
      range.insertNode(formula)
      const space = document.createTextNode(' ')
      formula.parentNode?.insertBefore(space, formula.nextSibling)
      const caret = document.createRange()
      caret.setStartAfter(space)
      caret.collapse(true)
      selection.removeAllRanges()
      selection.addRange(caret)
      savedRangeRef.current = caret.cloneRange()
      handleInput()
    }
    setIsFormulaDialogOpen(false)
    formulaTargetRef.current = null
  }, [formulaDraft, handleInput, renderFormulaElement, restoreSavedSelection])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const handleFormulaClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const formula = target?.closest('.formula-inline') as HTMLElement | null
      if (!formula || !editor.contains(formula)) return

      event.preventDefault()
      event.stopPropagation()
      openFormulaDialog(formula.dataset.latex || '', formula)
    }

    editor.addEventListener('click', handleFormulaClick)
    editor.addEventListener('dblclick', handleFormulaClick)
    return () => {
      editor.removeEventListener('click', handleFormulaClick)
      editor.removeEventListener('dblclick', handleFormulaClick)
    }
  }, [openFormulaDialog])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const doCopy = async (button: HTMLElement) => {
      const wrapper = button.closest('.code-block-wrapper')
      const code = wrapper?.querySelector('pre code')
      const rawText = code?.textContent || ''
      const copyText = rawText.replace(/\u200b/g, '')
      if (!copyText.trim()) return

      let copied = false
      try {
        await navigator.clipboard.writeText(copyText)
        copied = true
      } catch {
        const helper = document.createElement('textarea')
        helper.value = copyText
        helper.style.position = 'fixed'
        helper.style.opacity = '0'
        document.body.appendChild(helper)
        helper.focus()
        helper.select()
        copied = document.execCommand('copy')
        document.body.removeChild(helper)
      }

      if (!copied) return
      toast.success('复制成功')
      const toastEl = wrapper?.querySelector('.code-copy-toast')
      if (toastEl) {
        toastEl.classList.add('show')
        window.setTimeout(() => {
          toastEl.classList.remove('show')
        }, 1200)
      }
    }

    const handleCopyCodeMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const button = target?.closest('[data-copy-code-btn="true"]') as HTMLElement | null
      if (!button || !editor.contains(button)) return
      event.preventDefault()
      event.stopPropagation()
    }

    const handleCopyCodeClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const button = target?.closest('[data-copy-code-btn="true"]') as HTMLElement | null
      if (!button || !editor.contains(button)) return

      event.preventDefault()
      event.stopPropagation()
      await doCopy(button)
    }

    editor.addEventListener('mousedown', handleCopyCodeMouseDown)
    editor.addEventListener('click', handleCopyCodeClick)
    return () => {
      editor.removeEventListener('mousedown', handleCopyCodeMouseDown)
      editor.removeEventListener('click', handleCopyCodeClick)
    }
  }, [])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const handleFocusOut = (event: FocusEvent) => {
      const element = event.target as HTMLElement | null
      const codeEl = element?.closest('.code-block-wrapper pre code') as HTMLElement | null
      if (!codeEl) return
      const nextTarget = event.relatedTarget as HTMLElement | null
      const wrapper = codeEl.closest('.code-block-wrapper')
      if (
        nextTarget &&
        wrapper &&
        (wrapper.contains(nextTarget) || nextTarget.closest('[data-code-lang-select="true"]'))
      ) {
        return
      }
      const langSelect = wrapper?.querySelector('[data-code-lang-select="true"]') as HTMLSelectElement | null
      const lang = (langSelect?.value || wrapper?.getAttribute('data-code-language') || 'plaintext').toLowerCase()
      applySyntaxHighlight(codeEl, lang, true)
      handleInput()
    }

    const handleLangMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const select = target?.closest('[data-code-lang-select="true"]') as HTMLElement | null
      if (!select || !editor.contains(select)) return
      event.stopPropagation()
      const htmlSelect = select as HTMLSelectElement
      window.setTimeout(() => htmlSelect.focus(), 0)
    }

    const handleLangChange = (event: Event) => {
      const target = event.target as HTMLSelectElement | null
      if (!target || target.getAttribute('data-code-lang-select') !== 'true') return
      const wrapper = target.closest('.code-block-wrapper')
      const codeEl = wrapper?.querySelector('pre code') as HTMLElement | null
      if (!wrapper || !codeEl) return
      const lang = (target.value || 'plaintext').toLowerCase()
      wrapper.setAttribute('data-code-language', lang)
      codeEl.setAttribute('data-language', lang)
      applySyntaxHighlight(codeEl, lang, true)
      handleInput()
    }

    editor.addEventListener('focusout', handleFocusOut)
    editor.addEventListener('mousedown', handleLangMouseDown)
    editor.addEventListener('change', handleLangChange)
    editor.addEventListener('input', handleLangChange)
    return () => {
      editor.removeEventListener('focusout', handleFocusOut)
      editor.removeEventListener('mousedown', handleLangMouseDown)
      editor.removeEventListener('change', handleLangChange)
      editor.removeEventListener('input', handleLangChange)
    }
  }, [applySyntaxHighlight, handleInput])

  const applyFontSize = useCallback((size: number) => {
    const selection = restoreSavedSelection()
    if (!selection || !selection.rangeCount || selection.isCollapsed) return
    const range = selection.getRangeAt(0)
    const selectedText = selection.toString()
    if (!selectedText.trim()) return

    const commonEl = (range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentElement
      : range.commonAncestorContainer as HTMLElement | null)
    const existingSpan = commonEl?.closest('.font-size-span') as HTMLElement | null
    if (existingSpan) {
      // Only update in-place when the selection covers the ENTIRE span.
      // Otherwise fall through to extract + wrap so only the selected
      // portion gets the new size.
      const spanRange = document.createRange()
      spanRange.selectNodeContents(existingSpan)
      const coversWholeSpan =
        range.compareBoundaryPoints(Range.START_TO_START, spanRange) <= 0 &&
        range.compareBoundaryPoints(Range.END_TO_END, spanRange) >= 0
      if (coversWholeSpan) {
        existingSpan.style.fontSize = `${size}px`
        existingSpan.style.lineHeight = '1.6'
        const newRange = document.createRange()
        newRange.selectNodeContents(existingSpan)
        selection.removeAllRanges()
        selection.addRange(newRange)
        savedRangeRef.current = newRange.cloneRange()
        shouldResetInlineTypingRef.current = true
        handleInput()
        return
      }
    }

    const fragment = range.extractContents()
    const blockTags = new Set(['p', 'div', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'ul', 'ol', 'table', 'tr', 'td', 'th'])
    const existingSizedSpans = Array.from(fragment.querySelectorAll('.font-size-span')) as HTMLElement[]
    const containsStructuredContent =
      existingSizedSpans.length > 0 ||
      !!fragment.querySelector?.('p, div, li, blockquote, h1, h2, h3, h4, h5, h6, pre, ul, ol, table, tr, td, th, br')

    const wrapTextNodeWithFontSize = (textNode: Text) => {
      if (!textNode.textContent?.trim()) return
      const parent = textNode.parentNode
      if (!parent) return
      if (
        parent.nodeType === Node.ELEMENT_NODE &&
        (parent as HTMLElement).classList.contains('font-size-span')
      ) {
        const parentEl = parent as HTMLElement
        parentEl.style.fontSize = `${size}px`
        parentEl.style.lineHeight = '1.6'
        return
      }
      const fontSpan = document.createElement('span')
      fontSpan.className = 'font-size-span'
      fontSpan.style.fontSize = `${size}px`
      fontSpan.style.lineHeight = '1.6'
      parent.insertBefore(fontSpan, textNode)
      fontSpan.appendChild(textNode)
    }

    let firstInsertedNode: Node | null = null
    let lastInsertedNode: Node | null = null

    if (containsStructuredContent) {
      existingSizedSpans.forEach((span) => {
        span.style.fontSize = `${size}px`
        span.style.lineHeight = '1.6'
      })

      const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT)
      const textNodes: Text[] = []
      let current: Node | null = walker.nextNode()
      while (current) {
        const textNode = current as Text
        let shouldWrap = !!textNode.textContent?.trim()
        let ancestor = textNode.parentNode
        while (shouldWrap && ancestor && ancestor !== fragment) {
          if (
            ancestor.nodeType === Node.ELEMENT_NODE &&
            (ancestor as HTMLElement).classList.contains('font-size-span')
          ) {
            shouldWrap = false
            break
          }
          if (
            ancestor.nodeType === Node.ELEMENT_NODE &&
            blockTags.has((ancestor as HTMLElement).tagName.toLowerCase())
          ) {
            break
          }
          ancestor = ancestor.parentNode
        }
        if (shouldWrap) {
          textNodes.push(textNode)
        }
        current = walker.nextNode()
      }

      textNodes.forEach(wrapTextNodeWithFontSize)
      firstInsertedNode = fragment.firstChild
      lastInsertedNode = fragment.lastChild
      range.insertNode(fragment)
    } else {
      const fontSpan = document.createElement('span')
      fontSpan.className = 'font-size-span'
      fontSpan.style.fontSize = `${size}px`
      fontSpan.style.lineHeight = '1.6'
      fontSpan.appendChild(fragment)
      firstInsertedNode = fontSpan
      lastInsertedNode = fontSpan
      range.insertNode(fontSpan)
    }

    const newRange = document.createRange()
    try {
      if (
        firstInsertedNode &&
        lastInsertedNode &&
        firstInsertedNode.parentNode &&
        lastInsertedNode.parentNode
      ) {
        newRange.setStartBefore(firstInsertedNode)
        newRange.setEndAfter(lastInsertedNode)
      } else {
        newRange.setStart(range.startContainer, range.startOffset)
        newRange.setEnd(range.endContainer, range.endOffset)
      }
    } catch {
      newRange.setStart(range.startContainer, range.startOffset)
      newRange.setEnd(range.endContainer, range.endOffset)
    }
    selection.removeAllRanges()
    selection.addRange(newRange)
    savedRangeRef.current = newRange.cloneRange()
    shouldResetInlineTypingRef.current = true
    handleInput()
  }, [handleInput, restoreSavedSelection])

  // Apply style to selected text
  const applyStyle = useCallback((style: string, value?: string) => {
    const selection = restoreSavedSelection()
    if (!selection || !selection.rangeCount) return
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
        clearColorTypingState()
        shouldResetInlineTypingRef.current = false
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
        clearColorTypingState()
        shouldResetInlineTypingRef.current = false
        break
      case 'fontSize': {
        const numeric = Number((value || '16px').replace('px', ''))
        applyFontSize(Math.max(MIN_FONT_SIZE, Math.min(numeric, MAX_FONT_SIZE)))
        return
      }
      case 'fontSizeIncrease': {
        const currentSize = getFontSizeFromRange(range)
        applyFontSize(Math.min(currentSize + FONT_SIZE_STEP, MAX_FONT_SIZE))
        return
      }
      case 'fontSizeDecrease': {
        const currentSize = getFontSizeFromRange(range)
        applyFontSize(Math.max(currentSize - FONT_SIZE_STEP, MIN_FONT_SIZE))
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
      case 'list': {
        const alreadyInList = !!getCurrentListItem()
        if (alreadyInList) {
          document.execCommand(value === 'bullet' ? 'insertUnorderedList' : 'insertOrderedList', false)
          break
        }
        // Isolate the current line (splitting <br>-separated content in the
        // same <p> if necessary) so only the caret's line becomes a list item.
        const listBlock = ensureIsolatedBlock() || getCurrentBlock(selection)
        if (!listBlock || listBlock === editorRef.current) {
          document.execCommand(value === 'bullet' ? 'insertUnorderedList' : 'insertOrderedList', false)
          break
        }
        const listEl = document.createElement(value === 'bullet' ? 'ul' : 'ol')
        const newLi = document.createElement('li')
        while (listBlock.firstChild) {
          newLi.appendChild(listBlock.firstChild)
        }
        if (!newLi.innerHTML.trim()) newLi.appendChild(document.createElement('br'))
        listEl.appendChild(newLi)
        listBlock.appendChild(listEl)
        const listR = document.createRange()
        listR.selectNodeContents(newLi)
        listR.collapse(true)
        selection.removeAllRanges()
        selection.addRange(listR)
        savedRangeRef.current = listR.cloneRange()
        break
      }
      case 'quote':
        document.execCommand('formatBlock', false, '<blockquote>')
        setFormatState((prev) => ({ ...prev, heading: null }))
        break
      case 'link': {
        const active = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
          ? range.commonAncestorContainer.parentElement
          : range.commonAncestorContainer as HTMLElement | null
        const currentLink = active?.closest('a') as HTMLAnchorElement | null
        const selected = selectedText.trim()
        const rect = range.getBoundingClientRect()
        const popoverWidth = 320
        const left = Math.max(8, Math.min(rect.left + rect.width / 2 - popoverWidth / 2, window.innerWidth - popoverWidth - 8))
        const top = Math.max(8, rect.bottom + 8)
        setEditingLink({
          element: currentLink,
          text: currentLink?.textContent || selected || '',
          href: currentLink?.getAttribute('href') || 'https://',
          range: range.cloneRange(),
          position: { top, left },
        })
        if (!currentLink && selected) {
          savedRangeRef.current = range.cloneRange()
        }
        return
      }
      case 'hr':
        document.execCommand('insertHorizontalRule', false)
        break
      case 'normal':
        document.execCommand('formatBlock', false, '<p>')
        setFormatState((prev) => ({ ...prev, heading: null }))
        break
      case 'table':
        {
          const rowsInput = prompt('表格行数（>=1）', '3')
          const colsInput = prompt('表格列数（>=1）', '3')
          const rows = Math.max(1, Number(rowsInput || 3) || 3)
          const cols = Math.max(1, Number(colsInput || 3) || 3)
          const headers = Array.from({ length: cols }, (_, i) => `<th>Header ${i + 1}</th>`).join('')
          const bodyRows = Array.from({ length: rows - 1 }, (_, rowIndex) => {
            const cells = Array.from({ length: cols }, (_, colIndex) => `<td>Cell ${rowIndex + 1}-${colIndex + 1}</td>`).join('')
            return `<tr>${cells}</tr>`
          }).join('')
          insertHtmlAtCaret(`<table><thead><tr>${headers}</tr></thead><tbody>${bodyRows}</tbody></table><p><br></p>`)
        }
        break
      case 'codeBlock':
        insertCodeBlockAtCaret()
        break
      case 'formula':
        openFormulaDialog(selectedText.trim(), null)
        return
      case 'tableAddRow': {
        const cell = getCurrentTableCell()
        if (!cell) break
        const row = cell.parentElement as HTMLTableRowElement
        const table = row.closest('table')
        if (!table) break
        const newRow = document.createElement('tr')
        const cellsCount = row.cells.length
        for (let i = 0; i < cellsCount; i += 1) {
          const td = document.createElement('td')
          td.textContent = ''
          newRow.appendChild(td)
        }
        row.parentElement?.insertBefore(newRow, row.nextSibling)
        break
      }
      case 'tableRemoveRow': {
        const cell = getCurrentTableCell()
        if (!cell) break
        const row = cell.parentElement as HTMLTableRowElement
        const section = row.parentElement
        if (!section || section.children.length <= 1) break
        section.removeChild(row)
        break
      }
      case 'tableAddColumn': {
        const cell = getCurrentTableCell()
        if (!cell) break
        const cellIndex = cell.cellIndex
        const table = cell.closest('table')
        if (!table) break
        table.querySelectorAll('tr').forEach((tr) => {
          const isHeader = tr.parentElement?.tagName.toLowerCase() === 'thead'
          const newCell = document.createElement(isHeader ? 'th' : 'td')
          newCell.textContent = ''
          const target = tr.children[cellIndex + 1] || null
          tr.insertBefore(newCell, target)
        })
        break
      }
      case 'tableRemoveColumn': {
        const cell = getCurrentTableCell()
        if (!cell) break
        const cellIndex = cell.cellIndex
        const table = cell.closest('table')
        if (!table) break
        table.querySelectorAll('tr').forEach((tr) => {
          if (tr.children.length > 1) {
            tr.removeChild(tr.children[cellIndex])
          }
        })
        break
      }
    }

    // Trigger content update
    handleInput()
  }, [applyFontSize, clearColorTypingState, clearInlineTypingState, ensureCaretOutsideInlineFormatting, ensureIsolatedBlock, getCurrentBlock, getCurrentListItem, getCurrentTableCell, getFontSizeFromRange, handleInput, insertCodeBlockAtCaret, insertHtmlAtCaret, openFormulaDialog, restoreSavedSelection, wrapSelectionWithStyle])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing || isComposingRef.current || (e.nativeEvent as KeyboardEvent).keyCode === 229) return

    if ((e.key === 'Backspace' || e.key === 'Delete') && removeSingleEmptyListAtCaret()) {
      e.preventDefault()
      handleInput()
      return
    }

    if ((e.key === 'Backspace' || e.key === 'Delete') && selectedImage) {
      e.preventDefault()
      selectedImage.remove()
      setSelectedImage(null)
      setImageOverlayRect(null)
      handleInput()
      return
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      if (exitCurrentBlockWithNewParagraph()) {
        handleInput()
        scrollCaretIntoView()
      }
      return
    }

    if (e.key === 'Enter' && isSelectionInsideCodeBlock()) {
      e.preventDefault()
      insertNewLineInCodeBlock()
      handleInput()
      return
    }

    if (e.key === 'Enter' && !e.shiftKey && handleListEnter()) {
      e.preventDefault()
      handleInput()
      scrollCaretIntoView()
      return
    }

    if (e.key === 'Enter' && !e.shiftKey && exitHeadingWithParagraph()) {
      e.preventDefault()
      clearInlineTypingState()
      clearColorTypingState()
      shouldResetInlineTypingRef.current = false
      handleInput()
      scrollCaretIntoView()
      return
    }

    // Block-level markdown shortcuts (## , - , 1. , ---, etc.) must be checked
    // BEFORE the generic Enter handler which would consume the event.
    if (e.key === 'Enter' && !e.shiftKey && applyMarkdownShortcut(e)) return

    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      insertSoftBreakAtCaret()
      shouldResetInlineTypingRef.current = false
      handleInput()
      scrollCaretIntoView()
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      const inList = isCaretInsideList()
      // Keep native behavior inside lists; in normal paragraphs we keep line
      // breaks in the same paragraph block for a Notion-like writing flow.
      if (!inList) {
        e.preventDefault()
        if (!splitParagraphAtCaret()) {
          document.execCommand('insertParagraph', false)
        }
        clearInlineTypingState()
        clearColorTypingState()
        shouldResetInlineTypingRef.current = false
        handleInput()
        scrollCaretIntoView()
        return
      }
    }

    if (shouldResetInlineTypingRef.current) {
      if (e.key === 'Enter') {
        if (isCaretInsideList()) {
          shouldResetInlineTypingRef.current = false
          return
        }
        // Normal Enter is already handled above.
        shouldResetInlineTypingRef.current = false
        return
      } else if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        shouldResetInlineTypingRef.current = false
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
  }, [applyInlineMarkdownShortcut, applyMarkdownShortcut, applyStyle, clearColorTypingState, clearInlineTypingState, ensureCaretOutsideInlineFormatting, exitCurrentBlockWithNewParagraph, exitHeadingWithParagraph, handleInput, handleListEnter, insertNewLineInCodeBlock, insertSoftBreakAtCaret, isCaretInsideInlineFormatting, isCaretInsideList, isSelectionInsideCodeBlock, removeSingleEmptyListAtCaret, scrollCaretIntoView, selectedImage, splitParagraphAtCaret])

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <TopToolbar
        onApplyStyle={applyStyle}
        formatState={formatState}
      />

      <div
        ref={editorRef}
        contentEditable
        className="prose-editor relative flex-1 overflow-y-auto p-8 outline-none focus:outline-none"
        onInput={handleInput}
        onClick={handleEditorClick}
        onFocus={() => {
          const selection = window.getSelection()
          const anchorNode = selection?.anchorNode || null
          const anchorInsideEditor = !!(anchorNode && editorRef.current?.contains(anchorNode))
          if (!content || !anchorInsideEditor || anchorNode === editorRef.current) {
            ensureReadyCaretForEmptyEditor()
          }
        }}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => { isComposingRef.current = true }}
        onCompositionEnd={() => {
          isComposingRef.current = false
          shouldResetInlineTypingRef.current = false
        }}
        suppressContentEditableWarning
        data-placeholder="Start writing..."
      />

      {editingLink && (
        <div
          className="fixed z-50 w-80 rounded-md border bg-background/95 p-3 shadow-lg backdrop-blur"
          style={{ top: `${editingLink.position.top}px`, left: `${editingLink.position.left}px` }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="space-y-2">
            <Input
              value={editingLink.text}
              onChange={(e) => setEditingLink((prev) => (prev ? { ...prev, text: e.target.value } : prev))}
              placeholder="链接文本"
            />
            <Input
              value={editingLink.href}
              onChange={(e) => setEditingLink((prev) => (prev ? { ...prev, href: e.target.value } : prev))}
              placeholder="https://example.com"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!editingLink) return
                  const target = editingLink.element
                  const text = editingLink.text.trim() || target?.textContent || editingLink.href
                  const href = editingLink.href.trim()
                  if (target && !href) {
                    const node = document.createTextNode(text || '')
                    target.parentNode?.replaceChild(node, target)
                  } else if (target && href) {
                    const nextLink = document.createElement('a')
                    nextLink.textContent = text || href
                    nextLink.setAttribute('href', href)
                    nextLink.setAttribute('target', '_blank')
                    nextLink.setAttribute('rel', 'noopener noreferrer')
                    target.parentNode?.replaceChild(nextLink, target)
                  } else if (editingLink.range && href) {
                    const selection = window.getSelection()
                    if (!selection) return
                    const range = editingLink.range.cloneRange()
                    selection.removeAllRanges()
                    selection.addRange(range)
                    if (!range.collapsed) {
                      document.execCommand('createLink', false, href)
                    } else {
                      const label = text || href
                      const a = document.createElement('a')
                      a.textContent = label
                      a.href = href
                      a.target = '_blank'
                      a.rel = 'noopener noreferrer'
                      range.insertNode(a)
                      const spacer = document.createTextNode(' ')
                      a.parentNode?.insertBefore(spacer, a.nextSibling)
                      const caret = document.createRange()
                      caret.setStartAfter(spacer)
                      caret.collapse(true)
                      selection.removeAllRanges()
                      selection.addRange(caret)
                      savedRangeRef.current = caret.cloneRange()
                    }
                  }
                  setEditingLink(null)
                  handleInput()
                }}
              >
                保存
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!editingLink) return
                  const href = editingLink.href.trim()
                  if (href) openExternalUrl(href)
                }}
              >
                打开
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (!editingLink) return
                  const target = editingLink.element
                  if (target) {
                    const node = document.createTextNode(editingLink.text || target.textContent || '')
                    target.parentNode?.replaceChild(node, target)
                  }
                  setEditingLink(null)
                  handleInput()
                }}
              >
                取消链接
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedImage && imageOverlayRect && (
        <div
          className="pointer-events-none absolute z-40 border-2 border-primary/70"
          style={{
            top: `${imageOverlayRect.top}px`,
            left: `${imageOverlayRect.left}px`,
            width: `${imageOverlayRect.width}px`,
            height: `${imageOverlayRect.height}px`,
          }}
        >
          {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
            <button
              key={corner}
              type="button"
              className="pointer-events-auto absolute h-3 w-3 rounded-full border border-primary bg-background shadow"
              style={{
                top: corner.includes('n') ? '-7px' : 'calc(100% - 7px)',
                left: corner.includes('w') ? '-7px' : 'calc(100% - 7px)',
                cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
              }}
              onMouseDown={(e) => {
                e.preventDefault()
                if (!selectedImage) return
                const width = selectedImage.getBoundingClientRect().width
                const height = selectedImage.getBoundingClientRect().height
                const ratio = width > 0 && height > 0 ? width / height : 1
                resizeDragRef.current = {
                  startX: e.clientX,
                  startWidth: width || selectedImage.naturalWidth || 160,
                  startHeight: height || selectedImage.naturalHeight || 90,
                  ratio: ratio || 1,
                  corner,
                }
              }}
            />
          ))}
        </div>
      )}

      <Dialog open={isFormulaDialogOpen} onOpenChange={setIsFormulaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>公式编辑</DialogTitle>
            <DialogDescription>输入 LaTeX 表达式，留空则使用占位公式。</DialogDescription>
          </DialogHeader>
          <Input
            value={formulaDraft}
            onChange={(e) => setFormulaDraft(e.target.value)}
            placeholder="例如: \\frac{a+b}{c}"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                saveFormulaFromDialog()
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormulaDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={saveFormulaFromDialog}>
              应用公式
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
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
          line-height: 1.55;
          font-size: 16px;
          --pmd-link-color: #3b82f6;
          --pmd-code-bg: var(--muted);
          --pmd-code-fg: var(--foreground);
          --pmd-code-border: var(--border);
          --pmd-table-border: var(--border);
          --pmd-table-header-bg: var(--muted);
          --pmd-table-cell-bg: transparent;
          --pmd-formula-bg: transparent;
          --pmd-formula-fg: var(--foreground);
          --pmd-formula-border: var(--border);
        }
        
        /* Font size spans - maintain consistent line height */
        .prose-editor .font-size-span {
          display: inline;
          line-height: inherit;
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
          background-color: var(--pmd-code-bg);
          color: var(--pmd-code-fg);
          border: 1px solid var(--pmd-code-border);
          padding: 1em;
          border-radius: 6px;
          overflow-x: auto;
          white-space: pre-wrap;
          line-height: 1.45;
          min-height: 3.2em;
        }

        .prose-editor .code-block-wrapper {
          position: relative;
          margin: 1em 0;
        }

        .prose-editor .code-block-wrapper pre {
          margin: 0;
          border-radius: 8px;
        }

        .prose-editor .code-controls {
          position: absolute;
          right: 0.75rem;
          top: -0.55rem;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.22rem 0.28rem;
          border-radius: 999px;
          border: 1px solid color-mix(in oklch, var(--pmd-code-border) 86%, transparent);
          background: color-mix(in oklch, var(--background) 92%, transparent);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16);
          z-index: 2;
          pointer-events: auto;
        }

        .prose-editor .code-copy-btn {
          position: static;
          height: 1.52rem;
          min-width: 1.52rem;
          border-radius: 999px;
          border: 1px solid var(--pmd-code-border);
          background: color-mix(in oklch, var(--background) 96%, transparent);
          color: var(--muted-foreground);
          font-size: 0.78rem;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
          pointer-events: auto;
          opacity: 0.95;
        }

        .prose-editor .code-lang-select {
          position: static;
          height: 1.55rem;
          max-width: 8.6rem;
          border: 1px solid var(--pmd-code-border);
          border-radius: 999px;
          background: color-mix(in oklch, var(--background) 95%, transparent);
          color: var(--muted-foreground);
          font-size: 11px;
          font-weight: 500;
          padding: 0 0.6rem;
          outline: none;
          cursor: pointer;
        }

        .prose-editor .code-copy-btn:hover {
          color: var(--foreground);
          border-color: var(--foreground);
        }

        .prose-editor .code-lang-select:hover,
        .prose-editor .code-lang-select:focus {
          color: var(--foreground);
          border-color: var(--foreground);
        }

        .prose-editor .code-copy-toast {
          position: absolute;
          right: 0.82rem;
          top: 1.48rem;
          opacity: 0;
          transform: translateY(4px);
          pointer-events: none;
          border-radius: 0.4rem;
          background: var(--foreground);
          color: var(--background);
          font-size: 11px;
          line-height: 1;
          padding: 0.3rem 0.45rem;
          transition: all 0.2s ease;
        }

        .prose-editor .code-copy-toast.show {
          opacity: 1;
          transform: translateY(0);
        }
        
        .prose-editor pre code {
          background-color: transparent;
          color: inherit;
          padding: 0;
          font-size: 1em;
          display: block;
          box-sizing: border-box;
          width: 100%;
          min-width: 100%;
          min-height: 1.45em;
          line-height: 1.45;
          white-space: pre-wrap;
        }

        .prose-editor pre code[data-highlighted='true'] .hljs {
          background: transparent;
        }

        .prose-editor p {
          line-height: 1.5;
          min-height: 1.5em;
          white-space: pre-wrap;
          color: var(--foreground);
          caret-color: var(--foreground);
        }

        /* Prevent paragraph-box border/background leaking into headings that may
           end up as direct children of a <p> via browser formatBlock behavior. */
        .prose-editor p:has(> h1, > h2, > h3, > h4, > h5, > h6) {
          border: none !important;
          background: none !important;
          box-shadow: none !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
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
          color: var(--pmd-link-color);
          text-decoration: underline;
          cursor: pointer;
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
          cursor: pointer;
          user-select: none;
        }
        
        .prose-editor table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
        }
        
        .prose-editor th,
        .prose-editor td {
          border: 1px solid var(--pmd-table-border);
          padding: 0.5em 1em;
          background: var(--pmd-table-cell-bg);
        }
        
        .prose-editor th {
          background-color: var(--pmd-table-header-bg);
          font-weight: 600;
        }

        .prose-editor .formula-inline {
          display: inline-flex;
          align-items: center;
          border: 1px solid var(--pmd-formula-border);
          border-radius: 4px;
          padding: 0.1em 0.3em;
          margin: 0 0.1em;
          color: var(--pmd-formula-fg);
          background: var(--pmd-formula-bg);
          cursor: pointer;
        }

        .prose-editor .formula-inline[data-empty='true'] {
          opacity: 0.8;
          border-style: dashed;
        }

        .prose-editor .formula-inline .katex {
          color: var(--pmd-formula-fg);
        }

        .prose-editor .formula-inline-placeholder {
          color: var(--muted-foreground);
          font-size: 0.85em;
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
