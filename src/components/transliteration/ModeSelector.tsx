import { useEffect, useState } from 'react'
import { Check, ChevronDown, Globe2, Keyboard, Languages, SlidersHorizontal, WifiOff } from 'lucide-react'
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from '@/components/common/Dropdown'
import { Dialog } from '@/components/common/Dialog'
import { Button } from '@/components/common/Button'
import { toast } from '@/components/common/Toast'
import { transliterationService } from '@/services/transliteration/TransliterationService'
import { DEFAULT_TRANSLITERATION_SETTINGS, type TransliterationMode, type TransliterationSettings } from '@/types/transliteration'
import { cn } from '@/lib/utils'

const MODES: Array<{ mode: TransliterationMode; label: string; description: string }> = [
  { mode: 'auto', label: 'Automatic', description: 'Online when available, offline always ready' },
  { mode: 'online', label: 'Online only', description: 'Use your configured transliteration endpoint' },
  { mode: 'offline', label: 'Offline', description: 'Bundled engine — works without internet' },
  { mode: 'english', label: 'English only', description: 'Type plain English, no Kannada conversion' },
]

export function ModeSelector({ compact = false }: { compact?: boolean }) {
  const [settings, setSettings] = useState<TransliterationSettings>(() => transliterationService.getSettings())
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    const handler = (event: Event) => {
      setSettings((event as CustomEvent<TransliterationSettings>).detail ?? transliterationService.getSettings())
    }
    window.addEventListener('kannada-writer:transliteration-settings', handler)
    return () => window.removeEventListener('kannada-writer:transliteration-settings', handler)
  }, [])

  const update = (patch: Partial<TransliterationSettings>) => {
    const next = transliterationService.updateSettings(patch)
    setSettings(next)
    return next
  }

  const kannadaActive = settings.mode !== 'english'
  const status = transliterationService.providerStatus

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center overflow-hidden rounded-lg border border-ink-300 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => update({ mode: 'auto' })}
          className={cn(
            'flex h-8 items-center gap-1 px-2 text-[11.5px] font-medium transition-colors',
            kannadaActive ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-50',
          )}
          title="Kannada phonetic typing"
        >
          <Languages size={13} />
          ಕನ್ನಡ
        </button>
        <button
          type="button"
          onClick={() => update({ mode: 'english' })}
          className={cn(
            'flex h-8 items-center gap-1 border-l border-ink-200 px-2 text-[11.5px] font-medium transition-colors',
            settings.mode === 'english' ? 'bg-ink-800 text-white' : 'text-ink-600 hover:bg-ink-50',
          )}
          title="English typing (no conversion)"
        >
          ABC
        </button>

        <Dropdown
          align="end"
          trigger={
            <button
              type="button"
              className="flex h-8 items-center gap-1 border-l border-ink-200 px-2 text-ink-500 hover:bg-ink-50"
              title={status.description}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', status.onlineReachable ? 'bg-sky-500' : 'bg-brand-500')} />
              <ChevronDown size={12} />
            </button>
          }
        >
          <DropdownLabel>Transliteration mode</DropdownLabel>
          {MODES.map((item) => (
            <DropdownItem key={item.mode} onSelect={() => update({ mode: item.mode })}>
              <span className="flex items-start gap-2">
                <span className="mt-0.5 w-3.5 shrink-0 text-brand-700">
                  {settings.mode === item.mode ? <Check size={12} /> : null}
                </span>
                <span>
                  <span className="block text-[12.5px] font-medium text-ink-800">{item.label}</span>
                  <span className="block text-[10px] leading-tight text-ink-500">{item.description}</span>
                </span>
              </span>
            </DropdownItem>
          ))}
          <DropdownSeparator />
          <DropdownItem onSelect={() => update({ autoConvert: !settings.autoConvert })}>
            <span className="flex items-center justify-between gap-6">
              <span>Auto-convert on Space</span>
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[9px] font-semibold',
                  settings.autoConvert ? 'bg-brand-100 text-brand-800' : 'bg-ink-200 text-ink-600',
                )}
              >
                {settings.autoConvert ? 'ON' : 'OFF'}
              </span>
            </span>
          </DropdownItem>
          <DropdownItem onSelect={() => update({ showSuggestions: !settings.showSuggestions })}>
            <span className="flex items-center justify-between gap-6">
              <span>Show suggestions</span>
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[9px] font-semibold',
                  settings.showSuggestions ? 'bg-brand-100 text-brand-800' : 'bg-ink-200 text-ink-600',
                )}
              >
                {settings.showSuggestions ? 'ON' : 'OFF'}
              </span>
            </span>
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem onSelect={() => setDialogOpen(true)}>
            <span className="flex items-center gap-2">
              <SlidersHorizontal size={13} />
              Transliteration settings…
            </span>
          </DropdownItem>
        </Dropdown>

        {!compact ? (
          <span className="hidden items-center gap-1 border-l border-ink-200 px-2 text-[10.5px] text-ink-500 lg:flex">
            {status.onlineReachable ? <Globe2 size={11} /> : <WifiOff size={11} />}
            {status.mode === 'english' ? 'English' : status.onlineReachable ? 'Online' : 'Offline'}
          </span>
        ) : null}
      </div>

      <TransliterationSettingsDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}

