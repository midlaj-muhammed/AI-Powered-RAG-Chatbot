import { useState, useCallback, useRef } from 'react'
import { AlertCircle, Paperclip, X, Image as ImageIcon, FileText, Film, Music, Mic, MicOff, Wand2, X as CloseIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatInput as UIChatInput, ChatInputTextArea, ChatInputSubmit } from '@/components/ui/chat-input'
import { chatApi } from '@/api/chat'
import { toastError } from '@/components/ui/toast-lib'
import { useSpeechRecognition } from '@/hooks/use-speech-recognition'
import { VoiceChat } from '@/components/ui/ia-siri-chat'
import { AnimatePresence, motion } from 'framer-motion'

// Message content constraints - must match backend
const MESSAGE_CONSTRAINTS = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 5000,
} as const

interface Attachment {
  id: string
  filename: string
  mime_type: string
  previewUrl?: string
}

interface ChatInputProps {
  onSend: (message: string, attachmentIds?: string[]) => void
  onError?: (error: string) => void
  onCancel?: () => void
  disabled?: boolean
  isStreaming?: boolean
}

export function ChatInput({ onSend, onError, onCancel, disabled, isStreaming }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { isListening, startListening, stopListening } = useSpeechRecognition(setMessage)

  const validateMessage = useCallback((text: string): string | null => {
    const trimmed = text.trim()

    if (!trimmed && attachments.length === 0) {
      return 'Message cannot be empty.'
    }

    if (trimmed && trimmed.length < MESSAGE_CONSTRAINTS.MIN_LENGTH && attachments.length === 0) {
      return `Message must be at least ${MESSAGE_CONSTRAINTS.MIN_LENGTH} characters.`
    }

    if (text.length > MESSAGE_CONSTRAINTS.MAX_LENGTH) {
      return `Message cannot exceed ${MESSAGE_CONSTRAINTS.MAX_LENGTH} characters.`
    }

    return null
  }, [attachments])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    const newAttachments: Attachment[] = [...attachments]

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      try {
        const result = await chatApi.uploadAttachment(file)

        let previewUrl: string | undefined
        if (file.type.startsWith('image/')) {
          previewUrl = URL.createObjectURL(file)
        }

        newAttachments.push({
          ...result,
          previewUrl
        })
      } catch {
        toastError(`Failed to upload ${file.name}`)
      }
    }

    setAttachments(newAttachments)
    setIsUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  const handleSubmit = useCallback(() => {
    const error = validateMessage(message)
    if (error) {
      setValidationError(error)
      onError?.(error)
      return
    }

    const trimmed = message.trim()
    if ((!trimmed && attachments.length === 0) || disabled || isUploading) return

    setValidationError(null)
    onSend(trimmed || 'Uploaded files', attachments.map(a => a.id))
    setMessage('')
    setAttachments([])
  }, [message, attachments, disabled, isUploading, onSend, validateMessage, onError])

  const getAttachmentIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="h-4 w-4" />
    if (mimeType.startsWith('video/')) return <Film className="h-4 w-4" />
    if (mimeType.startsWith('audio/')) return <Music className="h-4 w-4" />
    return <FileText className="h-4 w-4" />
  }

  return (
    <div className="border-t border-border bg-card px-4 py-3 relative" role="form" aria-label="Send a message">
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute bottom-full left-0 right-0 mb-4 px-4 z-[210] pointer-events-none"
          >
            <div className="pointer-events-auto mx-auto max-w-3xl">
              <VoiceChat
                externalListening={isListening}
                onStop={stopListening}
                className="shadow-2xl shadow-blue-500/10 min-h-[300px]"
              />
              <button
                onClick={stopListening}
                className="absolute top-4 right-8 p-2 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white transition-colors"
                title="Close voice mode"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map(att => (
              <div key={att.id} className="relative group rounded-lg border border-border bg-accent/50 p-2 flex items-center gap-2 pr-8">
                {att.previewUrl ? (
                  <img src={att.previewUrl} alt={att.filename} className="h-8 w-8 rounded object-cover" />
                ) : (
                  getAttachmentIcon(att.mime_type)
                )}
                <span className="text-xs truncate max-w-[120px]">{att.filename}</span>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <UIChatInput
          variant="default"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value)
            setValidationError(null)
          }}
          onSubmit={handleSubmit}
          loading={isStreaming || isUploading}
          onStop={onCancel}
          className={cn(
            validationError ? 'border-destructive focus-within:ring-destructive/50' : '',
            disabled ? 'opacity-50 pointer-events-none' : ''
          )}
        >
          <div className="flex items-center pl-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isStreaming || isUploading}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-accent"
              title="Attach files (Image, Video, Audio, PDF)"
            >
              <Paperclip className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              disabled={disabled || isStreaming || isUploading}
              className={cn(
                "p-2 transition-all rounded-full hover:bg-accent",
                isListening ? "text-red-500 animate-pulse bg-red-500/10" : "text-muted-foreground hover:text-foreground"
              )}
              title={isListening ? "Stop recording" : "Voice to Text"}
            >
              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
              multiple
              accept="image/*,video/*,audio/*,application/pdf"
            />
          </div>
          <ChatInputTextArea
            placeholder={isListening ? "Listening..." : "Type your message or attach files..."}
            maxLength={MESSAGE_CONSTRAINTS.MAX_LENGTH}
            disabled={disabled || isStreaming || isUploading}
          />
          <div className="flex items-center justify-end gap-1 w-full">
            {message.length > 200 && !isStreaming && (
              <button
                type="button"
                onClick={() => {
                  setMessage(prev => `Summarize this: ${prev}`)
                  handleSubmit()
                }}
                className="p-1.5 text-xs font-medium text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1"
                title="Summarize your input and send"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Summarize & Send
              </button>
            )}
            <ChatInputSubmit disabled={(!message.trim() && attachments.length === 0) || disabled || isUploading} />
          </div>
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
            {isUploading && <span className="animate-pulse">Uploading files...</span>}
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
