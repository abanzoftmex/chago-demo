import { useState, useEffect, createContext, useContext } from 'react';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  InformationCircleIcon,
  XCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

// Toast Context
const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast Provider
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type, duration };
    
    setToasts(prev => [...prev, toast]);

    // Auto remove toast after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const success = (message, duration) => addToast(message, 'success', duration);
  const error = (message, duration) => addToast(message, 'error', duration);
  const warning = (message, duration) => addToast(message, 'warning', duration);
  const info = (message, duration) => addToast(message, 'info', duration);

  const value = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast />
    </ToastContext.Provider>
  );
};

// Toast Component
const Toast = () => {
  const context = useContext(ToastContext);
  if (!context) return null;
  
  const { toasts, removeToast } = context;

  const getToastIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
    }
  };

  const getToastStyles = (type) => {
    const baseStyles = "border-l-4 bg-background shadow-lg";
    
    switch (type) {
      case 'success':
        return `${baseStyles} border-green-500`;
      case 'error':
        return `${baseStyles} border-red-500`;
      case 'warning':
        return `${baseStyles} border-yellow-500`;
      default:
        return `${baseStyles} border-blue-500`;
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={removeToast}
          getIcon={getToastIcon}
          getStyles={getToastStyles}
        />
      ))}
    </div>
  );
};

// Individual Toast Item
const ToastItem = ({ toast, onRemove, getIcon, getStyles }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleRemove = () => {
    setIsLeaving(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  return (
    <div
      className={`
        transform transition-all duration-300 ease-in-out max-w-sm w-full
        ${isVisible && !isLeaving 
          ? 'translate-x-0 opacity-100' 
          : 'translate-x-full opacity-0'
        }
      `}
    >
      <div className={`${getStyles(toast.type)} rounded-md p-4`}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {getIcon(toast.type)}
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm text-foreground">
              {toast.message}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={handleRemove}
              className="inline-flex text-muted-foreground hover:text-foreground"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toast;