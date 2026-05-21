import { Component, ReactNode, ErrorInfo } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-surface border border-red-500/30 rounded p-6 max-w-lg text-center">
          <div className="text-3xl mb-3">⚠</div>
          <h2 className="text-sm font-semibold text-red-400 mb-2">Something went wrong</h2>
          <p className="text-xs text-text-muted mb-4 font-mono break-all">
            {this.state.error.message}
          </p>
          <button
            className="btn btn-sm"
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
