import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  User,
  Bot,
  ThumbsUp,
  ThumbsDown,
  Star,
  ChevronDown,
  ChevronUp,
  FileText,
  Film,
  Music,
  Download,
} from 'lucide-react'
import { useState, memo, useMemo } from 'react'
import { cn, formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { chatApi } from '@/api/chat'
import type { Message, MessageSource, Attachment } from '@/api/types'

const AttachmentPreview = memo(function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const isImage = attachment.mime_type.startsWith('image/')
  const isVideo = attachment.mime_type.startsWith('video/')
  const isAudio = attachment.mime_type.startsWith('audio/')

  return (
    <div className="group relative rounded-xl border border-border/50 bg-background/50 overflow-hidden transition-all hover:bg-background/80">
      {isImage ? (
        <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
          <img
            src={attachment.file_url}
            alt={attachment.filename}
            className="h-24 w-auto max-w-[200px] object-cover cursor-zoom-in"
          />
        </a>
      ) : (
        <div className="flex items-center gap-2 p-2 min-w-[140px]">
          <div className="p-2 rounded-lg bg-primary/10">
            {isVideo ? <Film className="h-4 w-4 text-primary" /> :
              isAudio ? <Music className="h-4 w-4 text-primary" /> :
                <FileText className="h-4 w-4 text-primary" />}
          </div>
          <div className="flex flex-col min-w-0 pr-6">
            <span className="text-[11px] font-medium truncate">{attachment.filename}</span>
            <span className="text-[10px] text-muted-foreground">{(attachment.file_size / 1024).toFixed(1)} KB</span>
          </div>
          <a
            href={attachment.file_url}
            download
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </div>
  )
})

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
}

export const MessageBubble = memo(function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
    const isUser = message.role === 'user'
    const [showSources, setShowSources] = useState(false)

    const remarkPlugins = useMemo(() => [remarkGfm], [])

    const markdownComponents = useMemo(() => ({
        // Headings
        h1: ({ children }: any) => <h1 className="text-xl font-bold mt-5 mb-3 text-foreground">{children}</h1>,
        h2: ({ children }: any) => <h2 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h2>,
        h3: ({ children }: any) => <h3 className="text-base font-semibold mt-3 mb-1.5 text-foreground">{children}</h3>,
        // Paragraphs
        p: ({ children }: any) => <p className="mb-3 leading-7 text-foreground/90">{children}</p>,
        // Lists – ChatGPT / Claude style
        ul: ({ children }: any) => <ul className="mb-3 ml-1 space-y-1.5 list-none">{children}</ul>,
        ol: ({ children }: any) => <ol className="mb-3 ml-1 space-y-1.5 list-decimal list-inside">{children}</ol>,
        li: ({ children }: any) => (
            <li className="flex items-start gap-2 text-foreground/90">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary/70 shrink-0" />
                <span className="flex-1">{children}</span>
            </li>
        ),
        // Bold & Italic
        strong: ({ children }: any) => <strong className="font-semibold text-foreground">{children}</strong>,
        em: ({ children }: any) => <em className="italic text-foreground/80">{children}</em>,
        // Code
        code: ({ className, children, ...props }: any) => {
            const isInline = !className
            return isInline ? (
                <code className="bg-muted/80 text-primary px-1.5 py-0.5 rounded text-[13px] font-mono" {...props}>{children}</code>
            ) : (
                <code className={`${className} text-[13px] font-mono`} {...props}>{children}</code>
            )
        },
        pre: ({ children }: any) => (
            <pre className="bg-[#0d0d10] border border-border/50 rounded-xl p-4 overflow-x-auto my-3 text-sm">{children}</pre>
        ),
        // Blockquote
        blockquote: ({ children }: any) => (
            <blockquote className="border-l-3 border-primary/50 pl-4 py-1 my-3 text-muted-foreground italic bg-primary/5 rounded-r-lg">{children}</blockquote>
        ),
        // Table
        table: ({ children }: any) => (
            <div className="overflow-x-auto my-3 rounded-lg border border-border/50">
                <table className="w-full text-sm">{children}</table>
            </div>
        ),
        thead: ({ children }: any) => <thead className="bg-muted/50">{children}</thead>,
        th: ({ children }: any) => <th className="px-3 py-2 text-left font-semibold text-foreground border-b border-border/50">{children}</th>,
        td: ({ children }: any) => <td className="px-3 py-2 border-b border-border/30 text-foreground/80">{children}</td>,
        // Horizontal rule
        hr: () => <hr className="my-4 border-border/30" />,
        // Links
        a: ({ href, children }: any) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-2">{children}</a>
        ),
    }), [])

  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-5 py-3 relative transition-all duration-300 shadow-sm',
          isUser
            ? 'bg-gradient-to-br from-primary/90 to-primary text-primary-foreground ml-auto border border-primary/20 shadow-primary/10'
            : 'bg-card/40 backdrop-blur-md border border-border/50 mr-auto hover:bg-card/60'
        )}
      >
        {/* Glow effect for assistant messages */}
        {!isUser && (
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/10 to-teal-500/10 rounded-2xl blur opacity-30 -z-10 group-hover:opacity-50 transition-opacity" />
        )}
        {isUser ? (
          <div className="flex flex-col gap-2">
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-1">
                {message.attachments.map(att => (
                  <AttachmentPreview key={att.id} attachment={att} />
                ))}
              </div>
            )}
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
        ) : (
          <div className="markdown-content text-sm leading-relaxed">
            <ReactMarkdown
              remarkPlugins={remarkPlugins}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Streaming indicator */}
        {isStreaming && (
          <span className="inline-block mt-1">
            <span className="animate-pulse">▊</span>
          </span>
        )}

        {/* Sources */}
        {!isUser && message.sources?.length > 0 && (
          <div className="mt-2 border-t border-border/50 pt-2">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileText className="h-3 w-3" />
              {message.sources.length} source{message.sources.length > 1 ? 's' : ''}
              {showSources ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showSources && (
              <SourcesList sources={message.sources} />
            )}
          </div>
        )}

        {/* Confidence + metadata */}
        {!isUser && !isStreaming && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {message.confidence_score != null && (
              <Badge
                variant={
                  message.confidence_score > 0.7
                    ? 'success'
                    : message.confidence_score > 0.4
                      ? 'warning'
                      : 'destructive'
                }
              >
                {Math.round(message.confidence_score * 100)}% confident
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDate(message.created_at)}
            </span>
          </div>
        )}

        {/* Actions */}
        {!isUser && !isStreaming && (
          <MessageActions message={message} />
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
          <User className="h-4 w-4 text-secondary-foreground" />
        </div>
      )}
    </div>
  )
})

