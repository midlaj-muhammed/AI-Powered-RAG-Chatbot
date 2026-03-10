import { Outlet } from 'react-router-dom'
import { Sidebar } from './sidebar'

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Skip to content link for keyboard/screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to main content
      </a>
      <Sidebar />
      <main
        id="main-content"
        role="main"
        aria-label="Page content"
        className="flex flex-1 flex-col overflow-hidden"
      >
        <Outlet />
      </main>
    </div>
  )
}
