export interface CodeLanguageOption {
  value: string
  label: string
  aliases?: string[]
}

export const CODE_LANGUAGE_OPTIONS: CodeLanguageOption[] = [
  { value: 'plaintext', label: 'Plain Text', aliases: ['text', 'txt', 'plain'] },
  { value: 'javascript', label: 'JavaScript', aliases: ['js', 'mjs', 'cjs'] },
  { value: 'typescript', label: 'TypeScript', aliases: ['ts', 'mts', 'cts'] },
  { value: 'jsx', label: 'JSX' },
  { value: 'tsx', label: 'TSX' },
  { value: 'python', label: 'Python', aliases: ['py'] },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust', aliases: ['rs'] },
  { value: 'json', label: 'JSON' },
  { value: 'jsonc', label: 'JSONC' },
  { value: 'bash', label: 'Bash', aliases: ['sh', 'shell', 'zsh', 'shellscript', 'console'] },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS', aliases: ['sass'] },
  { value: 'sql', label: 'SQL' },
  { value: 'markdown', label: 'Markdown', aliases: ['md', 'mdx'] },
  { value: 'yaml', label: 'YAML', aliases: ['yml'] },
  { value: 'toml', label: 'TOML' },
  { value: 'xml', label: 'XML' },
  { value: 'dockerfile', label: 'Dockerfile', aliases: ['docker'] },
  { value: 'diff', label: 'Diff', aliases: ['patch'] },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++', aliases: ['c++', 'cc', 'cxx', 'hpp'] },
  { value: 'csharp', label: 'C#', aliases: ['c#', 'cs'] },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby', aliases: ['rb'] },
  { value: 'swift', label: 'Swift' },
  { value: 'kotlin', label: 'Kotlin', aliases: ['kt', 'kts'] },
  { value: 'scala', label: 'Scala' },
  { value: 'r', label: 'R' },
  { value: 'lua', label: 'Lua' },
  { value: 'powershell', label: 'PowerShell', aliases: ['ps', 'ps1'] },
  { value: 'dart', label: 'Dart' },
  { value: 'vue', label: 'Vue' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'graphql', label: 'GraphQL', aliases: ['gql'] },
  { value: 'ini', label: 'INI', aliases: ['properties', 'conf'] },
  { value: 'makefile', label: 'Makefile', aliases: ['make'] },
]

export const CODE_LANGUAGES = CODE_LANGUAGE_OPTIONS.map((option) => option.value)

const languageAliases = new Map<string, string>()

for (const option of CODE_LANGUAGE_OPTIONS) {
  languageAliases.set(option.value, option.value)
  for (const alias of option.aliases || []) {
    languageAliases.set(alias, option.value)
  }
}

export function normalizeCodeLanguage(input: string | null | undefined): string {
  const raw = String(input || '')
    .trim()
    .split(/\s+/)[0]
    .replace(/^language-/i, '')
    .replace(/^\{?\.?/, '')
    .replace(/\}?$/, '')
    .toLowerCase()

  if (!raw) return 'plaintext'
  return languageAliases.get(raw) || 'plaintext'
}

export function getCodeLanguageLabel(language: string): string {
  const normalized = normalizeCodeLanguage(language)
  return CODE_LANGUAGE_OPTIONS.find((option) => option.value === normalized)?.label || 'Plain Text'
}
