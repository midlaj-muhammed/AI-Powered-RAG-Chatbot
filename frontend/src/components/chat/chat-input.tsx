import { useState, useCallback } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatInput as UIChatInput, ChatInputTextArea, ChatInputSubmit } from '@/components/ui/chat-input'

// Message content constraints - must match backend
const MESSAGE_CONSTRAINTS = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 5000,
} as const

interface ChatInputProps {
  onSend: (message: string) => void
  onError?: (error: string) => void
  onCancel?: () => void
  disabled?: boolean
  isStreaming?: boolean
}

export function ChatInput({ onSend, onError, onCancel, disabled, isStreaming }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const validateMessage = useCallback((text: string): string | null => {
    const trimmed = text.trim()

    if (!trimmed) {
      return 'Message cannot be empty.'
    }

    if (trimmed.length < MESSAGE_CONSTRAINTS.MIN_LENGTH) {
      return `Message must be at least ${MESSAGE_CONSTRAINTS.MIN_LENGTH} characters.`
    }

    if (text.length > MESSAGE_CONSTRAINTS.MAX_LENGTH) {
      return `Message cannot exceed ${MESSAGE_CONSTRAINTS.MAX_LENGTH} characters.`
    }

    return null
  }, [])

  const handleSubmit = useCallback(() => {
    const error = validateMessage(message)
    if (error) {
      setValidationError(error)
      onError?.(error)
      return
    }

    const trimmed = message.trim()
    if (!trimmed || disabled) return

    setValidationError(null)
    onSend(trimmed)
    setMessage('')
  }, [message, disabled, onSend, validateMessage, onError])

  return (
    <div className="border-t border-border bg-card px-4 py-3" role="form" aria-label="Send a message">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <UIChatInput
          variant="default"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value)
            setValidationError(null)
          }}
          onSubmit={handleSubmit}
          loading={isStreaming}
          onStop={onCancel}
          className={cn(
            validationError ? 'border-destructive focus-within:ring-destructive/50' : '',
            disabled ? 'opacity-50 pointer-events-none' : ''
          )}
        >
          <ChatInputTextArea
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            maxLength={MESSAGE_CONSTRAINTS.MAX_LENGTH}
            disabled={disabled || isStreaming}
          />
          <ChatInputSubmit disabled={!message.trim() || disabled} />
        </UIChatInput>

        <div className="flex items-center justify-between px-1">
          <span id="chat-validation" className={cn(
            'text-xs flex items-center gap-1',
            validationError ? 'text-destructive' : 'text-muted-foreground/50'
          )} role="alert" aria-live="polite">
            {validationError && (
              <>
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
                {validationError}
              </>
            )}
          </span>
          <span id="chat-char-count" className={cn(
            'text-xs',
            message.length > MESSAGE_CONSTRAINTS.MAX_LENGTH * 0.9 ? 'text-amber-600' : 'text-muted-foreground/50'
          )} aria-live="polite">
            {message.length}/{MESSAGE_CONSTRAINTS.MAX_LENGTH}
          </span>
        </div>
      </div>
    </div>
  )
}
