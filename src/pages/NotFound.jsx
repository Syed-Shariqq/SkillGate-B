import React from 'react'
import { useNavigate } from 'react-router-dom'

const NotFound = () => {
  const navigate = useNavigate()

  return (
    <main className="relative min-h-screen bg-primary flex items-center justify-center p-6 text-text-primary overflow-hidden">
      {/* Premium subtle dot grid pattern background */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: 'radial-gradient(var(--color-accent) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Decorative gradient orb for glassmorphism background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-125 bg-accent-soft rounded-full filter blur-[120px] pointer-events-none opacity-20" />

      {/* Main card */}
      <section className="relative z-10 max-w-lg w-full text-center space-y-8 animate-fade-in-up">
        {/* Large stylized 404 with text gradient */}
        <div className="relative inline-block select-none">
          <h1 className="text-[10rem] font-extrabold tracking-tighter leading-none text-transparent bg-clip-text bg-linear-to-b from-accent via-accent to-accent/20 filter drop-shadow-[0_0_30px_rgba(91,109,246,0.3)]">
            404
          </h1>
          {/* Subtle decorative scanline or glitch border */}
          <div className="absolute top-0 left-0 w-full h-full bg-linear-to-r from-transparent via-accent-soft to-transparent opacity-10 animate-pulse pointer-events-none" />
        </div>

        {/* Content Section */}
        <div className="space-y-3">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary">
            Page not found
          </h2>
          <p className="text-text-secondary max-w-md mx-auto text-base leading-relaxed">
            This page doesn't exist or was moved. Double-check the URL or head back.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-sm mx-auto pt-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full sm:flex-1 py-3 px-5 bg-accent hover:bg-accent-hover text-text-primary font-semibold rounded-lg transition-all duration-150 shadow-lg shadow-accent/15 cursor-pointer"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full sm:flex-1 py-3 px-5 bg-secondary hover:bg-hover-overlay text-text-secondary hover:text-text-primary border border-border-default hover:border-text-tertiary font-semibold rounded-lg transition-all duration-150 cursor-pointer"
          >
            Go Home
          </button>
        </div>
      </section>
    </main>
  )
}

export default NotFound
