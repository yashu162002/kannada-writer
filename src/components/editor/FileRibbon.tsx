import {
  ArrowLeft,
  Download,
  FileArchive,
  FileCode2,
  FileDown,
  FileJson,
  FilePlus2,
  FileText,
  FolderOpen,
  Info,
  Printer,
  Save,
  SaveAll,
  Search,
} from 'lucide-react'
import type { SaveState } from '@/types/document'
import { RibbonButton, RibbonDivider, RibbonGroup, RibbonMenuButton } from './RibbonShared'

export type ExportFormat = 'docx' | 'pdf' | 'txt' | 'rtf' | 'html' | 'odt' | 'json'

interface Props {
  onNew: () => void
  onOpen: () => void
  onSave: () => void
  onSaveAs: () => void
  onExport: (format: ExportFormat) => void
  onPrint: () => void
  onPrintPreview: () => void
  onProperties: () => void
  onFindReplace: () => void
  onBack: () => void
  saveState: SaveState
  lastSavedLabel: string
}

export function FileRibbon({
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onExport,
  onPrint,
  onPrintPreview,
  onProperties,
  onFindReplace,
  onBack,
  saveState,
  lastSavedLabel,
}: Props) {
  const formats: Array<{ format: ExportFormat; label: string; description: string; icon: React.ReactNode }> = [
    {
      format: 'docx',
      label: 'Word document (.docx)',
      description: 'Editable in Microsoft Word — Kannada Unicode preserved',
      icon: <FileText size={14} />,
    },
    {
      format: 'pdf',
      label: 'PDF (.pdf)',
      description: 'Exact page layout with perfect Kannada rendering',
      icon: <FileDown size={14} />,
    },
    {
      format: 'txt',
      label: 'Plain text (.txt)',
      description: 'UTF-8 text only',
      icon: <FileCode2 size={14} />,
    },
    {
      format: 'rtf',
      label: 'Rich text (.rtf)',
      description: 'Opens in Word / LibreOffice with Kannada Unicode',
      icon: <FileText size={14} />,
    },
    {
      format: 'html',
      label: 'Web page (.html)',
      description: 'Standalone HTML with embedded Kannada font',
      icon: <FileCode2 size={14} />,
    },
    {
      format: 'odt',
      label: 'OpenDocument (.odt)',
      description: 'LibreOffice / OpenOffice compatible',
      icon: <FileArchive size={14} />,
    },
    {
      format: 'json',
      label: 'Document JSON (.json)',
      description: 'Full-fidelity Kannada Writer document',
      icon: <FileJson size={14} />,
    },
  ]

  return (
    <div className="kw-ribbon-scroller">
      <RibbonGroup label="Document">
        <RibbonButton icon={<FilePlus2 size={16} />} label="New" onClick={onNew} title="New document (Ctrl+N)" />
        <RibbonButton icon={<FolderOpen size={16} />} label="Open" onClick={onOpen} title="Open document (Ctrl+O)" />
        <RibbonButton icon={<Save size={16} />} label="Save" onClick={onSave} title="Save (Ctrl+S)" />
        <RibbonButton icon={<SaveAll size={16} />} label="Save As" onClick={onSaveAs} title="Save as a new document" />
      </RibbonGroup>

      <RibbonGroup label="Download">
        <RibbonMenuButton icon={<Download size={16} />} label="Download" title="Export document">
          <div className="w-[300px]">
            {formats.map((item) => (
              <button
                key={item.format}
                type="button"
                onClick={() => onExport(item.format)}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-ink-100"
              >
                <span className="mt-0.5 text-ink-500">{item.icon}</span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-medium text-ink-800">{item.label}</span>
                  <span className="block text-[10px] leading-tight text-ink-500">{item.description}</span>
                </span>
              </button>
            ))}
          </div>
        </RibbonMenuButton>
        <RibbonButton icon={<Printer size={16} />} label="Print" onClick={onPrint} title="Print (Ctrl+P)" />
        <RibbonButton icon={<FileDown size={16} />} label="Print preview" onClick={onPrintPreview} title="Print preview" />
      </RibbonGroup>

      <RibbonGroup label="Editing">
        <RibbonButton icon={<Search size={16} />} label="Find & Replace" onClick={onFindReplace} title="Find and replace (Ctrl+F)" />
      </RibbonGroup>

      <RibbonGroup label="Information">
        <RibbonButton icon={<Info size={16} />} label="Properties" onClick={onProperties} title="Document properties" />
        <RibbonButton icon={<ArrowLeft size={16} />} label="All documents" onClick={onBack} title="Back to documents" />
      </RibbonGroup>

      <RibbonGroup label="Save status">
        <div className="flex flex-col justify-center px-1 text-[10.5px] leading-tight">
          <span className="font-medium text-ink-700">
            {saveState === 'saving'
              ? 'Saving…'
              : saveState === 'dirty'
                ? 'Unsaved changes'
                : saveState === 'error'
                  ? 'Save failed'
                  : 'Saved locally'}
          </span>
          <span className="text-ink-500">{lastSavedLabel}</span>
        </div>
        <RibbonDivider />
      </RibbonGroup>
    </div>
  )
}
