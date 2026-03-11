'use client'

import { useEffect, useState, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileText, Heading1, Heading2, Heading3, ChevronRight } from 'lucide-react'

interface TocItem {
  id: string
  text: string
  level: 1 | 2 | 3
  element: HTMLElement
}

interface TableOfContentsProps {
  content: string
  editorRef: React.RefObject<HTMLDivElement | null>
}

export function TableOfContents({ content, editorRef }: TableOfContentsProps) {
  const [tocItems, setTocItems] = useState<TocItem[]>([])

  // Parse the editor content and extract headings
  const extractHeadings = useCallback(() => {
    if (!editorRef.current) return []

    const headings: TocItem[] = []
    const headingElements = editorRef.current.querySelectorAll('h1, h2, h3')

    headingElements.forEach((el, index) => {
      const tagName = el.tagName.toLowerCase()
      const level = parseInt(tagName.charAt(1)) as 1 | 2 | 3
      const text = el.textContent?.trim() || ''
      
      // Generate a unique ID for the heading if it doesn't have one
      let id = el.id || `heading-${index}`
      if (!el.id) {
        el.id = id
      }

      headings.push({
        id,
        text,
        level,
        element: el as HTMLElement,
      })
    })

    return headings
  }, [editorRef])

  // Update TOC when content changes
  useEffect(() => {
    // Small delay to ensure DOM is updated
    const timer = setTimeout(() => {
      const headings = extractHeadings()
      setTocItems(headings)
    }, 50)

    return () => clearTimeout(timer)
  }, [content, extractHeadings])

  // Scroll to heading when clicked
  const scrollToHeading = useCallback((item: TocItem) => {
    const element = document.getElementById(item.id)
    if (element) {
      // Calculate the position accounting for any fixed headers
      const headerOffset = 80
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.scrollY - headerOffset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })

      // Also scroll within the editor if needed
      if (editorRef.current) {
        const editorRect = editorRef.current.getBoundingClientRect()
        const headingRect = element.getBoundingClientRect()
        
        if (headingRect.top < editorRect.top || headingRect.bottom > editorRect.bottom) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }

      // Briefly highlight the heading
      element.classList.add('toc-highlight')
      setTimeout(() => {
        element.classList.remove('toc-highlight')
      }, 1500)
    }
  }, [editorRef])

  // Get icon for heading level
  const getHeadingIcon = (level: 1 | 2 | 3) => {
    switch (level) {
      case 1:
        return <Heading1 className="h-4 w-4 shrink-0" />
      case 2:
        return <Heading2 className="h-4 w-4 shrink-0" />
      case 3:
        return <Heading3 className="h-4 w-4 shrink-0" />
    }
  }

  // Get indentation class based on heading level
  const getIndentClass = (level: 1 | 2 | 3) => {
    switch (level) {
      case 1:
        return 'pl-2'
      case 2:
        return 'pl-6'
      case 3:
        return 'pl-10'
    }
  }

  if (tocItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
        <FileText className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm text-center">No headings found</p>
        <p className="text-xs text-center mt-1 opacity-70">
          Add H1, H2, or H3 headings to see the outline
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <nav className="p-2">
        <ul className="space-y-1">
          {tocItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => scrollToHeading(item)}
                className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors group ${getIndentClass(item.level)}`}
                title={item.text}
              >
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                  {getHeadingIcon(item.level)}
                </span>
                <span className="truncate flex-1">{item.text}</span>
                <ChevronRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </ScrollArea>
  )
}
