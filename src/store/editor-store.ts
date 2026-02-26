'use client'

import { create } from 'zustand'
import {
  importMarkdownFile,
  saveMarkdownFile,
  exportToPdf,
  openDirectory,
  readDirectory,
  readFileContent,
  saveFileToPath,
  createFile,
  isTauri,
  markdownToHtml,
  type FileInfo,
} from '@/lib/file-service'

export interface Document {
  id: string
  title: string
  content: string
  isPinned: boolean
  createdAt: string
  updatedAt: string
  // For file system mode
  filePath?: string
}

interface EditorState {
  documents: Document[]
  currentDocument: Document | null
  isLoading: boolean
  isSidebarOpen: boolean

  // File system mode
  isFileSystemMode: boolean
  currentDirectory: string | null
  directoryFiles: FileInfo[]
  currentFilePath: string | null

  // Actions
  setDocuments: (documents: Document[]) => void
  setCurrentDocument: (document: Document | null) => void
  setIsLoading: (loading: boolean) => void
  setSidebarOpen: (open: boolean) => void
  updateCurrentContent: (content: string) => void
  updateCurrentTitle: (title: string) => void

  // Storage operations
  fetchDocuments: () => Promise<void>
  createDocument: () => Promise<Document | null>
  saveDocument: () => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  exportAllDocuments: () => Promise<string>
  importDocumentsFromJson: (jsonData: string) => Promise<number>

  // New file system operations
  importFile: () => Promise<Document | null>
  saveCurrentFile: () => Promise<boolean>
  exportAsPdf: () => Promise<boolean>

  // Directory management
  openFolder: () => Promise<string | null>
  loadDirectoryContents: (dirPath: string) => Promise<void>
  openFileFromDirectory: (filePath: string) => Promise<void>
  saveToDirectory: (filePath: string) => Promise<boolean>
  createNewFileInDirectory: (fileName: string) => Promise<string | null>
  setCurrentDirectory: (path: string | null) => void
  setCurrentFilePath: (path: string | null) => void
}

// ===== IndexedDB Storage (inlined) =====

const DB_NAME = 'MarkdownEditorDB'
const DB_VERSION = 1
const STORE_NAME = 'documents'

const isBrowser = () => typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'

const generateId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = Math.random() * 16 | 0
  const v = c === 'x' ? r : (r & 0x3 | 0x8)
  return v.toString(16)
})

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(new Error(`Failed to open database: ${request.error?.message}`))
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('isPinned', 'isPinned', { unique: false })
        store.createIndex('updatedAt', 'updatedAt', { unique: false })
      }
    }
  })
}

async function getAllDocs(): Promise<Document[]> {
  if (!isBrowser()) return []
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => {
      const documents = request.result as Document[]
      documents.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })
      resolve(documents)
    }
    request.onerror = () => reject(new Error(`Failed to get documents: ${request.error?.message}`))
  })
}

async function getDocById(id: string): Promise<Document | null> {
  if (!isBrowser()) return null
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(new Error(`Failed to get document: ${request.error?.message}`))
  })
}

async function createDoc(title: string = 'Untitled', content: string = ''): Promise<Document> {
  const now = new Date().toISOString()
  const document: Document = {
    id: generateId(),
    title,
    content,
    isPinned: false,
    createdAt: now,
    updatedAt: now,
  }

  if (!isBrowser()) return document

  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.add(document)
    request.onsuccess = () => resolve(document)
    request.onerror = () => reject(new Error(`Failed to create document: ${request.error?.message}`))
  })
}

async function updateDoc(id: string, data: Partial<Omit<Document, 'id' | 'createdAt'>>): Promise<Document | null> {
  if (!isBrowser()) return null
  const existing = await getDocById(id)
  if (!existing) return null

  const updated: Document = { ...existing, ...data, updatedAt: new Date().toISOString() }
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(updated)
    request.onsuccess = () => resolve(updated)
    request.onerror = () => reject(new Error(`Failed to update document: ${request.error?.message}`))
  })
}

