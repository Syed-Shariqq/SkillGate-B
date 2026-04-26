import React from 'react';

const EmptyState = ({
  icon,
  title,
  subtitle,
  ctaLabel,
  onCtaClick,
  className = ''
}) => {
  const DefaultIcon = (
    <svg 
      width="28" 
      height="28" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5"
    >
      <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
    </svg>
  );

  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 gap-4 ${className}`.trim()}>
      <div className="w-16 h-16 rounded-full bg-accent-soft flex items-center justify-center mb-2 text-accent">
        {icon || DefaultIcon}
      </div>
      
      {title && (
        <h3 className="text-text-primary font-semibold text-lg">
          {title}
        </h3>
      )}
      
      {subtitle && (
        <p className="text-text-secondary text-sm max-w-xs mt-1">
          {subtitle}
        </p>
      )}
      
      {ctaLabel && (
        <button
          onClick={onCtaClick}
          className="bg-accent text-white px-5 py-2 rounded-md font-medium text-sm hover:bg-accent-hover transition-smooth mt-2"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
