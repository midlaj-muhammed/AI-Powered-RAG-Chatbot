import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Upload,
  FileText,
  Trash2,
  Download,
  Search,
  Grid,
  List,
  Plus,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  FolderOpen,
  RefreshCw,
  ChevronRight,
  Info,
  Tag,
} from 'lucide-react'
import { cn, formatFileSize, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { toastError } from '@/components/ui/toast'
import { documentsApi } from '@/api/documents'
import { adminApi } from '@/api/admin'
import type { Document, Collection } from '@/api/types'

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, variant: 'warning' as const },
  processing: { label: 'Processing', icon: Loader2, variant: 'default' as const },
  indexed: { label: 'Indexed', icon: CheckCircle2, variant: 'success' as const },
  error: { label: 'Error', icon: AlertCircle, variant: 'destructive' as const },
}

const mimeIcons: Record<string, string> = {
  'application/pdf': '📄',
  'text/plain': '📝',
  'text/markdown': '📝',
  'text/csv': '📊',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📘',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
}

export function DocumentsPage() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [collectionFilter, setCollectionFilter] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showNewCollection, setShowNewCollection] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')

  const { data: docsData, isLoading } = useQuery({
    queryKey: ['documents', search, statusFilter, collectionFilter],
    queryFn: () =>
      documentsApi.getDocuments({
        search: search || undefined,
        status: statusFilter || undefined,
        collection: collectionFilter || undefined,
      }),
  })

  const { data: collections } = useQuery({
    queryKey: ['collections'],
    queryFn: documentsApi.getCollections,
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsApi.uploadDocument(file, collectionFilter || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      setShowUpload(false)
    },
    onError: (error: any) => {
      // Extract and display the actual error message
      const errorMessage = error.response?.data?.detail ||
                          error.response?.data?.file?.[0] ||
                          error.response?.data?.message ||
                          error.message ||
                          'Upload failed. Please try again.'
      toastError(errorMessage)
      console.error('Upload error:', error.response?.data || error)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      setSelectedDoc(null)
    },
  })

  const reprocessMutation = useMutation({
    mutationFn: (id: string) => adminApi.reprocessDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  const bulkMutation = useMutation({
    mutationFn: ({ action, ids }: { action: 'delete' | 'reprocess'; ids: string[] }) =>
      adminApi.bulkAction(action, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      setSelectedIds(new Set())
    },
  })

  const createCollectionMutation = useMutation({
    mutationFn: (name: string) => documentsApi.createCollection(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      setShowNewCollection(false)
      setNewCollectionName('')
    },
  })

  const deleteCollectionMutation = useMutation({
    mutationFn: (id: string) => documentsApi.deleteCollection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      if (collectionFilter === '') return
      setCollectionFilter('')
    },
  })

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const files = Array.from(e.dataTransfer.files)
      files.forEach((file) => uploadMutation.mutate(file))
    },
    [uploadMutation]
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach((file) => uploadMutation.mutate(file))
    e.target.value = ''
  }

  const handleDownload = async (doc: Document) => {
    try {
      const blob = await documentsApi.downloadDocument(doc.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.original_name
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // handle error
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const documents = docsData?.results || []

  return (
    <div className="flex h-full">
      {/* Left: Collections sidebar */}
      <div className="w-52 shrink-0 border-r border-border bg-card/50 flex flex-col">
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Collections</span>
          <button
            onClick={() => setShowNewCollection(!showNewCollection)}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {showNewCollection && (
          <div className="px-3 py-2 border-b border-border">
            <Input
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder="Collection name"
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCollectionName.trim()) {
                  createCollectionMutation.mutate(newCollectionName.trim())
                }
              }}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          <button
            onClick={() => setCollectionFilter('')}
            className={cn(
              'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors',
              collectionFilter === ''
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            All Documents
          </button>
          {collections?.map((col) => (
            <div key={col.id} className="group flex items-center">
              <button
                onClick={() => setCollectionFilter(col.id === collectionFilter ? '' : col.id)}
                className={cn(
                  'flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors text-left',
                  collectionFilter === col.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: col.color }} />
                <span className="truncate">{col.name}</span>
                <span className="ml-auto text-[10px] opacity-60">{col.document_count}</span>
              </button>
              <button
                onClick={() => deleteCollectionMutation.mutate(col.id)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">Documents</h1>
              <p className="text-sm text-muted-foreground">
                Upload and manage your knowledge base documents
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() =>
                      bulkMutation.mutate({
                        action: 'reprocess',
                        ids: Array.from(selectedIds),
                      })
                    }
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reprocess ({selectedIds.size})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs text-destructive hover:text-destructive"
                    onClick={() =>
                      bulkMutation.mutate({
                        action: 'delete',
                        ids: Array.from(selectedIds),
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete ({selectedIds.size})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear
                  </Button>
                </>
              )}
              <Button onClick={() => setShowUpload(!showUpload)} className="gap-2">
                <Upload className="h-4 w-4" />
                Upload
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="indexed">Indexed</option>
              <option value="error">Error</option>
            </select>
            <div className="flex rounded-lg border border-border">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'grid' ? 'bg-accent text-foreground' : 'text-muted-foreground'
                )}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'list' ? 'bg-accent text-foreground' : 'text-muted-foreground'
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Upload zone */}
        {showUpload && (
          <div
            className={cn(
              'mx-6 mt-4 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground'
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              Drag & drop files here, or{' '}
              <label className="cursor-pointer text-primary hover:underline">
                browse
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept=".pdf,.txt,.md,.csv,.docx,.xlsx"
                  onChange={handleFileSelect}
                />
              </label>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, DOCX, TXT, MD, CSV, XLSX — Max 50MB per file
            </p>
            {uploadMutation.isPending && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <Spinner className="h-4 w-4" />
                <span className="text-sm text-muted-foreground">Uploading...</span>
              </div>
            )}
            {uploadMutation.isError && (
              <p className="mt-3 text-sm text-destructive">
                Upload failed. Please try again.
              </p>
            )}
          </div>
        )}

        {/* Document list */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <FileText className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                No documents found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload your first document to get started
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  isSelected={selectedIds.has(doc.id)}
                  onSelect={() => toggleSelect(doc.id)}
                  onDelete={() => deleteMutation.mutate(doc.id)}
                  onDownload={() => handleDownload(doc)}
                  onDetail={() => setSelectedDoc(doc)}
                  onReprocess={() => reprocessMutation.mutate(doc.id)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  isSelected={selectedIds.has(doc.id)}
                  onSelect={() => toggleSelect(doc.id)}
                  onDelete={() => deleteMutation.mutate(doc.id)}
                  onDownload={() => handleDownload(doc)}
                  onDetail={() => setSelectedDoc(doc)}
                  onReprocess={() => reprocessMutation.mutate(doc.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedDoc && (
        <DocumentDetailPanel
          document={selectedDoc}
          collections={collections || []}
          onClose={() => setSelectedDoc(null)}
          onReprocess={() => reprocessMutation.mutate(selectedDoc.id)}
          onDelete={() => deleteMutation.mutate(selectedDoc.id)}
        />
      )}
    </div>
  )
}

function DocumentCard({
  document: doc,
  isSelected,
  onSelect,
  onDelete,
  onDownload,
  onDetail,
  onReprocess,
}: {
  document: Document
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  onDownload: () => void
  onDetail: () => void
  onReprocess: () => void
}) {
  const status = statusConfig[doc.status]
  const StatusIcon = status.icon

  return (
    <div
      className={cn(
        'group rounded-xl border bg-card p-4 transition-colors cursor-pointer',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-muted-foreground/30'
      )}
      onClick={onDetail}
    >
      {/* Selection checkbox + File icon + name */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 h-3.5 w-3.5 rounded border-input accent-primary"
        />
        <span className="text-2xl">{mimeIcons[doc.mime_type] || '📄'}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={doc.original_name}>
            {doc.original_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(doc.file_size)}
          </p>
        </div>
      </div>

      {/* Status */}
      <div className="mt-3 flex items-center gap-2">
        <Badge variant={status.variant}>
          <StatusIcon
            className={cn(
              'mr-1 h-3 w-3',
              doc.status === 'processing' && 'animate-spin'
            )}
          />
          {status.label}
        </Badge>
        {doc.collection_name && (
          <Badge variant="outline">{doc.collection_name}</Badge>
        )}
      </div>

      {/* Tags */}
      {doc.tags && doc.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {doc.tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px]"
              style={{ backgroundColor: tag.color + '20', color: tag.color }}
            >
              <Tag className="h-2 w-2" />
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Error message */}
      {doc.error_message && (
        <p className="mt-2 text-xs text-destructive line-clamp-2">
          {doc.error_message}
        </p>
      )}

      {/* Date + actions */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {formatDate(doc.created_at)}
        </span>
        <div
          className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {doc.status === 'error' && (
            <button
              onClick={onReprocess}
              className="rounded p-1 text-muted-foreground hover:text-primary"
              title="Reprocess"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onDownload}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function DocumentRow({
  document: doc,
  isSelected,
  onSelect,
  onDelete,
  onDownload,
  onDetail,
  onReprocess,
}: {
  document: Document
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  onDownload: () => void
  onDetail: () => void
  onReprocess: () => void
}) {
  const status = statusConfig[doc.status]
  const StatusIcon = status.icon

  return (
    <div
      className={cn(
        'group flex items-center gap-4 rounded-lg border bg-card px-4 py-3 transition-colors cursor-pointer',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-muted-foreground/30'
      )}
      onClick={onDetail}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        onClick={(e) => e.stopPropagation()}
        className="h-3.5 w-3.5 rounded border-input accent-primary"
      />
      <span className="text-lg">{mimeIcons[doc.mime_type] || '📄'}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{doc.original_name}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(doc.file_size)} · {formatDate(doc.created_at)}
        </p>
      </div>
      {doc.collection_name && (
        <Badge variant="outline" className="text-xs">
          {doc.collection_name}
        </Badge>
      )}
      <Badge variant={status.variant}>
        <StatusIcon
          className={cn('mr-1 h-3 w-3', doc.status === 'processing' && 'animate-spin')}
        />
        {status.label}
      </Badge>
      <div
        className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        {doc.status === 'error' && (
          <button
            onClick={onReprocess}
            className="rounded p-1.5 text-muted-foreground hover:text-primary"
            title="Reprocess"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={onDownload}
          className="rounded p-1.5 text-muted-foreground hover:text-foreground"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          className="rounded p-1.5 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
    </div>
  )
}

/* ── Document Detail Panel ────────────────────────────────────────── */

function DocumentDetailPanel({
  document: doc,
  collections,
  onClose,
  onReprocess,
  onDelete,
}: {
  document: Document
  collections: Collection[]
  onClose: () => void
  onReprocess: () => void
  onDelete: () => void
}) {
  const status = statusConfig[doc.status]
  const StatusIcon = status.icon
  const metadata = doc.metadata || {}

  return (
    <div className="w-80 shrink-0 border-l border-border bg-card overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Details</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-accent">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* File info */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{mimeIcons[doc.mime_type] || '📄'}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium break-words">{doc.original_name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</p>
            </div>
          </div>
          <Badge variant={status.variant} className="mt-1">
            <StatusIcon className={cn('mr-1 h-3 w-3', doc.status === 'processing' && 'animate-spin')} />
            {status.label}
          </Badge>
        </div>

        {/* Error */}
        {doc.error_message && (
          <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
            {doc.error_message}
          </div>
        )}

        {/* Metadata */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Metadata
          </h4>
          <div className="space-y-1.5 text-xs">
            <MetadataRow label="Type" value={doc.mime_type.split('/').pop() || 'unknown'} />
            <MetadataRow label="Uploaded by" value={doc.uploaded_by_email} />
            <MetadataRow label="Uploaded" value={new Date(doc.created_at).toLocaleDateString()} />
            {doc.indexed_at && (
              <MetadataRow label="Indexed" value={new Date(doc.indexed_at).toLocaleDateString()} />
            )}
            {metadata.title && <MetadataRow label="Title" value={String(metadata.title)} />}
            {metadata.author && <MetadataRow label="Author" value={String(metadata.author)} />}
            {metadata.word_count && (
              <MetadataRow label="Words" value={String(metadata.word_count)} />
            )}
            {metadata.language && (
              <MetadataRow label="Language" value={String(metadata.language)} />
            )}
          </div>
        </div>

        {/* Summary */}
        {metadata.summary_preview && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Summary
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {String(metadata.summary_preview)}
            </p>
          </div>
        )}

        {/* Topics */}
        {metadata.detected_topics && Array.isArray(metadata.detected_topics) && metadata.detected_topics.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Topics
            </h4>
            <div className="flex flex-wrap gap-1">
              {(metadata.detected_topics as string[]).map((topic) => (
                <Badge key={topic} variant="secondary" className="text-[10px]">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {doc.tags && doc.tags.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Tags
            </h4>
            <div className="flex flex-wrap gap-1">
              {doc.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px]"
                  style={{ backgroundColor: tag.color + '20', color: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Collection */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Collection
          </h4>
          <p className="text-xs">{doc.collection_name || 'None'}</p>
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-border space-y-2">
          {(doc.status === 'error' || doc.status === 'indexed') && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 text-xs"
              onClick={onReprocess}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reprocess Document
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Document
          </Button>
        </div>
      </div>
    </div>
  )
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right truncate" title={value}>{value}</span>
    </div>
  )
}
