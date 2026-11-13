import { useEffect, useRef, useState } from 'react'
import type { Suggestion } from '@/types/transliteration'
import { transliterationService } from '@/services/transliteration/TransliterationService'

interface State {
  suggestions: Suggestion[]
  provider: string
  loading: boolean
  error: string | null
}

/** Async transliteration suggestions for the word currently being typed. */
export function useTransliteration(word: string, enabled: boolean): State {
  const [state, setState] = useState<State>({ suggestions: [], provider: '', loading: false, error: null })
  const requestId = useRef(0)

  useEffect(() => {
    const id = ++requestId.current
    if (!enabled || !word || word.length < 2) {
      setState({ suggestions: [], provider: '', loading: false, error: null })
      return
    }

    const local = transliterationService.localSuggestions(word)
    setState({ suggestions: local, provider: 'Offline engine', loading: local.length === 0, error: null })

    const status = transliterationService.providerStatus
    if (!status.onlineConfigured || status.mode === 'offline' || status.mode === 'english') return

    let cancelled = false
    setState((prev) => ({ ...prev, loading: true }))
    void transliterationService
      .suggest(word)
      .then((result) => {
        if (cancelled || requestId.current !== id) return
        setState({
          suggestions: result.suggestions,
          provider: result.provider,
          loading: false,
          error: null,
        })
      })
      .catch((error: unknown) => {
        if (cancelled || requestId.current !== id) return
        setState({
          suggestions: local,
          provider: 'Offline engine',
          loading: false,
          error: error instanceof Error ? error.message : 'Transliteration service unavailable',
        })
      })

    return () => {
      cancelled = true
    }
  }, [word, enabled])

  useEffect(() => {
    const handler = () => {
      if (!word || !enabled) return
      const next = transliterationService.localSuggestions(word)
      setState((prev) => ({ ...prev, suggestions: next }))
    }
    window.addEventListener('kannada-writer:transliteration-settings', handler)
    return () => window.removeEventListener('kannada-writer:transliteration-settings', handler)
  }, [word, enabled])

  return state
}
