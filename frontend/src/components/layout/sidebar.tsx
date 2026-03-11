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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useChatStore } from '@/stores/chat-store'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { documentsApi } from '@/api/documents'
import type { Document as AIDocument } from '@/api/types'

export function Sidebar() {
  const location = useLocation()
  const { logout } = useAuthStore()
  const { sidebarOpen, toggleSidebar } = useChatStore()

  const handleLogout = () => {
    logout()
  }

  const { data: docsData } = useQuery({
    queryKey: ['documents', 'sidebar-status'],
    queryFn: () => documentsApi.getDocuments({ page: 1 }),
    refetchInterval: (query) => {
      const data = query.state.data as { results?: AIDocument[] }
      const hasProcessing = data?.results?.some(
        (doc: AIDocument) => doc.status === 'pending' || doc.status === 'processing'
      )
      return hasProcessing ? 5000 : 60000
    },
    staleTime: 0,
  })

  const processingCount = docsData?.results?.filter(
    (d: AIDocument) => d.status === 'pending' || d.status === 'processing'
  ).length || 0

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Chat',
      href: '/chat',
      icon: MessageSquare,
    },
    {
      label: 'Documents',
      href: '/documents',
      icon: FileText,
      badge: processingCount > 0 ? processingCount : undefined,
    },
    {
      label: 'Members',
      href: '/members',
      icon: Users,
    },
  ]

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
        <Link to="/" className={cn('flex items-center gap-2 font-semibold', !sidebarOpen && 'hidden')}>
          <MessageSquare className="h-6 w-6 text-primary" />
          <span>NexusAI</span>
        </Link>
        {!sidebarOpen && (
          <Link to="/" className="mx-auto">
            <MessageSquare className="h-6 w-6 text-primary" />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn('h-8 w-8', !sidebarOpen && 'mx-auto')}
        >
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="grid gap-1 px-2">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                  location.pathname === item.href ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
                  !sidebarOpen && 'justify-center px-2'
                )}
              >
                <item.icon className="h-5 w-5" />
                {sidebarOpen && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2">
        <div className="grid gap-1">
          <Link
            to="/profile"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              !sidebarOpen && 'justify-center px-2'
            )}
          >
            <User className="h-5 w-5" />
            {sidebarOpen && <span>Profile</span>}
          </Link>
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              !sidebarOpen && 'justify-center px-2'
            )}
          >
            <LogOut className="h-5 w-5" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>
    </aside>
  )
}
