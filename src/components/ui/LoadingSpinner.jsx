import React from 'react';

const LoadingSpinner = ({
  size = 'md',
  color = 'accent',
  fullScreen = false,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-[3px]'
  };

  const colorClasses = {
    white: 'border-t-white',
    accent: 'border-t-accent',
    success: 'border-t-success'
  };

  const spinnerClass = `inline-block rounded-full animate-spin border-transparent ${sizeClasses[size] || sizeClasses.md} ${colorClasses[color] || colorClasses.accent} ${className}`.trim();

  const spinner = (
    <div className={spinnerClass} />
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(13,17,23,0.8)]">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;
