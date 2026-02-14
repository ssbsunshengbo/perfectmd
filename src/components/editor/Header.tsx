'use client'

import { useEditorStore } from '@/store/editor-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Moon, Sun, FileText, Save } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

export function Header() {
  const { currentDocument, updateCurrentTitle, saveDocument } = useEditorStore()
  const { theme, setTheme } = useTheme()
  const [isSaving, setIsSaving] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Track mounted state for hydration
  useEffect(() => {
    // Using a microtask to avoid synchronous setState warning
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  const handleSaveDocument = useCallback(async () => {
    if (!currentDocument) return
    setIsSaving(true)
    await saveDocument()
    toast.success('Document saved')
    setTimeout(() => setIsSaving(false), 500)
  }, [currentDocument, saveDocument])

  // Auto-save on Ctrl+S
  useEffect(() => {
    const handleSave = () => {
      handleSaveDocument()
    }
    window.addEventListener('save-document', handleSave)
    return () => window.removeEventListener('save-document', handleSave)
  }, [handleSaveDocument])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateCurrentTitle(e.target.value)
  }

  // Auto-save on blur (silent)
  const handleTitleBlur = () => {
    if (currentDocument) {
      saveDocument()
    }
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-semibold">Markdown Editor</h1>
        {currentDocument && (
          <span className="text-xs text-muted-foreground">
            • {isSaving ? 'Saving...' : 'Auto-saved'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {currentDocument && (
          <>
            <Input
              value={currentDocument.title}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              className="h-8 w-48 text-sm"
              placeholder="Document title"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDocument}
              disabled={isSaving}
              className="gap-1"
            >
              <Save className="h-4 w-4" />
              Save
            </Button>
          </>
        )}
        
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        )}
      </div>
    </header>
  )
}
