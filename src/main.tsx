import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import AppRoot from './App'
import { Toaster } from '@/components/common/Toast'
import { requestPersistentStorage } from '@/services/storage/Database'
import { transliterationService } from '@/services/transliteration/TransliterationService'

// Warm the personal dictionary and ask the browser to keep IndexedDB data.
void transliterationService.init()
void requestPersistentStorage()

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root was not found in index.html')
}

createRoot(container).render(
  <StrictMode>
    <AppRoot />
    <Toaster />
  </StrictMode>,
)
