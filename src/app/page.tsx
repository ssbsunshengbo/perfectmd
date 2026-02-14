'use client'

import { useEffect, useCallback, useState } from 'react'
import { useEditorStore } from '@/store/editor-store'
import { MarkdownEditor } from '@/components/editor/MarkdownEditor'
import { Sidebar } from '@/components/editor/Sidebar'
import { Header } from '@/components/editor/Header'
import { EmptyState } from '@/components/editor/EmptyState'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'sonner'
import { downloadMarkdown } from '@/lib/html-to-markdown'

export default function Home() {
  const {
    currentDocument,
    fetchDocuments,
    updateCurrentContent,
    saveDocument,
  } = useEditorStore()

  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

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

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onExport={handleExport} />
        <main className="flex-1 overflow-auto bg-background">
          {currentDocument ? (
            <MarkdownEditor
              content={currentDocument.content}
              onChange={handleContentChange}
            />
          ) : (
            <EmptyState />
          )}
        </main>
      </div>
      <Toaster />
    </div>
  )
}
