// Parse CSV telemetry data
export const parseCSV = (text) => {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const data = lines.slice(1).map((line, index) => {
    const values = line.split(',');
    const obj = { index };
    headers.forEach((header, i) => {
      const value = values[i];
      const numValue = parseFloat(value);
      obj[header] = isNaN(numValue) ? value : numValue;
    });
    return obj;
  });
  return data;
};

// Parse track CSV data (x,y coordinates)
export const parseTrackCSV = (text, name) => {
  const lines = text.trim().split('\n').filter(line => !line.startsWith('#'));
  const data = lines.map(line => {
    const [x_m, y_m] = line.split(',').map(parseFloat);
    return { x: x_m, y: y_m };
  });
  return { id: Date.now(), name, data };
};

// Format track name for display
export const formatTrackName = (name) => {
  if (!name) return 'Track Layout';
  return name.replace('.csv', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Downsample data for performance
export const downsampleData = (data, factor) => {
  if (!data || factor <= 1) return data;
  return data.filter((_, i) => i % factor === 0);
};


