import { useEffect } from 'react'
import { XCircle, AlertCircle, CheckCircle, Info } from 'lucide-react'
import { create } from 'zustand'

export type ToastType = 'error' | 'warning' | 'success' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastStore {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  clearAll: () => void
}

const toastIcons = {
  error: XCircle,
  warning: AlertCircle,
  success: CheckCircle,
  info: Info,
}

const toastColors = {
  error: 'bg-destructive text-destructive-foreground border-destructive',
  warning: 'bg-amber-600 text-amber-50 border-amber-600',
  success: 'bg-green-600 text-green-50 border-green-600',
  info: 'bg-blue-600 text-blue-50 border-blue-600',
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID()
    const newToast: Toast = { ...toast, id }
    set((state) => ({ toasts: [...state.toasts, newToast] }))

    // Auto-remove after duration
    const duration = toast.duration ?? 5000
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, duration)

    return id
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clearAll: () => set({ toasts: [] }),
}))

export function toast(type: ToastType, message: string, duration?: number) {
  useToastStore.getState().addToast({ type, message, duration })
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = toastIcons[t.type]
        const colorClass = toastColors[t.type]

        return (
          <div
            key={t.id}
            className={`
              flex items-start gap-3 rounded-lg border p-4 shadow-lg
              max-w-sm min-w-[300px]
              animate-toast-in
              ${colorClass}
            `}
            role="alert"
            aria-live={t.type === 'error' ? 'assertive' : 'polite'}
          >
            <Icon className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <p className="text-sm font-medium">{t.message}</p>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Dismiss notification"
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// Convenience functions
export const toastError = (message: string) => toast('error', message)
export const toastWarning = (message: string) => toast('warning', message)
export const toastSuccess = (message: string) => toast('success', message)
export const toastInfo = (message: string) => toast('info', message)
