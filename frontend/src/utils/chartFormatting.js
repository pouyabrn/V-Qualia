export const colors = ['#d0e4f2', '#ed7180', '#929ce5', '#91c3be', '#deb991'];
export const formatValue = (n, digits = 1) => typeof n === 'number' && Number.isFinite(n) ? n.toFixed(digits) : '—';
export const formatLap = n => typeof n === 'number' && Number.isFinite(n) ? `${Math.floor(n / 60)}:${(n % 60).toFixed(3).padStart(6, '0')}` : '—';
