import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { ChartFrame } from './ScientificCharts';

// Orthographic scientific surface. Redraw only on resize/data/view changes; no idle render loop.
export default function GGVSurface({ data }) {
  const canvasRef = useRef(null), drag = useRef(null);
  const [view, setView] = useState({ azimuth: -35, elevation: 28 });
  const [size, setSize] = useState({ width: 800, height: 360 });
  const mesh = useMemo(() => {
    const allV = [...new Set(data.map(r => r.velocity_ms))].sort((a, b) => a - b);
    const allY = [...new Set(data.map(r => Math.abs(r.lateral_accel_ms2)))].sort((a, b) => a - b);
    const reduce = (a, n) => a.length <= n ? a : [...new Set(Array.from({ length: n }, (_, i) => a[Math.round(i * (a.length - 1) / (n - 1))]))];
    const velocities = reduce(allV, 40), magnitudes = reduce(allY, 25);
    const lateral = [...magnitudes.filter(y => y > 0).reverse().map(y => -y), ...magnitudes];
    const lookup = new Map(data.map(r => [`${r.velocity_ms}|${Math.abs(r.lateral_accel_ms2)}`, r]));
    const vmax = Math.max(...allV, 1), ymax = Math.max(...allY, 1);
    const zmax = data.reduce((max, r) => Math.max(max, Math.abs(r.max_accel_ms2), Math.abs(r.max_brake_ms2)), 1);
    const surfaces = [];
    for (const mode of ['accel', 'brake']) {
      const vertex = (v, y) => {
        const r = lookup.get(`${v}|${Math.abs(y)}`);
        if (!r || r[`${mode}_feasible`] === 0 || r[`${mode}_feasible`] === false) return null;
        const value = mode === 'accel' ? r.max_accel_ms2 : -Math.abs(r.max_brake_ms2);
        return [v / vmax - .5, y / ymax * .5, value / zmax * .6];
      };
      for (let i = 1; i < velocities.length; i++) for (let j = 1; j < lateral.length; j++) {
        const vertices = [vertex(velocities[i - 1], lateral[j - 1]), vertex(velocities[i], lateral[j - 1]),
          vertex(velocities[i], lateral[j]), vertex(velocities[i - 1], lateral[j])];
        if (vertices.every(Boolean)) surfaces.push({ mode, vertices });
      }
    }
    return { surfaces, vmax, ymax, zmax };
  }, [data]);
  useEffect(() => {
    const element = canvasRef.current?.parentElement;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !size.width || !size.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(size.width * dpr); canvas.height = Math.round(size.height * dpr);
    const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr); ctx.fillStyle = '#141d26'; ctx.fillRect(0, 0, size.width, size.height);
    const az = view.azimuth * Math.PI / 180, el = view.elevation * Math.PI / 180;
    const scale = Math.min(size.width / 1.7, size.height / 1.8), cx = size.width * .51, cy = size.height * .48;
    const project = ([x, y, z]) => {
      const rx = x * Math.cos(az) - y * Math.sin(az), ry = x * Math.sin(az) + y * Math.cos(az);
      return { x: cx + rx * scale, y: cy - (ry * Math.sin(el) + z * Math.cos(el)) * scale,
        depth: ry * Math.cos(el) - z * Math.sin(el) };
    };
    const line = (a, b, color = '#405460', width = .7) => {
      const p = project(a), q = project(b); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
    };
    for (let i = 0; i <= 4; i++) { const p = -.5 + i / 4; line([p, -.5, 0], [p, .5, 0]); line([-.5, p, 0], [.5, p, 0]); }
    const polygons = mesh.surfaces.map(face => ({ ...face, points: face.vertices.map(project) }))
      .sort((a, b) => b.points.reduce((s, p) => s + p.depth, 0) - a.points.reduce((s, p) => s + p.depth, 0));
    for (const face of polygons) {
      ctx.beginPath(); face.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
      ctx.fillStyle = face.mode === 'accel' ? '#83bdcc88' : '#ab9dcc88'; ctx.fill();
      ctx.strokeStyle = face.mode === 'accel' ? '#83bdcc45' : '#ab9dcc45'; ctx.lineWidth = .45; ctx.stroke();
    }
    const label = (point, text, dx = 0, dy = 0, color = '#b4c9d5') => {
      const p = project(point); ctx.fillStyle = color; ctx.font = '10px Consolas, monospace'; ctx.fillText(text, p.x + dx, p.y + dy);
    };
    line([-.5, -.5, 0], [.5, -.5, 0], '#a1b7c4', 1);
    line([-.5, -.5, 0], [-.5, .5, 0], '#a1b7c4', 1);
    line([-.5, -.5, -.6], [-.5, -.5, .6], '#a1b7c4', 1);
    for (let i = 0; i <= 2; i++) {
      const p = -.5 + i / 2;
      label([p, -.5, 0], `${Math.round(i / 2 * mesh.vmax * 3.6)}`, -5, 15);
      label([-.5, p, 0], `${((i - 1) * mesh.ymax / 9.81).toFixed(1)}`, -24, 2);
      label([-.5, -.5, (i - 1) * .6], `${((i - 1) * mesh.zmax / 9.81).toFixed(1)}`, -26, -5);
    }
    label([.58, -.5, 0], 'V / km/h', 0, 14); label([-.5, .58, 0], 'Ay / g', -15, -8); label([-.5, -.5, .69], 'Ax / g', -15, -4);
    ctx.fillStyle = '#b4c9d5'; ctx.font = '11px Consolas, monospace'; ctx.fillText('GGV · Acceleration (cyan) / braking (purple)', 15, 20);
    ctx.fillStyle = '#839da9'; ctx.font = '10px Consolas, monospace'; ctx.fillText('ORTHOGRAPHIC · drag to rotate', 15, size.height - 12);
  }, [mesh, size, view]);
  const exportPNG = () => {
    const link = document.createElement('a'); link.download = 'GGV-surface.png';
    link.href = canvasRef.current.toDataURL('image/png'); link.click();
  };
  return <div className="ggv-surface"><div className="surface-controls"><span><i className="surface-key accel" />Acceleration <i className="surface-key brake" />Braking</span>
    <label>Azimuth<input aria-label="Surface azimuth" type="range" min="-180" max="180" value={view.azimuth} onChange={e => setView(v => ({ ...v, azimuth: Number(e.target.value) }))} />{view.azimuth.toFixed(0)}°</label>
    <label>Elevation<input aria-label="Surface elevation" type="range" min="5" max="85" value={view.elevation} onChange={e => setView(v => ({ ...v, elevation: Number(e.target.value) }))} />{view.elevation.toFixed(0)}°</label>
    <button className="icon-button" aria-label="Reset 3D view" onClick={() => setView({ azimuth: -35, elevation: 28 })}><RotateCcw size={14} /></button>
    <button className="button secondary" onClick={exportPNG}><Download size={14} />Export PNG</button></div>
    <ChartFrame title="3D GGV surface" units="V / km/h · Ay / g · Ax / g" formula="Feasible acceleration and braking branches. Axes normalized to fit; ticks show physical values. Lateral magnitude is mirrored. Display mesh is reduced; 2D slices retain all samples.">
      <canvas ref={canvasRef} className="surface-canvas" role="img" aria-label="Rotatable three-dimensional GGV acceleration and braking envelope" onPointerDown={e => { drag.current = { x: e.clientX, y: e.clientY, ...view }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={e => { if (drag.current) { const d = drag.current; setView({ azimuth: Math.max(-180, Math.min(180, d.azimuth + (e.clientX - d.x) * .4)), elevation: Math.max(5, Math.min(85, d.elevation + (e.clientY - d.y) * .3)) }); } }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
    </ChartFrame></div>;
}
