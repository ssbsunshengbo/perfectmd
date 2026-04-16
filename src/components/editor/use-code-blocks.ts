import { useCallback } from 'react'
import hljs from 'highlight.js/lib/common'
import { CODE_LANGUAGES, type EditorRefs } from './editor-types'

export function useCodeBlocks(refs: EditorRefs) {
  const { editorRef } = refs

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
    refs.savedRangeRef.current = caret.cloneRange()
    return true
  }, [refs.savedRangeRef])

  const insertCodeBlockAtCaret = useCallback((
    restoreSavedSelection: () => Selection | null,
    getCurrentBlock: (selection: Selection) => HTMLElement | null,
    handleInput: () => void,
  ) => {
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
    refs.savedRangeRef.current = caret.cloneRange()
    handleInput()
  }, [editorRef, refs.savedRangeRef])

  return {
    normalizeCodeBlockToPlainText,
    applySyntaxHighlight,
    renderCodeHighlights,
    ensureCodeBlockControls,
    insertNewLineInCodeBlock,
    insertCodeBlockAtCaret,
  }
}
