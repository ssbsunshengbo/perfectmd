import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAYAAAC09K7GAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWOwbvr2HxkzEBQAACikIFlq6jbfAAAAAElFTkSuQmCC'

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

test('resizes image blocks from their visible drag border and saves the ratio', async ({ page }) => {
  const editor = await createDocument(page)
  const topBar = page.locator('.milkdown-top-bar')
  await editor.click()
  await topBar.getByTitle('插入图片').click()

  const uploader = page.locator('.milkdown-image-block input[type="file"]')
  await expect(uploader).toBeAttached()
  await uploader.evaluate((input) => {
    const file = new File([
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" fill="#3b82f6"/></svg>',
    ], 'resize-test.svg', { type: 'image/svg+xml' })
    const transfer = new DataTransfer()
    transfer.items.add(file)
    Object.defineProperty(input, 'files', { value: transfer.files, configurable: true })
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })

  const imageBlock = page.locator('.milkdown-image-block')
  const image = imageBlock.locator('img[data-type="image-block"]')
  await expect(image).toBeVisible()
  await image.click({ force: true })
  await expect(imageBlock).toHaveClass(/selected/)

  const resizeHandle = imageBlock.locator('.image-resize-handle')
  await expect(resizeHandle).toHaveCSS('opacity', '1')
  await expect(resizeHandle).toHaveCSS('height', '12px')

  const before = await image.boundingBox()
  const handleBox = await resizeHandle.boundingBox()
  expect(before).not.toBeNull()
  expect(handleBox).not.toBeNull()
  await page.mouse.move((handleBox?.x || 0) + (handleBox?.width || 0) / 2, (handleBox?.y || 0) + (handleBox?.height || 0) / 2)
  await page.mouse.down()
  await page.mouse.move((handleBox?.x || 0) + (handleBox?.width || 0) / 2, (handleBox?.y || 0) + (handleBox?.height || 0) / 2 + 60, { steps: 4 })
  await page.mouse.up()

  await expect.poll(async () => (await image.boundingBox())?.height || 0).toBeGreaterThan((before?.height || 0) + 20)
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
  expect(savedContent).toMatch(/!\[(?:0\.[0-9]+|[1-9][0-9]*(?:\.[0-9]+)?)\]\(pmd-image:\/\//)
})

test('embeds locally stored images in PDF exports', async ({ page }) => {
  await createDocument(page)
  const imageId = '11111111-1111-4111-8111-111111111111'
  await page.evaluate(async ({ dataUrl, id }) => {
    const imageBlob = await (await fetch(dataUrl)).blob()
    const request = indexedDB.open('MarkdownEditorDB')
    await new Promise<void>((resolve, reject) => {
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['documents', 'images'], 'readwrite')
        const documents = transaction.objectStore('documents')
        const getAll = documents.getAll()
        getAll.onsuccess = () => {
          const document = getAll.result[0]
          document.title = 'PDF image'
          document.content = `![1.00](pmd-image://${id})`
          documents.put(document)
          transaction.objectStore('images').put({ id, blob: imageBlob, mimeType: 'image/png' })
        }
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      }
    })
  }, { dataUrl: PNG_DATA_URL, id: imageId })
  await page.reload()
  await page.getByText('PDF image', { exact: true }).click()
  await expect(page.locator('.milkdown-image-block img')).toHaveCount(1)

  const downloadPromise = page.waitForEvent('download')
  await page.getByTitle('导出为 PDF').click()
  const download = await downloadPromise
  const pdfPath = await download.path()
  expect(pdfPath).not.toBeNull()
  const bytes = await readFile(pdfPath || '')
  expect(bytes.toString('latin1')).toContain('/Subtype /Image')
})

test('keeps the persistent Markdown authoring controls available', async ({ page }) => {
  const editor = await createDocument(page)
  const topBar = page.locator('.milkdown-top-bar')
  await expect(topBar).toBeVisible()

  for (const label of [
    '加粗', '斜体', '删除线', '行内代码', '无序列表', '有序列表',
    '任务列表', '插入链接', '插入图片', '插入表格', '插入代码块',
    '插入公式块', '引用', '分割线',
  ]) {
    await expect(topBar.getByTitle(label)).toHaveCount(1)
  }

  await editor.click()
  await topBar.getByTitle('无序列表').click()
  await editor.pressSequentially('First list item')
  await expect(editor.locator('ul li')).toContainText('First list item')
  await expect(editor.locator('ul li p').first()).toHaveCSS('margin-top', '0px')

  await editor.press('Enter')
  await topBar.getByTitle('插入表格').click()
  await expect(editor.locator('table:visible')).toHaveCount(1)
})

