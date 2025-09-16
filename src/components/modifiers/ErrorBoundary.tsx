import React, { Component, type ReactNode } from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export class ModifierErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Modifier processing error:', error, errorInfo)

    this.setState({
      error,
      errorInfo
    })

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="modifier-error-boundary" style={{
          padding: '12px',
          margin: '8px',
          border: '1px solid #ff6b6b',
          borderRadius: '4px',
          backgroundColor: '#fff5f5',
          color: '#d63031'
        }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
            Modifier Error
          </h4>
          <p style={{ margin: '0 0 8px 0', fontSize: '12px' }}>
            {this.state.error?.message || 'An error occurred while processing modifiers'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              border: '1px solid #d63031',
              borderRadius: '3px',
              backgroundColor: '#fff',
              color: '#d63031',
              cursor: 'pointer'
            }}
          >
            Reset
          </button>
          {import.meta.env.DEV && this.state.errorInfo && (
            <details style={{ marginTop: '8px' }}>
              <summary style={{ fontSize: '12px', cursor: 'pointer' }}>
                Error Details (Development)
              </summary>
              <pre style={{
                fontSize: '10px',
                marginTop: '4px',
                padding: '8px',
                backgroundColor: '#f8f8f8',
                borderRadius: '3px',
                overflow: 'auto',
                maxHeight: '200px'
              }}>
                {this.state.error?.stack}
                {'\n\n'}
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

// Hook-based error boundary for functional components
export const useModifierErrorHandler = () => {
  const handleError = React.useCallback((error: Error, context: string = 'modifier') => {
    console.error(`${context} error:`, error)

    // You could also report to an error tracking service here
    // e.g., Sentry.captureException(error, { tags: { context } })

    return null // Return null to gracefully handle the error
  }, [])

  return handleError
}