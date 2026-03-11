// Theme definitions and utilities

export interface ThemeColors {
  name: string
  label: string
  primary: string
  accent: string
  description?: string
}

// Predefined themes
export const predefinedThemes: ThemeColors[] = [
  {
    name: 'default',
    label: 'Default',
    primary: 'oklch(0.205 0 0)',
    accent: 'oklch(0.97 0 0)',
    description: 'Classic neutral theme'
  },
  {
    name: 'ocean',
    label: 'Ocean Blue',
    primary: 'oklch(0.5 0.2 250)',
    accent: 'oklch(0.7 0.15 250)',
    description: 'Calm ocean blue tones'
  },
  {
    name: 'forest',
    label: 'Forest Green',
    primary: 'oklch(0.5 0.15 145)',
    accent: 'oklch(0.7 0.1 145)',
    description: 'Natural forest green'
  },
  {
    name: 'sunset',
    label: 'Sunset Orange',
    primary: 'oklch(0.6 0.2 35)',
    accent: 'oklch(0.75 0.15 35)',
    description: 'Warm sunset colors'
  },
  {
    name: 'lavender',
    label: 'Lavender Purple',
    primary: 'oklch(0.55 0.2 300)',
    accent: 'oklch(0.75 0.15 300)',
    description: 'Soft lavender purple'
  },
  {
    name: 'rose',
    label: 'Rose Pink',
    primary: 'oklch(0.6 0.2 350)',
    accent: 'oklch(0.75 0.15 350)',
    description: 'Elegant rose pink'
  },
  {
    name: 'midnight',
    label: 'Midnight',
    primary: 'oklch(0.7 0.15 270)',
    accent: 'oklch(0.85 0.1 270)',
    description: 'Deep midnight blue'
  },
  {
    name: 'sepia',
    label: 'Sepia',
    primary: 'oklch(0.4 0.05 70)',
    accent: 'oklch(0.85 0.05 70)',
    description: 'Classic sepia tones'
  }
]

// Apply theme colors to CSS variables
export function applyTheme(theme: ThemeColors, isDark: boolean) {
  const root = document.documentElement

  if (isDark) {
    // For dark mode, we lighten the primary color
    root.style.setProperty('--primary', theme.primary)
    root.style.setProperty('--primary-foreground', 'oklch(0.98 0 0)')
    root.style.setProperty('--accent', theme.accent)
    root.style.setProperty('--ring', theme.primary)
  } else {
    // For light mode
    root.style.setProperty('--primary', theme.primary)
    root.style.setProperty('--primary-foreground', 'oklch(0.98 0 0)')
    root.style.setProperty('--accent', theme.accent)
    root.style.setProperty('--ring', theme.primary)
  }
}

// Apply custom CSS
export function applyCustomCss(css: string) {
  let styleEl = document.getElementById('custom-theme-css')
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'custom-theme-css'
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = css
}

// Remove custom CSS
export function removeCustomCss() {
  const styleEl = document.getElementById('custom-theme-css')
  if (styleEl) {
    styleEl.remove()
  }
}

// Generate CSS from color values
export function generateThemeCss(primaryColor: string, accentColor: string, isDark: boolean): string {
  return `
/* Custom Theme */
:root {
  --primary: ${primaryColor};
  --primary-foreground: oklch(0.98 0 0);
  --accent: ${accentColor};
  --ring: ${primaryColor};
}

.dark {
  --primary: ${primaryColor};
  --primary-foreground: oklch(0.98 0 0);
  --accent: ${accentColor};
  --ring: ${primaryColor};
}

/* Editor customization */
.ProseMirror {
  caret-color: ${primaryColor};
}

::selection {
  background-color: ${accentColor};
}
`
}

// Save theme preferences to localStorage
export function saveThemePreferences(theme: string, customCss: string) {
  localStorage.setItem('perfectmd-theme', theme)
  localStorage.setItem('perfectmd-custom-css', customCss)
}

// Load theme preferences from localStorage
export function loadThemePreferences(): { theme: string; customCss: string } {
  return {
    theme: localStorage.getItem('perfectmd-theme') || 'default',
    customCss: localStorage.getItem('perfectmd-custom-css') || ''
  }
}
