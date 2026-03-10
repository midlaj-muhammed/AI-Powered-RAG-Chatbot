import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users,
  Search,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  FileText,
  MessageSquare,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { adminApi } from '@/api/admin'
import { useAuthStore } from '@/stores/auth-store'
import type { AdminUser } from '@/api/types'

const roleConfig = {
  admin: { label: 'Admin', icon: ShieldAlert, variant: 'destructive' as const, color: 'text-red-400' },
  editor: { label: 'Editor', icon: ShieldCheck, variant: 'default' as const, color: 'text-blue-400' },
  viewer: { label: 'Viewer', icon: Shield, variant: 'secondary' as const, color: 'text-gray-400' },
}

export function AdminUsersPage() {
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, roleFilter],
    queryFn: () =>
      adminApi.getUsers({
        search: search || undefined,
        role: roleFilter || undefined,
      }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { role?: string; is_active?: boolean } }) =>
      adminApi.updateUser(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  const users = data?.results || []

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">User Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage user roles and access permissions
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </div>
      </div>

      {/* Users list */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Users className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">No users found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                isSelf={currentUser?.id === user.id}
                onRoleChange={(role) =>
                  updateMutation.mutate({ id: user.id, updates: { role } })
                }
                onToggleActive={() =>
                  updateMutation.mutate({
                    id: user.id,
                    updates: { is_active: !user.is_active },
                  })
                }
                isUpdating={updateMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function UserCard({
  user,
  isSelf,
  onRoleChange,
  onToggleActive,
  isUpdating,
}: {
  user: AdminUser
  isSelf: boolean
  onRoleChange: (role: string) => void
  onToggleActive: () => void
  isUpdating: boolean
}) {
  const role = roleConfig[user.role] || roleConfig.viewer
  const RoleIcon = role.icon

  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4 transition-colors',
        !user.is_active && 'opacity-60',
        isSelf && 'border-primary/30'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold',
            user.is_active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
          )}
        >
          {(user.first_name?.[0] || user.email[0]).toUpperCase()}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">
              {user.first_name} {user.last_name}
              {isSelf && (
                <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
              )}
            </p>
            <Badge variant={role.variant} className="text-[10px] gap-1">
              <RoleIcon className="h-3 w-3" />
              {role.label}
            </Badge>
            {!user.is_active && (
              <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                Deactivated
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>

          {/* Stats row */}
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {user.document_count} docs
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {user.session_count} sessions
            </span>
            <span>Joined {formatDate(user.date_joined)}</span>
            {user.last_login && (
              <span>Last login {formatDate(user.last_login)}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        {!isSelf && (
          <div className="flex items-center gap-2">
            <select
              value={user.role}
              onChange={(e) => onRoleChange(e.target.value)}
              disabled={isUpdating}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleActive}
              disabled={isUpdating}
              className={cn(
                'gap-1 text-xs h-8',
                user.is_active
                  ? 'text-destructive hover:text-destructive'
                  : 'text-emerald-500 hover:text-emerald-600'
              )}
            >
              {user.is_active ? (
                <>
                  <UserX className="h-3.5 w-3.5" />
                  Deactivate
                </>
              ) : (
                <>
                  <UserCheck className="h-3.5 w-3.5" />
                  Activate
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
