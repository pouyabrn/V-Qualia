import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { carsAPI } from '../../utils/api';
import { TracePlot } from '../charts/ScientificCharts';
const units = { mass: 'kg', cog_height: 'm', wheelbase: 'm', frontal_area: 'm²', ClA: 'm²', CdA: 'm²', air_density: 'kg/m³', tire_radius: 'm', max_rpm: 'rpm', min_rpm: 'rpm', shift_time: 's', max_brake_force: 'N', Fz0: 'N', track_width: 'm', rolling_resistance: 'ratio', wheel_inertia: 'kg·m²', engine_inertia: 'kg·m²' };
const blank = { name: 'New_vehicle', mass: { mass: 1000, cog_height: .5, wheelbase: 2.5, weight_distribution: .5 }, aerodynamics: { Cl: 0, Cd: .3, frontal_area: 2, air_density: 1.225 }, tire: { mu_x: 1, mu_y: 1, load_sensitivity: 1, tire_radius: .3 }, powertrain: { drive: 'RWD', engine_torque_curve: { 1000: 150, 6000: 200 }, gear_ratios: [3.5, 2.2, 1.5, 1, .8], final_drive: 4, efficiency: .9, max_rpm: 6000, min_rpm: 1000 }, brake: { max_brake_force: 20000, brake_bias: .6 } };
export default function CarsPage() {
  const [cars, setCars] = useState([]), [selected, setSelected] = useState(''), [form, setForm] = useState(null), [jsonText, setJsonText] = useState(''), [gearText, setGearText] = useState('');
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const select = useCallback((car, existing = true) => { setSelected(existing ? car.name : ''); setForm(structuredClone(car)); setJsonText(JSON.stringify(car, null, 2)); setGearText(car.powertrain.gear_ratios.join(', ')); setMessage(''); }, []);
  const load = useCallback(async () => { try { const r = await carsAPI.getAll(); setCars(r.cars); if (r.cars.length) select(r.cars[0]); } catch (e) { setError(e.message); } }, [select]);
  useEffect(() => { load(); }, [load]);
  const change = (section, key, value) => { const next = section ? { ...form, [section]: { ...form[section], [key]: value } } : { ...form, [key]: value }; setForm(next); setJsonText(JSON.stringify(next, null, 2)); };
  const save = async e => { e.preventDefault(); setBusy(true); setError('');
    try { const ratios = gearText.split(',').map(v => Number(v.trim())); if (!ratios.length || ratios.some(v => !Number.isFinite(v) || v <= 0)) throw new Error('Gear ratios must be positive numbers separated by commas.');
      const payload = { ...form, powertrain: { ...form.powertrain, gear_ratios: ratios } };
      const r = selected ? await carsAPI.update(selected, payload) : await carsAPI.create(payload); select(r.car); setCars((await carsAPI.getAll()).cars); setMessage('Vehicle saved.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const remove = async () => { if (!selected || !window.confirm(`Delete vehicle ${selected}?`)) return;
    try { await carsAPI.delete(selected); setForm(null); setSelected(''); await load(); } catch (e) { setError(e.message); }
  };
  const applyJSON = () => { try { const value = JSON.parse(jsonText); if (!value.name || !value.powertrain?.gear_ratios || !value.mass || !value.aerodynamics || !value.tire || !value.brake) throw new Error('Missing engine car sections.'); const original = selected; select(value, false); setSelected(original); setError(''); setMessage('JSON applied to the editor. Save to store this vehicle.'); } catch (e) { setError(e.message); } };
  const torque = form ? Object.entries(form.powertrain.engine_torque_curve).map(([rpm, value]) => ({ rpm: Number(rpm), torque_nm: value })).sort((a, b) => a.rpm - b.rpm) : [];
  return <div><div className="page-heading"><div><div className="eyebrow">VEHICLE PARAMETERS</div><h1>Vehicles</h1><p>Edit physical inputs. Advanced sections are preserved when saving.</p></div><button className="button" onClick={() => select(blank, false)}><Plus size={15} />New vehicle</button></div>
    {error && <p className="error-message" role="alert">{error}</p>}{message && <p className="status-message" role="status">{message}</p>}
    <div className="library-layout"><aside className="library-list" aria-label="Vehicle library">{cars.map(c => <button key={c.name} className={selected === c.name ? 'selected' : ''} onClick={() => select(c)}>{c.name}<span>{c.mass.mass} kg · {c.powertrain.drive || 'RWD'}</span></button>)}</aside>
      {form && <form className="vehicle-editor" onSubmit={save}><div className="dataset-bar"><label>Vehicle name<input value={form.name} required onChange={e => change(null, 'name', e.target.value)} /></label><button className="button primary" disabled={busy}><Save size={14} />Save vehicle</button><button type="button" className="icon-button" aria-label="Delete selected vehicle" disabled={!selected} onClick={remove}><Trash2 size={15} /></button></div>
        <div className="editor-grid">{['mass', 'aerodynamics', 'tire', 'powertrain', 'brake'].map(section => <fieldset key={section} className="parameter-section"><legend>{section === 'mass' ? 'Mass & dimensions' : section}</legend>{Object.entries(form[section]).filter(([, v]) => typeof v === 'number').map(([key, v]) => <label key={key}>{key.replace(/_/g, ' ')}<span>{units[key] || '—'}</span><input type="number" step="any" value={v} required onChange={e => change(section, key, Number(e.target.value))} /></label>)}
          {section === 'powertrain' && <><label>Drive axle<select value={form.powertrain.drive || 'RWD'} onChange={e => change('powertrain', 'drive', e.target.value)}>{['FWD', 'RWD', 'AWD'].map(d => <option key={d}>{d}</option>)}</select></label><label>Gear ratios<input value={gearText} required onChange={e => setGearText(e.target.value)} /></label></>}
          {section === 'aerodynamics' && <p className="method-note">Fdrag = ½ρCdAv². Cl &lt; 0 represents downforce; positive ClA is downforce coefficient × area.</p>}{section === 'tire' && <p className="method-note">Effective coefficients. Use the complete JSON for reference load and combined-slip settings.</p>}
        </fieldset>)}</div><TracePlot data={torque} title="Engine torque curve" units="N·m" xKey="rpm" xLabel="Engine speed / rpm" xUnit="rpm" channels={[{ key: 'torque_nm', label: 'Torque' }]} formula="P = τω · edit torque points in the complete vehicle JSON." />
        <details className="advanced-editor"><summary>Complete vehicle JSON · ERS, DRS, tire maps and inertia</summary><p className="method-note">Preserves fields beyond the basic editor. Apply changes here, then save the vehicle.</p><textarea aria-label="Complete vehicle JSON" rows="20" value={jsonText} onChange={e => setJsonText(e.target.value)} spellCheck={false} /><button type="button" className="button secondary" onClick={applyJSON}>Apply JSON to editor</button></details>
      </form>}
    </div>
  </div>;
}
