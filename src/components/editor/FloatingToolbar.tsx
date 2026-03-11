'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  Palette,
  Type,
  Code,
  Quote,
  List,
  ListOrdered,
  Link2,
  Minus,
  Pilcrow,
  Plus,
  Minus as MinusIcon,
} from 'lucide-react'

interface FormatState {
  heading: string | null
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  bulletList: boolean
  orderedList: boolean
}

interface FloatingToolbarProps {
  onApplyStyle: (style: string, value?: string) => void
  position: { top: number; left: number }
  visible: boolean
  formatState: FormatState
}

const TEXT_COLORS = [
  { name: 'None', value: 'inherit' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Gray', value: '#6b7280' },
]

const HIGHLIGHT_COLORS = [
  { name: 'None', value: 'transparent' },
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Orange', value: '#fed7aa' },
  { name: 'Purple', value: '#e9d5ff' },
]

const FONT_SIZES = [
  { name: '12px', value: '12px' },
  { name: '14px', value: '14px' },
  { name: '16px', value: '16px' },
  { name: '18px', value: '18px' },
  { name: '20px', value: '20px' },
  { name: '24px', value: '24px' },
  { name: '28px', value: '28px' },
  { name: '32px', value: '32px' },
  { name: '36px', value: '36px' },
  { name: '48px', value: '48px' },
]

export function FloatingToolbar({ onApplyStyle, position, visible, formatState }: FloatingToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)
  const [showFontSizePicker, setShowFontSizePicker] = useState(false)

  if (!visible) return null

  const toolbarButtons = [
    { icon: Bold, title: 'Bold (Ctrl+B)', style: 'bold', active: formatState.bold },
    { icon: Italic, title: 'Italic (Ctrl+I)', style: 'italic', active: formatState.italic },
    { icon: Underline, title: 'Underline (Ctrl+U)', style: 'underline', active: formatState.underline },
    { icon: Strikethrough, title: 'Strikethrough', style: 'strikethrough', active: formatState.strikethrough },
    { icon: Code, title: 'Inline Code', style: 'code', active: false },
  ]

  return (
    <div
      className="fixed z-50 flex items-center gap-0.5 rounded-lg border bg-background/95 px-1 py-1 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Text formatting buttons */}
      {toolbarButtons.map((btn) => (
        <Button
          key={btn.style}
          variant={btn.active ? 'secondary' : 'ghost'}
          size="sm"
          className={`h-8 w-8 p-0 ${btn.active ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : ''}`}
          onClick={() => onApplyStyle(btn.style)}
          title={btn.title}
        >
          <btn.icon className="h-4 w-4" />
        </Button>
      ))}

      <div className="mx-1 h-5 w-px bg-border" />

      {/* Text color */}
      <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Text Color">
            <Palette className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="grid grid-cols-5 gap-1">
            {TEXT_COLORS.map((color) => (
              <button
                key={color.value}
                className="h-6 w-6 rounded border transition-transform hover:scale-110 flex items-center justify-center"
                style={{ 
                  backgroundColor: color.value === 'inherit' ? 'transparent' : color.value,
                }}
                title={color.name}
                onClick={() => {
                  onApplyStyle('color', color.value)
                  setShowColorPicker(false)
                }}
              >
                {color.value === 'inherit' && (
                  <span className="text-xs text-muted-foreground font-bold">✕</span>
                )}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Highlight color */}
      <Popover open={showHighlightPicker} onOpenChange={setShowHighlightPicker}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Highlight">
            <Highlighter className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="grid grid-cols-7 gap-1">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color.value}
                className="h-6 w-6 rounded border transition-transform hover:scale-110 flex items-center justify-center"
                style={{ 
                  backgroundColor: color.value === 'transparent' ? undefined : color.value,
                }}
                title={color.name}
                onClick={() => {
                  onApplyStyle('highlight', color.value)
                  setShowHighlightPicker(false)
                }}
              >
                {color.value === 'transparent' && (
                  <span className="text-xs text-muted-foreground font-bold">✕</span>
                )}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Font size controls */}
      <div className="flex items-center">
        {/* Decrease font size */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onApplyStyle('fontSizeDecrease')}
          title="Decrease Font Size"
        >
          <MinusIcon className="h-4 w-4" />
        </Button>
        
        {/* Font size picker */}
        <Popover open={showFontSizePicker} onOpenChange={setShowFontSizePicker}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Font Size">
              <Type className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-32 p-1" align="start">
            <div className="flex flex-col gap-0.5">
              {FONT_SIZES.map((size) => (
                <button
                  key={size.value}
                  className="rounded px-2 py-1 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    onApplyStyle('fontSize', size.value)
                    setShowFontSizePicker(false)
                  }}
                >
                  {size.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        
        {/* Increase font size */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => onApplyStyle('fontSizeIncrease')}
          title="Increase Font Size"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="mx-1 h-5 w-px bg-border" />

      {/* Paragraph type buttons */}
      <Button
        variant={formatState.heading === null ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onApplyStyle('normal')}
        title="Normal Paragraph"
      >
        <Pilcrow className="h-4 w-4" />
      </Button>
      
      {/* Heading buttons with active state */}
      <Button
        variant={formatState.heading === 'h1' ? 'secondary' : 'ghost'}
        size="sm"
        className={`h-8 w-8 p-0 text-xs font-bold ${formatState.heading === 'h1' ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : ''}`}
        onClick={() => onApplyStyle('heading', '1')}
        title="Heading 1"
      >
        H1
      </Button>
      <Button
        variant={formatState.heading === 'h2' ? 'secondary' : 'ghost'}
        size="sm"
        className={`h-8 w-8 p-0 text-xs font-bold ${formatState.heading === 'h2' ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : ''}`}
        onClick={() => onApplyStyle('heading', '2')}
        title="Heading 2"
      >
        H2
      </Button>
      <Button
        variant={formatState.heading === 'h3' ? 'secondary' : 'ghost'}
        size="sm"
        className={`h-8 w-8 p-0 text-xs font-bold ${formatState.heading === 'h3' ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : ''}`}
        onClick={() => onApplyStyle('heading', '3')}
        title="Heading 3"
      >
        H3
      </Button>

      <div className="mx-1 h-5 w-px bg-border" />

      {/* List and other formatting */}
      <Button
        variant={formatState.bulletList ? 'secondary' : 'ghost'}
        size="sm"
        className={`h-8 w-8 p-0 ${formatState.bulletList ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : ''}`}
        onClick={() => onApplyStyle('list', 'bullet')}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant={formatState.orderedList ? 'secondary' : 'ghost'}
        size="sm"
        className={`h-8 w-8 p-0 ${formatState.orderedList ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground' : ''}`}
        onClick={() => onApplyStyle('list', 'ordered')}
        title="Ordered List"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onApplyStyle('quote')}
        title="Quote"
      >
        <Quote className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onApplyStyle('link')}
        title="Link"
      >
        <Link2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => onApplyStyle('hr')}
        title="Horizontal Rule"
      >
        <Minus className="h-4 w-4" />
      </Button>
    </div>
  )
}
