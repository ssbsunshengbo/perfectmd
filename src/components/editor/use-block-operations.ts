import { useCallback } from 'react'
import type { EditorRefs } from './editor-types'

export function useBlockOperations(
  refs: EditorRefs,
  deps: {
    getCurrentBlock: (selection: Selection) => HTMLElement | null
    ensureIsolatedBlock: () => HTMLElement | null
    getCurrentListItem: () => HTMLLIElement | null
  },
) {
  const { editorRef, savedRangeRef } = refs
  const { getCurrentBlock, ensureIsolatedBlock, getCurrentListItem } = deps

  const insertSoftBreakAtCaret = useCallback((): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return false
    document.execCommand('insertLineBreak', false)
    if (selection.rangeCount) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange()
    }
    return true
  }, [savedRangeRef])

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
        // strip trailing break
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

    placeCaretInBlockStart(newParagraph)
    return true
  }, [editorRef, ensureIsolatedBlock, getCurrentBlock, savedRangeRef])

  const exitHeadingWithParagraph = useCallback((): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return false
    const anchor = selection.anchorNode
    const element = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor as HTMLElement | null
    const heading = element?.closest('h1, h2, h3, h4, h5, h6') as HTMLElement | null
    if (!heading || !editorRef.current.contains(heading)) return false

    const caretRange = selection.getRangeAt(0)

    const trailingRange = document.createRange()
    trailingRange.setStart(caretRange.startContainer, caretRange.startOffset)
    trailingRange.setEnd(heading, heading.childNodes.length)
    const trailingFragment = trailingRange.extractContents()
    const trailingText = (trailingFragment.textContent || '').replace(/\u200b/g, '').trim()

    if (!(heading.textContent || '').replace(/\u200b/g, '').trim()) {
      heading.appendChild(document.createElement('br'))
    }

    const paragraph = document.createElement('p')
    if (trailingText.length > 0) {
      paragraph.appendChild(trailingFragment)
    } else {
      paragraph.appendChild(document.createElement('br'))
    }
    heading.parentNode?.insertBefore(paragraph, heading.nextSibling)

    const range = document.createRange()
    range.selectNodeContents(paragraph)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    savedRangeRef.current = range.cloneRange()
    return true
  }, [editorRef, savedRangeRef])

  const cleanupEmptyParagraphContainer = useCallback((node: Element | null) => {
    const paragraph = node?.tagName?.toLowerCase() === 'p' ? node as HTMLParagraphElement : null
    if (!paragraph || paragraph === editorRef.current) return
    const hasBlockChildren = paragraph.querySelector('ul, ol, pre, table, blockquote, h1, h2, h3, h4, h5, h6, hr, img')
    const normalizedText = (paragraph.textContent || '').replace(/\u200b/g, '').trim()
    if (!hasBlockChildren && normalizedText.length === 0) {
      paragraph.remove()
    }
  }, [editorRef])

  const exitCurrentBlockWithNewParagraph = useCallback((): boolean => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !editorRef.current) return false
    const listItem = getCurrentListItem()
    if (listItem) {
      const list = listItem.parentElement
      if (!list || (list.tagName !== 'UL' && list.tagName !== 'OL')) return false
      const newP = document.createElement('p')
      newP.appendChild(document.createElement('br'))
      list.parentNode?.insertBefore(newP, list.nextSibling)
      const range = document.createRange()
      range.selectNodeContents(newP)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
      savedRangeRef.current = range.cloneRange()
      return true
    }

    const isolated = ensureIsolatedBlock()
    const currentBlock = isolated || getCurrentBlock(selection)
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
  }, [editorRef, ensureIsolatedBlock, getCurrentBlock, getCurrentListItem, savedRangeRef])

  const isCaretInsideList = useCallback((): boolean => {
    return !!getCurrentListItem()
  }, [getCurrentListItem])

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
  }, [editorRef, getCurrentListItem, savedRangeRef])

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
  }, [cleanupEmptyParagraphContainer, editorRef, getCurrentListItem, savedRangeRef])

  return {
    insertSoftBreakAtCaret,
    splitParagraphAtCaret,
    exitHeadingWithParagraph,
    cleanupEmptyParagraphContainer,
    exitCurrentBlockWithNewParagraph,
    isCaretInsideList,
    handleListEnter,
    removeSingleEmptyListAtCaret,
  }
}
