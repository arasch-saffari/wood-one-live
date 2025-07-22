import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch() {
    // Optional: Logging an externes Monitoring
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-700">
          <h2 className="text-xl font-bold text-red-700 dark:text-red-300 mb-2">Ein unerwarteter Fehler ist aufgetreten</h2>
          <pre className="text-xs text-red-600 dark:text-red-200 mb-4 max-w-full overflow-x-auto">{this.state.error?.message}</pre>
          <button onClick={this.handleReload} className="px-4 py-2 rounded bg-red-600 text-white font-semibold hover:bg-red-700">Seite neu laden</button>
        </div>
      )
    }
    return this.props.children
  }
} 