'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { MarkdownEditor, TocItem } from '@/components/editor/MarkdownEditor'
import { Sidebar } from '@/components/editor/Sidebar'
import { Header } from '@/components/editor/Header'
import { EmptyState } from '@/components/editor/EmptyState'
import { MainToolbar } from '@/components/editor/MainToolbar'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { downloadMarkdown } from '@/lib/html-to-markdown'

export default function Home() {
  const {
    currentDocument,
    fetchDocuments,
    updateCurrentContent,
    saveDocument,
    isFileSystemMode,
  } = useEditorStore()

  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)
  const [tocItems, setTocItems] = useState<TocItem[]>([])
  const [scrollToHeading, setScrollToHeading] = useState<string | null>(null)

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Auto-save with debounce (no toast notification)
  const handleContentChange = useCallback((content: string) => {
    updateCurrentContent(content)

    // Debounced auto-save without toast
    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    const timeout = setTimeout(async () => {
      if (currentDocument) {
        await saveDocument()
        // No toast for auto-save - silent background save
      }
    }, 2000)

    setSaveTimeout(timeout)
  }, [currentDocument, updateCurrentContent, saveDocument, saveTimeout])

  // Handle TOC item click
  const handleTocItemClick = useCallback((id: string) => {
    setScrollToHeading(id)
    // Reset after a short delay to allow re-clicking the same item
    setTimeout(() => setScrollToHeading(null), 100)
  }, [])

  // Export document with proper formatting
  const handleExport = useCallback(() => {
    if (!currentDocument) {
      toast.error('No document to export')
      return
    }

    try {
      downloadMarkdown(currentDocument.content, currentDocument.title)
      toast.success('Document exported successfully')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export document')
    }
  }, [currentDocument])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }
    }
  }, [saveTimeout])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (currentDocument) {
          saveDocument()
          toast.success('Document saved')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentDocument, saveDocument])

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          onExport={handleExport} 
          tocItems={tocItems}
          onTocItemClick={handleTocItemClick}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          {currentDocument ? (
            <>
              {/* Main Toolbar */}
              <MainToolbar onApplyStyle={(style, value) => {
                // Apply style by triggering execCommand
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
                  case 'heading':
                    document.execCommand('formatBlock', false, `<h${value || '1'}>`)
                    break
                  case 'normal':
                    document.execCommand('formatBlock', false, '<p>')
                    break
                  case 'list':
                    if (value === 'bullet') {
                      document.execCommand('insertUnorderedList', false)
                    } else {
                      document.execCommand('insertOrderedList', false)
                    }
                    break
                  case 'quote':
                    document.execCommand('formatBlock', false, '<blockquote>')
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
                  case 'code': {
                    const selection = window.getSelection()
                    if (selection && !selection.isCollapsed) {
                      const range = selection.getRangeAt(0)
                      const codeSpan = document.createElement('code')
                      codeSpan.className = 'inline-code'
                      codeSpan.textContent = selection.toString()
                      range.deleteContents()
                      range.insertNode(codeSpan)
                    }
                    break
                  }
                }
              }} />
              {/* Editor Area - fixed overflow to prevent double scrollbar */}
              <div className="flex-1 overflow-hidden">
                <MarkdownEditor
                  content={currentDocument.content}
                  onChange={handleContentChange}
                  onTocChange={setTocItems}
                  scrollToHeading={scrollToHeading}
                />
              </div>
            </>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>
      <Toaster />
    </div>
  )
}
