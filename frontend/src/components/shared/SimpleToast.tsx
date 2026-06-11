// components/shared/SimpleToast.tsx
import { useState, useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose?: () => void;
}

export default function SimpleToast({ 
  message, 
  type, 
  duration = 5000,
  onClose 
}: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) return null;

  const bgColor = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800'
  }[type];

  const iconColor = {
    success: 'text-green-500',
    error: 'text-red-500',
    info: 'text-blue-500',
    warning: 'text-yellow-500'
  }[type];

  const icons = {
    success: 'pi-check-circle',
    error: 'pi-exclamation-circle',
    info: 'pi-info-circle',
    warning: 'pi-exclamation-triangle'
  }[type];

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md animate-fade-in">
      <div className={`${bgColor} border rounded-lg p-4 shadow-lg`}>
        <div className="flex items-start">
          <div className={`flex-shrink-0 ${iconColor} mt-0.5`}>
            <i className={`pi ${icons} text-lg`}></i>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm">{message}</p>
          </div>
          <button
            onClick={() => {
              setVisible(false);
              onClose?.();
            }}
            className="ml-4 text-gray-400 hover:text-gray-600"
          >
            <i className="pi pi-times"></i>
          </button>
        </div>
      </div>
    </div>
  );
}