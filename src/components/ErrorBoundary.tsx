import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State;
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md p-8 bg-surface-primary/50 border border-border-primary rounded-3xl shadow-2xl backdrop-blur-xl text-center"
          >
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-3xl font-bold text-text-heading mb-3">
              Oops! Something went wrong.
            </h1>
            <p className="text-text-tertiary mb-8 text-sm">
              {this.state.error?.message || "An unexpected error occurred in the application."}
            </p>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 bg-white text-stone-900 px-6 py-3.5 rounded-xl font-semibold hover:bg-stone-100 transition-colors shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] border border-border-secondary"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Page
            </motion.button>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
