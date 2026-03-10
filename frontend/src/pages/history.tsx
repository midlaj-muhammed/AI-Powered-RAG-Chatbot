import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Clock,
  Star,
  Bookmark,
  BookmarkPlus,
  Download,
  Trash2,
  MessageSquare,
  Zap,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  CalendarDays,
} from 'lucide-react'
import { chatApi } from '@/api/chat'
import { documentsApi } from '@/api/documents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import type { QueryHistoryItem, SavedSearch } from '@/api/types'

export function HistoryPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [activeTab, setActiveTab] = useState<'history' | 'saved'>('history')
  const [saveName, setSaveName] = useState('')
  const [saveQuery, setSaveQuery] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Query History
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['queryHistory', search, dateFrom, dateTo, favoritesOnly, page],
    queryFn: () =>
      chatApi.getQueryHistory({
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        favorites: favoritesOnly ? 'true' : undefined,
        page,
      }),
    enabled: activeTab === 'history',
  })

  // Saved Searches
  const { data: savedData, isLoading: savedLoading } = useQuery({
    queryKey: ['savedSearches'],
    queryFn: () => chatApi.getSavedSearches(),
    enabled: activeTab === 'saved',
  })

  // Collections for saved searches
  const { data: collections } = useQuery({
    queryKey: ['collections'],
    queryFn: () => documentsApi.getCollections(),
  })

  // Mutations
  const createSavedSearch = useMutation({
    mutationFn: (data: { name: string; query: string; collection?: string }) =>
      chatApi.createSavedSearch(data.name, data.query, data.collection),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedSearches'] })
      setShowSaveForm(false)
      setSaveName('')
      setSaveQuery('')
    },
  })

  const deleteSavedSearch = useMutation({
    mutationFn: (id: string) => chatApi.deleteSavedSearch(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['savedSearches'] }),
  })

  const clearFilters = () => {
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setFavoritesOnly(false)
    setPage(1)
  }

  const handleSaveFromHistory = (item: QueryHistoryItem) => {
    setSaveName(item.content.slice(0, 60))
    setSaveQuery(item.content)
    setShowSaveForm(true)
    setActiveTab('saved')
  }

  const handleRunSaved = (saved: SavedSearch) => {
    navigate('/chat')
  }

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportChat = async (sessionId: string, format: 'json' | 'markdown') => {
    const blob = await chatApi.exportChat(sessionId, format)
    const ext = format === 'markdown' ? 'md' : 'json'
    downloadFile(blob, `chat_export.${ext}`)
  }

  const handleExportDocs = async () => {
    const blob = await chatApi.exportDocuments()
    downloadFile(blob, 'documents_export.csv')
  }

  const hasActiveFilters = search || dateFrom || dateTo || favoritesOnly

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">History & Exports</h1>
            <p className="text-sm text-muted-foreground">
              Browse past queries, save searches, and export data
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportDocs}>
            <Download className="mr-2 h-4 w-4" />
            Export All Documents (CSV)
          </Button>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="mr-1.5 inline h-4 w-4" />
            Query History
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'saved'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Bookmark className="mr-1.5 inline h-4 w-4" />
            Saved Searches
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Search & Filter Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search past queries..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  className="pl-9"
                />
              </div>
              <Button
                variant={showFilters ? 'default' : 'outline'}
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
              </Button>
              <Button
                variant={favoritesOnly ? 'default' : 'outline'}
                size="icon"
                onClick={() => {
                  setFavoritesOnly(!favoritesOnly)
                  setPage(1)
                }}
                title="Show favorites only"
              >
                <Star className="h-4 w-4" />
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="flex gap-4 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm text-muted-foreground">From:</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value)
                      setPage(1)
                    }}
                    className="rounded-md border border-input bg-background px-3 py-1 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">To:</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value)
                      setPage(1)
                    }}
                    className="rounded-md border border-input bg-background px-3 py-1 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Results */}
            {historyLoading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : !historyData?.results?.length ? (
              <div className="py-12 text-center text-muted-foreground">
                <Clock className="mx-auto mb-3 h-12 w-12 opacity-30" />
                <p className="text-lg font-medium">No queries found</p>
                <p className="text-sm">
                  {hasActiveFilters
                    ? 'Try adjusting your filters'
                    : 'Start chatting to build your query history'}
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {historyData.count} {historyData.count === 1 ? 'query' : 'queries'} found
                </p>

                <div className="space-y-2">
                  {historyData.results.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-border bg-card transition-colors hover:bg-accent/30"
                    >
                      {/* Main row */}
                      <div
                        className="flex cursor-pointer items-center gap-3 p-4"
                        onClick={() =>
                          setExpandedId(expandedId === item.id ? null : item.id)
                        }
                      >
                        <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {item.content}
                          </p>
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{new Date(item.created_at).toLocaleString()}</span>
                            <span>•</span>
                            <span>{item.session_title}</span>
                            {item.ai_response && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Zap className="h-3 w-3" />
                                  {item.ai_response.latency_ms}ms
                                </span>
                                {item.ai_response.confidence_score !== null && (
                                  <Badge
                                    variant={
                                      item.ai_response.confidence_score >= 0.7
                                        ? 'default'
                                        : 'secondary'
                                    }
                                    className="text-xs"
                                  >
                                    {Math.round(
                                      item.ai_response.confidence_score * 100
                                    )}
                                    %
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSaveFromHistory(item)
                            }}
                            title="Save this search"
                          >
                            <BookmarkPlus className="h-3.5 w-3.5" />
                          </Button>
                          {expandedId === item.id ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {expandedId === item.id && item.ai_response && (
                        <div className="border-t border-border bg-muted/30 px-4 py-3">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            AI Response Preview
                          </p>
                          <p className="text-sm">
                            {item.ai_response.content_preview}
                          </p>
                          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                            <span>
                              {item.ai_response.tokens_used} tokens
                            </span>
                            <span>
                              {item.ai_response.sources_count} sources
                            </span>
                            <div className="ml-auto flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() =>
                                  handleExportChat(item.session, 'json')
                                }
                              >
                                <Download className="mr-1 h-3 w-3" />
                                JSON
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() =>
                                  handleExportChat(item.session, 'markdown')
                                }
                              >
                                <Download className="mr-1 h-3 w-3" />
                                Markdown
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {historyData.count > 20 && (
                  <div className="flex items-center justify-between pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!historyData.previous}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {Math.ceil(historyData.count / 20)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!historyData.next}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="space-y-4">
            {/* Save form */}
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => setShowSaveForm(!showSaveForm)}
              >
                <BookmarkPlus className="mr-2 h-4 w-4" />
                New Saved Search
              </Button>
            </div>

            {showSaveForm && (
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <Input
                  placeholder="Search name"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                />
                <Input
                  placeholder="Query text"
                  value={saveQuery}
                  onChange={(e) => setSaveQuery(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSaveForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!saveName || !saveQuery}
                    onClick={() =>
                      createSavedSearch.mutate({
                        name: saveName,
                        query: saveQuery,
                      })
                    }
                  >
                    Save
                  </Button>
                </div>
              </div>
            )}

            {/* Saved list */}
            {savedLoading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : !savedData?.results?.length ? (
              <div className="py-12 text-center text-muted-foreground">
                <Bookmark className="mx-auto mb-3 h-12 w-12 opacity-30" />
                <p className="text-lg font-medium">No saved searches</p>
                <p className="text-sm">
                  Save frequently used queries for quick access
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {savedData.results.map((saved) => (
                  <div
                    key={saved.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/30"
                  >
                    <Bookmark className="h-4 w-4 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{saved.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {saved.query}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Saved {new Date(saved.created_at).toLocaleDateString()}
                        {saved.collection !== 'default' && (
                          <span> · Collection: {saved.collection}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleRunSaved(saved)}
                      >
                        <MessageSquare className="mr-1 h-3 w-3" />
                        Run
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteSavedSearch.mutate(saved.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