const SourcesList = memo(function SourcesList({ sources }: { sources: MessageSource[] }) {
  return (
    <div className="mt-1.5 space-y-1">
      {sources.map((source, i) => (
        <SourceCard key={i} source={source} />
      ))}
    </div>
  )
})

const SourceCard = memo(function SourceCard({ source }: { source: MessageSource }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="rounded-md bg-background/50 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-background/80 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileText className="h-3 w-3 shrink-0 text-primary/60" />
          <span className="font-medium text-foreground truncate">
            {source.document_name}
          </span>
          <span className="text-muted-foreground shrink-0">
            chunk {source.chunk_index}
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {source.score != null ? `${Math.round(source.score * 100)}%` : ''}
        </Badge>
      </div>
      {source.content_preview && (
        <p
          className={cn(
            'mt-1 text-muted-foreground transition-all',
            expanded ? '' : 'line-clamp-2'
          )}
        >
          {source.content_preview}
        </p>
      )}
    </div>
  )
})

const MessageActions = memo(function MessageActions({ message }: { message: Message }) {
  const [feedback, setFeedback] = useState<boolean | null>(
    message.feedback?.is_helpful ?? null
  )
  const [isFavorite, setIsFavorite] = useState(message.is_favorite)

  const handleFeedback = async (isHelpful: boolean) => {
    try {
      await chatApi.submitFeedback(message.id, isHelpful)
      setFeedback(isHelpful)
    } catch {
      // ignore
    }
  }

  const handleToggleFavorite = async () => {
    try {
      const result = await chatApi.toggleFavorite(message.id)
      setIsFavorite(result.is_favorite)
    } catch {
      // ignore
    }
  }

  return (
    <div className="mt-1.5 flex items-center gap-1">
      <button
        onClick={() => handleFeedback(true)}
        className={cn(
          'rounded p-1 transition-colors',
          feedback === true
            ? 'text-success'
            : 'text-muted-foreground/50 hover:text-foreground'
        )}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => handleFeedback(false)}
        className={cn(
          'rounded p-1 transition-colors',
          feedback === false
            ? 'text-destructive'
            : 'text-muted-foreground/50 hover:text-foreground'
        )}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={handleToggleFavorite}
        className={cn(
          'rounded p-1 transition-colors',
          isFavorite
            ? 'text-warning'
            : 'text-muted-foreground/50 hover:text-foreground'
        )}
      >
        <Star className="h-3.5 w-3.5" fill={isFavorite ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
})