test('persists underline, color, highlight, and font size as Markdown-compatible rich styles', async ({ page }) => {
  const editor = await createDocument(page)
  await editor.click()
  await editor.pressSequentially('Styled text')
  await editor.press('Meta+A')

  await page.getByTitle('文字颜色').click()
  await page.getByTitle('文字颜色 #ef4444').click()
  await page.getByTitle('背景高亮').click()
  await page.getByTitle('高亮颜色 #fef08a').click()
  await page.locator('[title="字号"]').click()
  await page.getByText('24px', { exact: true }).click()
  await page.getByTitle('下划线').click()

  const styledText = editor.locator('span[data-perfectmd-text-style="true"]')
  await expect(styledText).toContainText('Styled text')
  await expect(styledText).toHaveCSS('color', 'rgb(239, 68, 68)')
  await expect(styledText).toHaveCSS('font-size', '24px')
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
  expect(savedContent).toContain('<span style="color:#ef4444;background-color:#fef08a;font-size:24px;text-decoration:underline">Styled text</span>')
})

test('supports custom RGB colors and the legacy font-size step controls', async ({ page }) => {
  const editor = await createDocument(page)
  await editor.click()
  await editor.pressSequentially('Custom style')
  await editor.press('Meta+A')

  await page.getByTitle('文字颜色').click()
  await page.getByLabel('文字颜色 RGB').fill('12, 34, 56')
  await page.getByRole('button', { name: '应用' }).click()
  await page.getByTitle('增大字号').click()

  const styledText = editor.locator('span[data-perfectmd-text-style="true"]')
  await expect(styledText).toHaveCSS('color', 'rgb(12, 34, 56)')
  await expect(styledText).toHaveCSS('font-size', '20px')

  await page.getByTitle('减小字号').click()
  await expect(styledText).toHaveCSS('font-size', '16px')
})

test('keeps long documents scrollable and switches to a coherent dark theme', async ({ page }) => {
  const editor = await createDocument(page)
  await editor.click()
  await editor.pressSequentially(Array.from({ length: 80 }, (_, index) => `Paragraph ${index + 1} with enough text for scrolling.`).join('\n\n'))

  const scrollState = await page.locator('.perfectmd-milkdown-shell').evaluate((element) => {
    const richToolbar = element.querySelector<HTMLElement>('.perfectmd-rich-style-toolbar')
    const markdownToolbar = element.querySelector<HTMLElement>('.milkdown-top-bar')
    element.scrollTop = element.scrollHeight
    const shellBounds = element.getBoundingClientRect()
    const richBounds = richToolbar?.getBoundingClientRect()
    const markdownBounds = markdownToolbar?.getBoundingClientRect()
    return {
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      shellTop: shellBounds.top,
      richTop: richBounds?.top,
      richHeight: richBounds?.height,
      markdownTop: markdownBounds?.top,
    }
  })
  expect(scrollState.scrollHeight).toBeGreaterThan(scrollState.clientHeight)
  expect(scrollState.scrollTop + scrollState.clientHeight).toBeGreaterThanOrEqual(scrollState.scrollHeight - 1)
  expect(scrollState.richTop).toBeCloseTo(scrollState.shellTop, 0)
  expect(scrollState.markdownTop).toBeCloseTo((scrollState.richTop || 0) + (scrollState.richHeight || 0), 0)
  await expect(page.getByTitle('文字颜色')).toBeVisible()
  await expect(page.locator('.milkdown-top-bar').getByTitle('插入代码块')).toBeVisible()

  await page.getByTitle('切换到暗色模式').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  const colors = await page.locator('.milkdown').evaluate((element) => {
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, color: style.color }
  })
  expect(colors.background).not.toBe(colors.color)
  const toolbarColors = await page.locator('.milkdown-top-bar').evaluate((element) => {
    const icon = element.querySelector('svg')
    return {
      background: getComputedStyle(element).backgroundColor,
      icon: icon ? getComputedStyle(icon).color : '',
    }
  })
  expect(toolbarColors.icon).not.toBe(toolbarColors.background)
})
