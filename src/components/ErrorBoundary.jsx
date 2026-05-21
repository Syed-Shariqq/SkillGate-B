import React from "react";
import logo from "../assets/skillGate-logo.png";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(
      "ErrorBoundary caught an unhandled runtime error:",
      error,
      errorInfo,
    );
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative min-h-screen w-full bg-primary flex flex-col items-center justify-center p-6 text-text-primary">
          {/* Premium subtle dot grid pattern background */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(var(--color-accent) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* Decorative gradient orb for glassmorphism background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-125 bg-accent-soft rounded-full filter blur-[120px] pointer-events-none opacity-20" />

          <div className="max-w-md w-full text-center space-y-6 animate-fade-in-up">
            {/* Logo branding */}
            <div className="flex items-center justify-center gap-2">
              <img
                src={logo}
                alt="SkillGate Logo"
                className="w-10 h-10 object-contain"
              />
              <span className="text-xl font-bold tracking-tight text-text-primary">
                Skill<span className="text-accent">Gate</span>
              </span>
            </div>

            {/* Error Message Card */}
            <div className="bg-secondary border border-border-default rounded-xl p-8 space-y-4 shadow-[0_4px_6px_2px_rgba(0,0,0,0.1)]">
              <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
                Something went wrong
              </h1>

              <p className="text-text-secondary text-sm leading-relaxed">
                An unexpected error occurred. Please refresh the page.
              </p>

              <div className="flex justify-center items-center gap-3">
                <button
                  onClick={this.handleReload}
                  className="mt-2 w-full py-2.5 px-4 bg-accent hover:bg-accent-hover text-text-primary font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft cursor-pointer shadow-lg shadow-accent/10"
                >
                  Refresh Page
                </button>
                <button
                  onClick={() => (window.location.href = "/dashboard")}
                  className="mt-2 w-full py-2.5 px-4 bg-text-secondary hover:bg-text-primary text-black font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft cursor-pointer shadow-lg shadow-accent/10"
                >
                  Go to Dashboard
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

export default ErrorBoundary;
