'use client'

import { useEditorStore, Document } from '@/store/editor-store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  FolderOpen,
  Folder,
  File,
  ChevronRight,
  Home,
  X,
  List,
  FileStack,
  H1,
  H2,
  H3,
} from 'lucide-react'
import { useState, useRef, useMemo } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { isTauri, type FileInfo } from '@/lib/file-service'

interface SidebarProps {
  onExport: () => void
  onTocItemClick?: (id: string) => void
  tocItems?: TocItem[]
}

interface TocItem {
  id: string
  text: string
  level: number // 1, 2, 3 for H1, H2, H3
}

type SidebarTab = 'documents' | 'toc'

export function Sidebar({ onExport, onTocItemClick, tocItems = [] }: SidebarProps) {
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
    // File system mode
    isFileSystemMode,
    currentDirectory,
    directoryFiles,
    currentFilePath,
    openFolder,
    loadDirectoryContents,
    openFileFromDirectory,
    createNewFileInDirectory,
    setCurrentDirectory,
  } = useEditorStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [isCreatingFile, setIsCreatingFile] = useState(false)
  const [activeTab, setActiveTab] = useState<SidebarTab>('documents')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

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

  const handleOpenFolder = async () => {
    await openFolder()
  }

  const handleCloseFolder = () => {
    setCurrentDirectory(null)
  }

  const handleFileClick = async (file: FileInfo) => {
    if (file.isDirectory) {
      // Navigate into directory
      await loadDirectoryContents(file.path)
    } else if (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt')) {
      // Open markdown file
      await openFileFromDirectory(file.path)
    }
  }

  const handleCreateNewFile = async () => {
    if (!newFileName.trim()) {
      toast.error('Please enter a file name')
      return
    }

    const fileName = newFileName.endsWith('.md') ? newFileName : `${newFileName}.md`
    setIsCreatingFile(true)
    const path = await createNewFileInDirectory(fileName)
    setIsCreatingFile(false)

    if (path) {
      setNewFileName('')
      toast.success(`Created ${fileName}`)
    }
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

  // Render TOC
  const renderToc = () => (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <h3 className="text-sm font-semibold text-muted-foreground">文档目录</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {tocItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              文档中没有标题
            </div>
          ) : (
            tocItems.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent transition-colors ${
                  item.level === 1 ? 'pl-2' : item.level === 2 ? 'pl-4' : 'pl-6'
                }`}
                onClick={() => onTocItemClick?.(item.id)}
              >
                {item.level === 1 && <H1 className="h-3.5 w-3.5 text-primary shrink-0" />}
                {item.level === 2 && <H2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                {item.level === 3 && <H3 className="h-3.5 w-3.5 text-primary shrink-0" />}
                <span className="truncate text-sm">{item.text}</span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )

  // Render file tree for file system mode
  const renderFileTree = () => (
    <div className="flex flex-col h-full">
      {/* Folder header */}
      <div className="flex items-center justify-between border-b p-2 bg-muted/50">
        <div className="flex items-center gap-2 min-w-0">
          <Folder className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">
            {currentDirectory?.split(/[/\\]/).pop()}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleOpenFolder}
            title="Open another folder"
          >
            <FolderOpen className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCloseFolder}
            title="Close folder"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* New file input */}
      {isCreatingFile ? (
        <div className="p-2 border-b flex gap-2">
          <Input
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="filename.md"
            className="h-8 text-sm flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateNewFile()
              if (e.key === 'Escape') setIsCreatingFile(false)
            }}
          />
          <Button size="sm" onClick={handleCreateNewFile}>Create</Button>
        </div>
      ) : (
        <div className="p-2 border-b">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => setIsCreatingFile(true)}
          >
            <Plus className="h-4 w-4" />
            New File
          </Button>
        </div>
      )}

      {/* File list */}
      <ScrollArea className="flex-1">
        <div className="p-1">
          {/* Go back button */}
          {currentDirectory && currentDirectory.includes('/') && (
            <div
              className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent text-sm text-muted-foreground"
              onClick={async () => {
                const parentPath = currentDirectory.split('/').slice(0, -1).join('/')
                if (parentPath) {
                  await loadDirectoryContents(parentPath)
                }
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>..</span>
            </div>
          )}

          {/* Files and folders */}
          {directoryFiles.map((file) => (
            <div
              key={file.path}
              className={`group flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-accent ${
                currentFilePath === file.path ? 'bg-accent' : ''
              }`}
              onClick={() => handleFileClick(file)}
            >
              {file.isDirectory ? (
                <Folder className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <File className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className="truncate text-sm">{file.name}</span>
            </div>
          ))}

          {directoryFiles.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Empty folder
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )

  // Render document list for database mode
  const renderDocumentList = () => (
    <>
      {/* Search */}
      <div className="p-2">
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

      {/* New Document Button */}
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

      {/* Document List */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {filteredDocuments.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery ? 'No documents found' : 'No documents yet'}
            </div>
          ) : (
            filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className={`group flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors hover:bg-accent ${
                  currentDocument?.id === doc.id ? 'bg-accent' : ''
                }`}
                onClick={() => setCurrentDocument(doc)}
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    {doc.isPinned && <Pin className="h-3 w-3 text-primary" />}
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
                    <DropdownMenuItem onClick={(e) => handleTogglePin(doc.id, e as unknown as React.MouseEvent)}>
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
                      onClick={(e) => handleDeleteDocument(doc.id, e as unknown as React.MouseEvent)}
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
      </ScrollArea>

      {/* Footer with document count */}
      <div className="border-t p-2 text-xs text-muted-foreground">
        {documents.length} document{documents.length !== 1 ? 's' : ''}
      </div>
    </>
  )

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
          variant={activeTab === 'documents' ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => { setActiveTab('documents'); setSidebarOpen(true) }}
          title="Documents"
        >
          <FileStack className="h-5 w-5" />
        </Button>
        <Button
          variant={activeTab === 'toc' ? 'secondary' : 'ghost'}
          size="icon"
          onClick={() => { setActiveTab('toc'); setSidebarOpen(true) }}
          title="Table of Contents"
        >
          <List className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCreateDocument}
          disabled={isCreating}
          title="New document"
          className="mt-2"
        >
          <Plus className="h-5 w-5" />
        </Button>
        {isTauri() && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenFolder}
            title="Open folder"
            className="mt-2"
          >
            <FolderOpen className="h-5 w-5" />
          </Button>
        )}
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
      {/* Hidden file input for restore */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      {/* Header with tabs */}
      <div className="flex items-center justify-between border-b p-1">
        <div className="flex">
          <Button
            variant={activeTab === 'documents' ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-1 h-7"
            onClick={() => setActiveTab('documents')}
          >
            <FileStack className="h-3.5 w-3.5" />
            <span className="text-xs">
              {isFileSystemMode ? 'Files' : 'Docs'}
            </span>
          </Button>
          <Button
            variant={activeTab === 'toc' ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-1 h-7"
            onClick={() => setActiveTab('toc')}
          >
            <List className="h-3.5 w-3.5" />
            <span className="text-xs">目录</span>
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {!isFileSystemMode && activeTab === 'documents' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" title="Data options">
                  <Database className="h-3.5 w-3.5" />
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
          )}
          {isTauri() && !isFileSystemMode && activeTab === 'documents' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleOpenFolder}
              title="Open folder"
            >
              <FolderOpen className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setSidebarOpen(false)}
            title="Close sidebar"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'toc' ? renderToc() : (
        isFileSystemMode ? renderFileTree() : renderDocumentList()
      )}
    </div>
  )
}
