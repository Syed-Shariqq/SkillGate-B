import React from 'react';

const SkeletonCard = ({
  rows = 3,
  showAvatar = false,
  className = ''
}) => {
  const rowWidths = ['w-full', 'w-5/6', 'w-4/6'];

  return (
    <div className={`bg-secondary border border-border-default rounded-xl p-6 ${className}`.trim()}>
      <div className="flex items-center gap-3">
        {showAvatar && (
          <div className="h-10 w-10 rounded-full bg-tertiary animate-pulse shrink-0" />
        )}
        <div className="h-4 w-2/3 bg-tertiary rounded-md animate-pulse" />
      </div>
      
      <div className="mt-3">
        {Array.from({ length: Math.max(0, rows) }).map((_, i) => (
          <div 
            key={i} 
            className={`h-3 bg-tertiary rounded-md animate-pulse ${rowWidths[i % 3]} ${i > 0 ? 'mt-2' : ''}`}
          />
        ))}
      </div>
    </div>
  );
};

export default SkeletonCard;
