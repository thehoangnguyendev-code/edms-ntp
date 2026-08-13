/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the component tree
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Copy, Check } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleCopy = () => {
    const { error, errorInfo } = this.state;
    const text = [
      error?.toString() ?? '',
      '',
      errorInfo?.componentStack ?? '',
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="max-w-md w-full bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Oops! Something went wrong
              </h1>
              <p className="text-slate-600 mb-4">
                We're sorry for the inconvenience. Please try refreshing the page.
              </p>
              {this.state.error && (
                <details open className="text-left text-sm bg-slate-50 border border-slate-200 rounded-lg mb-4">
                  <summary className="cursor-pointer font-semibold text-slate-700 px-4 py-2.5 select-none">
                    Error Details
                  </summary>
                  <div className="px-4 pb-4 pt-1 space-y-3">
                    {/* Error message */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Message</p>
                      <pre className="text-red-600 text-xs overflow-auto whitespace-pre-wrap break-words">
                        {this.state.error.toString()}
                      </pre>
                    </div>

                    {/* Component stack — extract file info */}
                    {this.state.errorInfo?.componentStack && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Component Stack</p>
                        <pre className="text-slate-600 text-xs overflow-auto whitespace-pre-wrap break-words max-h-48">
                          {this.state.errorInfo.componentStack.trim()}
                        </pre>
                      </div>
                    )}

                    {/* Stack trace */}
                    {this.state.error.stack && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Stack Trace</p>
                        <pre className="text-slate-500 text-xs overflow-auto whitespace-pre-wrap break-words max-h-48">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={this.handleCopy}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {this.state.copied
                    ? <><Check className="h-4 w-4 text-emerald-600" /> Copied!</>
                    : <><Copy className="h-4 w-4" /> Copy Error</>}
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
