import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import PropTypes from 'prop-types';

const typeStyles = {
  success: {
    accent: 'bg-emerald-500',
    icon: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
    progress: 'bg-emerald-500',
  },
  error: {
    accent: 'bg-rose-500',
    icon: 'text-rose-600',
    iconBg: 'bg-rose-100',
    progress: 'bg-rose-500',
  },
  warning: {
    accent: 'bg-amber-500',
    icon: 'text-amber-600',
    iconBg: 'bg-amber-100',
    progress: 'bg-amber-500',
  },
  info: {
    accent: 'bg-blue-500',
    icon: 'text-blue-600',
    iconBg: 'bg-blue-100',
    progress: 'bg-blue-500',
  },
};

const Toast = ({ toast }) => {
  const { removeToast } = useToast();
  const style = typeStyles[toast.type] || typeStyles.info;

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className={`w-5 h-5 ${style.icon}`} />;
      case 'error':
        return <XCircle className={`w-5 h-5 ${style.icon}`} />;
      case 'warning':
        return <AlertTriangle className={`w-5 h-5 ${style.icon}`} />;
      case 'info':
      default:
        return <Info className={`w-5 h-5 ${style.icon}`} />;
    }
  };

  return (
    <div
      className="relative flex items-start gap-3 overflow-hidden rounded-xl bg-white p-4 shadow-[0_4px_24px_rgba(0,0,0,0.08)] ring-1 ring-black/5 max-w-sm w-full"
      style={{
        animation: 'slideInRight 0.35s cubic-bezier(0.21, 0.47, 0.32, 0.98)',
      }}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.accent}`} />

      <div className={`flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg ${style.iconBg} ml-1`}>
        {getIcon()}
      </div>

      <div className="flex-1 min-w-0 pt-0.5">
        {toast.title && (
          <p className="text-sm font-semibold text-gray-900 mb-0.5">
            {toast.title}
          </p>
        )}
        <p className="text-sm text-gray-600 leading-snug">
          {toast.message}
        </p>
        {/* Progress bar */}
        <div className="mt-3 w-full h-0.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${style.progress}`}
            style={{
              width: '100%',
              animation: `shrink ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => removeToast(toast.id)}
        className="flex-shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

Toast.propTypes = {
  toast: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    type: PropTypes.oneOf(['success', 'error', 'warning', 'info']),
    title: PropTypes.string,
    message: PropTypes.string,
    duration: PropTypes.number,
  }).isRequired,
};

const ToastContainer = () => {
  const { toasts } = useToast();

  return (
    <div
      className="fixed top-5 right-5 z-[9999] flex flex-col gap-3"
      style={{ maxHeight: 'calc(100vh - 2.5rem)', overflowY: 'auto' }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
};

export default ToastContainer;


