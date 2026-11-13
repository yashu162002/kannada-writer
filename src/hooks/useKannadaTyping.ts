import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import type { Suggestion, TransliterationSettings } from '@/types/transliteration'
import { transliterationService } from '@/services/transliteration/TransliterationService'

const PUNCTUATION = new Set([',', '.', '!', '?', ';', ':', ')', ']', '}', '"', "'", '—', '–'])

function isSkippableBlock(editor: Editor): boolean {
  const { $from } = editor.state.selection
  const name = $from.parent.type.name
  return name === 'codeBlock' || name === 'pre'
}

/**
 * State for the typing suggestion popup.
 */
export interface TypingPopupState {
  word: string
  from: number
  to: number
  suggestions: Suggestion[]
  activeIndex: number
  loading: boolean
  provider: string
  error: string | null
}

/**
 * Google Indic Keyboard-style phonetic typing inside Tiptap.
 *
 * – Tracks the trailing Latin word under the caret
 * – Shows ranked Kannada suggestions in a floating popup
 * – Number keys (1, 2, 3…) select suggestions by index
 * – Space accepts the highlighted suggestion (when auto-convert is on)
 * – ↑/↓ cycle, Enter accepts, Esc dismisses, punctuation accepts
 * – Replaces only the Latin word range, preserving marks and cursor position
 */
