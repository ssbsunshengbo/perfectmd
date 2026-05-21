import { useCallback, useRef } from 'react'
import type { EditorRefs } from './editor-types'
import { CODE_LANGUAGE_OPTIONS, normalizeCodeLanguage } from '@/lib/code-languages'
import { highlightCodeToInlineHtml } from '@/lib/code-highlighter'

const CODE_INDENT = '  '

interface TextSelectionOffsets {
  start: number
  end: number
}

type HighlightOptions = boolean | {
  force?: boolean
  preserveSelection?: boolean
}

function getCodeText(codeEl: HTMLElement): string {
  return (codeEl.textContent || '').replace(/\u200B/g, '').replace(/\r\n?/g, '\n')
}

function getVisibleTextLength(text: string): number {
  return text.replace(/\u200B/g, '').length
}

function getDomOffsetForVisibleOffset(text: string, visibleOffset: number): number {
  let visible = 0
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\u200B') continue
    if (visible === visibleOffset) return index
    visible += 1
  }
  return text.length
}

function ensureTrailingCaretAnchor(codeEl: HTMLElement, sourceText: string) {
  if (!sourceText.endsWith('\n')) return
  codeEl.appendChild(document.createTextNode('\u200B'))
}

function isNodeInside(root: Node, node: Node | null): node is Node {
  return !!node && (node === root || root.contains(node))
}

function getTextOffset(root: HTMLElement, container: Node, offset: number): number {
  if (!isNodeInside(root, container)) return 0

  const range = document.createRange()
  try {
    range.setStart(root, 0)
    range.setEnd(container, offset)
    return getVisibleTextLength(range.toString())
  } catch {
    return getCodeText(root).length
  }
}

function getSelectionOffsets(root: HTMLElement): TextSelectionOffsets | null {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return null
  const range = selection.getRangeAt(0)
  if (!isNodeInside(root, range.startContainer) || !isNodeInside(root, range.endContainer)) {
    return null
  }

  const start = getTextOffset(root, range.startContainer, range.startOffset)
  const end = getTextOffset(root, range.endContainer, range.endOffset)
  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
  }
}

function findTextPoint(root: HTMLElement, targetOffset: number): { node: Node; offset: number } {
  const safeOffset = Math.max(0, targetOffset)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode() as Text | null
  let consumed = 0
  let lastText: Text | null = null

  while (current) {
    const textContent = current.textContent || ''
    const textLength = getVisibleTextLength(textContent)
    if (consumed + textLength >= safeOffset) {
      return {
        node: current,
        offset: getDomOffsetForVisibleOffset(textContent, Math.max(0, Math.min(textLength, safeOffset - consumed))),
      }
    }
    consumed += textLength
    lastText = current
    current = walker.nextNode() as Text | null
  }

  if (lastText) {
    return { node: lastText, offset: lastText.textContent?.length || 0 }
  }

  const anchor = document.createTextNode('')
  root.appendChild(anchor)
  return { node: anchor, offset: 0 }
}

function restoreSelectionOffsets(root: HTMLElement, offsets: TextSelectionOffsets): Range | null {
  const selection = window.getSelection()
  if (!selection) return null

  const textLength = getCodeText(root).length
  const startPoint = findTextPoint(root, Math.max(0, Math.min(textLength, offsets.start)))
  const endPoint = findTextPoint(root, Math.max(0, Math.min(textLength, offsets.end)))
  const range = document.createRange()
  range.setStart(startPoint.node, startPoint.offset)
  range.setEnd(endPoint.node, endPoint.offset)
  selection.removeAllRanges()
  selection.addRange(range)
  return range
}

function getHighlightOptions(options?: HighlightOptions) {
  if (typeof options === 'boolean') {
    return { force: options, preserveSelection: false }
  }
  return {
    force: !!options?.force,
    preserveSelection: !!options?.preserveSelection,
  }
}

function fillLanguageSelect(select: HTMLSelectElement) {
  const expected = CODE_LANGUAGE_OPTIONS.map((option) => option.value).join('|')
  const current = Array.from(select.options).map((option) => option.value).join('|')
  if (current === expected) return

  select.innerHTML = ''
  CODE_LANGUAGE_OPTIONS.forEach((language) => {
    const option = document.createElement('option')
    option.value = language.value
    option.textContent = language.label
    select.appendChild(option)
  })
}

