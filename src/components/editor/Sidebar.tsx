'use client'

import { useEditorStore } from '@/store/editor-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Plus,
  FileText,
  Trash2,
  Pin,
  PinOff,
  Search,
  ChevronLeft,
  Download,
  Upload,
  MoreHorizontal,
  Database,
  ListTree,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface SidebarProps {
  onExport: () => void
}

export function Sidebar({ onExport }: SidebarProps) {
  const {
    documents,
    currentDocument,
    isSidebarOpen,
    setSidebarOpen,
    createDocument,
    setCurrentDocument,
    deleteDocument,
    togglePin,
    exportAllDocuments,
    importDocumentsFromJson,
  } = useEditorStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [viewMode, setViewMode] = useState<'documents' | 'outline'>('documents')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const outlineHeadings = useMemo(() => {
    if (!currentDocument?.content) return []
    const parser = new DOMParser()
    const doc = parser.parseFromString(currentDocument.content, 'text/html')
    const headingElements = Array.from(doc.querySelectorAll('h1, h2, h3'))
    return headingElements.map((heading, index) => {
      const level = Number(heading.tagName.toLowerCase().replace('h', '')) || 1
      const text = heading.textContent?.trim() || `Heading ${index + 1}`
      return { level, text, index }
    })
  }, [currentDocument?.content])

  const handleCreateDocument = async () => {
    setIsCreating(true)
    await createDocument()
    setIsCreating(false)
  }

  const handleDeleteDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteDocument(id)
  }

  const handleTogglePin = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await togglePin(id)
  }

  const handleBackup = async () => {
    try {
      const jsonData = await exportAllDocuments()
      const blob = new Blob([jsonData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `markdown-editor-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Backup created successfully')
    } catch (error) {
      console.error('Backup error:', error)
      toast.error('Failed to create backup')
    }
  }

  const handleRestore = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const count = await importDocumentsFromJson(text)
      toast.success(`Restored ${count} documents`)
    } catch (error) {
      console.error('Restore error:', error)
      toast.error('Failed to restore backup. Make sure the file is valid.')
    }

    e.target.value = ''
  }

  const handleOutlineClick = (headingIndex: number) => {
    window.dispatchEvent(
      new CustomEvent('editor-scroll-to-heading', {
        detail: { index: headingIndex },
      })
    )
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    return d.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!isSidebarOpen) {
    return (
      <div className="flex h-full w-12 flex-col items-center border-r bg-muted/30 py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          className="mb-4"
          title="Open sidebar"
        >
          <FileText className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCreateDocument}
          disabled={isCreating}
          title="New document"
        >
          <Plus className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBackup}
          title="Backup data"
          className="mt-2"
        >
          <Database className="h-5 w-5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full w-64 flex-col border-r bg-muted/30">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-semibold">
          {viewMode === 'documents' ? 'Documents' : 'Outline'}
        </h2>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Data options">
                <Database className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleBackup}>
                <Download className="mr-2 h-4 w-4" />
                Backup All Data
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRestore}>
                <Upload className="mr-2 h-4 w-4" />
                Restore from Backup
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onExport}>
                <Download className="mr-2 h-4 w-4" />
                Export Current Document
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSidebarOpen(false)}
            title="Close sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-2">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          <Button
            variant={viewMode === 'documents' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setViewMode('documents')}
          >
            <FileText className="mr-1 h-3.5 w-3.5" />
            Document
          </Button>
          <Button
            variant={viewMode === 'outline' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setViewMode('outline')}
          >
            <ListTree className="mr-1 h-3.5 w-3.5" />
            目录
          </Button>
        </div>
      </div>

      {viewMode === 'documents' ? (
        <>
          <div className="px-2 pb-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>

          <div className="px-2 pb-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={handleCreateDocument}
              disabled={isCreating}
            >
              <Plus className="h-4 w-4" />
              New Document
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2">
            <div className="space-y-1 py-2">
              {filteredDocuments.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {searchQuery ? 'No documents found' : 'No documents yet'}
                </div>
              ) : (
                filteredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className={`group flex cursor-pointer items-center gap-2 rounded-md border p-2 transition-colors ${
                      doc.isPinned
                        ? 'border-amber-300/80 bg-amber-50/80 dark:border-amber-500/70 dark:bg-amber-950/30'
                        : 'border-transparent'
                    } ${
                      currentDocument?.id === doc.id ? 'bg-accent' : 'hover:bg-accent'
                    }`}
                    onClick={() => setCurrentDocument(doc)}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        {doc.isPinned && (
                          <>
                            <Pin className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                            <span className="rounded bg-amber-200/80 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-700/40 dark:text-amber-200">
                              Pinned
                            </span>
                          </>
                        )}
                        <span className="truncate text-sm font-medium">{doc.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(doc.updatedAt)}
                      </span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) =>
                            handleTogglePin(doc.id, e as unknown as React.MouseEvent)
                          }
                        >
                          {doc.isPinned ? (
                            <>
                              <PinOff className="mr-2 h-4 w-4" />
                              Unpin
                            </>
                          ) : (
                            <>
                              <Pin className="mr-2 h-4 w-4" />
                              Pin
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) =>
                            handleDeleteDocument(doc.id, e as unknown as React.MouseEvent)
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <div className="space-y-1 py-2">
            {!currentDocument ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Select a document first
              </div>
            ) : outlineHeadings.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No headings found (H1/H2/H3)
              </div>
            ) : (
              outlineHeadings.map((heading) => (
                <button
                  key={`${heading.index}-${heading.text}`}
                  type="button"
                  onClick={() => handleOutlineClick(heading.index)}
                  className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                  style={{ paddingLeft: `${heading.level * 12}px` }}
                  title={heading.text}
                >
                  <span className="mr-2 shrink-0 text-[10px] text-muted-foreground">
                    {heading.level === 1 ? '•' : heading.level === 2 ? '◦' : '▪'}
                  </span>
                  <span className="truncate">{heading.text}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div className="border-t p-2 text-xs text-muted-foreground">
        {documents.length} document{documents.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
