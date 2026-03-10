import api from './client'
import { useAuthStore } from '@/stores/auth-store'
import type {
  ChatSession,
  ChatSessionDetail,
  MessageFeedback,
  PaginatedResponse,
  QueryHistoryItem,
  SavedSearch,
  SSEEvent,
} from './types'

export const chatApi = {
  getSessions: async (): Promise<PaginatedResponse<ChatSession>> => {
    const { data } = await api.get('/chat/sessions/')
    return data
  },

  createSession: async (): Promise<ChatSession> => {
    const { data } = await api.post('/chat/sessions/')
    return data
  },

  getSession: async (id: string): Promise<ChatSessionDetail> => {
    const { data } = await api.get(`/chat/sessions/${id}/`)
    return data
  },

  deleteSession: async (id: string): Promise<void> => {
    await api.delete(`/chat/sessions/${id}/`)
  },

  sendMessage: async function* (
    sessionId: string,
    content: string,
    collection?: string
  ): AsyncGenerator<SSEEvent> {
    const token = useAuthStore.getState().accessToken
    const baseUrl = import.meta.env.VITE_API_URL || '/api'

    const response = await fetch(`${baseUrl}/chat/sessions/${sessionId}/messages/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content, collection }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }))
      throw new Error(error.detail || 'Failed to send message')
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data: ')) {
          try {
            const event: SSEEvent = JSON.parse(trimmed.slice(6))
            yield event
          } catch {
            // Skip malformed events
          }
        }
      }
    }
  },

  submitFeedback: async (
    messageId: string,
    isHelpful: boolean,
    comment?: string
  ): Promise<MessageFeedback> => {
    const { data } = await api.post(`/chat/messages/${messageId}/feedback/`, {
      is_helpful: isHelpful,
      comment: comment || '',
    })
    return data
  },

  toggleFavorite: async (messageId: string): Promise<{ is_favorite: boolean }> => {
    const { data } = await api.post(`/chat/messages/${messageId}/favorite/`)
    return data
  },

  // Phase 3: Query History
  getQueryHistory: async (params?: {
    search?: string
    date_from?: string
    date_to?: string
    session?: string
    favorites?: string
    page?: number
  }): Promise<PaginatedResponse<QueryHistoryItem>> => {
    const { data } = await api.get('/chat/history/', { params })
    return data
  },

  // Phase 3: Saved Searches
  getSavedSearches: async (): Promise<PaginatedResponse<SavedSearch>> => {
    const { data } = await api.get('/chat/saved-searches/')
    return data
  },

  createSavedSearch: async (name: string, query: string, collection?: string): Promise<SavedSearch> => {
    const { data } = await api.post('/chat/saved-searches/', {
      name,
      query,
      collection: collection || 'default',
    })
    return data
  },

  deleteSavedSearch: async (id: string): Promise<void> => {
    await api.delete(`/chat/saved-searches/${id}/`)
  },

  // Phase 3: Export
  exportChat: async (sessionId: string, format: 'json' | 'markdown' = 'json'): Promise<Blob> => {
    const { data } = await api.get(`/chat/export/session/${sessionId}/`, {
      params: { format },
      responseType: 'blob',
    })
    return data
  },

  exportDocuments: async (): Promise<Blob> => {
    const { data } = await api.get('/chat/export/documents/', {
      responseType: 'blob',
    })
    return data
  },
}
