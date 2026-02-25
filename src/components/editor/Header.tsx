'use client'

import { useEditorStore } from '@/store/editor-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Moon,
  Sun,
  FileText,
  Save,
  Upload,
  Download,
  FileDown,
  FolderOpen,
  Settings,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { isTauri } from '@/lib/file-service'
import { ThemeSettings } from '@/components/editor/ThemeSettings'

export function Header() {
  const {
    currentDocument,
    updateCurrentTitle,
    saveDocument,
    importFile,
    saveCurrentFile,
    exportAsPdf,
    openFolder,
    isFileSystemMode,
    currentDirectory,
  } = useEditorStore()
  const { theme, setTheme } = useTheme()
  const [isSaving, setIsSaving] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Track mounted state for hydration
  useEffect(() => {
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

  const handleImportFile = async () => {
    const doc = await importFile()
    if (doc) {
      toast.success(`Imported: ${doc.title}`)
    }
  }

  const handleSaveFile = async () => {
    try {
      const success = await saveCurrentFile()
      if (success) {
        toast.success('File saved successfully')
      } else {
        // User cancelled the save dialog, no error
      }
    } catch (error) {
      console.error('Save file error:', error)
      toast.error(`Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleExportPdf = async () => {
    const result = await exportAsPdf()
    if (result) {
      toast.success('PDF exported successfully!')
    } else {
      toast.error('Failed to export PDF')
    }
  }

  const handleOpenFolder = async () => {
    const path = await openFolder()
    if (path) {
      toast.success('Folder opened')
    }
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-semibold">PerfectMD</h1>
        {currentDocument && (
          <span className="text-xs text-muted-foreground">
            • {isSaving ? 'Saving...' : 'Auto-saved'}
          </span>
        )}
        {isFileSystemMode && currentDirectory && (
          <span className="max-w-[200px] truncate text-xs text-primary">
            📁 {currentDirectory.split(/[/\\]/).pop()}
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

            {/* File Operations */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Download className="h-4 w-4" />
                  File
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleImportFile}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import MD File
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSaveFile}>
                  <Save className="mr-2 h-4 w-4" />
                  Save As...
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExportPdf}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Export as PDF
                </DropdownMenuItem>
                {isTauri() && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleOpenFolder}>
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Open Folder
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

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

        {/* Theme Settings */}
        <ThemeSettings />

        {/* Quick Dark/Light Toggle */}
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
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
