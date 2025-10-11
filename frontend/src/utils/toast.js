// Toast notification utility
let toastContainer = null;
let toastId = 0;

const createToastContainer = () => {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-2';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
};

const createToast = (message, type = 'info', duration = 3000) => {
  const container = createToastContainer();
  const id = `toast-${toastId++}`;
  
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  const colors = {
    success: 'border-green-500/50 bg-green-500/10 text-green-400',
    error: 'border-red-500/50 bg-red-500/10 text-red-400',
    warning: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400',
    info: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400'
  };

  const toast = document.createElement('div');
  toast.id = id;
  toast.className = `flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-lg shadow-2xl min-w-[300px] max-w-md transition-all duration-300 animate-slideInRight ${colors[type]}`;
  toast.innerHTML = `
    <span class="text-xl">${icons[type]}</span>
    <span class="text-white text-sm flex-1">${message}</span>
    <button class="text-gray-400 hover:text-white transition-colors" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(2rem)';
    setTimeout(() => toast.remove(), 300);
  }, duration);

  return id;
};

export const toast = {
  success: (message, duration) => createToast(message, 'success', duration),
  error: (message, duration) => createToast(message, 'error', duration),
  warning: (message, duration) => createToast(message, 'warning', duration),
  info: (message, duration) => createToast(message, 'info', duration)
};

