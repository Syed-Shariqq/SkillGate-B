import React from "react";

export default function AssessmentUnavailable() {
  return (
    <div className="min-h-screen bg-primary flex flex-col font-sans">
      {/* Header / Logo */}
      <header className="px-6 py-6 border-b border-border-default/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-text-primary text-lg tracking-wide">SkillGate</span>
          <span className="font-mono text-[10px] text-text-tertiary px-2 py-0.5 rounded border border-border-default bg-secondary">
            AI SCREENING
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center max-w-lg mx-auto w-full">
        {/* Entrance Animation Wrapper */}
        <div className="animate-fade-in-up w-full">
          
          {/* Friendly Clock Icon Container */}
          <div className="w-16 h-16 rounded-full bg-secondary border border-border-default flex items-center justify-center mx-auto mb-6 text-accent">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-8 h-8"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>

          {/* Heading */}
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mb-3 font-sans">
            This assessment isn't available right now
          </h1>

          {/* Subtext */}
          <p className="text-text-secondary text-base leading-relaxed max-w-sm mx-auto mb-8 font-sans">
            The recruiter may have reached their assessment limit. Please check back later or contact the company directly.
          </p>

        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-secondary border-t border-border-default px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left Section */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-text-primary text-sm">SkillGate</span>
          <span className="font-mono text-xs text-text-tertiary ml-2">
            AI POWERED HIRING
          </span>
        </div>

        {/* Center Section Links */}
        <div className="flex gap-4 flex-wrap justify-center">
          <span className="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer transition-colors">
            Privacy Policy
          </span>
          <span className="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer transition-colors">
            Terms of Service
          </span>
          <span className="text-xs text-text-tertiary hover:text-text-secondary cursor-pointer transition-colors">
            Trust Center
          </span>
        </div>

        {/* Right Section */}
        <div className="text-xs text-text-tertiary">
          © 2026 SkillGate AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
