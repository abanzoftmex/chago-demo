const Switch = ({ 
  enabled, 
  onChange, 
  disabled = false, 
  size = 'md', 
  label,
  description,
  loading = false,
  color = 'rose'
}) => {
  const sizeClasses = {
    sm: {
      switch: 'h-5 w-9',
      toggle: 'h-4 w-4',
      translate: enabled ? 'translate-x-4' : 'translate-x-0'
    },
    md: {
      switch: 'h-6 w-11',
      toggle: 'h-5 w-5', 
      translate: enabled ? 'translate-x-5' : 'translate-x-0'
    },
    lg: {
      switch: 'h-7 w-14',
      toggle: 'h-6 w-6',
      translate: enabled ? 'translate-x-7' : 'translate-x-0'
    }
  };

  const currentSize = sizeClasses[size];

  return (
    <div className="flex items-center">
      <div className="flex items-center">
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => !disabled && !loading && onChange(!enabled)}
          className={`
            relative inline-flex flex-shrink-0 border-2 border-transparent rounded-full cursor-pointer 
            transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 
            ${color === 'emerald' ? 'focus:ring-emerald-500' : 'focus:ring-rose-500'} ${currentSize.switch}
            ${enabled 
              ? color === 'emerald' ? 'bg-emerald-600' : 'bg-rose-600' 
              : 'bg-gray-200'
            }
            ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}
          `}
          role="switch"
          aria-checked={enabled}
          aria-label={label}
        >
          <span className="sr-only">{label}</span>
          <span
            aria-hidden="true"
            className={`
              ${currentSize.toggle} ${currentSize.translate}
              pointer-events-none inline-block rounded-full bg-white shadow transform ring-0 
              transition ease-in-out duration-200 flex items-center justify-center
            `}
          >
            {loading && (
              <svg className="animate-spin h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
          </span>
        </button>
        
        {(label || description) && (
          <div className="ml-3">
            {label && (
              <label className="text-sm font-medium text-gray-900 cursor-pointer" onClick={() => !disabled && !loading && onChange(!enabled)}>
                {label}
              </label>
            )}
            {description && (
              <p className="text-xs text-gray-500">{description}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Switch;
