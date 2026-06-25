import React, { useState } from 'react';

const EyeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
  >
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
  >
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

const Input = ({
  label,
  placeholder,
  error,
  type = 'text',
  value,
  onChange,
  disabled = false,
  className = '',
  ...props
}) => {
  const isPassword = type === 'password';
  const [showPassword, setShowPassword] = useState(false);

  const baseInputStyles = 'w-full bg-primary rounded-lg text-text-primary placeholder-text-tertiary transition-smooth px-4 py-2 outline-none';
  
  const borderStyles = error 
    ? 'border border-error focus:border-error' 
    : 'border border-border-default focus:border-accent focus:ring-focus';
    
  const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : '';
  const paddingStyles = isPassword ? 'pr-12' : '';

  const inputClasses = `${baseInputStyles} ${borderStyles} ${disabledStyles} ${paddingStyles} ${className}`.trim();

  const inputElement = (
    <input
      type={isPassword && showPassword ? 'text' : type}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      className={inputClasses}
      {...props}
    />
  );

  const renderInput = () => {
    if (isPassword) {
      return (
        <div className="relative w-full">
          {inputElement}
          <button
            type="button"
            disabled={disabled}
            onClick={() => setShowPassword((prev) => !prev)}
            onMouseDown={(e) => e.preventDefault()}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-tertiary hover:text-text-primary transition-colors focus:outline-none"
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      );
    }
    return inputElement;
  };

  return (
    <div className="w-full flex flex-col">
      {label && (
        <label className="text-text-secondary text-sm mb-1.5 font-medium">
          {label}
        </label>
      )}
      {renderInput()}
      {error && (
        <span className="text-error text-sm mt-1.5">
          {error}
        </span>
      )}
    </div>
  );
};

export default Input;
