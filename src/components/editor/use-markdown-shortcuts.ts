import { useCallback } from 'react'
import katex from 'katex'
import type { EditorRefs } from './editor-types'

export function useMarkdownShortcuts(
  refs: EditorRefs,
  deps: {
    getCurrentBlock: (selection: Selection) => HTMLElement | null
    getTextBeforeCaretInBlock: (block: HTMLElement, selection: Selection) => string
    deleteMarkdownTrigger: (selection: Selection, triggerText: string) => boolean
    ensureIsolatedBlock: () => HTMLElement | null
    convertBlockTag: (block: HTMLElement, newTag: string) => HTMLElement
    isSelectionInsideHeading: () => boolean
    clearInlineTypingState: (includeBold?: boolean) => void
    handleInput: () => void
  },
) {
  const { editorRef, shouldResetInlineTypingRef } = refs
  const {
    getCurrentBlock,
    getTextBeforeCaretInBlock,
    deleteMarkdownTrigger,
    ensureIsolatedBlock,
    convertBlockTag,
    isSelectionInsideHeading,
    clearInlineTypingState,
    handleInput,
  } = deps

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

      const orderedMatch = currentLine.match(/^(\d+)[\.\．。]$/)
      if (orderedMatch) {
        e.preventDefault()
        const listBlock = ensureIsolatedBlock() || block
        if (listBlock && listBlock.parentNode) {
          const ol = document.createElement('ol')
          const start = Number(orderedMatch[1] || '1')
          if (Number.isFinite(start) && start > 1) {
            ol.start = start
          }
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
          if (!deleteMarkdownTrigger(selection, currentLine)) return false
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
  }, [convertBlockTag, deleteMarkdownTrigger, editorRef, ensureIsolatedBlock, getCurrentBlock, getTextBeforeCaretInBlock, handleInput])

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
      const caretAnchor = document.createTextNode('')
      fragment.appendChild(formattedNode)
      fragment.appendChild(caretAnchor)
      replaceRange.insertNode(fragment)

      const caretRange = document.createRange()
      caretRange.setStart(caretAnchor, 0)
      caretRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(caretRange)

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
  }, [clearInlineTypingState, handleInput, isSelectionInsideHeading, shouldResetInlineTypingRef])

  return {
    applyMarkdownShortcut,
    applyInlineMarkdownShortcut,
  }
}
