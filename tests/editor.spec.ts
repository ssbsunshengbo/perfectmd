import { expect, test } from '@playwright/test'

async function createDocument(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByText('新建文档', { exact: true }).last().click()
  const editor = page.locator('.ProseMirror').first()
  await expect(editor).toBeVisible()
  await expect(page.locator('.ProseMirror')).toHaveCount(1)
  return editor
}

test('writes Markdown once and persists it after auto-save', async ({ page }) => {
  const editor = await createDocument(page)
  await editor.click()
  await editor.pressSequentially('First line')
  await editor.press('Enter')
  await editor.pressSequentially('Second line')

  await expect(editor).toContainText('First line')
  await expect(editor).toContainText('Second line')
  await page.waitForTimeout(2200)

  const savedContent = await page.evaluate(async () => {
    const request = indexedDB.open('MarkdownEditorDB')
    return await new Promise<string>((resolve) => {
      request.onsuccess = () => {
        const getAll = request.result.transaction('documents', 'readonly').objectStore('documents').getAll()
        getAll.onsuccess = () => resolve(getAll.result[0]?.content || '')
      }
    })
  })

  expect(savedContent).toContain('First line')
  expect(savedContent).toContain('Second line')
  expect(savedContent).not.toContain('<p>')
})

test('sanitizes rich-text paste while preserving document structure', async ({ page }) => {
  const editor = await createDocument(page)
  await editor.click()
  await page.evaluate(() => {
    const target = document.querySelector('.ProseMirror')
    const data = new DataTransfer()
    data.setData('text/plain', 'Imported title\nBold copy')
    data.setData('text/html', '<h1>Imported title</h1><p><strong>Bold</strong> copy</p><script>window.__unsafe = true</script>')
    target?.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }))
  })

  await expect(editor.locator('h1')).toHaveCount(1)
  await expect(editor).toContainText('Imported title')
  await expect(editor).toContainText('Bold copy')
  await expect(editor.locator('script')).toHaveCount(0)
  expect(await page.evaluate(() => Boolean((window as Window & { __unsafe?: boolean }).__unsafe))).toBe(false)
})

test('uses CodeMirror for code blocks with brace completion and indentation', async ({ page }) => {
  const editor = await createDocument(page)
  await editor.click()
  await editor.pressSequentially('```javascript')
  await editor.press('Enter')

  const code = page.locator('.cm-content').first()
  await expect(code).toBeVisible()
  await code.click()
  await code.pressSequentially('function demo() {')
  await code.press('Enter')
  await code.pressSequentially('return 1;')
  await code.press('Enter')

  await expect(code).toContainText('  return 1;')
  await expect(code).toContainText('\n}')
})

test('keeps long documents scrollable and switches to a coherent dark theme', async ({ page }) => {
  const editor = await createDocument(page)
  await editor.click()
  await editor.pressSequentially(Array.from({ length: 80 }, (_, index) => `Paragraph ${index + 1} with enough text for scrolling.`).join('\n\n'))

  const scrollState = await page.locator('.perfectmd-milkdown-shell').evaluate((element) => {
    element.scrollTop = element.scrollHeight
    return {
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }
  })
  expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight)
  expect(scrollState.scrollTop + scrollState.clientHeight).toBeGreaterThanOrEqual(scrollState.scrollHeight - 1)

  await page.getByTitle('切换到暗色模式').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  const colors = await page.locator('.milkdown').evaluate((element) => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, color: style.color }
  })
  expect(colors.background).not.toBe(colors.color)
})
