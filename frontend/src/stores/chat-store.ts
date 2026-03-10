import { create } from 'zustand'
import type { ChatSession, Message, MessageSource } from '@/api/types'

interface ChatState {
  sessions: ChatSession[]
  activeSessionId: string | null
  messages: Message[]
  isStreaming: boolean
  streamingContent: string
  streamingSources: MessageSource[]
  sidebarOpen: boolean

  setSessions: (sessions: ChatSession[]) => void
  addSession: (session: ChatSession) => void
  removeSession: (id: string) => void
  setActiveSessionId: (id: string | null) => void
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  setStreaming: (isStreaming: boolean) => void
  appendStreamContent: (token: string) => void
  setStreamingSources: (sources: MessageSource[]) => void
  clearStream: () => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  updateSessionTitle: (id: string, title: string) => void
}

export const useChatStore = create<ChatState>()((set) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  streamingSources: [],
  sidebarOpen: true,

  setSessions: (sessions) => set({ sessions }),
  addSession: (session) =>
    set((state) => ({ sessions: [session, ...state.sessions] })),
  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
    })),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setStreaming: (isStreaming) => set({ isStreaming }),
  appendStreamContent: (token) =>
    set((state) => ({ streamingContent: state.streamingContent + token })),
  setStreamingSources: (sources) => set({ streamingSources: sources }),
  clearStream: () => set({ streamingContent: '', streamingSources: [], isStreaming: false }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  updateSessionTitle: (id, title) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, title } : s
      ),
    })),
}))
