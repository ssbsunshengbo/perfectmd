import { useState, useCallback, useEffect, useRef } from 'react'
import type { EditorRefs, ImageOverlayRect } from './editor-types'
import { saveImageBlob } from '@/store/editor-store'

function setImageDimensions(imageEl: HTMLImageElement, width: number, height: number) {
  imageEl.style.width = `${width}px`
  imageEl.style.height = `${height}px`
  imageEl.removeAttribute('width')
  imageEl.removeAttribute('height')
}

export function useImageHandling(
  refs: EditorRefs,
  handleInput: () => void,
  imageUrlMapRef: React.MutableRefObject<Map<string, string>>,
) {
  const { editorRef } = refs

  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null)
  const [imageOverlayRect, setImageOverlayRect] = useState<ImageOverlayRect | null>(null)
  const resizeDragRef = useRef<{
    startX: number
    startWidth: number
    startHeight: number
    ratio: number
    corner: 'se' | 'sw' | 'ne' | 'nw'
  } | null>(null)

  const recalcSelectedImageOverlay = useCallback((imageEl: HTMLImageElement | null = selectedImage) => {
    if (!imageEl || !editorRef.current) {
      setImageOverlayRect(null)
      return
    }
    if (!imageEl.isConnected) {
      setSelectedImage(null)
      setImageOverlayRect(null)
      return
    }
    const containerRect = editorRef.current.getBoundingClientRect()
    const imageRect = imageEl.getBoundingClientRect()
    const width = imageRect.width || imageEl.naturalWidth
    const height = imageRect.height || imageEl.naturalHeight

    if (width === 0 || height === 0) {
      const editorEl = editorRef.current
      imageEl.addEventListener('load', () => {
        if (!editorEl || !imageEl.isConnected) return
        const cr = editorEl.getBoundingClientRect()
        const ir = imageEl.getBoundingClientRect()
        if (ir.width > 0 && ir.height > 0) {
          setImageOverlayRect({
            top: ir.top - cr.top + editorEl.scrollTop + editorEl.offsetTop,
            left: ir.left - cr.left + editorEl.scrollLeft + editorEl.offsetLeft,
            width: ir.width,
            height: ir.height,
          })
        }
      }, { once: true })
      return
    }

    setImageOverlayRect({
      top: imageRect.top - containerRect.top + editorRef.current.scrollTop + editorRef.current.offsetTop,
      left: imageRect.left - containerRect.left + editorRef.current.scrollLeft + editorRef.current.offsetLeft,
      width: imageRect.width,
      height: imageRect.height,
    })
  }, [editorRef, selectedImage])

  const resizeSelectedImageByFactor = useCallback((factor: number) => {
    const image = selectedImage
    if (!image || !Number.isFinite(factor) || factor <= 0) return
    const rect = image.getBoundingClientRect()
    const currentWidth = rect.width || image.naturalWidth || 160
    const currentHeight = rect.height || image.naturalHeight || 90
    const ratio = currentHeight > 0 ? currentWidth / currentHeight : 1
    const nextWidth = Math.max(60, Math.min(2400, Math.round(currentWidth * factor)))
    const nextHeight = Math.max(40, Math.round(nextWidth / (ratio || 1)))
    setImageDimensions(image, nextWidth, nextHeight)
    recalcSelectedImageOverlay(image)
    handleInput()
  }, [handleInput, recalcSelectedImageOverlay, selectedImage])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !selectedImage) return
    const handleRecalc = () => recalcSelectedImageOverlay()
    editor.addEventListener('scroll', handleRecalc)
    window.addEventListener('resize', handleRecalc)
    return () => {
      editor.removeEventListener('scroll', handleRecalc)
      window.removeEventListener('resize', handleRecalc)
    }
  }, [editorRef, recalcSelectedImageOverlay, selectedImage])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeDragRef.current || !selectedImage) return
      e.preventDefault()
      const drag = resizeDragRef.current
      const dx = e.clientX - drag.startX
      const signX = drag.corner === 'sw' || drag.corner === 'nw' ? -1 : 1
      const nextWidth = Math.max(60, drag.startWidth + dx * signX)
      const nextHeight = Math.max(40, nextWidth / drag.ratio)
      setImageDimensions(selectedImage, Math.round(nextWidth), Math.round(nextHeight))
      recalcSelectedImageOverlay()
    }
    const handleMouseUp = () => {
      if (!resizeDragRef.current) return
      resizeDragRef.current = null
      handleInput()
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleInput, recalcSelectedImageOverlay, selectedImage])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find((item) => item.type.startsWith('image/'))
    if (!imageItem) return

    e.preventDefault()
    const file = imageItem.getAsFile()
    if (!file || !editorRef.current) return

    const generateId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })

    const imageId = generateId()
    const tempUrl = URL.createObjectURL(file)

    const img = document.createElement('img')
    img.src = tempUrl
    img.style.maxWidth = '100%'
    img.dataset.imageId = imageId

    const selection = window.getSelection()
    if (selection && selection.rangeCount) {
      const range = selection.getRangeAt(0)
      if (!range.collapsed) range.deleteContents()
      range.insertNode(img)
      const newRange = document.createRange()
      newRange.setStartAfter(img)
      newRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(newRange)
    } else {
      editorRef.current.appendChild(img)
    }

    setSelectedImage(img)
    const editorEl = editorRef.current
    const showOverlay = () => {
      if (!editorEl || !img.isConnected) return
      const cr = editorEl.getBoundingClientRect()
      const ir = img.getBoundingClientRect()
      if (ir.width > 0 && ir.height > 0) {
        setImageOverlayRect({
          top: ir.top - cr.top + editorEl.scrollTop + editorEl.offsetTop,
          left: ir.left - cr.left + editorEl.scrollLeft + editorEl.offsetLeft,
          width: ir.width,
          height: ir.height,
        })
      }
    }
    img.addEventListener('load', showOverlay, { once: true })
    showOverlay()

    saveImageBlob(imageId, file, file.type || 'image/png').then(() => {
      imageUrlMapRef.current.set(imageId, tempUrl)
      handleInput()
    }).catch(() => {
      const reader = new FileReader()
      reader.onload = (evt) => {
        const dataUrl = evt.target?.result as string | undefined
        if (dataUrl) {
          img.src = dataUrl
          URL.revokeObjectURL(tempUrl)
        }
        handleInput()
      }
      reader.readAsDataURL(file)
    })
  }, [editorRef, handleInput, imageUrlMapRef])

  return {
    selectedImage,
    setSelectedImage,
    imageOverlayRect,
    setImageOverlayRect,
    resizeDragRef,
    recalcSelectedImageOverlay,
    resizeSelectedImageByFactor,
    handlePaste,
  }
}
