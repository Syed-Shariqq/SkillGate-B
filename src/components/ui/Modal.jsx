import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className = ''
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return ReactDOM.createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-[fadeIn_150ms_ease-out]"
      onClick={onClose}
    >
      <div 
        className={`bg-secondary border border-border-default rounded-xl w-full p-6 shadow-xl animate-[scaleIn_150ms_ease-out] flex flex-col ${sizeClasses[size] || sizeClasses.md} ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h2 className="text-text-primary font-semibold text-lg">
              {title}
            </h2>
          )}
          <button 
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-smooth ml-auto focus:outline-none"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="text-text-primary">
          {children}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}} />
    </div>,
    document.body
  );
};

export default Modal;
