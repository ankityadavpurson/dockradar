import { useEffect, useState } from 'react'
import { Alert, Button, Card, FileCode2Icon, SaveIcon, TextArea, XCircleIcon, Flex } from 'xedonium'
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
    <Card
      padded={false}
      className="overflow-hidden"
      title={
        <Flex as="span" align="center" gap={2} className="normal-case tracking-normal">
          <FileCode2Icon className="h-4 w-4 shrink-0 text-app-muted" />
          <span className="font-mono text-[13px] font-normal">{file.filename}</span>
        </Flex>
      }
      actions={<>
        <Button onClick={handleSave} disabled={saving}>
          <SaveIcon className="h-3 w-3 shrink-0" />{saving ? 'Saving…' : 'Save'}
        </Button>
        {onCancel && (
          <Button variant="flat" onClick={onCancel} aria-label="Cancel edit" tooltip="Cancel edit">
            <XCircleIcon className="h-4 w-4 shrink-0" />
          </Button>
        )}
      </>}
    >

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
    </Card>
  )
}
