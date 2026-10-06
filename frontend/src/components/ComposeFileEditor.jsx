import { useEffect, useState } from 'react'
import { Alert, Button, FileCode2Icon, SaveIcon, TextArea, XCircleIcon } from 'xedonium'
import { composeApi } from '../api/client'

/**
 * Inline YAML editor for a stored compose file. Fetches the raw content on
 * mount, saves via `composeApi.updateContent`, and calls `onSave()` on success.
 * Shared by the Compose Manager and the details-drawer edit action.
 */
export default function ComposeFileEditor({ file, onSave, onCancel }) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    composeApi.getContent(file.file_id)
      .then(d => setContent(d.content))
      .catch(e => setError(e.message))
  }, [file.file_id])

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await composeApi.updateContent(file.file_id, content)
      onSave()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col border border-app-border">
      <div className="flex items-center justify-between border-b border-app-border bg-app-bg px-3 py-2">
        <div className="flex items-center gap-2">
          <FileCode2Icon className="h-4 w-4 shrink-0 text-app-muted" />
          <span className="font-mono text-[13px] text-app-text">{file.filename}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5">
            <SaveIcon className="h-3 w-3 shrink-0" />{saving ? 'Saving…' : 'Save'}
          </Button>
          {onCancel && (
            <Button variant="flat" onClick={onCancel} aria-label="Cancel edit" tooltip="Cancel edit">
              <XCircleIcon className="h-4 w-4 shrink-0" />
            </Button>
          )}
        </div>
      </div>

      {error && <Alert tone="danger" className="m-3"><span className="break-words">{error}</span></Alert>}

      <TextArea
        value={content}
        onChange={setContent}
        spellCheck={false}
        rows={16}
        resize={false}
        aria-label={`Contents of ${file.filename}`}
        className="!border-0 !px-4 !py-3 font-mono !text-[13px] leading-relaxed"
      />
    </div>
  )
}
