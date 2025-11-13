import React, { useState, useEffect, useRef } from 'react';
import { Upload, RotateCcw, ZoomIn, ZoomOut, Eye, EyeOff, FileText, AlertCircle } from 'lucide-react';
import { toast } from '../../utils/toast';

const GGVPage = () => {
  const [data, setData] = useState(null);
  const [rotation, setRotation] = useState({ x: -30, y: 45 });
  const [zoom, setZoom] = useState(1.6);
  const [showGrid, setShowGrid] = useState(false);
  const [showPoints, setShowPoints] = useState(true);
  const [showSurface, setShowSurface] = useState(true);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const canvasRef = useRef(null);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',');

    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      parsed.push({
        velocity: parseFloat(values[0]),
        lateralAccel: parseFloat(values[1]),
        maxAccel: parseFloat(values[2]),
        maxBrake: parseFloat(values[3])
      });
    }
    return parsed;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a CSV file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const parsed = parseCSV(e.target.result);
        setData(parsed);
        toast.success(`Successfully loaded ${file.name}`);
      };
      reader.readAsText(file);
    } catch (err) {
      setError('Failed to parse CSV file. Please check the format.');
      toast.error('Failed to load GGV data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const project3D = (x, y, z, width, height, centerX, centerY) => {
    const scale = 3 * zoom;
    const rotX = (rotation.x * Math.PI) / 180;
    const rotY = (rotation.y * Math.PI) / 180;

    // Rotation around X axis
    let y1 = y * Math.cos(rotX) - z * Math.sin(rotX);
    let z1 = y * Math.sin(rotX) + z * Math.cos(rotX);
    let x1 = x;

    // Rotation around Y axis
    let x2 = x1 * Math.cos(rotY) + z1 * Math.sin(rotY);
    let z2 = -x1 * Math.sin(rotY) + z1 * Math.cos(rotY);
    let y2 = y1;

    // Perspective projection
    const perspective = 300;
    const projScale = perspective / (perspective + z2);

    return {
      x: centerX + x2 * scale * projScale,
      y: centerY - y2 * scale * projScale,
      z: z2
    };
  };

  const drawScene = () => {
    console.log('drawScene called with data:', !!data, 'canvas:', !!canvasRef.current);
    if (!data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Setup mouse events now that canvas is ready
    setupMouseEvents(canvas);

    ctx.clearRect(0, 0, width, height);

    // Normalize data for visualization
    const velocities = [...new Set(data.map(d => d.velocity))].sort((a, b) => a - b);
    const lateralAccels = [...new Set(data.map(d => d.lateralAccel))].sort((a, b) => a - b);

    const maxVel = Math.max(...velocities);
    const maxLat = Math.max(...lateralAccels.map(Math.abs));
    const maxLong = Math.max(...data.map(d => Math.max(Math.abs(d.maxAccel), Math.abs(d.maxBrake))));

    // Ensure origin (0,0,0) is much lower than canvas center
    const centerX = width / 2;
    const centerY = height / 2 + 100; // Move origin down by 100 pixels

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
      ctx.lineWidth = 1;

      for (let i = 0; i <= 10; i++) {
        const v = (i / 10) * 100 - 50;
        for (let j = 0; j <= 10; j++) {
          const h = (j / 10) * 100 - 50;
          const p1 = project3D(v, h, -50, width, height, centerX, centerY);
          const p2 = project3D(v, h, 50, width, height, centerX, centerY);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    // Draw axes with professional engineering colors
    const origin = project3D(0, 0, 0, width, height, centerX, centerY);
    const xAxis = project3D(60, 0, 0, width, height, centerX, centerY);
    const yAxis = project3D(0, 60, 0, width, height, centerX, centerY);
    const zAxis = project3D(0, 0, 60, width, height, centerX, centerY);

    // Set font for axis labels
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.lineWidth = 3;

    // X axis (Lateral Accel) - White
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(xAxis.x, xAxis.y);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Lateral (g)', xAxis.x + 8, xAxis.y + 4);

    // Y axis (Longitudinal Accel) - Calmer Pink
    ctx.strokeStyle = '#b40060';
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(yAxis.x, yAxis.y);
    ctx.stroke();
    ctx.fillStyle = '#b40060';
    ctx.fillText('Longitudinal (g)', yAxis.x + 8, yAxis.y + 4);

    // Z axis (Velocity) - Calmer Blue
    ctx.strokeStyle = '#0060b4';
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(zAxis.x, zAxis.y);
    ctx.stroke();
    ctx.fillStyle = '#0060b4';
    ctx.fillText('Velocity (m/s)', zAxis.x + 8, zAxis.y + 4);

    // Color interpolation function for green → yellow → orange gradient
    const getGradientColor = (ratio) => {
      const r = Math.max(0, Math.min(1, ratio));
      let color;

      if (r < 0.5) {
        // Green to Yellow (0.0 to 0.5)
        const t = r * 2; // 0 to 1
        const r_val = Math.round(34 + t * (255 - 34));   // 34 to 255
        const g_val = Math.round(197 + t * (255 - 197)); // 197 to 255
        const b_val = Math.round(94 + t * (0 - 94));     // 94 to 0
        color = `rgba(${r_val}, ${g_val}, ${b_val}, 0.85)`;
      } else {
        // Yellow to Orange (0.5 to 1.0)
        const t = (r - 0.5) * 2; // 0 to 1
        const r_val = Math.round(255 + t * (255 - 255)); // 255 to 255
        const g_val = Math.round(255 + t * (140 - 255)); // 255 to 140
        const b_val = Math.round(0 + t * (0 - 0));       // 0 to 0
        color = `rgba(${r_val}, ${g_val}, ${b_val}, 0.85)`;
      }

      return color;
    };

    // Draw GGV surface/points with green-yellow-orange gradient
    const points = [];
    data.forEach(d => {
      // Create gradient based on normalized position (combination of lateral accel and velocity)
      const lateralRatio = Math.abs(d.lateralAccel) / maxLat;
      const velocityRatio = d.velocity / maxVel;
      const gradientRatio = (lateralRatio * 0.3 + velocityRatio * 0.7); // Weighted combination

      const color = getGradientColor(gradientRatio);

      if (d.maxAccel !== 0) {
        points.push({
          x: (d.lateralAccel / maxLat) * 50,
          y: (d.maxAccel / maxLong) * 50,
          z: (d.velocity / maxVel) * 50,
          color: color
        });
      }
      if (d.maxBrake !== 0) {
        points.push({
          x: (d.lateralAccel / maxLat) * 50,
          y: (d.maxBrake / maxLong) * 50,
          z: (d.velocity / maxVel) * 50,
          color: color
        });
      }
    });

    // Sort by z-depth for proper rendering
    points.sort((a, b) => {
      const pa = project3D(a.x, a.y, a.z, width, height, centerX, centerY);
      const pb = project3D(b.x, b.y, b.z, width, height, centerX, centerY);
      return pb.z - pa.z;
    });

    // Draw surface as lines connecting velocity levels
    if (showSurface) {
      velocities.forEach((vel, vIdx) => {
        const velPoints = data.filter(d => d.velocity === vel);

        // Use gradient color for surface lines based on velocity level
        const velocityRatio = vel / maxVel;
        ctx.strokeStyle = getGradientColor(velocityRatio);
        ctx.lineWidth = 1;

        velPoints.forEach((d, i) => {
          if (i === 0) return;
          const prev = velPoints[i - 1];
          const p1 = project3D(
            (prev.lateralAccel / maxLat) * 50,
            (prev.maxAccel / maxLong) * 50,
            (vel / maxVel) * 50,
            width, height, centerX, centerY
          );
          const p2 = project3D(
            (d.lateralAccel / maxLat) * 50,
            (d.maxAccel / maxLong) * 50,
            (vel / maxVel) * 50,
            width, height, centerX, centerY
          );
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        });
      });
    }

    // Draw points
    if (showPoints) {
      points.forEach(point => {
        const projected = project3D(point.x, point.y, point.z, width, height, centerX, centerY);
        ctx.fillStyle = point.color;
        ctx.beginPath();
        ctx.arc(projected.x, projected.y, 2, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  };

  useEffect(() => {
    drawScene();
  }, [data, rotation, zoom, showGrid, showPoints, showSurface]);

  // Mouse event setup - called from drawScene when canvas is ready
  const setupMouseEvents = (canvas) => {
    console.log('Setting up mouse events on ready canvas');

    const handleMouseDown = (e) => {
      e.preventDefault();
      console.log('Mouse down detected on canvas');
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e) => {
      if (!isDragging.current) return;

      e.preventDefault();
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;

      setRotation(prev => ({
        x: prev.x + dy * 0.5,
        y: prev.y + dx * 0.5
      }));

      lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      console.log('Mouse up detected');
      isDragging.current = false;
      canvas.style.cursor = 'grab';
    };

    // Remove any existing listeners first
    canvas.removeEventListener('mousedown', handleMouseDown);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);

    // Add fresh listeners
    canvas.addEventListener('mousedown', handleMouseDown, { capture: true });
    window.addEventListener('mousemove', handleMouseMove, { capture: true });
    window.addEventListener('mouseup', handleMouseUp, { capture: true });

    console.log('Mouse events successfully attached');
  };

  useEffect(() => {
    // Clean up function to remove any existing mouse events
    return () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = 'grab';
      }
    };
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center pt-16 animate-fadeIn">
        <div className="max-w-2xl w-full bg-gradient-to-br from-gray-900/80 to-gray-800/40 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex p-4 bg-cyan-500/10 rounded-full mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-cyan-500 border-t-transparent" />
            </div>
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
              Loading GGV Data...
            </h2>
            <p className="text-gray-400 text-lg">
              Processing your GGV diagram data
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center pt-16 animate-fadeIn">
        <div className="max-w-2xl w-full bg-gradient-to-br from-gray-900/80 to-gray-800/40 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 hover:border-cyan-500/30 transition-all">
          <div className="text-center mb-8">
            <div className="inline-flex p-4 bg-cyan-500/10 rounded-full mb-4">
              <FileText className="w-12 h-12 text-cyan-400" />
            </div>
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-cyan-300 to-purple-400 bg-clip-text text-transparent">
              GGV Diagram Visualizer
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed">
              Upload your GGV CSV file to visualize the 3D acceleration envelope
              and understand your car's performance limits.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <label
            htmlFor="ggv-file-upload"
            className="relative flex flex-col items-center justify-center w-full h-56 border-2 border-cyan-500/30 border-dashed rounded-xl cursor-pointer bg-black/20 hover:bg-cyan-500/5 hover:border-cyan-500/50 transition-all group"
          >
            <div className="flex flex-col items-center justify-center text-center p-6">
              <div className="p-4 bg-cyan-500/10 rounded-full mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-10 h-10 text-cyan-400" />
              </div>
              <p className="text-xl font-semibold text-white mb-2">
                Drop your GGV CSV file here
              </p>
              <p className="text-sm text-gray-400 mb-3">
                or click to browse files
              </p>
              <span className="text-xs text-gray-500 bg-gray-800/50 px-3 py-1 rounded-full">
                Max size: 10MB • Format: velocity, lateral_accel, max_accel, max_brake
              </span>
            </div>
            <input
              id="ggv-file-upload"
              type="file"
              className="hidden"
              accept=".csv"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>
    );
  }

  // Main content with data
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header with file info */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-900/80 to-gray-800/40 backdrop-blur-lg border border-gray-700/50 rounded-xl hover:border-cyan-500/30 transition-all animate-slideUp">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 rounded-lg">
            <FileText className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{fileName || 'GGV Data'}</h3>
            <p className="text-sm text-gray-400">{data.length.toLocaleString()} data points</p>
          </div>
        </div>
        <label
          htmlFor="ggv-file-upload-replace"
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/50 rounded-lg transition-all cursor-pointer group"
        >
          <Upload className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
          <span className="text-sm text-white">Upload New</span>
          <input
            id="ggv-file-upload-replace"
            type="file"
            className="hidden"
            accept=".csv"
            onChange={handleFileUpload}
          />
        </label>
      </div>

      {/* 3D Canvas */}
      <div className="bg-gradient-to-r from-gray-900/80 to-gray-800/40 backdrop-blur-lg border border-gray-700/50 rounded-xl p-6 animate-slideUp">

        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={1100}
            height={500}
            className="border border-gray-600 rounded-lg cursor-grab active:cursor-grabbing bg-gray-900 max-w-full h-auto"
            style={{ display: 'block' }}
          />
        </div>

          {/* Minimal Controls - positioned below canvas */}
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            <button
              onClick={() => setRotation({ x: -30, y: 45 })}
              className="p-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-cyan-500/50 rounded-lg transition-all group"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            </button>

            <button
              onClick={() => setZoom(z => Math.min(z + 0.2, 3))}
              className="p-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-cyan-500/50 rounded-lg transition-all group"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            </button>

            <button
              onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))}
              className="p-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-cyan-500/50 rounded-lg transition-all group"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            </button>

            <div className="w-px h-8 bg-gray-600 mx-2" />

            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-2 rounded-lg transition-all group ${
                showGrid
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-500'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-600 hover:border-cyan-500/50'
              }`}
              title={showGrid ? "Hide Grid" : "Show Grid"}
            >
              {showGrid ? <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" /> : <EyeOff className="w-4 h-4 group-hover:scale-110 transition-transform" />}
            </button>

            <button
              onClick={() => setShowPoints(!showPoints)}
              className={`p-2 rounded-lg transition-all group ${
                showPoints
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-500'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-600 hover:border-cyan-500/50'
              }`}
              title={showPoints ? "Hide Points" : "Show Points"}
            >
              {showPoints ? <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" /> : <EyeOff className="w-4 h-4 group-hover:scale-110 transition-transform" />}
            </button>

            <button
              onClick={() => setShowSurface(!showSurface)}
              className={`p-2 rounded-lg transition-all group ${
                showSurface
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-500'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-600 hover:border-cyan-500/50'
              }`}
              title={showSurface ? "Hide Surface" : "Show Surface"}
            >
              {showSurface ? <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" /> : <EyeOff className="w-4 h-4 group-hover:scale-110 transition-transform" />}
            </button>
          </div>

          <div className="text-center mt-2 text-xs text-gray-500">
            Click and drag to rotate • Hover for tooltips
          </div>
        </div>

      {/* Stats */}
      <div className="bg-gradient-to-r from-gray-900/80 to-gray-800/40 backdrop-blur-lg border border-gray-700/50 rounded-xl p-4 animate-slideUp">
        <div className="flex gap-6 text-sm text-gray-400">
          <div>Data points: <span className="text-cyan-400 font-semibold">{data.length}</span></div>
          <div>Rotation: <span className="text-cyan-400 font-semibold">X={rotation.x.toFixed(0)}° Y={rotation.y.toFixed(0)}°</span></div>
          <div>Zoom: <span className="text-cyan-400 font-semibold">{zoom.toFixed(1)}x</span></div>
        </div>
      </div>
    </div>
  );
};

export default GGVPage;
