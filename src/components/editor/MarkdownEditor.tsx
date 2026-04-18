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
import './prose-editor.css'

import {
  type FormatState,
  type EditingLink,
  type EditorRefs,
  DEFAULT_FORMAT_STATE,
  DEFAULT_FONT_SIZE,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  FONT_SIZE_STEP,
} from './editor-types'
import { useEditorSelection } from './use-editor-selection'
import { useCodeBlocks } from './use-code-blocks'
import { useBlockOperations } from './use-block-operations'
import { useMarkdownShortcuts } from './use-markdown-shortcuts'
import { useImageHandling } from './use-image-handling'
import { IMAGE_PROTOCOL, getImageBlob } from '@/store/editor-store'

interface MarkdownEditorProps {
  content: string
  onChange: (content: string) => void
}

interface SelectionPointSnapshot {
  path: number[]
  offset: number
}

interface SelectionSnapshot {
  start: SelectionPointSnapshot
  end: SelectionPointSnapshot
}

interface HistorySnapshot {
  html: string
  selection: SelectionSnapshot | null
}

function getNodePath(root: Node, target: Node): number[] | null {
  const path: number[] = []
  let current: Node | null = target

  while (current && current !== root) {
    const parent = current.parentNode
    if (!parent) return null
    const index = Array.prototype.indexOf.call(parent.childNodes, current)
    if (index < 0) return null
    path.unshift(index)
    current = parent
  }

  return current === root ? path : null
}

function getNodeFromPath(root: Node, path: number[]): Node | null {
  let current: Node = root
  for (const index of path) {
    const next = current.childNodes[index]
    if (!next) return null
    current = next
  }
  return current
}

function getNodeOffsetLimit(node: Node): number {
  return node.nodeType === Node.TEXT_NODE ? (node.textContent || '').length : node.childNodes.length
}

