// API types matching Django backend serializers

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'editor' | 'viewer'
  full_name: string
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface LoginResponse {
  access: string
  refresh: string
  user: User
}

export interface RegisterPayload {
  email: string
  first_name: string
  last_name: string
  password: string
  password_confirm: string
}

// Chat types
export interface ChatSession {
  id: string
  title: string | null
  is_archived: boolean
  message_count: number
  last_message: { role: string; content: string; created_at: string } | null
  created_at: string
  updated_at: string
}

export interface MessageSource {
  document_name: string
  chunk_index: number
  score: number
  content_preview: string
}

export interface MessageFeedback {
  id: string
  is_helpful: boolean
  comment: string
}

export interface Attachment {
  id: string
  filename: string
  mime_type: string
  file_size: number
  file_url: string
  created_at: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: Attachment[]
  tokens_used: number | null
  latency_ms: number | null
  sources: MessageSource[]
  confidence_score: number | null
  is_favorite: boolean
  feedback: MessageFeedback | null
  created_at: string
}

export interface ChatSessionDetail extends ChatSession {
  messages: Message[]
}

// Document types
export interface Tag {
  id: string
  name: string
  color: string
}

export interface Collection {
  id: string
  name: string
  description: string
  color: string
  is_default: boolean
  document_count: number
  created_at: string
}

export interface Document {
  id: string
  original_name: string
  file_size: number
  mime_type: string
  status: 'pending' | 'processing' | 'indexed' | 'error'
  error_message: string
  metadata: Record<string, unknown>
  collection: string | null
  collection_name: string | null
  tags: Tag[]
  uploaded_by_email: string
  created_at: string
  indexed_at: string | null
}

// SSE event types (match backend pipeline.py output)
export interface SSESourcesEvent {
  type: 'sources'
  data: MessageSource[]  // backend sends 'data', not 'sources'
}

export interface SSETokenEvent {
  type: 'token'
  content: string
}

export interface SSEDoneEvent {
  type: 'done'
  message_id: string
  tokens_used: number
  latency_ms: number
  confidence: number  // backend sends 'confidence', not 'confidence_score'
}

export interface SSEErrorEvent {
  type: 'error'
  detail: string  // backend sends 'detail', not 'message'
}

export type SSEEvent = SSESourcesEvent | SSETokenEvent | SSEDoneEvent | SSEErrorEvent

// Analytics types
export interface DashboardOverview {
  documents: {
    total: number
    indexed: number
    pending: number
    processing: number
    error: number
    total_chunks: number
    total_tokens: number
  }
  chat: {
    total_sessions: number
    total_messages: number
    active_users_7d: number
  }
  quality: {
    avg_confidence: number
    total_feedback: number
    helpful: number
    not_helpful: number
  }
}

export interface UsageTimelineDay {
  date: string
  total: number
  user_msgs?: number
  ai_msgs?: number
}

export interface UsageTimeline {
  messages: UsageTimelineDay[]
  sessions: UsageTimelineDay[]
  documents: UsageTimelineDay[]
}

export interface QueryAnalytics {
  averages: {
    latency_ms: number
    tokens_used: number
    confidence: number
    total_tokens: number
  }
  confidence_distribution: { range: string; count: number }[]
  slow_queries: {
    id: string
    latency_ms: number
    tokens_used: number
    confidence_score: number | null
    created_at: string
  }[]
}

export interface TopDocumentsResponse {
  top_documents: { document_name: string; reference_count: number }[]
}

// Admin types
export interface AdminUser extends User {
  is_active: boolean
  date_joined: string
  last_login: string | null
  document_count: number
  session_count: number
}

// Paginated response
export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// Phase 3: Query History
export interface QueryHistoryItem {
  id: string
  content: string
  session: string
  session_title: string
  ai_response: {
    id: string
    content_preview: string
    confidence_score: number | null
    tokens_used: number
    latency_ms: number
    sources_count: number
  } | null
  created_at: string
}

// Phase 3: Saved Searches
export interface SavedSearch {
  id: string
  name: string
  query: string
  collection: string
  created_at: string
  updated_at: string
}
