export const colors = ['#83bdcc', '#ab9dcc', '#d3b27e', '#90b9a2', '#ca939a'];
export const formatValue = (n, digits = 1) => typeof n === 'number' && Number.isFinite(n) ? n.toFixed(digits) : '—';
export const formatLap = n => typeof n === 'number' && Number.isFinite(n) ? `${Math.floor(n / 60)}:${(n % 60).toFixed(3).padStart(6, '0')}` : '—';
