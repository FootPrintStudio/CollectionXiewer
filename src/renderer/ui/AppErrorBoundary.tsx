import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AppErrorBoundary]', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="fatal-screen">
          <h1>Something went wrong</h1>
          <p className="fatal-screen__message">{this.state.error.message}</p>
          <button type="button" className="primary" onClick={() => window.location.reload()}>
            Reload app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
