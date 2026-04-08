/**
 * Global Toast Provider - Mission Control Ultra V6
 * Top-right, dark glass, auto-dismiss 2400ms, aria-live
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertCircle, Info, X } from 'lucide-react';

// ARAS Design Tokens
const DT = {
  orange: '#ff6a00',
  panelBorder: 'rgba(255,255,255,0.06)',
};

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  detail?: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, detail?: string) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const iconMap = {
    success: <Check size={14} className="text-green-400" />,
    error: <AlertCircle size={14} className="text-red-400" />,
    info: <Info size={14} style={{ color: DT.orange }} />,
  };

  const borderColor = {
    success: 'rgba(34,197,94,0.3)',
    error: 'rgba(239,68,68,0.3)',
    info: DT.panelBorder,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, x: 10 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: -10, x: 10 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className="relative flex items-start gap-3 px-4 py-3 rounded-xl shadow-xl max-w-sm"
      style={{
        background: 'rgba(20,20,25,0.95)',
        border: `1px solid ${borderColor[toast.type]}`,
        backdropFilter: 'blur(12px)',
      }}
      role="alert"
      aria-live="polite"
    >
      <div className="flex-shrink-0 mt-0.5">{iconMap[toast.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white">{toast.message}</p>
        {toast.detail && (
          <p className="text-[10px] text-white/50 mt-0.5">{toast.detail}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
        aria-label="Schließen"
      >
        <X size={12} className="text-white/40" />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success', detail?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const toast: Toast = { id, message, type, detail };
    
    setToasts(prev => [...prev, toast]);

    // Auto-dismiss after 2400ms
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2400);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      
      {/* Toast Container - Top Right */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(toast => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem 
                toast={toast} 
                onDismiss={() => hideToast(toast.id)} 
              />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export default ToastProvider;