function syncWrapButton(wrapper: Element) {
  const button = wrapper.querySelector('[data-code-wrap-toggle="true"]') as HTMLButtonElement | null
  if (!button) return
  const isWrapped = wrapper.getAttribute('data-code-wrap') !== 'off'
  wrapper.setAttribute('data-code-wrap', isWrapped ? 'on' : 'off')
  button.textContent = isWrapped ? '↩' : '↔'
  button.title = isWrapped ? '关闭自动换行' : '开启自动换行'
  button.setAttribute('aria-label', button.title)
  button.setAttribute('aria-pressed', String(isWrapped))
  button.classList.toggle('is-active', isWrapped)
}

function createCodeBlockWrapper(language: string, initialText = '') {
  const normalizedLanguage = normalizeCodeLanguage(language)
  const wrapper = document.createElement('div')
  wrapper.className = 'code-block-wrapper'
  wrapper.setAttribute('data-code-language', normalizedLanguage)
  wrapper.setAttribute('data-code-wrap', 'on')

  const pre = document.createElement('pre')
  pre.className = 'editor-code-block'

  const code = document.createElement('code')
  code.setAttribute('data-language', normalizedLanguage)
  code.appendChild(document.createTextNode(initialText))

  pre.appendChild(code)
  wrapper.appendChild(pre)

  return { wrapper, code }
}

