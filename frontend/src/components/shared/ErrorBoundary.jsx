import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      errorMessage: ''
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unknown error'
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] rounded-xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center p-6">
          <div className="max-w-xl text-center">
            <h2 className="text-xl font-semibold text-[var(--text)] mb-2">Something went wrong loading this page</h2>
            <button
              type="button"
              onClick={() => { window.location.href = '/dashboard' }}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-semibold"
            >
              Go to Dashboard
            </button>
            <p className="mt-3 text-xs text-[var(--text-muted)] break-words">{this.state.errorMessage}</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
