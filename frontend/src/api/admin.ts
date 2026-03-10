import api from './client'
import type {
  AdminUser,
  PaginatedResponse,
  QueryAnalytics,
  TopDocumentsResponse,
  UsageTimeline,
} from './types'

export const adminApi = {
  // Analytics
  getUsageTimeline: async (days = 30): Promise<UsageTimeline> => {
    const { data } = await api.get('/admin-panel/analytics/usage/', { params: { days } })
    return data
  },

  getQueryAnalytics: async (): Promise<QueryAnalytics> => {
    const { data } = await api.get('/admin-panel/analytics/queries/')
    return data
  },

  getTopDocuments: async (): Promise<TopDocumentsResponse> => {
    const { data } = await api.get('/admin-panel/analytics/top-documents/')
    return data
  },

  // User management
  getUsers: async (params?: {
    role?: string
    is_active?: string
    search?: string
  }): Promise<PaginatedResponse<AdminUser>> => {
    const { data } = await api.get('/admin-panel/users/', { params })
    return data
  },

  updateUser: async (
    id: string,
    updates: { role?: string; is_active?: boolean }
  ): Promise<AdminUser> => {
    const { data } = await api.patch(`/admin-panel/users/${id}/`, updates)
    return data
  },

  // Document actions
  reprocessDocument: async (id: string): Promise<void> => {
    await api.post(`/documents/${id}/reprocess/`)
  },

  bulkAction: async (
    action: 'delete' | 'reprocess' | 'move_collection',
    documentIds: string[],
    collectionId?: string
  ): Promise<void> => {
    await api.post('/documents/bulk/', {
      action,
      document_ids: documentIds,
      collection_id: collectionId,
    })
  },

  updateDocument: async (
    id: string,
    updates: { collection?: string | null; tags?: string[] }
  ): Promise<void> => {
    await api.patch(`/documents/${id}/update/`, updates)
  },
}
