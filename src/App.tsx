import { Component, useCallback, useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

import { DocumentHome } from '@/components/documents/DocumentHome'
import { DocumentEditor } from '@/components/editor/DocumentEditor'
import { Button } from '@/components/common/Button'
import { DocumentService } from '@/services/storage/DocumentService'

interface Route {
  name: 'home' | 'document'
  documentId?: string
}

function parseRoute(): Route {
  const hash = window.location.hash.replace(/^#/, '')
  const match = /^\/doc\/([^/?#]+)/.exec(hash)
  if (match?.[1]) {
    try {
      return { name: 'document', documentId: decodeURIComponent(match[1]) }
    } catch {
      return { name: 'document', documentId: match[1] }
    }
  }
  return { name: 'home' }
}

function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(parseRoute)

  useEffect(() => {
    const handleHashChange = () => setRoute(parseRoute())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return route
}

function navigate(hash: string): void {
  const next = hash.startsWith('#') ? hash : `#${hash}`
  if (window.location.hash === next) {
    window.dispatchEvent(new Event('hashchange'))
    return
  }
  window.location.hash = next
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="kw-app-bg flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle size={20} />
          </div>
          <h1 className="text-[16px] font-semibold text-ink-900">Something went wrong</h1>
          <p className="max-w-md text-[12px] leading-relaxed text-ink-500">
            The editor hit an unexpected error. Your saved documents are still stored in this browser.
          </p>
          <pre className="max-w-lg overflow-auto rounded-lg bg-white px-3 py-2 text-left text-[10.5px] text-red-700 shadow-sm">
            {this.state.error.message}
          </pre>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              Reload app
            </Button>
            <Button
              size="sm"
              onClick={() => {
                window.location.hash = '#/'
                window.location.reload()
              }}
            >
              Back to documents
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  const route = useHashRoute()

  const openDocument = useCallback((id: string) => {
    navigate(`#/doc/${encodeURIComponent(id)}`)
  }, [])

  const openHome = useCallback(() => {
    navigate('#/')
  }, [])

  const createAndOpen = useCallback(async (): Promise<string | null> => {
    try {
      const count = await DocumentService.list()
      const doc = await DocumentService.create({
        title: count.length === 0 ? 'Untitled document' : `Untitled document ${count.length + 1}`,
      })
      openDocument(doc.id)
      return doc.id
    } catch (error) {
      console.error('Could not create document', error)
      return null
    }
  }, [openDocument])

  if (route.name === 'document' && route.documentId) {
    return (
      <DocumentEditor
        key={route.documentId}
        documentId={route.documentId}
        onBack={openHome}
        onOpenDocument={openDocument}
        onNewDocument={() => void createAndOpen()}
      />
    )
  }

  return <DocumentHome onOpenDocument={openDocument} onCreateDocument={createAndOpen} />
}

export default function AppRoot() {
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  )
}
