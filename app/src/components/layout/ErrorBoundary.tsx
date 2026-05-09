import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] caught', error, info);
    this.setState({ info });
  }

  reset = () => {
    this.setState({ error: null, info: null });
  };

  override render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: 24,
            background: '#0E0F13',
            color: '#E8E8EA',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontSize: 13,
            overflow: 'auto',
            zIndex: 9999,
          }}
        >
          <h1 style={{ color: '#E0533C', fontSize: 16, marginBottom: 16 }}>
            Something broke during render
          </h1>
          <div style={{ marginBottom: 16, color: '#9CA0AB' }}>
            The UI threw an error. The audio engine and project state are likely
            still intact — try the action below to reset the React tree.
          </div>
          <pre
            style={{
              background: '#07080A',
              padding: 12,
              borderRadius: 6,
              border: '1px solid #2A2E38',
              marginBottom: 12,
              whiteSpace: 'pre-wrap',
              color: '#E0533C',
            }}
          >
            {this.state.error.message}
          </pre>
          <pre
            style={{
              background: '#07080A',
              padding: 12,
              borderRadius: 6,
              border: '1px solid #2A2E38',
              marginBottom: 12,
              whiteSpace: 'pre-wrap',
              color: '#5A5F6B',
              fontSize: 11,
              maxHeight: 300,
              overflow: 'auto',
            }}
          >
            {this.state.error.stack}
          </pre>
          {this.state.info?.componentStack && (
            <pre
              style={{
                background: '#07080A',
                padding: 12,
                borderRadius: 6,
                border: '1px solid #2A2E38',
                marginBottom: 12,
                whiteSpace: 'pre-wrap',
                color: '#5A5F6B',
                fontSize: 11,
                maxHeight: 300,
                overflow: 'auto',
              }}
            >
              {this.state.info.componentStack}
            </pre>
          )}
          <button
            type="button"
            onClick={this.reset}
            style={{
              background: '#F87328',
              color: 'white',
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              alignSelf: 'flex-start',
              fontFamily: 'inherit',
              fontSize: 13,
            }}
          >
            Try to recover
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
