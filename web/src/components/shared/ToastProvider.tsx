import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X } from 'lucide-react';

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastCtx {
  toast: (type: Toast['type'], message: string) => void;
}

const ToastContext = createContext<ToastCtx>(null!);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((type: Toast['type'], message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-start gap-2 px-4 py-3 rounded border text-sm shadow-lg animate-slide-up ${
              t.type === 'success'
                ? 'bg-green-900/90 border-green-500/40 text-green-200'
                : t.type === 'error'
                ? 'bg-red-900/90 border-red-500/40 text-red-200'
                : 'bg-blue-900/90 border-blue-500/40 text-blue-200'
            }`}
          >
            <span className="flex-1">{t.message}</span>
            <button className="shrink-0 opacity-60 hover:opacity-100" onClick={() => dismiss(t.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
