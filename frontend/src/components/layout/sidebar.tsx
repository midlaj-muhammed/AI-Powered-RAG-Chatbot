import { Link, useLocation } from 'react-router-dom'
import {
  MessageSquare,
  FileText,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  User,
  Users,
  History,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useChatStore } from '@/stores/chat-store'
import { Button } from '@/components/ui/button'
import { authApi } from '@/api/auth'
import { useQuery } from '@tanstack/react-query'
import { documentsApi } from '@/api/documents'

const navItems = [
  { path: '/chat', label: 'Chat', icon: MessageSquare },
  { path: '/documents', label: 'Documents', icon: FileText },
  { path: '/history', label: 'History', icon: History },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/users', label: 'Users', icon: Users, adminOnly: true },
]

export function Sidebar() {
  const location = useLocation()
  const { user, refreshToken, logout } = useAuthStore()
  const { sidebarOpen, toggleSidebar } = useChatStore()

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken)
    } finally {
      logout()
    }
  }

  const { data: docsData } = useQuery({
    queryKey: ['documents', 'sidebar-status'],
    queryFn: () => documentsApi.getDocuments({ page: 1 }),
    refetchInterval: (query) => {
      const hasProcessing = (query.state.data as any)?.results?.some(
        (doc: any) => doc.status === 'pending' || doc.status === 'processing'
      )
      return hasProcessing ? 5000 : 60000
    },
    staleTime: 0,
    enabled: !!user,
  })

  const processingCount = docsData?.results?.filter(
    (d: any) => d.status === 'pending' || d.status === 'processing'
  ).length || 0

  return (
    <aside
      role="navigation"
      aria-label="Main navigation"
      className={cn(
        'flex flex-col border-r border-border bg-card transition-all duration-300',
        sidebarOpen ? 'w-60' : 'w-14'
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-3">
        {sidebarOpen && (
          <Link to="/chat" className="flex items-center gap-2" aria-label="RAG Chatbot – go to chat">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <MessageSquare className="h-4 w-4 text-white" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold">RAG Chatbot</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={sidebarOpen}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeft className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2" aria-label="Primary">
        {navItems
          .filter((item) => !('adminOnly' in item && item.adminOnly) || user?.role === 'admin')
          .map((item) => {
            const isActive = location.pathname.startsWith(item.path)
            const Icon = item.icon
            const isDocPage = item.path === '/documents'

            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                aria-label={!sidebarOpen ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors relative group',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {sidebarOpen && <span className="flex-1">{item.label}</span>}

                {/* Processing indicator */}
                {isDocPage && processingCount > 0 && (
                  <div className={cn(
                    "flex items-center justify-center rounded-full bg-primary/20",
                    sidebarOpen ? "px-1.5 py-0.5" : "absolute top-1 right-1 w-2 h-2"
                  )}>
                    {sidebarOpen ? (
                      <>
                        <Loader2 className="h-2.5 w-2.5 animate-spin mr-1 text-primary" />
                        <span className="text-[10px] font-bold text-primary">{processingCount}</span>
                      </>
                    ) : (
                      <div className="w-full h-full rounded-full bg-primary animate-pulse" />
                    )}
                  </div>
                )}
              </Link>
            )
          })}
      </nav>

      {/* User section */}
      <div className="border-t border-border p-2">
        {sidebarOpen && user && (
          <div className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2" aria-label={`Signed in as ${user.first_name || user.email}, role: ${user.role}`}>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20">
              <User className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{user.first_name || user.email}</p>
              <p className="truncate text-xs text-muted-foreground">{user.role}</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size={sidebarOpen ? 'default' : 'icon'}
          className={cn('w-full text-muted-foreground hover:text-destructive', !sidebarOpen && 'justify-center')}
          onClick={handleLogout}
          aria-label="Log out"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {sidebarOpen && <span>Logout</span>}
        </Button>
      </div>
    </aside>
  )
}
