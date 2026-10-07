import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

import PropTypes from 'prop-types';

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    const newToast = {
      id,
      type: 'success',
      title: '',
      message: '',
      duration: 5000,
      ...toast,
    };

    setToasts((prev) => {
      // Show only one toast at a time for the same message + type
      const alreadyShown = prev.some(
        (t) => t.message === newToast.message && t.type === newToast.type
      );
      if (alreadyShown) return prev;
      return [...prev, newToast];
    });

    // Auto remove toast after duration
    setTimeout(() => {
      removeToast(id);
    }, newToast.duration);

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods for different toast types
  const success = useCallback((message, title = 'Success') => {
    return addToast({ type: 'success', title, message });
  }, [addToast]);

  const error = useCallback((message, title = 'Error') => {
    return addToast({ type: 'error', title, message, duration: 7000 });
  }, [addToast]);

  const warning = useCallback((message, title = 'Warning') => {
    return addToast({ type: 'warning', title, message });
  }, [addToast]);

  const info = useCallback((message, title = 'Info') => {
    return addToast({ type: 'info', title, message });
  }, [addToast]);

  const value = React.useMemo(() => ({
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    success,
    error,
    warning,
    info,
  }), [toasts, addToast, removeToast, clearAllToasts, success, error, warning, info]);

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
};

ToastProvider.propTypes = {
  children: PropTypes.node.isRequired,
};


