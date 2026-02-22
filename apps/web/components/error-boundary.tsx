"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
    if (typeof window !== "undefined") {
      import("@sentry/nextjs")
        .then((Sentry) => {
          Sentry.captureException(error, {
            contexts: {
              react: { componentStack: info.componentStack ?? "" },
            },
          });
        })
        .catch(() => {
          /* Sentry not available */
        });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-red-200 bg-red-50/50 p-8">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <div className="text-center">
            <h3 className="font-serif text-lg font-semibold text-[#2F2F2F]">
              Something went wrong
            </h3>
            <p className="mt-1 max-w-md text-sm text-[#6B6B6B]">
              An unexpected error occurred in this panel. Your work has been auto-saved.
            </p>
            {this.state.error && (
              <p className="mt-2 max-w-md font-mono text-xs text-red-600/70">
                {this.state.error.message}
              </p>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={this.handleReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
