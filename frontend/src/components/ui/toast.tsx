import { XCircle, AlertCircle, CheckCircle, Info } from 'lucide-react'
import { useToastStore, type ToastType } from './toast-lib'

// Also re-export convenience functions for easier migration if needed, 
// but it's better to import from toast-lib directly.
// However, the existing code imports from @/components/ui/toast.
// To avoid breaking many files, I'll re-export them here, but 
// this might still trigger the React Refresh warning...
// Wait, if I export them as functions, it should be fine if they ARE functions.
// But the warning says "Use a new file to share constants or functions between components".
// So I should NOT export them here if I export a component.

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

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = toastIcons[t.type as ToastType]
        const colorClass = toastColors[t.type as ToastType]

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

// Export a dummy to satisfy imports that might still point here, 
// but we'll need to update them to import from toast-lib.
// Actually, I'll just re-export them from toast-lib in a separate step or 
// use a barrel file.

