import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import claimBg from '../assets/backgrounds/InsuranceClaim.jpg';
import { formatINR } from '../utils/policyCatalog';

const DAMAGE_TYPES = ['Minor', 'Major', 'Total Loss'];
const CAUSES = ['Collision', 'Natural Disaster', 'Theft'];

const LOADING_STEPS = [
  { key: 'submit', label: 'Submitting claim…' },
  { key: 'upload', label: 'Uploading damage images…' },
  { key: 'ai', label: 'Running AI damage detection…' },
  { key: 'report', label: 'Generating assessment report…' },
];

export default function Claim() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({
    vehicle_id: '', damage_type: 'Minor', cause: 'Collision',
    incident_date: '', police_report: '', witness_info: '', description: '',
  });
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/api/vehicles').then((r) => setVehicles(r.data.vehicles));
  }, []);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => String(v.id) === String(form.vehicle_id)),
    [vehicles, form.vehicle_id],
  );

  const maxClaim = selectedVehicle?.max_claim_amount || selectedVehicle?.calculated_idv;
  const set = (k, v) => setForm({ ...form, [k]: v });

  const submitClaim = async (e) => {
    e.preventDefault();
    if (images.length < 1) {
      setMsg('Please upload at least one damage image for AI assessment.');
      return;
    }
    setBusy(true);
    setMsg('');
    setLoadingStep('submit');
    try {
      const r = await api.post('/api/claims', form);
      const created = r.data.claim;

      setLoadingStep('upload');
      const fd = new FormData();
      images.forEach((f) => fd.append('images', f));
      await api.post(`/api/claims/${created.id}/images`, fd);

      setLoadingStep('ai');
      await api.post(`/api/claims/${created.id}/analyze`);

      setLoadingStep('report');
      navigate(`/customer/claims/${created.id}/assessment`, { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const serverMsg = err.response?.data?.error;
      if (status === 503) {
        setMsg(serverMsg || 'AI service is unavailable. Start the prediction API on http://127.0.0.1:8000 and try again.');
      } else if (status === 504) {
        setMsg(serverMsg || 'AI analysis timed out. Please try again with a smaller image.');
      } else if (serverMsg) {
        setMsg(serverMsg);
      } else {
        setMsg(`Failed to submit claim${status ? ` (HTTP ${status})` : ''}.`);
      }
      setBusy(false);
      setLoadingStep('');
    }
  };

  const activeStep = LOADING_STEPS.findIndex((s) => s.key === loadingStep);

  return (
    <div
      className="relative min-h-[90vh] py-10"
      style={{ backgroundImage: `url(${claimBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 mx-auto max-w-3xl px-4">
        <div className="glass p-8 text-white">
          <h1 className="mb-6 text-2xl font-bold">File Insurance Claim</h1>
          {msg && <div className="mb-4 rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-100">{msg}</div>}

          <form onSubmit={submitClaim} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Select Vehicle *">
              <select required className="input text-ink" value={form.vehicle_id}
                onChange={(e) => set('vehicle_id', e.target.value)} disabled={busy}>
                <option value="">Choose vehicle</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.make} {v.model} {v.variant ? `(${v.variant})` : ''} — {v.license_plate}
                  </option>
                ))}
              </select>
            </Field>
            {maxClaim ? (
              <div className="sm:col-span-2 rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-white">
                Maximum payable claim for this vehicle (current IDV):{' '}
                <strong>{formatINR(maxClaim)}</strong>
              </div>
            ) : null}
            <Field label="Damage Type *">
              <select className="input text-ink" value={form.damage_type}
                onChange={(e) => set('damage_type', e.target.value)} disabled={busy}>
                {DAMAGE_TYPES.map((d) => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Cause of Accident *">
              <select className="input text-ink" value={form.cause}
                onChange={(e) => set('cause', e.target.value)} disabled={busy}>
                {CAUSES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Date of Accident *">
              <input type="date" required className="input text-ink" value={form.incident_date}
                onChange={(e) => set('incident_date', e.target.value)} disabled={busy} />
            </Field>
            <Field label="Police Complaint No.">
              <input className="input text-ink" value={form.police_report}
                onChange={(e) => set('police_report', e.target.value)} disabled={busy} />
            </Field>
            <Field label="Witness Information">
              <input className="input text-ink" value={form.witness_info}
                onChange={(e) => set('witness_info', e.target.value)} disabled={busy} />
            </Field>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-white/90">Description of Damage</label>
              <textarea rows={3} required className="input text-ink" value={form.description}
                onChange={(e) => set('description', e.target.value)} disabled={busy} />
            </div>
            <div className="sm:col-span-2">
              <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-white/40 p-6 text-center">
                <input type="file" multiple accept="image/*" className="hidden" disabled={busy}
                  onChange={(e) => setImages([...images, ...Array.from(e.target.files)])} />
                <p className="font-semibold">Upload damage images for AI assessment</p>
                <p className="mt-1 text-xs text-white/70">At least 1 image required</p>
              </label>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {images.map((f, i) => (
                  <img key={i} src={URL.createObjectURL(f)} alt="" className="h-20 w-full rounded object-cover" />
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy} className="btn-brand w-full">
                {busy ? 'Processing…' : 'Submit Claim & Run AI Assessment'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {busy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
            <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-4 border-brand border-t-transparent" />
            <h2 className="text-center text-lg font-bold text-navy">AI Damage Assessment in Progress</h2>
            <p className="mt-2 text-center text-sm text-slatey">Please wait — do not refresh the page.</p>
            <ul className="mt-6 space-y-2">
              {LOADING_STEPS.map((step, i) => (
                <li key={step.key} className={`flex items-center gap-2 text-sm ${
                  i <= activeStep ? 'text-navy font-medium' : 'text-slate-400'
                }`}>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    i < activeStep ? 'bg-brand text-white' : i === activeStep ? 'bg-navy text-white' : 'bg-slate-200'
                  }`}>
                    {i < activeStep ? '✓' : i + 1}
                  </span>
                  {step.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-white/90">{label}</label>
      {children}
    </div>
  );
}
