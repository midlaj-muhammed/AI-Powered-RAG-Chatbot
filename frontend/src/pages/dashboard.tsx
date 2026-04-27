import { useQuery } from '@tanstack/react-query'
import {
  FileText,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  Users,
  Zap,
  Clock,
  BarChart3,
} from 'lucide-react'
import { PageLoader } from '@/components/ui/spinner'
import api from '@/api/client'
import { adminApi } from '@/api/admin'
import type {
  DashboardOverview,
} from '@/api/types'

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async (): Promise<DashboardOverview> => {
      const { data } = await api.get('/admin-panel/dashboard/')
      return data
    },
    refetchInterval: (query) => {
      const data = query.state.data as DashboardOverview | undefined
      const hasProcessing = data && (data.documents.processing > 0 || data.documents.pending > 0)
      return hasProcessing ? 5000 : 30000
    },
    staleTime: 0,
  })

  const { data: usage } = useQuery({
    queryKey: ['usage-timeline'],
    queryFn: () => adminApi.getUsageTimeline(30),
  })

  const { data: queryAnalytics } = useQuery({
    queryKey: ['query-analytics'],
    queryFn: adminApi.getQueryAnalytics,
  })

  const { data: topDocs } = useQuery({
    queryKey: ['top-documents'],
    queryFn: adminApi.getTopDocuments,
  })

  if (isLoading) {
    return <PageLoader title="Fetching Analytics..." subtitle="Gathering latest system insights" />
  }

  if (error && (error as any).response?.status === 403) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-destructive/10 text-destructive mb-6">
          <Zap className="h-10 w-10" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Dashboard Restricted</h2>
        <p className="max-w-xs text-sm text-muted-foreground leading-relaxed">
          The Analytics Dashboard is reserved for Administrative personnel.
          Please use the Chat or Documents sections for standard tasks.
        </p>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">System overview and analytics</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileText}
          label="Total Documents"
          value={data.documents.total}
          subtext={`${data.documents.indexed} indexed · ${data.documents.total_chunks} chunks`}
          color="text-blue-400"
        />
        <StatCard
          icon={MessageSquare}
          label="Chat Sessions"
          value={data.chat.total_sessions}
          subtext={`${data.chat.total_messages} messages`}
          color="text-purple-400"
        />
        <StatCard
          icon={Users}
          label="Active Users (7d)"
          value={data.chat.active_users_7d}
          subtext="Unique users this week"
          color="text-cyan-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Confidence"
          value={`${Math.round(data.quality.avg_confidence * 100)}%`}
          subtext={`${data.quality.total_feedback} feedback received`}
          color="text-green-400"
        />
      </div>

      {/* Row 2: Usage timeline + Query performance */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Usage Timeline */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Messages (Last 30 Days)</h3>
          </div>
          {usage?.messages && usage.messages.length > 0 ? (
            <MiniBarChart data={usage.messages} colorClass="bg-purple-500" />
          ) : (
            <EmptyChart label="No message data yet" />
          )}
        </div>

        {/* Query Performance */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Query Performance</h3>
          </div>
          {queryAnalytics ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <MetricBlock
                  label="Avg Latency"
                  value={`${Math.round(queryAnalytics.averages.latency_ms)}ms`}
                />
                <MetricBlock
                  label="Avg Tokens"
                  value={Math.round(queryAnalytics.averages.tokens_used).toString()}
                />
                <MetricBlock
                  label="Total Tokens"
                  value={formatNumber(queryAnalytics.averages.total_tokens)}
                />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Confidence Distribution
                </p>
                <div className="flex items-end gap-1 h-16">
                  {queryAnalytics.confidence_distribution.map((bin) => {
                    const maxCount = Math.max(
                      ...queryAnalytics.confidence_distribution.map((b) => b.count),
                      1
                    )
                    const height = (bin.count / maxCount) * 100
                    return (
                      <div key={bin.range} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t bg-green-500/70 transition-all min-h-[2px]"
                          style={{ height: `${Math.max(height, 3)}%` }}
                          title={`${bin.range}: ${bin.count}`}
                        />
                        <span className="text-[10px] text-muted-foreground">{bin.range}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <EmptyChart label="No query data yet" />
          )}
        </div>
      </div>

      {/* Row 3: Document status, Top docs, Feedback */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Document Status */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Document Status</h3>
          <div className="space-y-2">
            <StatusRow label="Indexed" value={data.documents.indexed} color="bg-emerald-500" />
            <StatusRow label="Processing" value={data.documents.processing} color="bg-blue-500" />
            <StatusRow label="Pending" value={data.documents.pending} color="bg-amber-500" />
            <StatusRow label="Error" value={data.documents.error} color="bg-red-500" />
          </div>
          <div className="mt-3 pt-3 border-t border-border flex justify-between text-xs text-muted-foreground">
            <span>{data.documents.total_chunks} chunks</span>
            <span>{formatNumber(data.documents.total_tokens)} tokens</span>
          </div>
        </div>

        {/* Top Referenced Documents */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Top Documents</h3>
          {topDocs?.top_documents && topDocs.top_documents.length > 0 ? (
            <div className="space-y-2">
              {topDocs.top_documents.slice(0, 5).map((doc, i) => (
                <div key={doc.document_name} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-sm truncate flex-1" title={doc.document_name}>
                    {doc.document_name}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">
                    {doc.reference_count}x
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No references yet
            </p>
          )}
        </div>

        {/* Feedback Summary */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Feedback Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <ThumbsUp className="h-4 w-4 text-emerald-500" />
              <div className="flex-1">
                <div className="flex justify-between text-sm">
                  <span>Helpful</span>
                  <span className="font-medium">{data.quality.helpful}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: data.quality.total_feedback > 0
                        ? `${(data.quality.helpful / data.quality.total_feedback) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThumbsDown className="h-4 w-4 text-red-500" />
              <div className="flex-1">
                <div className="flex justify-between text-sm">
                  <span>Not Helpful</span>
                  <span className="font-medium">{data.quality.not_helpful}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-500 transition-all"
                    style={{
                      width: data.quality.total_feedback > 0
                        ? `${(data.quality.not_helpful / data.quality.total_feedback) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border text-center">
            <span className="text-xs text-muted-foreground">
              {data.quality.total_feedback} total responses
            </span>
          </div>
        </div>
      </div>

      {/* Slow queries table */}
      {queryAnalytics?.slow_queries && queryAnalytics.slow_queries.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Slow Queries (&gt;5s)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4">Latency</th>
                  <th className="pb-2 pr-4">Tokens</th>
                  <th className="pb-2 pr-4">Confidence</th>
                  <th className="pb-2">When</th>
                </tr>
              </thead>
              <tbody>
                {queryAnalytics.slow_queries.map((q) => (
                  <tr key={q.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4 font-medium text-amber-500">
                      {(q.latency_ms / 1000).toFixed(1)}s
                    </td>
                    <td className="py-2 pr-4">{q.tokens_used}</td>
                    <td className="py-2 pr-4">
                      {q.confidence_score != null
                        ? `${Math.round(q.confidence_score * 100)}%`
                        : '—'}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(q.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Helper Components ────────────────────────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  subtext: string
  color: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{subtext}</p>
    </div>
  )
}

function StatusRow({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2.5 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}

function MiniBarChart({
  data,
  colorClass = 'bg-primary',
}: {
  data: { date: string; total: number }[]
  colorClass?: string
}) {
  const maxVal = Math.max(...data.map((d) => d.total), 1)

  return (
    <div className="flex items-end gap-[3px] h-24">
      {data.map((d) => {
        const height = (d.total / maxVal) * 100
        return (
          <div
            key={d.date}
            className="flex-1 flex flex-col items-center gap-1 group relative"
          >
            <div
              className={`w-full rounded-t ${colorClass} opacity-80 hover:opacity-100 transition-all min-h-[2px]`}
              style={{ height: `${Math.max(height, 3)}%` }}
            />
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-popover border border-border rounded px-2 py-1 text-[10px] whitespace-nowrap shadow-lg z-10">
              {d.total} · {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
      {label}
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}
