import { useCallback } from 'react'
import type { EditorRefs } from './editor-types'

export function useEditorSelection(refs: EditorRefs) {
  const { editorRef, savedRangeRef } = refs

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
  }, [editorRef, savedRangeRef])

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
  }, [editorRef, savedRangeRef])

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

        if ((before && before.nodeName === 'BR') || (at && at.nodeName === 'BR')) {
          return createParagraphAtCaret()
        }

        if (at && at.nodeType === Node.TEXT_NODE && at.parentNode === editor) {
          const textNode = at as Text
          return wrapTextNodeAsParagraph(textNode, 0)
        }

        if (!at) {
          return createParagraphAtCaret()
        }
      }

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
  }, [editorRef])

  const deleteCharsBeforeCaret = useCallback((selection: Selection, count: number): boolean => {
    if (count <= 0 || !selection.rangeCount) return false

    const caretRange = selection.getRangeAt(0)
    let endContainer: Node = caretRange.endContainer
    let endOffset: number = caretRange.endOffset

    if (endContainer.nodeType !== Node.TEXT_NODE) {
      if (endContainer.nodeType === Node.ELEMENT_NODE && endOffset > 0) {
        let child: ChildNode | null = (endContainer as Element).childNodes[endOffset - 1]
        while (child && child.nodeType !== Node.TEXT_NODE) {
          if (child.nodeType === Node.ELEMENT_NODE && child.lastChild) {
            child = child.lastChild
          } else {
            child = null
            break
          }
        }
        if (child && child.nodeType === Node.TEXT_NODE) {
          endContainer = child
          endOffset = (child as Text).length
        } else {
          return false
        }
      } else {
        return false
      }
    }

    if (endOffset < count) {
      return false
    }

    const deleteRange = document.createRange()
    deleteRange.setStart(endContainer as Text, endOffset - count)
    deleteRange.setEnd(endContainer as Text, endOffset)
    deleteRange.deleteContents()
    return true
  }, [])

  const deleteMarkdownTrigger = useCallback((selection: Selection, triggerText: string): boolean => {
    return deleteCharsBeforeCaret(selection, triggerText.length)
  }, [deleteCharsBeforeCaret])

  const ensureIsolatedBlock = useCallback((): HTMLElement | null => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection || !selection.rangeCount) return null

    const range = selection.getRangeAt(0)

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

    const checkRange = document.createRange()
    checkRange.selectNodeContents(blockEl)
    checkRange.setEnd(range.startContainer, range.startOffset)
    const textBefore = checkRange.toString().trim()

    if (textBefore.length === 0) {
      return blockEl
    }

    const extractRange = document.createRange()
    extractRange.setStart(range.startContainer, range.startOffset)
    extractRange.setEnd(blockEl, blockEl.childNodes.length)
    const fragment = extractRange.extractContents()

    while (blockEl.lastChild && blockEl.lastChild.nodeName === 'BR') {
      blockEl.removeChild(blockEl.lastChild)
    }
    if (!blockEl.innerHTML.trim()) {
      blockEl.innerHTML = '<br>'
    }

    const newBlock = document.createElement('p')
    newBlock.appendChild(fragment)
    if (!newBlock.innerHTML.trim()) {
      newBlock.innerHTML = '<br>'
    }

    blockEl.parentNode!.insertBefore(newBlock, blockEl.nextSibling)

    const r = document.createRange()
    r.selectNodeContents(newBlock)
    r.collapse(true)
    selection.removeAllRanges()
    selection.addRange(r)

    return newBlock
  }, [editorRef])

  const convertBlockTag = useCallback((block: HTMLElement, newTag: string): HTMLElement => {
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
    return newBlock
  }, [])

  const selectElement = useCallback((element: HTMLElement) => {
    const selection = window.getSelection()
    if (!selection) return

    const range = document.createRange()
    range.selectNodeContents(element)
    selection.removeAllRanges()
    selection.addRange(range)
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
  }, [editorRef])

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
  }, [editorRef])

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
  }, [editorRef])

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
  }, [editorRef])

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
  }, [editorRef])

  const getCurrentTableCell = useCallback((): HTMLTableCellElement | null => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return null
    const anchor = selection.anchorNode
    const element = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor as HTMLElement | null
    if (!element) return null
    const cell = element.closest('td, th') as HTMLTableCellElement | null
    if (!cell) return null
    return editorRef.current.contains(cell) ? cell : null
  }, [editorRef])

  return {
    restoreSavedSelection,
    scrollCaretIntoView,
    ensureReadyCaretForEmptyEditor,
    getTextBeforeCaretInBlock,
    getCurrentBlock,
    deleteCharsBeforeCaret,
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
  }
}
