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
    addToast: (toast: Omit<Toast, 'id'>) => string
    removeToast: (id: string) => void
    clearAll: () => void
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

// Convenience functions
export const toastError = (message: string) => toast('error', message)
export const toastWarning = (message: string) => toast('warning', message)
export const toastSuccess = (message: string) => toast('success', message)
export const toastInfo = (message: string) => toast('info', message)
