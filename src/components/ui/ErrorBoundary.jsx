import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-8">
          <svg
            className="w-12 h-12 text-[#DA3633]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h1 className="text-text-primary text-2xl font-semibold mt-4">
            Something went wrong
          </h1>
          <p className="text-text-secondary text-sm mt-2 text-center max-w-sm">
            An unexpected error occurred. Please reload the page.
          </p>
          <button
            onClick={this.handleReload}
            className="bg-accent text-white px-6 py-2.5 rounded-md font-medium mt-6 hover:bg-accent-hover transition-smooth"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
