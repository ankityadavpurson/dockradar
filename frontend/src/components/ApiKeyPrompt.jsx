import { useState } from 'react'
import { Button, HelperText, KeyIcon, PasswordInput, Stack } from 'xedonium'
import { setApiKey, verifyApiKey } from '../api/client'
import Modal from './Modal'

/**
 * Asks for the API key after the API answers 401. The key is checked against
 * the server before it is stored in this browser; on success the page reloads
 * so every view refetches with the key.
 */
export default function ApiKeyPrompt({ hadKey, onClose }) {
  const [key, setKey]         = useState('')
  const [error, setError]     = useState(null)
  const [checking, setChecking] = useState(false)

  async function submit(e) {
    e?.preventDefault()
    const value = key.trim()
    if (!value || checking) return
    setChecking(true)
    setError(null)
    try {
      if (await verifyApiKey(value)) {
        setApiKey(value)
        window.location.reload()
        return
      }
      setError('That key was not accepted. Check it and try again.')
    } catch (err) {
      setError(`Couldn't check the key: ${err.message}`)
    }
    setChecking(false)
  }

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={checking}>Not now</Button>
      <Button type="submit" form="api-key-form" disabled={!key.trim() || checking}>
        <KeyIcon className="h-4 w-4 shrink-0" />
        {checking ? 'Checking…' : 'Unlock'}
      </Button>
    </>
  )

  return (
    <Modal title="API key required" onClose={onClose} size="sm" footer={footer} ariaLabel="API key required">
      <HelperText className="!text-[13px] leading-relaxed">
        {hadKey
          ? 'The API key saved in this browser is no longer accepted. Enter the current key to continue.'
          : 'This DockRadar is protected with an API key. Enter it to view and manage your containers.'}
      </HelperText>
      <Stack as="form" gap={2} id="api-key-form" onSubmit={submit}>
        <PasswordInput
          label="API key"
          value={key}
          onChange={v => { setKey(v); setError(null) }}
          error={error}
          autoFocus
          autoComplete="current-password"
          spellCheck={false}
        />
      </Stack>
      <HelperText>
        It's the <code>API_KEY</code> value from your env file, or the key set on the Settings page.
        It is kept in this browser only.
      </HelperText>
    </Modal>
  )
}
