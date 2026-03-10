import { useEffect, useCallback } from 'react'
import { Plus, Trash2, MessageSquare } from 'lucide-react'
import { cn, formatDate, truncate } from '@/lib/utils'
import { useChatStore } from '@/stores/chat-store'
import { chatApi } from '@/api/chat'
import { Button } from '@/components/ui/button'
import type { ChatSession } from '@/api/types'

export function ChatSidebar() {
  const {
    sessions,
    activeSessionId,
    setSessions,
    addSession,
    removeSession,
    setActiveSessionId,
    setMessages,
    sidebarOpen,
  } = useChatStore()

  const loadSessions = useCallback(async () => {
    try {
      const data = await chatApi.getSessions()
      setSessions(data.results)
    } catch {
      // silently fail
    }
  }, [setSessions])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const handleNewChat = async () => {
    try {
      const session = await chatApi.createSession()
      addSession(session)
      setActiveSessionId(session.id)
      setMessages([])
    } catch {
      // handle error
    }
  }

  const handleSelectSession = async (session: ChatSession) => {
    setActiveSessionId(session.id)
    try {
      const detail = await chatApi.getSession(session.id)
      setMessages(detail.messages)
    } catch {
      setMessages([])
    }
  }

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      await chatApi.deleteSession(id)
      removeSession(id)
      if (activeSessionId === id) {
        setMessages([])
      }
    } catch {
      // handle error
    }
  }

  if (!sidebarOpen) return null

  return (
    <div className="flex w-60 flex-col border-r border-border bg-card/50">
      {/* New chat button */}
      <div className="p-3">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={handleNewChat}
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No conversations yet</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sessions.map((session) => (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectSession(session)}
                onKeyDown={(e) => e.key === 'Enter' && handleSelectSession(session)}
                className={cn(
                  'group flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                  activeSessionId === session.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {session.title || 'New conversation'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground/70">
                    {session.last_message
                      ? truncate(typeof session.last_message === 'string' ? session.last_message : session.last_message.content, 30)
                      : formatDate(session.created_at)}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(e, session.id)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