export function MarkdownEditor({ content, onChange }: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const formulaTargetRef = useRef<HTMLElement | null>(null)
  const isInternalChange = useRef(false)
  const shouldResetInlineTypingRef = useRef(false)
  const isComposingRef = useRef(false)
  const imageUrlMapRef = useRef<Map<string, string>>(new Map())
  const historyRef = useRef<HistorySnapshot[]>([])
  const redoRef = useRef<HistorySnapshot[]>([])
  const isRestoringHistoryRef = useRef(false)

  const refs: EditorRefs = {
    editorRef,
    savedRangeRef,
    isInternalChange,
    shouldResetInlineTypingRef,
    isComposingRef,
  }

  const [formatState, setFormatState] = useState<FormatState>(DEFAULT_FORMAT_STATE)
  const [isFormulaDialogOpen, setIsFormulaDialogOpen] = useState(false)
  const [formulaDraft, setFormulaDraft] = useState('')
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false)
  const [tableRows, setTableRows] = useState(3)
  const [tableCols, setTableCols] = useState(3)
  const [editingLink, setEditingLink] = useState<EditingLink | null>(null)

  // Resolve pmd-image:// references in the editor DOM to displayable Object URLs
  const resolveEditorImages = useCallback(async (editor: HTMLDivElement) => {
    const images = Array.from(editor.querySelectorAll('img'))
    for (const img of images) {
      const src = img.getAttribute('src') || ''
      if (!src.startsWith(IMAGE_PROTOCOL)) continue

      const imageId = src.slice(IMAGE_PROTOCOL.length)
      if (!imageId) continue

      const existing = imageUrlMapRef.current.get(imageId)
      if (existing) {
        img.src = existing
        continue
      }

      try {
        const stored = await getImageBlob(imageId)
        if (stored) {
          const objectUrl = URL.createObjectURL(stored.blob)
          imageUrlMapRef.current.set(imageId, objectUrl)
          img.src = objectUrl
        }
      } catch {
        // Image not found in DB — leave as is
      }
    }
  }, [])

  // Convert Object URLs back to pmd-image:// references in HTML string
  const serializeEditorContent = useCallback((html: string): string => {
    let result = html
    for (const [imageId, objectUrl] of imageUrlMapRef.current) {
      result = result.replaceAll(objectUrl, `${IMAGE_PROTOCOL}${imageId}`)
    }
    return result
  }, [])

  // Cleanup Object URLs on unmount
  useEffect(() => {
    return () => {
      for (const url of imageUrlMapRef.current.values()) {
        URL.revokeObjectURL(url)
      }
      imageUrlMapRef.current.clear()
    }
  }, [])

  const createSelectionSnapshot = useCallback((editor: HTMLDivElement): SelectionSnapshot | null => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return null
    const range = selection.getRangeAt(0)
    if (
      !editor.contains(range.startContainer) ||
      !editor.contains(range.endContainer)
    ) {
      return null
    }

    const startPath = getNodePath(editor, range.startContainer)
    const endPath = getNodePath(editor, range.endContainer)
    if (!startPath || !endPath) return null

    return {
      start: { path: startPath, offset: range.startOffset },
      end: { path: endPath, offset: range.endOffset },
    }
  }, [])

  const restoreSelectionSnapshot = useCallback((editor: HTMLDivElement, snapshot: SelectionSnapshot | null) => {
    const selection = window.getSelection()
    if (!selection || !snapshot) return

    const startNode = getNodeFromPath(editor, snapshot.start.path)
    const endNode = getNodeFromPath(editor, snapshot.end.path)
    if (!startNode || !endNode) return

    const range = document.createRange()
    range.setStart(startNode, Math.min(snapshot.start.offset, getNodeOffsetLimit(startNode)))
    range.setEnd(endNode, Math.min(snapshot.end.offset, getNodeOffsetLimit(endNode)))
    selection.removeAllRanges()
    selection.addRange(range)
    savedRangeRef.current = range.cloneRange()
  }, [])

  const createHistorySnapshot = useCallback((editor: HTMLDivElement): HistorySnapshot => ({
    html: editor.innerHTML,
    selection: createSelectionSnapshot(editor),
  }), [createSelectionSnapshot])

  const resetHistory = useCallback((editor: HTMLDivElement) => {
    historyRef.current = [createHistorySnapshot(editor)]
    redoRef.current = []
  }, [createHistorySnapshot])

  const pushHistorySnapshot = useCallback((editor: HTMLDivElement) => {
    if (isRestoringHistoryRef.current || isComposingRef.current) return

    const snapshot = createHistorySnapshot(editor)
    const lastSnapshot = historyRef.current[historyRef.current.length - 1]
    if (lastSnapshot?.html === snapshot.html) {
      historyRef.current[historyRef.current.length - 1] = snapshot
      return
    }

    historyRef.current.push(snapshot)
    if (historyRef.current.length > 200) {
      historyRef.current.shift()
    }
    redoRef.current = []
  }, [createHistorySnapshot])

  const emitSelectionStats = useCallback((selection: Selection | null) => {
    const editor = editorRef.current
    if (!selection || !selection.rangeCount || !editor) {
      window.dispatchEvent(new CustomEvent('editor-selection-stats', {
        detail: { hasSelection: false, charCount: 0, wordCount: 0 },
      }))
      return
    }

    const range = selection.getRangeAt(0)
    if (!editor.contains(range.commonAncestorContainer)) {
      window.dispatchEvent(new CustomEvent('editor-selection-stats', {
        detail: { hasSelection: false, charCount: 0, wordCount: 0 },
      }))
      return
    }

    const text = selection.toString().replace(/\s+/g, ' ').trim()
    const hasSelection = !selection.isCollapsed && text.length > 0
    window.dispatchEvent(new CustomEvent('editor-selection-stats', {
      detail: {
        hasSelection,
        charCount: hasSelection ? text.length : 0,
        wordCount: hasSelection && text ? text.split(/\s+/).length : 0,
      },
    }))
  }, [])

  // --- Selection & DOM utilities ---
  const {
    restoreSavedSelection,
    scrollCaretIntoView,
    ensureReadyCaretForEmptyEditor,
    getTextBeforeCaretInBlock,
    getCurrentBlock,
    deleteMarkdownTrigger,
    ensureIsolatedBlock,
    convertBlockTag,
    selectElement,
    isSelectionInsideHeading,
    isSelectionInsideCodeBlock,
    ensureCaretOutsideInlineFormatting,
    isCaretInsideInlineFormatting,
    getCurrentListItem,
    getCurrentTableCell,
  } = useEditorSelection(refs)

  // --- Code block highlighting & controls ---
  const {
    applySyntaxHighlight,
    renderCodeHighlights,
    ensureCodeBlockControls,
    insertNewLineInCodeBlock,
    insertCodeBlockAtCaret,
  } = useCodeBlocks(refs)

  // --- handleInput: normalizes DOM + triggers onChange ---
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const editor = editorRef.current
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

      const nestedBlocks = Array.from(editor.querySelectorAll(
        'p > h1, p > h2, p > h3, p > h4, p > h5, p > h6'
      ))
      const hasMeaningfulParagraphContent = (p: HTMLParagraphElement) => {
        return Array.from(p.childNodes).some((n) => {
          if (n.nodeType === Node.TEXT_NODE) return (n.textContent || '').replace(/\u200b/g, '').trim().length > 0
          if (n.nodeType !== Node.ELEMENT_NODE) return false
          const tag = (n as HTMLElement).tagName.toLowerCase()
          if (tag === 'br') return false
          return true
        })
      }
      for (const block of nestedBlocks) {
        const heading = block as HTMLElement
        const parentP = heading.parentElement as HTMLParagraphElement | null
        if (!parentP || parentP === editor || !parentP.parentNode) continue
        const parent = parentP.parentNode

        const beforeP = document.createElement('p')
        const afterP = document.createElement('p')
        let passedHeading = false
        const originalChildren = Array.from(parentP.childNodes)
        for (const child of originalChildren) {
          if (child === heading) {
            passedHeading = true
            continue
          }
          if (passedHeading) afterP.appendChild(child)
          else beforeP.appendChild(child)
        }

        if (hasMeaningfulParagraphContent(beforeP)) {
          parent.insertBefore(beforeP, parentP)
        }
        parent.insertBefore(heading, parentP)
        if (hasMeaningfulParagraphContent(afterP)) {
          parent.insertBefore(afterP, parentP)
        }
        parent.removeChild(parentP)
      }

      ensureCodeBlockControls(editor)

      isInternalChange.current = true
      const newContent = serializeEditorContent(editor.innerHTML)
      onChange(newContent)
      pushHistorySnapshot(editor)
      emitSelectionStats(window.getSelection())
    }
  }, [emitSelectionStats, ensureCodeBlockControls, onChange, pushHistorySnapshot, serializeEditorContent])

  const applyHistorySnapshot = useCallback((snapshot: HistorySnapshot): boolean => {
    const editor = editorRef.current
    if (!editor) return false

    isRestoringHistoryRef.current = true
    editor.innerHTML = snapshot.html || '<p><br></p>'
    ensureCodeBlockControls(editor)
    renderCodeHighlights(editor, true)
    restoreSelectionSnapshot(editor, snapshot.selection)
    emitSelectionStats(window.getSelection())
    isInternalChange.current = true
    onChange(serializeEditorContent(editor.innerHTML))
    requestAnimationFrame(() => {
      isRestoringHistoryRef.current = false
    })
    return true
  }, [emitSelectionStats, ensureCodeBlockControls, onChange, renderCodeHighlights, restoreSelectionSnapshot, serializeEditorContent])

  const handleUndo = useCallback((): boolean => {
    if (historyRef.current.length <= 1) return false
    const currentSnapshot = historyRef.current.pop()
    if (currentSnapshot) {
      redoRef.current.push(currentSnapshot)
    }
    const previousSnapshot = historyRef.current[historyRef.current.length - 1]
    if (!previousSnapshot) return false
    return applyHistorySnapshot(previousSnapshot)
  }, [applyHistorySnapshot])

  const handleRedo = useCallback((): boolean => {
    const nextSnapshot = redoRef.current.pop()
    if (!nextSnapshot) return false
    historyRef.current.push(nextSnapshot)
    return applyHistorySnapshot(nextSnapshot)
  }, [applyHistorySnapshot])

  // --- Block operations (split paragraph, list enter, etc.) ---
  const {
    insertSoftBreakAtCaret,
    splitParagraphAtCaret,
    exitHeadingWithParagraph,
    exitCurrentBlockWithNewParagraph,
    isCaretInsideList,
    handleListEnter,
    removeSingleEmptyListAtCaret,
  } = useBlockOperations(refs, { getCurrentBlock, ensureIsolatedBlock, getCurrentListItem })

  // --- Inline typing state management ---
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

  // --- Markdown shortcuts ---
  const { applyMarkdownShortcut, applyInlineMarkdownShortcut } = useMarkdownShortcuts(refs, {
    getCurrentBlock,
    getTextBeforeCaretInBlock,
    deleteMarkdownTrigger,
    ensureIsolatedBlock,
    convertBlockTag,
    isSelectionInsideHeading,
    clearInlineTypingState,
    handleInput,
  })

  // --- Image handling ---
  const {
    selectedImage,
    setSelectedImage,
    imageOverlayRect,
    setImageOverlayRect,
    resizeDragRef,
    recalcSelectedImageOverlay,
    resizeSelectedImageByFactor,
    handlePaste,
  } = useImageHandling(refs, handleInput, imageUrlMapRef)

  // --- Format state detection ---
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

    state.bold = document.queryCommandState('bold')
    state.italic = document.queryCommandState('italic')
    state.underline = document.queryCommandState('underline')
    state.strikethrough = document.queryCommandState('strikeThrough')
    state.bulletList = document.queryCommandState('insertUnorderedList')
    state.orderedList = document.queryCommandState('insertOrderedList')

    let element: Element | null = node.nodeType === Node.TEXT_NODE
      ? node.parentElement
      : node as Element

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

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) {
      setFormatState(DEFAULT_FORMAT_STATE)
      emitSelectionStats(selection)
      return
    }

    const range = selection.getRangeAt(0)
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange()
      const detectedFormat = detectFormatState(range.commonAncestorContainer)
      setFormatState(detectedFormat)
      emitSelectionStats(selection)
    } else {
      setFormatState(DEFAULT_FORMAT_STATE)
      emitSelectionStats(selection)
    }
  }, [detectFormatState, emitSelectionStats])

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      window.dispatchEvent(new CustomEvent('editor-selection-stats', {
        detail: { hasSelection: false, charCount: 0, wordCount: 0 },
      }))
    }
  }, [handleSelectionChange])

  // --- Scroll to heading (from outline) ---
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

  // --- Font size helpers ---
  const getFontSizeFromNode = useCallback((node: Node | null): number => {
    if (!node) return DEFAULT_FONT_SIZE

    let element: Element | null = node.nodeType === Node.TEXT_NODE
      ? node.parentElement
      : node as Element

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

  // --- Style wrapping helper ---
  const wrapSelectionWithStyle = useCallback(
    (property: 'color' | 'backgroundColor', value: string, clearToken: string): boolean => {
      const selection = restoreSavedSelection()
      if (!selection || selection.isCollapsed || !selection.rangeCount) return false

      const range = selection.getRangeAt(0)
      const extracted = range.extractContents()

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

  const insertTableAtCaret = useCallback((rows: number, cols: number) => {
    const safeRows = Math.max(1, rows)
    const safeCols = Math.max(1, cols)
    const headers = Array.from({ length: safeCols }, (_, i) => `<th>表头 ${i + 1}</th>`).join('')
    const bodyRows = Array.from({ length: safeRows - 1 }, (_, rowIndex) => {
      const cells = Array.from({ length: safeCols }, (_, colIndex) => `<td>单元格 ${rowIndex + 1}-${colIndex + 1}</td>`).join('')
      return `<tr>${cells}</tr>`
    }).join('')
    insertHtmlAtCaret(`<table><thead><tr>${headers}</tr></thead><tbody>${bodyRows}</tbody></table><p><br></p>`)
  }, [insertHtmlAtCaret])

  // --- Formula rendering ---
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

  // --- Font size application ---
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
      const textNodesToWrap: Text[] = []
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
          textNodesToWrap.push(textNode)
        }
        current = walker.nextNode()
      }

      textNodesToWrap.forEach(wrapTextNodeWithFontSize)
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

  // --- applyStyle (toolbar actions) ---
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
        if (selection.isCollapsed || !selectedText) break
        wrapSelectionWithStyle('color', value || 'inherit', 'inherit')
        selection.collapseToEnd()
        ensureCaretOutsideInlineFormatting()
        clearInlineTypingState()
        clearColorTypingState()
        shouldResetInlineTypingRef.current = false
        break
      }
      case 'highlight':
        if (selection.isCollapsed || !selectedText) break
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
        const codeTextNode = document.createTextNode(selectedText || '\u200B')
        codeSpan.appendChild(codeTextNode)
        range.deleteContents()
        range.insertNode(codeSpan)
        const caret = document.createRange()
        if (selectedText) {
          caret.setStartAfter(codeSpan)
        } else {
          caret.setStart(codeTextNode, codeTextNode.textContent?.length || 0)
        }
        caret.collapse(true)
        selection.removeAllRanges()
        selection.addRange(caret)
        savedRangeRef.current = caret.cloneRange()
        break
      }
      case 'heading': {
        const headingTag = `h${value || '1'}`
        const headingBlock = ensureIsolatedBlock() || getCurrentBlock(selection)
        if (headingBlock && headingBlock !== editorRef.current) {
          const newHeading = convertBlockTag(headingBlock, headingTag)
          const next = newHeading.nextElementSibling
          const shouldCreateParagraph =
            !next ||
            !['p', 'ul', 'ol', 'blockquote', 'pre', 'table', 'div'].includes(next.tagName.toLowerCase())
          if (shouldCreateParagraph) {
            const paragraph = document.createElement('p')
            paragraph.appendChild(document.createElement('br'))
            newHeading.parentNode?.insertBefore(paragraph, newHeading.nextSibling)
          }
        } else {
          document.execCommand('formatBlock', false, `<${headingTag}>`)
        }
        setFormatState((prev) => ({ ...prev, heading: headingTag }))
        break
      }
      case 'list': {
        const alreadyInList = !!getCurrentListItem()
        if (alreadyInList) {
          document.execCommand(value === 'bullet' ? 'insertUnorderedList' : 'insertOrderedList', false)
          break
        }
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
        setTableRows(3)
        setTableCols(3)
        setIsTableDialogOpen(true)
        return
      case 'codeBlock':
        insertCodeBlockAtCaret(restoreSavedSelection, getCurrentBlock, handleInput)
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

    handleInput()
  }, [applyFontSize, clearColorTypingState, clearInlineTypingState, convertBlockTag, ensureCaretOutsideInlineFormatting, ensureIsolatedBlock, getCurrentBlock, getCurrentListItem, getCurrentTableCell, getFontSizeFromRange, handleInput, insertCodeBlockAtCaret, openFormulaDialog, restoreSavedSelection, wrapSelectionWithStyle])

  // --- Sync content to editor on external changes ---
  useEffect(() => {
    const editor = editorRef.current
    if (editor && !isInternalChange.current) {
      const serializedCurrent = serializeEditorContent(editor.innerHTML)
      if (document.activeElement !== editorRef.current && serializedCurrent !== content) {
        editor.innerHTML = content || '<p><br></p>'
        ensureCodeBlockControls(editor)
        renderCodeHighlights(editor, true)
        void resolveEditorImages(editor).then(() => {
          if (editorRef.current === editor) {
            resetHistory(editor)
          }
        })
        if (!content) {
          savedRangeRef.current = null
        }
      }
    }
    isInternalChange.current = false
  }, [content, ensureCodeBlockControls, renderCodeHighlights, resetHistory, resolveEditorImages, serializeEditorContent])

  useEffect(() => {
    if (!editorRef.current || content) return
    ensureReadyCaretForEmptyEditor()
    resetHistory(editorRef.current)
  }, [content, ensureReadyCaretForEmptyEditor, resetHistory])

  useEffect(() => {
    if (editorRef.current && content) {
      editorRef.current.innerHTML = content
      void resolveEditorImages(editorRef.current).then(() => {
        if (editorRef.current) {
          resetHistory(editorRef.current)
        }
      })
    }
    try { document.execCommand('defaultParagraphSeparator', false, 'p') } catch { /* ignore */ }
  }, [])

  // --- Formula click handler ---
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

  // --- Code block copy button ---
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

  // --- Code block focusout highlight + language select ---
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

  // --- External URL opener ---
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
      // fallback
    }
    try {
      const openedWindow = window.open(url, '_blank', 'noopener,noreferrer')
      if (openedWindow) return
    } catch {
      // fallback
    }
    try {
      void openExternal(url)
    } catch {
      // ignore
    }
  }, [])

  // --- Editor click handler ---
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
            // fallback
          }
          try {
            const openedWindow = window.open(href, '_blank', 'noopener,noreferrer')
            if (openedWindow) return
          } catch {
            // fallback
          }
          void openExternal(href).catch(() => {})
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
  }, [recalcSelectedImageOverlay, setImageOverlayRect, setSelectedImage])

  // --- Keyboard handler ---
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing || isComposingRef.current || (e.nativeEvent as KeyboardEvent).keyCode === 229) return

    const isModKey = e.ctrlKey || e.metaKey

    if (isModKey && !e.altKey) {
      const key = e.key.toLowerCase()

      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          handleRedo()
        } else {
          handleUndo()
        }
        return
      }

      if (e.ctrlKey && !e.shiftKey && key === 'y') {
        e.preventDefault()
        handleRedo()
        return
      }

      if (e.shiftKey && e.code === 'Digit8') {
        e.preventDefault()
        applyStyle('list', 'bullet')
        return
      }

      if (e.shiftKey && e.code === 'Digit7') {
        e.preventDefault()
        applyStyle('list', 'ordered')
        return
      }
    }

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

    if ((e.metaKey || e.ctrlKey) && selectedImage) {
      const key = e.key
      if (key === '+' || key === '=' || key === 'Add') {
        e.preventDefault()
        resizeSelectedImageByFactor(1.1)
        return
      }
      if (key === '-' || key === '_' || key === 'Subtract') {
        e.preventDefault()
        resizeSelectedImageByFactor(0.9)
        return
      }
    }

    if (e.key === 'Enter' && isSelectionInsideCodeBlock()) {
      e.preventDefault()
      insertNewLineInCodeBlock()
      handleInput()
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

    if (e.key === 'Enter' && !e.shiftKey && handleListEnter()) {
      e.preventDefault()
      handleInput()
      scrollCaretIntoView()
      return
    }

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
        case 'k':
          e.preventDefault()
          applyStyle('link')
          break
        case 'x':
          if (!e.shiftKey) break
          e.preventDefault()
          applyStyle('strikethrough')
          break
        case 's':
          e.preventDefault()
          const event = new CustomEvent('save-document')
          window.dispatchEvent(event)
          break
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;')
    }
  }, [applyInlineMarkdownShortcut, applyMarkdownShortcut, applyStyle, clearColorTypingState, clearInlineTypingState, exitCurrentBlockWithNewParagraph, exitHeadingWithParagraph, handleInput, handleListEnter, handleRedo, handleUndo, insertNewLineInCodeBlock, insertSoftBreakAtCaret, isCaretInsideList, isSelectionInsideCodeBlock, removeSingleEmptyListAtCaret, resizeSelectedImageByFactor, scrollCaretIntoView, selectedImage, setImageOverlayRect, setSelectedImage, splitParagraphAtCaret])

  const handleBeforeInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const nativeEvent = e.nativeEvent as InputEvent
    if (nativeEvent.inputType === 'historyUndo') {
      e.preventDefault()
      handleUndo()
      return
    }
    if (nativeEvent.inputType === 'historyRedo') {
      e.preventDefault()
      handleRedo()
    }
  }, [handleRedo, handleUndo])

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
        onBeforeInput={handleBeforeInput}
        onInput={handleInput}
        onPaste={handlePaste}
        onClick={handleEditorClick}
        onFocus={() => {
          const selection = window.getSelection()
          const anchorNode = selection?.anchorNode || null
          const anchorInsideEditor = !!(anchorNode && editorRef.current?.contains(anchorNode))
          if (!content || !anchorInsideEditor || anchorNode === editorRef.current) {
            ensureReadyCaretForEmptyEditor()
            if (editorRef.current && historyRef.current.length === 0) {
              resetHistory(editorRef.current)
            }
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
          <div className="pointer-events-auto absolute right-2 top-2 flex gap-1 rounded-md border border-border/60 bg-background/85 p-1 shadow">
            <button
              type="button"
              className="h-6 w-6 rounded border border-border/60 text-xs leading-none hover:bg-muted"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => resizeSelectedImageByFactor(0.9)}
              aria-label="缩小图片"
              title="缩小 (Cmd/Ctrl + -)"
            >
              −
            </button>
            <button
              type="button"
              className="h-6 w-6 rounded border border-border/60 text-xs leading-none hover:bg-muted"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => resizeSelectedImageByFactor(1.1)}
              aria-label="放大图片"
              title="放大 (Cmd/Ctrl + +)"
            >
              +
            </button>
          </div>
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

      <Dialog open={isTableDialogOpen} onOpenChange={setIsTableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>插入表格</DialogTitle>
            <DialogDescription>设置表格的行数和列数</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <label className="mb-1 block text-sm font-medium">行数</label>
              <Input
                type="number"
                min={1}
                max={50}
                value={tableRows}
                onChange={(e) => setTableRows(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">列数</label>
              <Input
                type="number"
                min={1}
                max={20}
                value={tableCols}
                onChange={(e) => setTableCols(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTableDialogOpen(false)}>取消</Button>
            <Button onClick={() => {
              insertTableAtCaret(tableRows, tableCols)
              setIsTableDialogOpen(false)
            }}>插入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

    </div>
  )
}
