import api from './client'
import type {
  Collection,
  Document,
  PaginatedResponse,
} from './types'

export const documentsApi = {
  getDocuments: async (params?: {
    collection?: string
    status?: string
    search?: string
    page?: number
  }): Promise<PaginatedResponse<Document>> => {
    const { data } = await api.get('/documents/', { params })
    return data
  },

  getDocument: async (id: string): Promise<Document> => {
    const { data } = await api.get(`/documents/${id}/`)
    return data
  },

  uploadDocument: async (
    file: File,
    collectionId?: string
  ): Promise<Document> => {
    const formData = new FormData()
    formData.append('file', file)
    if (collectionId) formData.append('collection', collectionId)

    const { data } = await api.post('/documents/upload/', formData, {
      headers: {
        // Let browser set Content-Type with boundary automatically
        'Content-Type': undefined,
      },
    })
    return data
  },

  deleteDocument: async (id: string): Promise<void> => {
    await api.delete(`/documents/${id}/`)
  },

  downloadDocument: async (id: string): Promise<Blob> => {
    const { data } = await api.get(`/documents/${id}/download/`, {
      responseType: 'blob',
    })
    return data
  },

  // Collections
  getCollections: async (): Promise<Collection[]> => {
    const { data } = await api.get('/documents/collections/')
    return Array.isArray(data) ? data : data.results ?? []
  },

  createCollection: async (name: string, description?: string, color?: string): Promise<Collection> => {
    const { data } = await api.post('/documents/collections/', {
      name,
      description: description || '',
      color: color || '#3B82F6',
    })
    return data
  },

  deleteCollection: async (id: string): Promise<void> => {
    await api.delete(`/documents/collections/${id}/`)
  },
}
