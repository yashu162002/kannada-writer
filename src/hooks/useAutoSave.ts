import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { DocumentService } from '@/services/storage/DocumentService'
import type { SaveState } from '@/types/document'
import { toast } from '@/components/common/Toast'

interface Options {
  editor: Editor | null
  documentId: string
  enabled?: boolean
  delay?: number
  onSaved?: (savedAt: number) => void
}

/**
 * Debounced autosave. Writes the ProseMirror JSON plus plain text, word and
 * character counts, and keeps a recovery snapshot for crash recovery.
 */
export function useAutoSave({ editor, documentId, enabled = true, delay = 750, onSaved }: Options) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sequence = useRef(0)
  const saving = useRef<Promise<void> | null>(null)
  const editorRef = useRef<Editor | null>(editor)
  editorRef.current = editor

  const persist = useCallback(async (): Promise<void> => {
    const currentEditor = editorRef.current
    if (!currentEditor || !enabled) return

    const current = ++sequence.current
    setSaveState('saving')

    const json = JSON.stringify(currentEditor.getJSON())
    const plainText = currentEditor.getText({ blockSeparator: '\n' })
    const words = plainText.trim() ? plainText.trim().split(/\s+/).filter(Boolean).length : 0
    const characters = plainText.length
    const now = Date.now()

    try {
      await DocumentService.saveRecovery(documentId, '', json)
      await DocumentService.patch(documentId, {
        content: json,
        plainText,
        wordCount: words,
        characterCount: characters,
        updatedAt: now,
      })
      if (sequence.current === current) {
        setLastSavedAt(now)
        setSaveState('saved')
        onSaved?.(now)
      }
    } catch (error) {
      setSaveState('error')
      toast(
        'Autosave failed',
        error instanceof Error ? error.message : 'The document could not be saved to browser storage.',
        'error',
      )
    }
  }, [documentId, enabled, onSaved])

  const saveNow = useCallback(async (): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (saving.current) {
      await saving.current
    }
    const task = persist()
    saving.current = task
    await task
    saving.current = null
  }, [persist])

  const scheduleSave = useCallback(() => {
    if (!enabled) return
    setSaveState('dirty')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void persist()
    }, delay)
  }, [delay, enabled, persist])

  useEffect(() => {
    if (!editor || !enabled) return

    const handleUpdate = () => scheduleSave()
    editor.on('update', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, enabled, scheduleSave])

  // Periodic recovery snapshot even when the user pauses between saves.
  useEffect(() => {
    if (!enabled) return
    const interval = window.setInterval(() => {
      const currentEditor = editorRef.current
      if (!currentEditor) return
      if (editorRef.current?.isDestroyed) return
      void DocumentService.saveRecovery(documentId, '', JSON.stringify(currentEditor.getJSON()))
    }, 20000)
    return () => window.clearInterval(interval)
  }, [documentId, enabled])

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
        void persist()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [persist])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return { saveState, lastSavedAt, saveNow, scheduleSave }
}
