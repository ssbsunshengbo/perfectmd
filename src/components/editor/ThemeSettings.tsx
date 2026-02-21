'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  predefinedThemes,
  applyTheme,
  applyCustomCss,
  saveThemePreferences,
  loadThemePreferences,
} from '@/lib/themes'
import { useTheme } from 'next-themes'
import { Palette, Check } from 'lucide-react'

interface ThemeSettingsProps {
  trigger?: React.ReactNode
}

export function ThemeSettings({ trigger }: ThemeSettingsProps) {
  const { theme: mode, setTheme: setMode } = useTheme()
  const [selectedTheme, setSelectedTheme] = useState(() => {
    // Initialize from localStorage on first render
    if (typeof window !== 'undefined') {
      return localStorage.getItem('perfectmd-theme') || 'default'
    }
    return 'default'
  })
  const [customCss, setCustomCss] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('perfectmd-custom-css') || ''
    }
    return ''
  })
  const [isOpen, setIsOpen] = useState(false)

  // Apply theme when selectedTheme or mode changes
  const applySelectedTheme = useCallback(() => {
    const theme = predefinedThemes.find(t => t.name === selectedTheme) || predefinedThemes[0]
    applyTheme(theme, mode === 'dark')
  }, [selectedTheme, mode])

  // Apply theme on mount and when dependencies change
  useEffect(() => {
    applySelectedTheme()
    if (customCss) {
      applyCustomCss(customCss)
    }
  }, [applySelectedTheme, customCss])

  const handleThemeSelect = (themeName: string) => {
    setSelectedTheme(themeName)
    const theme = predefinedThemes.find(t => t.name === themeName) || predefinedThemes[0]
    applyTheme(theme, mode === 'dark')
    saveThemePreferences(themeName, customCss)
  }

  const handleCustomCssChange = (css: string) => {
    setCustomCss(css)
    applyCustomCss(css)
    saveThemePreferences(selectedTheme, css)
  }

  const handleModeChange = (newMode: string) => {
    setMode(newMode)
    setTimeout(() => {
      const theme = predefinedThemes.find(t => t.name === selectedTheme) || predefinedThemes[0]
      applyTheme(theme, newMode === 'dark')
    }, 0)
  }

  const resetCustomCss = () => {
    setCustomCss('')
    applyCustomCss('')
    saveThemePreferences(selectedTheme, '')
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1">
            <Palette className="h-4 w-4" />
            Theme
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Theme Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="presets" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="presets">Presets</TabsTrigger>
            <TabsTrigger value="mode">Light/Dark</TabsTrigger>
            <TabsTrigger value="custom">Custom CSS</TabsTrigger>
          </TabsList>

          {/* Preset Themes */}
          <TabsContent value="presets" className="mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {predefinedThemes.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => handleThemeSelect(theme.name)}
                  className={`
                    relative p-3 rounded-lg border-2 transition-all hover:scale-105
                    ${selectedTheme === theme.name ? 'border-primary ring-2 ring-primary/20' : 'border-border'}
                  `}
                >
                  {selectedTheme === theme.name && (
                    <Check className="absolute top-1 right-1 h-4 w-4 text-primary" />
                  )}
                  <div
                    className="w-full h-8 rounded-md mb-2"
                    style={{ backgroundColor: theme.primary }}
                  />
                  <div className="text-sm font-medium">{theme.label}</div>
                  {theme.description && (
                    <div className="text-xs text-muted-foreground mt-1">{theme.description}</div>
                  )}
                </button>
              ))}
            </div>
          </TabsContent>

          {/* Light/Dark Mode */}
          <TabsContent value="mode" className="mt-4">
            <div className="space-y-4">
              <Label>Appearance</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleModeChange('light')}
                  className={`
                    p-4 rounded-lg border-2 transition-all
                    ${mode === 'light' ? 'border-primary bg-accent' : 'border-border'}
                  `}
                >
                  <div className="w-full h-16 bg-white rounded-md mb-2 border" />
                  <div className="text-sm font-medium">Light</div>
                </button>
                <button
                  onClick={() => handleModeChange('dark')}
                  className={`
                    p-4 rounded-lg border-2 transition-all
                    ${mode === 'dark' ? 'border-primary bg-accent' : 'border-border'}
                  `}
                >
                  <div className="w-full h-16 bg-zinc-900 rounded-md mb-2 border border-zinc-700" />
                  <div className="text-sm font-medium">Dark</div>
                </button>
              </div>
            </div>
          </TabsContent>

          {/* Custom CSS */}
          <TabsContent value="custom" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Custom CSS</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetCustomCss}
                  disabled={!customCss}
                >
                  Reset
                </Button>
              </div>
              <Textarea
                value={customCss}
                onChange={(e) => handleCustomCssChange(e.target.value)}
                placeholder={`/* Add your custom CSS here */
/* Example: */
.ProseMirror {
  font-family: 'Georgia', serif;
  font-size: 18px;
}

/* Change heading colors */
.ProseMirror h1 {
  color: #your-color;
}`}
                className="font-mono text-sm min-h-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Add custom CSS to override default styles. Changes are applied immediately.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
