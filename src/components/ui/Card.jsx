import React from 'react';

const Card = ({
  children,
  hoverable = false,
  padding = 'md',
  className = '',
  onClick,
  ...props
}) => {
  const baseStyles = 'bg-secondary border border-border-default rounded-xl transition-smooth';
  
  const paddingStyles = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  const isClickable = hoverable || !!onClick;
  
  const hoverStyles = hoverable 
    ? 'hover:bg-tertiary hover:-translate-y-0.5 hover:border-text-tertiary' 
    : '';

  const clickableStyles = isClickable ? 'cursor-pointer' : '';

  const cardClasses = `${baseStyles} ${paddingStyles[padding] || paddingStyles.md} ${hoverStyles} ${clickableStyles} ${className}`.trim();

  return (
    <div 
      className={cardClasses} 
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