export function useKannadaTyping(editor: Editor | null) {
  const [popup, setPopupState] = useState<TypingPopupState | null>(null)
  const [settings, setSettings] = useState<TransliterationSettings>(() =>
    transliterationService.getSettings(),
  )
  const popupRef = useRef<TypingPopupState | null>(null)
  const suppressedWord = useRef<string | null>(null)
  const lastWord = useRef<string>('')
  const requestId = useRef(0)
  const editorRef = useRef<Editor | null>(editor)
  editorRef.current = editor

  const setPopup = useCallback((next: TypingPopupState | null) => {
    popupRef.current = next
    setPopupState(next)
  }, [])

  const readTrailingWord = useCallback((instance: Editor) => {
    const { selection } = instance.state
    if (!selection.empty) return null
    if (isSkippableBlock(instance)) return null
    const { $from } = selection
    const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '\ufffc')
    const match = /([A-Za-z]+)$/.exec(before)
    if (!match) return null
    const word = match[1]
    if (word.length < 2) return null
    return { word, from: selection.from - word.length, to: selection.from }
  }, [])

  const refresh = useCallback(() => {
    const instance = editorRef.current
    if (!instance || instance.isDestroyed) return
    const currentSettings = transliterationService.getSettings()

    if (currentSettings.mode === 'english') {
      setPopup(null)
      return
    }

    const found = readTrailingWord(instance)
    if (!found) {
      setPopup(null)
      lastWord.current = ''
      suppressedWord.current = null
      return
    }

    if (suppressedWord.current === found.word) {
      setPopup(null)
      lastWord.current = found.word
      return
    }

    if (lastWord.current !== found.word) {
      suppressedWord.current = null
      lastWord.current = found.word
    }

    const local = transliterationService.localSuggestions(found.word)
    const existing = popupRef.current
    const keepIndex =
      existing && existing.word === found.word && existing.suggestions.length === local.length
        ? existing.activeIndex
        : 0

    const newPopup: TypingPopupState = {
      word: found.word,
      from: found.from,
      to: found.to,
      suggestions: local,
      activeIndex: Math.min(keepIndex, Math.max(0, local.length - 1)),
      loading: false,
      provider: 'Offline engine',
      error: null,
    }
    setPopup(newPopup)

    const status = transliterationService.providerStatus
    const shouldTryOnline =
      status.onlineConfigured && status.mode !== 'offline' && navigator.onLine !== false

    const id = ++requestId.current
    const currentPopupState: TypingPopupState = {
      ...(popupRef.current as TypingPopupState),
      loading: shouldTryOnline,
    }
    setPopup(currentPopupState)

    void transliterationService
      .suggest(found.word)
      .then((result) => {
        if (requestId.current !== id) return
        const current = popupRef.current
        if (!current || current.word !== found.word || current.to !== found.to) return
        const updatedPopup: TypingPopupState = {
          ...current,
          suggestions: result.suggestions,
          activeIndex: Math.min(current.activeIndex, Math.max(0, result.suggestions.length - 1)),
          loading: false,
          provider: result.provider,
        }
        setPopup(updatedPopup)
      })
      .catch((error: unknown) => {
        if (requestId.current !== id) return
        const current = popupRef.current
        if (!current) return
        const errorPopup: TypingPopupState = {
          ...current,
          loading: false,
          provider: 'Offline engine',
          error: error instanceof Error ? error.message : null,
        }
        setPopup(errorPopup)
      })
  }, [readTrailingWord, setPopup])

  const replaceWord = useCallback(
    (state: TypingPopupState, index: number, suffix: string) => {
      const instance = editorRef.current
      if (!instance) return
      const suggestion = state.suggestions[index]
      if (!suggestion) return

      const doc = instance.state.doc
      const clampedFrom = Math.max(0, Math.min(state.from, doc.content.size))
      const clampedTo = Math.max(0, Math.min(state.to, doc.content.size))
      if (clampedTo <= clampedFrom) return

      const marks =
        instance.state.storedMarks ??
        (clampedFrom > 0 ? doc.resolve(clampedFrom).marks() : doc.resolve(clampedTo).marks())

      const { tr } = instance.state
      try {
        tr.replaceWith(clampedFrom, clampedTo, instance.schema.text(suggestion.text, marks))
        let cursor = clampedFrom + suggestion.text.length
        if (suffix) {
          tr.insertText(suffix, cursor)
          cursor += suffix.length
        }
        tr.setSelection(TextSelection.create(tr.doc, cursor))
        instance.view.dispatch(tr.scrollIntoView())
        instance.view.focus()
      } catch {
        // Fallback for edge cases (split nodes / tables)
        instance
          .chain()
          .focus()
          .insertContentAt({ from: clampedFrom, to: clampedTo }, suggestion.text)
          .run()
        if (suffix) instance.chain().focus().insertContent(suffix).run()
      }

      if (index > 0 || suggestion.source === 'personal') {
        void transliterationService.remember(state.word, suggestion.text)
      }

      lastWord.current = ''
      suppressedWord.current = null
      setPopup(null)
    },
    [setPopup],
  )

  const selectSuggestion = useCallback(
    (index: number) => {
      const current = popupRef.current
      if (!current) return
      replaceWord(current, index, '')
    },
    [replaceWord],
  )

  const acceptCurrent = useCallback(
    (suffix = ' ') => {
      const current = popupRef.current
      if (!current || !current.suggestions.length) return
      replaceWord(current, current.activeIndex, suffix)
    },
    [replaceWord],
  )

  const closePopup = useCallback(() => {
    const current = popupRef.current
    if (current) suppressedWord.current = current.word
    setPopup(null)
  }, [setPopup])

  const handleKeyDown = useCallback(
    (view: unknown, event: KeyboardEvent): boolean => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return false
      const current = popupRef.current
      if (!current || !current.suggestions.length) return false

      const typingSettings = transliterationService.getSettings()
      if (!typingSettings.showSuggestions) {
        if ((event.key === ' ' || event.key === 'Spacebar') && typingSettings.autoConvert) {
          event.preventDefault()
          replaceWord(current, 0, ' ')
          return true
        }
        return false
      }
      const instance = editorRef.current
      if (!instance) return false
      const selection = instance.state.selection
      if (!selection.empty || selection.from !== current.to) return false

      switch (event.key) {
        case 'ArrowDown': {
          event.preventDefault()
          setPopupState((prev: TypingPopupState | null): TypingPopupState | null => ({
            word: prev?.word ?? '',
            from: prev?.from ?? 0,
            to: prev?.to ?? 0,
            suggestions: prev?.suggestions ?? [],
            loading: prev?.loading ?? false,
            activeIndex: ((prev?.activeIndex ?? 0) + 1) % (popup?.suggestions.length || 1),
            provider: prev?.provider ?? 'Offline engine',
            error: prev?.error ?? null,
          }))
          return true
        }
        case 'ArrowUp': {
          event.preventDefault()
          setPopupState((prev: TypingPopupState | null): TypingPopupState | null => ({
            word: prev?.word ?? '',
            from: prev?.from ?? 0,
            to: prev?.to ?? 0,
            suggestions: prev?.suggestions ?? [],
            loading: prev?.loading ?? false,
            activeIndex: ((prev?.activeIndex ?? 0) - 1 + (popup?.suggestions.length || 1)) % (popup?.suggestions.length || 1),
            provider: prev?.provider ?? 'Offline engine',
            error: prev?.error ?? null,
          }))
          return true
        }
        case 'Escape': {
          event.preventDefault()
          closePopup()
          return true
        }
        case ' ':
        case 'Spacebar': {
          if (transliterationService.getSettings().autoConvert) {
            event.preventDefault()
            replaceWord(current, current.activeIndex, ' ')
            return true
          }
          setPopup(null)
          lastWord.current = ''
          return false
        }
        case 'Enter': {
          event.preventDefault()
          replaceWord(current, current.activeIndex, '')
          return true
        }
        case 'Tab': {
          event.preventDefault()
          replaceWord(current, current.activeIndex, '')
          return true
        }
        case 'Home': {
          event.preventDefault()
          setPopupState((prev: TypingPopupState | null): TypingPopupState | null => ({
            word: prev?.word ?? '',
            from: prev?.from ?? 0,
            to: prev?.to ?? 0,
            suggestions: prev?.suggestions ?? [],
            loading: prev?.loading ?? false,
            activeIndex: 0,
            provider: prev?.provider ?? 'Offline engine',
            error: prev?.error ?? null,
          }))
          return true
        }
        case 'End': {
          event.preventDefault()
          setPopupState((prev: TypingPopupState | null): TypingPopupState | null => ({
            word: prev?.word ?? '',
            from: prev?.from ?? 0,
            to: prev?.to ?? 0,
            suggestions: prev?.suggestions ?? [],
            loading: prev?.loading ?? false,
            activeIndex: (popup?.suggestions.length || 1) - 1,
            provider: prev?.provider ?? 'Offline engine',
            error: prev?.error ?? null,
          }))
          return true
        }
        default: {
          if (event.key >= '1' && event.key <= '9') {
            const index = Number(event.key) - 1
            if (index < current.suggestions.length) {
              event.preventDefault()
              setPopupState((prev: TypingPopupState | null): TypingPopupState | null => ({
                word: prev?.word ?? '',
                from: prev?.from ?? 0,
                to: prev?.to ?? 0,
                suggestions: prev?.suggestions ?? [],
                loading: prev?.loading ?? false,
                activeIndex: index,
                provider: prev?.provider ?? 'Offline engine',
                error: prev?.error ?? null,
              }))
              replaceWord(current, index, '')
              return true
            }
          }
          break
        }
      }

      if (event.key.length === 1 && PUNCTUATION.has(event.key)) {
        event.preventDefault()
        replaceWord(current, current.activeIndex, event.key)
        return true
      }

      return false
    },
    [closePopup, replaceWord, setPopup],
  )

  useEffect(() => {
    if (!editor) return
    const popupElement = document.querySelector('.kw-suggestion-popup')
    if (!popupElement) return

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setPopupState((prev: TypingPopupState | null): TypingPopupState | null => ({
          word: prev?.word ?? '',
          from: prev?.from ?? 0,
          to: prev?.to ?? 0,
          suggestions: prev?.suggestions ?? [],
          loading: prev?.loading ?? false,
          activeIndex: ((prev?.activeIndex ?? 0) + 1) % (popup?.suggestions.length || 1),
          provider: prev?.provider ?? 'Offline engine',
          error: prev?.error ?? null,
        }))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setPopupState((prev: TypingPopupState | null): TypingPopupState | null => ({
          word: prev?.word ?? '',
          from: prev?.from ?? 0,
          to: prev?.to ?? 0,
          suggestions: prev?.suggestions ?? [],
          loading: prev?.loading ?? false,
          activeIndex: ((prev?.activeIndex ?? 0) - 1 + (popup?.suggestions.length || 1)) % (popup?.suggestions.length || 1),
          provider: prev?.provider ?? 'Offline engine',
          error: prev?.error ?? null,
        }))
      } else if (event.key === 'Escape') {
        event.preventDefault()
        closePopup()
      }
    }

    ;(popupElement as HTMLElement).addEventListener('keydown', handleKeydown)
    return () => {
      ;(popupElement as HTMLElement).removeEventListener('keydown', handleKeydown)
    }
  }, [popup, closePopup])

  useEffect(() => {
    if (!editor) return
    const handler = () => refresh()
    editor.on('update', handler)
    editor.on('selectionUpdate', handler)
    return () => {
      editor.off('update', handler)
      editor.off('selectionUpdate', handler)
    }
  }, [editor, refresh])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<TransliterationSettings>).detail
      setSettings(detail ?? transliterationService.getSettings())
      refresh()
    }
    const connectivity = () => refresh()
    window.addEventListener('kannada-writer:transliteration-settings', handler)
    window.addEventListener('kannada-writer:connectivity', connectivity)
    return () => {
      window.removeEventListener('kannada-writer:transliteration-settings', handler)
      window.removeEventListener('kannada-writer:connectivity', connectivity)
    }
  }, [refresh])

  return {
    popup,
    settings,
    handleKeyDown,
    selectSuggestion,
    acceptCurrent,
    closePopup,
    refresh,
  }
}