async function deleteDoc(id: string): Promise<boolean> {
  if (!isBrowser()) return false
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)
    request.onsuccess = () => resolve(true)
    request.onerror = () => reject(new Error(`Failed to delete document: ${request.error?.message}`))
  })
}

async function toggleDocPin(id: string): Promise<Document | null> {
  const existing = await getDocById(id)
  if (!existing) return null
  return updateDoc(id, { isPinned: !existing.isPinned })
}

async function exportDocs(): Promise<string> {
  const documents = await getAllDocs()
  return JSON.stringify(documents, null, 2)
}

async function importDocs(jsonData: string): Promise<number> {
  const documents = JSON.parse(jsonData) as Document[]
  if (!Array.isArray(documents)) throw new Error('Invalid backup format')

  if (!isBrowser()) return 0

  const db = await openDB()
  let importedCount = 0

  for (const doc of documents) {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(doc)
      request.onsuccess = () => { importedCount++; resolve() }
      request.onerror = () => reject(new Error(`Failed to import document`))
    })
  }
  return importedCount
}

// ===== Zustand Store =====

export const useEditorStore = create<EditorState>((set, get) => ({
  documents: [],
  currentDocument: null,
  isLoading: false,
  isSidebarOpen: true,

  // File system mode
  isFileSystemMode: false,
  currentDirectory: null,
  directoryFiles: [],
  currentFilePath: null,

  setDocuments: (documents) => set({ documents }),
  setCurrentDocument: (document) => set({ currentDocument: document }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),

  updateCurrentContent: (content) => {
    const { currentDocument } = get()
    if (currentDocument) {
      set({ currentDocument: { ...currentDocument, content } })
    }
  },

  updateCurrentTitle: (title) => {
    const { currentDocument } = get()
    if (currentDocument) {
      set({ currentDocument: { ...currentDocument, title } })
    }
  },

  fetchDocuments: async () => {
    if (!isBrowser()) return
    set({ isLoading: true })
    try {
      const documents = await getAllDocs()
      set({ documents, isLoading: false })
    } catch (error) {
      console.error('Failed to fetch documents:', error)
      set({ isLoading: false })
    }
  },

  createDocument: async () => {
    if (!isBrowser()) return null
    try {
      const document = await createDoc('Untitled', '')
      const { documents } = get()
      set({ documents: [document, ...documents], currentDocument: document, currentFilePath: null })
      return document
    } catch (error) {
      console.error('Failed to create document:', error)
      return null
    }
  },

  saveDocument: async () => {
    const { currentDocument, currentFilePath, isFileSystemMode } = get()
    if (!currentDocument || !isBrowser()) return

    try {
      // If in file system mode and has a file path, save directly
      if (isFileSystemMode && currentFilePath) {
        await saveFileToPath(currentFilePath, currentDocument.content)
        return
      }

      await updateDoc(currentDocument.id, {
        title: currentDocument.title,
        content: currentDocument.content,
      })
      const { documents } = get()
      const updatedDocs = documents.map((d) => d.id === currentDocument.id ? currentDocument : d)
      updatedDocs.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })
      set({ documents: updatedDocs })
    } catch (error) {
      console.error('Failed to save document:', error)
    }
  },

  deleteDocument: async (id) => {
    if (!isBrowser()) return
    try {
      await deleteDoc(id)
      const { documents, currentDocument } = get()
      set({
        documents: documents.filter((d) => d.id !== id),
        currentDocument: currentDocument?.id === id ? null : currentDocument,
      })
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  },

  togglePin: async (id) => {
    if (!isBrowser()) return
    try {
      await toggleDocPin(id)
      const { documents } = get()
      const newDocuments = documents.map((d) => d.id === id ? { ...d, isPinned: !d.isPinned } : d)
      newDocuments.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      })
      set({ documents: newDocuments })
    } catch (error) {
      console.error('Failed to toggle pin:', error)
    }
  },

  exportAllDocuments: async () => exportDocs(),

  importDocumentsFromJson: async (jsonData: string) => {
    if (!isBrowser()) return 0
    const count = await importDocs(jsonData)
    const documents = await getAllDocs()
    set({ documents })
    return count
  },

  // New file system operations
  importFile: async () => {
    try {
      const result = await importMarkdownFile()
      if (!result) return null

      const { documents } = get()
      // Create a new document from imported file
      const document = await createDoc(result.name, result.content)
      set({
        documents: [document, ...documents.filter(d => d.id !== document.id)],
        currentDocument: document,
        currentFilePath: null,
      })
      return document
    } catch (error) {
      console.error('Failed to import file:', error)
      return null
    }
  },

  saveCurrentFile: async () => {
    const { currentDocument, currentFilePath, isFileSystemMode } = get()
    if (!currentDocument) return false

    try {
      // If in file system mode with a file path, save directly
      if (isFileSystemMode && currentFilePath) {
        const success = await saveFileToPath(currentFilePath, currentDocument.content)
        if (success) {
          console.log('File saved to:', currentFilePath)
        }
        return success
      }

      // Otherwise, use save dialog
      const path = await saveMarkdownFile(currentDocument.content, currentDocument.title)
      if (path) {
        console.log('File saved to:', path)
        set({ currentFilePath: path })
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to save file:', error)
      throw error // Re-throw to let caller show error message
    }
  },

  exportAsPdf: async () => {
    const { currentDocument } = get()
    if (!currentDocument) return false

    try {
      return await exportToPdf(currentDocument.title, currentDocument.content)
    } catch (error) {
      console.error('Failed to export PDF:', error)
      throw error // Re-throw to let caller handle
    }
  },

  // Directory management
  openFolder: async () => {
    try {
      const dirPath = await openDirectory()
      if (!dirPath) return null

      set({
        currentDirectory: dirPath,
        isFileSystemMode: true,
        isSidebarOpen: true,
      })

      await get().loadDirectoryContents(dirPath)
      return dirPath
    } catch (error) {
      console.error('Failed to open folder:', error)
      return null
    }
  },

  loadDirectoryContents: async (dirPath: string) => {
    try {
      const files = await readDirectory(dirPath)
      if (files) {
        set({ directoryFiles: files, currentDirectory: dirPath })
      }
    } catch (error) {
      console.error('Failed to load directory:', error)
    }
  },

  openFileFromDirectory: async (filePath: string) => {
    try {
      const markdown = await readFileContent(filePath)
      if (markdown === null) return

      const fileName = filePath.split(/[/\\]/).pop() || 'Untitled'
      const title = fileName.replace(/\.md$/, '')
      
      // Convert markdown to HTML for the editor
      const html = markdownToHtml(markdown)

      const document: Document = {
        id: generateId(),
        title,
        content: html,
        isPinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        filePath,
      }

      set({ currentDocument: document, currentFilePath: filePath })
    } catch (error) {
      console.error('Failed to open file:', error)
    }
  },

  saveToDirectory: async (filePath: string) => {
    const { currentDocument } = get()
    if (!currentDocument) return false

    try {
      const success = await saveFileToPath(filePath, currentDocument.content)
      if (success) {
        set({ currentFilePath: filePath })
        // Refresh directory contents
        const { currentDirectory } = get()
        if (currentDirectory) {
          await get().loadDirectoryContents(currentDirectory)
        }
      }
      return success
    } catch (error) {
      console.error('Failed to save to directory:', error)
      return false
    }
  },

  createNewFileInDirectory: async (fileName: string) => {
    const { currentDirectory } = get()
    if (!currentDirectory) return null

    try {
      const filePath = await createFile(currentDirectory, fileName, '# ' + fileName.replace('.md', '') + '\n\n')
      if (filePath) {
        // Refresh directory contents
        await get().loadDirectoryContents(currentDirectory)
        // Open the new file
        await get().openFileFromDirectory(filePath)
        return filePath
      }
      return null
    } catch (error) {
      console.error('Failed to create file:', error)
      return null
    }
  },

  setCurrentDirectory: (path) => set({ currentDirectory: path, isFileSystemMode: !!path }),
  setCurrentFilePath: (path) => set({ currentFilePath: path }),
}))
