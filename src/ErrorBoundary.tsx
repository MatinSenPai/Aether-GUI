import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught UI error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-svh w-full flex-col items-center justify-center bg-background text-foreground p-6 text-center">
          <AlertTriangle size={48} className="text-status-error mb-4 opacity-80" />
          <h1 className="text-xl font-medium mb-2">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs">
            The interface encountered an unexpected error. Please restart or reload.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 rounded-full bg-surface-2 px-6 py-2.5 text-sm font-medium hover:bg-surface-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <RefreshCcw size={16} />
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
