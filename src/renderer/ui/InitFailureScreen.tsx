interface InitFailureScreenProps {
  message: string
  onRetry: () => void
}

export function InitFailureScreen({ message, onRetry }: InitFailureScreenProps) {
  return (
    <div className="fatal-screen">
      <h1>Could not load library</h1>
      <p className="fatal-screen__message">{message}</p>
      <button type="button" className="primary" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}
