import { Loader2 } from 'lucide-react'

export function Spinner({ className = 'h-6 w-6' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-primary ${className}`} />
}

export function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="h-8 w-8" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
