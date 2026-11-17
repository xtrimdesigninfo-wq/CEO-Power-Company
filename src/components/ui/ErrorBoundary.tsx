import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred while rendering this page.';
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('Application render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAF8] px-4 py-10 text-slate-800">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-6 sm:p-8 text-center">
            <h1 className="text-xl font-bold text-slate-900 font-heading">
              Unable to Load Page
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Something interrupted rendering this view. Please reload the page to try again.
            </p>
            {this.state.errorMessage && (
              <p className="mt-3 text-xs font-mono text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 break-words">
                {this.state.errorMessage}
              </p>
            )}
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2.5 rounded-xl bg-[#187004] hover:bg-[#135903] text-white text-sm font-bold transition-colors cursor-pointer"
              >
                Reload Page
              </button>
              <a
                href="/"
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors"
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
