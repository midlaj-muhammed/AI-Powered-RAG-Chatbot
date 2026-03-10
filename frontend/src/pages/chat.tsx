import { useRef, useEffect, useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MessageSquare, Sparkles, FolderOpen, X } from 'lucide-react'
import { useChatStore } from '@/stores/chat-store'
import { chatApi } from '@/api/chat'
import { documentsApi } from '@/api/documents'
import { ChatSidebar } from '@/components/chat/chat-sidebar'
import { ChatInput } from '@/components/chat/chat-input'
import { MessageBubble } from '@/components/chat/message-bubble'
import { toastError, toastWarning } from '@/components/ui/toast-lib'
import type { Message } from '@/api/types'

export function ChatPage() {
  const {
    activeSessionId,
    messages,
    isStreaming,
    streamingContent,
    streamingSources,
    addMessage,
    setStreaming,
    appendStreamContent,
    setStreamingSources,
    clearStream,
    setActiveSessionId,
    addSession,
    setMessages,
    updateSessionTitle,
  } = useChatStore()

  const [selectedCollection, setSelectedCollection] = useState<string | undefined>()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const userMessageRef = useRef<string | null>(null) // Track user message for rollback

  const { data: collections, error: collectionsError } = useQuery({
    queryKey: ['collections'],
    queryFn: documentsApi.getCollections,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Show error message if collections fail to load
  useEffect(() => {
    if (collectionsError) {
      toastWarning('Unable to load collections. You may need to refresh the page.')
    }
  }, [collectionsError])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleInputError = useCallback((error: string) => {
    toastWarning(error)
  }, [])

  const handleSend = useCallback(
    async (content: string) => {
      let sessionId = activeSessionId
      userMessageRef.current = content

      // Create session if none active
      if (!sessionId) {
        try {
          const session = await chatApi.createSession()
          addSession(session)
          setActiveSessionId(session.id)
          sessionId = session.id
        } catch (error) {
          console.error('Failed to create session:', error)
          toastError('Failed to create chat session. Please try again.')
          return
        }
      }

      // Add user message optimistically
      const userMessageId = crypto.randomUUID()
      const userMessage: Message = {
        id: userMessageId,
        role: 'user',
        content,
        tokens_used: null,
        latency_ms: null,
        sources: [],
        confidence_score: null,
        is_favorite: false,
        feedback: null,
        created_at: new Date().toISOString(),
      }
      addMessage(userMessage)

      // Start streaming
      setStreaming(true)
      abortRef.current = new AbortController()

      try {
        let fullContent = ''

        for await (const event of chatApi.sendMessage(sessionId, content, selectedCollection)) {
          if (abortRef.current?.signal.aborted) break

          switch (event.type) {
            case 'sources':
              setStreamingSources(event.data)
              break
            case 'token':
              appendStreamContent(event.content)
              fullContent += event.content
              break
            case 'done': {
              // Add the final assistant message
              const assistantMessage: Message = {
                id: event.message_id,
                role: 'assistant',
                content: fullContent,
                tokens_used: event.tokens_used,
                latency_ms: event.latency_ms,
                sources: useChatStore.getState().streamingSources,
                confidence_score: event.confidence,
                is_favorite: false,
                feedback: null,
                created_at: new Date().toISOString(),
              }
              addMessage(assistantMessage)

              // Update session title if it was the first message
              if (messages.length === 0) {
                try {
                  const sessionDetail = await chatApi.getSession(sessionId)
                  if (sessionDetail.title) {
                    updateSessionTitle(sessionId, sessionDetail.title)
                  }
                } catch (error) {
                  console.error('Failed to fetch session details:', error)
                  // Non-critical, don't show toast
                }
              }
              break
            }
            case 'error': {
              const errorMsg = event.detail || 'An unknown error occurred'
              toastError(errorMsg)

              const errorMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `I encountered an error: ${errorMsg}`,
                tokens_used: null,
                latency_ms: null,
                sources: [],
                confidence_score: null,
                is_favorite: false,
                feedback: null,
                created_at: new Date().toISOString(),
              }
              addMessage(errorMessage)
              break
            }
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Stream connection failed'
        console.error('Stream failed:', error)

        // Rollback user message on stream failure
        if (messages.length > 0 && userMessageRef.current === content) {
          // Remove the optimistically added user message
          setMessages(messages.filter((m) => m.id !== userMessageId))
        } else {
          // Just show assistant error if we can't rollback
          const errorResponse: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Connection failed. ${errorMessage}. Please check your network and try again.`,
            tokens_used: null,
            latency_ms: null,
            sources: [],
            confidence_score: null,
            is_favorite: false,
            feedback: null,
            created_at: new Date().toISOString(),
          }
          addMessage(errorResponse)
        }

        toastError(errorMessage)
      } finally {
        clearStream()
        userMessageRef.current = null
      }
    },
    [
      activeSessionId,
      messages,
      addMessage,
      addSession,
      appendStreamContent,
      clearStream,
      setActiveSessionId,
      setMessages,
      setStreaming,
      setStreamingSources,
      updateSessionTitle,
      selectedCollection,
    ]
  )

  const handleCancel = () => {
    abortRef.current?.abort()
    clearStream()
  }

  return (
    <div className="flex h-full">
      <ChatSidebar />

      <div className="flex flex-1 flex-col">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !isStreaming ? (
            <EmptyState onSuggestionClick={handleSend} />
          ) : (
            <div className="mx-auto max-w-3xl py-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {/* Streaming message */}
              {isStreaming && streamingContent && (
                <MessageBubble
                  message={{
                    id: 'streaming',
                    role: 'assistant',
                    content: streamingContent,
                    tokens_used: null,
                    latency_ms: null,
                    sources: streamingSources,
                    confidence_score: null,
                    is_favorite: false,
                    feedback: null,
                    created_at: new Date().toISOString(),
                  }}
                  isStreaming
                />
              )}

              {/* Typing indicator */}
              {isStreaming && !streamingContent && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                  </div>
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Collection selector + Input */}
        <div className="border-t border-border bg-card">
          {/* Collection selector */}
          {collections && collections.length > 0 && (
            <div className="mx-auto max-w-3xl px-4 pt-2 flex items-center gap-2">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setSelectedCollection(undefined)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] transition-colors ${!selectedCollection
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent'
                    }`}
                >
                  All docs
                </button>
                {collections.map((col) => (
                  <button
                    key={col.id}
                    onClick={() =>
                      setSelectedCollection(
                        selectedCollection === col.id ? undefined : col.id
                      )
                    }
                    className={`rounded-full px-2.5 py-0.5 text-[11px] transition-colors flex items-center gap-1 ${selectedCollection === col.id
                      ? 'bg-primary/15 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-accent'
                      }`}
                  >
                    <div
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: col.color }}
                    />
                    {col.name}
                    {selectedCollection === col.id && (
                      <X className="h-3 w-3 ml-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ChatInput
            onSend={handleSend}
            onError={handleInputError}
            onCancel={handleCancel}
            isStreaming={isStreaming}
          />
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onSuggestionClick }: { onSuggestionClick?: (text: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold">How can I help you?</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Ask questions about your company's documents. I'll search through your
          uploaded files and provide answers with source citations.
        </p>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {[
          'What were the Q3 sales figures?',
          'Summarize the HR policy changes',
          'What are the product roadmap priorities?',
          'Show me the latest financial report',
        ].map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSuggestionClick?.(suggestion)}
            className="rounded-xl border border-border bg-card px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}
