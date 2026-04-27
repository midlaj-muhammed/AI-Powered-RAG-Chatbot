import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    User as UserIcon,
    Mail,
    Shield,
    Save,
    Loader2,
    CheckCircle2,
    AlertCircle
} from 'lucide-react'
import { authApi } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { PageLoader } from '@/components/ui/spinner'
import { useAuthStore } from '@/stores/auth-store'

export function ProfilePage() {
    const queryClient = useQueryClient()
    const { setAuth } = useAuthStore()
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const { data: profile, isLoading } = useQuery({
        queryKey: ['profile'],
        queryFn: authApi.getProfile,
    })

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
    })

    // Initialize form data when profile is loaded
    useState(() => {
        if (profile) {
            setFormData({
                first_name: profile.first_name,
                last_name: profile.last_name,
            })
        }
    })

    const updateMutation = useMutation({
        mutationFn: (data: { first_name: string; last_name: string }) =>
            authApi.updateProfile(data),
        onSuccess: (updatedUser) => {
            queryClient.setQueryData(['profile'], updatedUser)
            // Update store as well if it's the current user
            const access = useAuthStore.getState().accessToken
            const refresh = useAuthStore.getState().refreshToken
            if (access && refresh) {
                setAuth(updatedUser, access, refresh)
            }
            setSuccess(true)
            setTimeout(() => setSuccess(false), 3000)
        },
        onError: (err: any) => {
            setError(err.response?.data?.detail || 'Failed to update profile')
            setTimeout(() => setError(null), 5000)
        }
    })

    if (isLoading) {
        return <PageLoader title="Loading Profile" subtitle="Retrieving your account details" />
    }

    if (!profile) return null

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        updateMutation.mutate(formData)
    }

    return (
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
            <div className="mx-auto max-w-2xl">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold tracking-tight">Your Profile</h1>
                    <p className="text-muted-foreground">Manage your account settings and preferences</p>
                </div>

                <div className="grid gap-6">
                    {/* Account Summary Card */}
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <UserIcon className="h-8 w-8" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold">{profile.full_name}</h2>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Mail className="h-3.5 w-3.5" />
                                    <span>{profile.email}</span>
                                </div>
                            </div>
                            <div className="ml-auto">
                                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary capitalize">
                                    {profile.role}
                                </span>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label htmlFor="first_name" className="text-sm font-medium">First Name</label>
                                    <input
                                        id="first_name"
                                        type="text"
                                        value={formData.first_name || profile.first_name}
                                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="last_name" className="text-sm font-medium">Last Name</label>
                                    <input
                                        id="last_name"
                                        type="text"
                                        value={formData.last_name || profile.last_name}
                                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <Button
                                    type="submit"
                                    disabled={updateMutation.isPending}
                                    className="w-full sm:w-auto gap-2"
                                >
                                    {updateMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4" />
                                    )}
                                    Save Changes
                                </Button>
                            </div>

                            {success && (
                                <div className="flex items-center gap-2 text-sm text-emerald-500 animate-in fade-in slide-in-from-top-1">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span>Profile updated successfully</span>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-center gap-2 text-sm text-destructive animate-in fade-in slide-in-from-top-1">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </form>
                    </div>

                    {/* Security / Permissions Card */}
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                            Security & Access
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <Shield className="mt-0.5 h-4 w-4 text-primary" />
                                <div>
                                    <p className="text-sm font-medium">Account Security</p>
                                    <p className="text-xs text-muted-foreground">
                                        Your account is currently active with {profile.role} privileges.
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-lg bg-muted/50 p-4">
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Need to change your password or security settings? Password management is currently handled via your organization's login provider or the standard login flow.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
