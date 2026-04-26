import React from 'react';

const Badge = ({
  variant = 'default',
  children,
  className = '',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  
  const variantStyles = {
    success: {
      backgroundColor: 'rgba(35, 134, 54, 0.15)',
      color: '#238636',
      border: '1px solid rgba(35, 134, 54, 0.3)'
    },
    error: {
      backgroundColor: 'rgba(218, 54, 51, 0.15)',
      color: '#DA3633',
      border: '1px solid rgba(218, 54, 51, 0.3)'
    },
    warning: {
      backgroundColor: 'rgba(210, 153, 34, 0.15)',
      color: '#D29922',
      border: '1px solid rgba(210, 153, 34, 0.3)'
    },
    info: {
      backgroundColor: 'rgba(31, 111, 235, 0.15)',
      color: '#1F6FEB',
      border: '1px solid rgba(31, 111, 235, 0.3)'
    },
    default: {
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      color: '#9DA7B3',
      border: '1px solid #2A323C'
    }
  };

  const currentStyle = variantStyles[variant] || variantStyles.default;

  return (
    <span
      className={`${baseStyles} ${className}`.trim()}
      style={currentStyle}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