export function TransliterationSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [draft, setDraft] = useState<TransliterationSettings>(() => transliterationService.getSettings())
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    if (open) setDraft(transliterationService.getSettings())
  }, [open])

  const status = transliterationService.providerStatus

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Kannada transliteration"
      description="Choose how phonetic English is converted to Kannada Unicode. Offline always works; online adds model-quality suggestions when configured."
      width="580px"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft({ ...DEFAULT_TRANSLITERATION_SETTINGS })
              toast('Reset to defaults', 'Press Apply to save.', 'default')
            }}
          >
            Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={clearing}
            onClick={async () => {
              setClearing(true)
              await transliterationService.clearCache()
              setClearing(false)
              toast('Conversion cache cleared')
            }}
          >
            Clear cache
          </Button>
          <Button
            size="sm"
            onClick={() => {
              transliterationService.updateSettings(draft)
              onOpenChange(false)
              toast('Typing settings saved', draft.mode === 'english' ? 'English only' : 'Kannada conversion enabled')
            }}
          >
            Apply
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {MODES.map((item) => (
            <button
              key={item.mode}
              type="button"
              onClick={() => setDraft({ ...draft, mode: item.mode })}
              className={cn(
                'rounded-lg border p-2.5 text-left transition-colors',
                draft.mode === item.mode
                  ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-200'
                  : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50',
              )}
            >
              <span className="flex items-center justify-between text-[12.5px] font-semibold text-ink-800">
                {item.label}
                {draft.mode === item.mode ? <Check size={13} className="text-brand-700" /> : null}
              </span>
              <span className="mt-0.5 block text-[10.5px] leading-snug text-ink-500">{item.description}</span>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-[12px] text-ink-800">
              <input
                type="checkbox"
                checked={draft.autoConvert}
                onChange={(event) => setDraft({ ...draft, autoConvert: event.target.checked })}
              />
              Convert when I press Space
            </label>
            <label className="flex items-center gap-2 text-[12px] text-ink-800">
              <input
                type="checkbox"
                checked={draft.personalDictionary}
                onChange={(event) => setDraft({ ...draft, personalDictionary: event.target.checked })}
              />
              Learn my word choices
            </label>
          </div>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-500">
            {draft.autoConvert
              ? 'Space accepts the highlighted suggestion. Use ↑/↓ to choose, Esc to dismiss, Enter or Tab to accept without a space.'
              : 'Space keeps the English word. Press Enter, Tab or click a suggestion to insert Kannada.'}
          </p>
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <Keyboard size={14} className="text-ink-500" />
            <h3 className="text-[12px] font-semibold text-ink-800">Online provider (optional)</h3>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[9px] font-semibold',
                draft.onlineEndpoint ? 'bg-sky-100 text-sky-800' : 'bg-ink-200 text-ink-600',
              )}
            >
              {draft.onlineEndpoint ? 'CONFIGURED' : 'OFFLINE ONLY'}
            </span>
          </div>
          <label className="kw-label" htmlFor="online-endpoint">
            Endpoint URL (POST JSON)
          </label>
          <input
            id="online-endpoint"
            className="kw-input font-mono text-[11.5px]"
            placeholder="https://your-proxy.example.com/transliterate"
            value={draft.onlineEndpoint}
            onChange={(event) => setDraft({ ...draft, onlineEndpoint: event.target.value })}
          />
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-500">
            Accepts an IndicXlit/ULCA-compatible response or a simple{' '}
            <code className="rounded bg-ink-100 px-1">{'{ suggestions: ["ನಮಸ್ಕಾರ"] }'}</code>. No Google Translate.
            Point this at your own proxy — AI4Bharat IndicXlit does not publish a guaranteed public endpoint.
          </p>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label className="kw-label" htmlFor="online-header-name">
                Auth header name (optional)
              </label>
              <input
                id="online-header-name"
                className="kw-input font-mono text-[11.5px]"
                placeholder="X-API-Key"
                value={draft.onlineApiKeyHeader}
                onChange={(event) => setDraft({ ...draft, onlineApiKeyHeader: event.target.value })}
              />
            </div>
            <div>
              <label className="kw-label" htmlFor="online-header-value">
                Header value
              </label>
              <input
                id="online-header-value"
                type="password"
                className="kw-input text-[11.5px]"
                placeholder="stored only in this browser"
                value={draft.onlineApiKeyValue}
                onChange={(event) => setDraft({ ...draft, onlineApiKeyValue: event.target.value })}
              />
            </div>
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-amber-700">
            Keys entered here live in this browser&apos;s local storage and are sent only to your endpoint. For shared
            deployments, terminate authentication in a server-side proxy.
          </p>
        </div>

        <div className="rounded-lg border border-ink-200 p-3 text-[11px] text-ink-600">
          <p className="font-medium text-ink-800">Active provider</p>
          <p>{status.label}</p>
          <p className="mt-0.5 text-ink-500">{status.description}</p>
          <p className="mt-1.5 text-[10.5px] text-ink-500">
            Offline engine: bundled phonetic rules + {transliterationService.offlineReady ? 'curated Kannada lexicon' : 'no lexicon'} +
            your personal dictionary. Runs fully in this browser.
          </p>
        </div>
      </div>
    </Dialog>
  )
}
