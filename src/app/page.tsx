'use client'

import { useEffect, useCallback, useRef } from 'react'
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

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleContentChange = useCallback((content: string) => {
    updateCurrentContent(content)

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await saveDocument()
    }, 2000)
  }, [updateCurrentContent, saveDocument])

  const handleExport = useCallback(async () => {
    if (!currentDocument) {
      toast.error('没有可导出的文档')
      return
    }

    try {
      await downloadMarkdown(currentDocument.content, currentDocument.title)
      toast.success('文档导出成功')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('文档导出失败')
    }
  }, [currentDocument])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onExport={handleExport} />
        <main className="flex-1 overflow-hidden bg-background">
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
