import React from "react";

class SectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const { sectionName } = this.props;
    const name = sectionName ? `[${sectionName}]` : "";
    console.error(`SectionErrorBoundary ${name} caught:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { fallbackTitle = "This section couldn't load" } = this.props;
      return (
        <div className="flex flex-col items-center justify-center p-6 border border-border-default bg-secondary rounded-xl text-center min-h-37.5">
          <svg
            className="h-8 w-8 text-warning mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="text-text-primary font-semibold text-sm sm:text-base">
            {fallbackTitle}
          </h3>
          <p className="text-text-secondary text-xs sm:text-sm mt-1 mb-4">
            Try refreshing this section.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-lg bg-accent px-4 py-2 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            Retry Section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default SectionErrorBoundary;
