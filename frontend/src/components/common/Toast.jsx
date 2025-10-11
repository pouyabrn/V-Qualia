import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

const Toast = ({ message, type = 'info', duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  const icons = {
    success: <CheckCircle className="text-green-400" size={20} />,
    error: <XCircle className="text-red-400" size={20} />,
    warning: <AlertCircle className="text-yellow-400" size={20} />,
    info: <Info className="text-cyan-400" size={20} />
  };

  const colors = {
    success: 'border-green-500/50 bg-green-500/10',
    error: 'border-red-500/50 bg-red-500/10',
    warning: 'border-yellow-500/50 bg-yellow-500/10',
    info: 'border-cyan-500/50 bg-cyan-500/10'
  };

  return (
    <div className={`fixed top-4 right-4 z-[9999] transition-all duration-300 ${
      isLeaving ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'
    }`}>
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-lg shadow-2xl min-w-[300px] max-w-md ${colors[type]}`}>
        <div className="flex-shrink-0">
          {icons[type]}
        </div>
        <p className="text-white text-sm flex-1">{message}</p>
        <button
          onClick={() => {
            setIsLeaving(true);
            setTimeout(() => {
              setIsVisible(false);
              onClose?.();
            }, 300);
          }}
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default Toast;