export function useCodeBlocks(refs: EditorRefs) {
  const { editorRef, savedRangeRef } = refs
  const highlightTimersRef = useRef<WeakMap<HTMLElement, number>>(new WeakMap())
  const highlightVersionsRef = useRef<WeakMap<HTMLElement, number>>(new WeakMap())

  const resetCodeBlockMetadata = useCallback((codeEl: HTMLElement) => {
    codeEl.removeAttribute('data-highlighted')
    codeEl.removeAttribute('data-highlight-theme')
    const classesToRemove = Array.from(codeEl.classList).filter((className) => (
      className === 'hljs' || className.startsWith('language-')
    ))
    if (classesToRemove.length > 0) {
      codeEl.classList.remove(...classesToRemove)
    }
  }, [])

  const normalizeCodeBlockToPlainText = useCallback((codeEl: HTMLElement) => {
    const rawText = getCodeText(codeEl)
    const offsets = getSelectionOffsets(codeEl)
    codeEl.textContent = rawText
    ensureTrailingCaretAnchor(codeEl, rawText)
    resetCodeBlockMetadata(codeEl)
    if (offsets) {
      const restored = restoreSelectionOffsets(codeEl, offsets)
      if (restored) savedRangeRef.current = restored.cloneRange()
    }
  }, [resetCodeBlockMetadata, savedRangeRef])

  const getSelectionCodeBlock = useCallback((): HTMLElement | null => {
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
      const codeEl = element?.closest('.code-block-wrapper pre code') as HTMLElement | null
      if (codeEl && editorRef.current.contains(codeEl)) return codeEl
    }
    return null
  }, [editorRef])

  const replaceCodeBlockText = useCallback((
    codeEl: HTMLElement,
    nextText: string,
    selectionStart: number,
    selectionEnd = selectionStart,
  ) => {
    codeEl.textContent = nextText
    ensureTrailingCaretAnchor(codeEl, nextText)
    resetCodeBlockMetadata(codeEl)
    const restored = restoreSelectionOffsets(codeEl, { start: selectionStart, end: selectionEnd })
    if (restored) savedRangeRef.current = restored.cloneRange()
  }, [resetCodeBlockMetadata, savedRangeRef])

  const applySyntaxHighlight = useCallback(async (
    codeEl: HTMLElement,
    language: string,
    options?: HighlightOptions,
  ) => {
    const { force, preserveSelection } = getHighlightOptions(options)
    const selection = window.getSelection()
    const selectionInside = !!(
      selection &&
      selection.rangeCount &&
      isNodeInside(codeEl, selection.getRangeAt(0).commonAncestorContainer)
    )

    if (!force && selectionInside) return

    const rawText = getCodeText(codeEl)
    const normalizedLanguage = normalizeCodeLanguage(language)
    const snapshot = preserveSelection && selectionInside ? getSelectionOffsets(codeEl) : null
    const wrapper = codeEl.closest('.code-block-wrapper')
    wrapper?.setAttribute('data-code-language', normalizedLanguage)
    codeEl.setAttribute('data-language', normalizedLanguage)

    const nextVersion = (highlightVersionsRef.current.get(codeEl) || 0) + 1
    highlightVersionsRef.current.set(codeEl, nextVersion)

    if (!rawText.trim() || normalizedLanguage === 'plaintext') {
      codeEl.textContent = rawText
      ensureTrailingCaretAnchor(codeEl, rawText)
      resetCodeBlockMetadata(codeEl)
      if (snapshot) {
        const restored = restoreSelectionOffsets(codeEl, snapshot)
        if (restored) savedRangeRef.current = restored.cloneRange()
      }
      return
    }

    try {
      const pre = codeEl.closest('pre')
      const backgroundColor = getComputedStyle(pre || codeEl).backgroundColor || ''
      const result = await highlightCodeToInlineHtml(rawText, normalizedLanguage, backgroundColor)
      if (!codeEl.isConnected) return
      if (highlightVersionsRef.current.get(codeEl) !== nextVersion) return

      const latestSelection = window.getSelection()
      const latestSelectionInside = !!(
        latestSelection &&
        latestSelection.rangeCount &&
        isNodeInside(codeEl, latestSelection.getRangeAt(0).commonAncestorContainer)
      )
      if (!force && latestSelectionInside) return

      codeEl.innerHTML = result.html
      ensureTrailingCaretAnchor(codeEl, rawText)
      resetCodeBlockMetadata(codeEl)
      codeEl.classList.add(`language-${result.language}`)
      codeEl.setAttribute('data-language', result.language)
      if (result.highlighted) {
        codeEl.setAttribute('data-highlighted', 'true')
        codeEl.setAttribute('data-highlight-theme', result.theme)
      }

      if (snapshot) {
        const restored = restoreSelectionOffsets(codeEl, snapshot)
        if (restored) savedRangeRef.current = restored.cloneRange()
      }
    } catch {
      codeEl.textContent = rawText
      ensureTrailingCaretAnchor(codeEl, rawText)
      resetCodeBlockMetadata(codeEl)
      if (snapshot) {
        const restored = restoreSelectionOffsets(codeEl, snapshot)
        if (restored) savedRangeRef.current = restored.cloneRange()
      }
    }
  }, [resetCodeBlockMetadata, savedRangeRef])

  const scheduleSyntaxHighlight = useCallback((codeEl: HTMLElement, language?: string) => {
    const existingTimer = highlightTimersRef.current.get(codeEl)
    if (existingTimer) window.clearTimeout(existingTimer)

    const timer = window.setTimeout(() => {
      highlightTimersRef.current.delete(codeEl)
      const wrapper = codeEl.closest('.code-block-wrapper')
      const lang = normalizeCodeLanguage(language || wrapper?.getAttribute('data-code-language') || codeEl.getAttribute('data-language'))
      void applySyntaxHighlight(codeEl, lang, { force: true, preserveSelection: true })
    }, 120)

    highlightTimersRef.current.set(codeEl, timer)
  }, [applySyntaxHighlight])

  const renderCodeHighlights = useCallback((editor: HTMLDivElement, force = false) => {
    const wrappers = editor.querySelectorAll('.code-block-wrapper')
    wrappers.forEach((wrapper) => {
      const codeEl = wrapper.querySelector('pre code') as HTMLElement | null
      if (!codeEl) return
      const langSelect = wrapper.querySelector('[data-code-lang-select="true"]') as HTMLSelectElement | null
      const lang = normalizeCodeLanguage(langSelect?.value || wrapper.getAttribute('data-code-language') || codeEl.getAttribute('data-language'))
      wrapper.setAttribute('data-code-language', lang)
      codeEl.setAttribute('data-language', lang)
      if (langSelect) langSelect.value = lang
      void applySyntaxHighlight(codeEl, lang, force)
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

      const lang = normalizeCodeLanguage(wrapper.getAttribute('data-code-language') || codeEl.getAttribute('data-language'))
      wrapper.setAttribute('data-code-language', lang)
      if (!wrapper.getAttribute('data-code-wrap')) {
        wrapper.setAttribute('data-code-wrap', 'on')
      }
      codeEl.setAttribute('data-language', lang)

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
        controls.appendChild(langSelect)
      }
      fillLanguageSelect(langSelect)
      langSelect.value = lang

      let wrapButton = controls.querySelector('[data-code-wrap-toggle="true"]') as HTMLButtonElement | null
      if (!wrapButton) {
        wrapButton = document.createElement('button')
        wrapButton.type = 'button'
        wrapButton.draggable = false
        wrapButton.className = 'code-wrap-toggle'
        wrapButton.setAttribute('contenteditable', 'false')
        wrapButton.setAttribute('data-code-wrap-toggle', 'true')
        controls.appendChild(wrapButton)
      }
      syncWrapButton(wrapper)

      let copyBtn = controls.querySelector('[data-copy-code-btn="true"]') as HTMLButtonElement | null
      if (!copyBtn) {
        copyBtn = document.createElement('button')
        copyBtn.type = 'button'
        copyBtn.draggable = false
        copyBtn.className = 'code-copy-btn'
        copyBtn.setAttribute('contenteditable', 'false')
        copyBtn.setAttribute('data-copy-code-btn', 'true')
        copyBtn.title = '复制代码'
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

  const insertTextInCodeBlock = useCallback((text: string): HTMLElement | null => {
    const codeEl = getSelectionCodeBlock()
    if (!codeEl) return null
    const offsets = getSelectionOffsets(codeEl)
    if (!offsets) return null

    const source = getCodeText(codeEl)
    const nextText = `${source.slice(0, offsets.start)}${text}${source.slice(offsets.end)}`
    const nextOffset = offsets.start + text.length
    replaceCodeBlockText(codeEl, nextText, nextOffset)
    return codeEl
  }, [getSelectionCodeBlock, replaceCodeBlockText])

  const insertPairedTextInCodeBlock = useCallback((open: string, close: string): HTMLElement | null => {
    const codeEl = getSelectionCodeBlock()
    if (!codeEl) return null
    const offsets = getSelectionOffsets(codeEl)
    if (!offsets) return null

    const source = getCodeText(codeEl)
    const selectedText = source.slice(offsets.start, offsets.end)
    const nextText = `${source.slice(0, offsets.start)}${open}${selectedText}${close}${source.slice(offsets.end)}`
    const nextStart = offsets.start + open.length
    const nextEnd = nextStart + selectedText.length
    replaceCodeBlockText(codeEl, nextText, nextStart, nextEnd)
    return codeEl
  }, [getSelectionCodeBlock, replaceCodeBlockText])

  const insertNewLineInCodeBlock = useCallback((): HTMLElement | null => {
    const codeEl = getSelectionCodeBlock()
    if (!codeEl) return null
    const offsets = getSelectionOffsets(codeEl)
    if (!offsets) return null

    const source = getCodeText(codeEl)
    const before = source.slice(0, offsets.start)
    const after = source.slice(offsets.end)
    const lineStart = before.lastIndexOf('\n') + 1
    const currentLine = before.slice(lineStart)
    const baseIndent = currentLine.match(/^[\t ]*/)?.[0] || ''
    const shouldIndentNextLine = /(?:[\{\[\(]|:)\s*$/.test(currentLine)
    const insertText = `\n${baseIndent}${shouldIndentNextLine ? CODE_INDENT : ''}`
    const nextOffset = before.length + insertText.length

    replaceCodeBlockText(codeEl, `${before}${insertText}${after}`, nextOffset)
    return codeEl
  }, [getSelectionCodeBlock, replaceCodeBlockText])

  const indentCodeBlockSelection = useCallback((outdent = false): HTMLElement | null => {
    const codeEl = getSelectionCodeBlock()
    if (!codeEl) return null
    const offsets = getSelectionOffsets(codeEl)
    if (!offsets) return null

    if (!outdent && offsets.start === offsets.end) {
      return insertTextInCodeBlock(CODE_INDENT)
    }

    const source = getCodeText(codeEl)
    const lineStart = source.lastIndexOf('\n', Math.max(0, offsets.start - 1)) + 1
    let selectionEnd = offsets.end
    if (selectionEnd > offsets.start && source[selectionEnd - 1] === '\n') {
      selectionEnd -= 1
    }
    const lineEndIndex = source.indexOf('\n', Math.max(lineStart, selectionEnd))
    const lineEnd = lineEndIndex === -1 ? source.length : lineEndIndex
    const selectedLines = source.slice(lineStart, lineEnd).split('\n')

    let totalDelta = 0
    let firstLineDelta = 0
    const nextLines = selectedLines.map((line, index) => {
      if (!outdent) {
        totalDelta += CODE_INDENT.length
        if (index === 0) firstLineDelta = CODE_INDENT.length
        return `${CODE_INDENT}${line}`
      }

      const removeCount = line.startsWith('\t')
        ? 1
        : line.startsWith(CODE_INDENT)
          ? CODE_INDENT.length
          : line.startsWith(' ')
            ? 1
            : 0
      totalDelta -= removeCount
      if (index === 0) firstLineDelta = -removeCount
      return line.slice(removeCount)
    })

    const nextText = `${source.slice(0, lineStart)}${nextLines.join('\n')}${source.slice(lineEnd)}`
    const nextStart = outdent
      ? Math.max(lineStart, offsets.start + (offsets.start > lineStart ? firstLineDelta : 0))
      : offsets.start + (offsets.start > lineStart ? firstLineDelta : 0)
    const nextEnd = Math.max(nextStart, offsets.end + totalDelta)

    replaceCodeBlockText(codeEl, nextText, nextStart, nextEnd)
    return codeEl
  }, [getSelectionCodeBlock, insertTextInCodeBlock, replaceCodeBlockText])

  const insertCodeBlockAtCaret = useCallback((
    restoreSavedSelection: () => Selection | null,
    getCurrentBlock: (selection: Selection) => HTMLElement | null,
    handleInput: () => void,
  ) => {
    const selection = restoreSavedSelection()
    if (!selection || !selection.rangeCount) return
    const range = selection.getRangeAt(0)
    const currentBlock = getCurrentBlock(selection)
    const { wrapper, code } = createCodeBlockWrapper('plaintext', '')

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

    if (editorRef.current) ensureCodeBlockControls(editorRef.current)
    const restored = restoreSelectionOffsets(code, { start: 0, end: 0 })
    if (restored) savedRangeRef.current = restored.cloneRange()
    handleInput()
  }, [editorRef, ensureCodeBlockControls, savedRangeRef])

  const replaceBlockWithCodeBlock = useCallback((
    block: HTMLElement,
    language: string,
    handleInput: () => void,
  ): boolean => {
    if (!editorRef.current || !block.parentNode || block === editorRef.current) return false

    const { wrapper, code } = createCodeBlockWrapper(language, '')
    const paragraph = document.createElement('p')
    paragraph.appendChild(document.createElement('br'))

    block.parentNode.replaceChild(wrapper, block)
    wrapper.parentNode?.insertBefore(paragraph, wrapper.nextSibling)
    ensureCodeBlockControls(editorRef.current)

    const restored = restoreSelectionOffsets(code, { start: 0, end: 0 })
    if (restored) savedRangeRef.current = restored.cloneRange()
    handleInput()
    return true
  }, [editorRef, ensureCodeBlockControls, savedRangeRef])

  const toggleCodeBlockWrap = useCallback((wrapper: Element): boolean => {
    const nextWrapped = wrapper.getAttribute('data-code-wrap') === 'off'
    wrapper.setAttribute('data-code-wrap', nextWrapped ? 'on' : 'off')
    syncWrapButton(wrapper)
    return nextWrapped
  }, [])

  return {
    normalizeCodeBlockToPlainText,
    applySyntaxHighlight,
    scheduleSyntaxHighlight,
    renderCodeHighlights,
    ensureCodeBlockControls,
    getSelectionCodeBlock,
    insertTextInCodeBlock,
    insertPairedTextInCodeBlock,
    insertNewLineInCodeBlock,
    indentCodeBlockSelection,
    insertCodeBlockAtCaret,
    replaceBlockWithCodeBlock,
    toggleCodeBlockWrap,
  }
}
