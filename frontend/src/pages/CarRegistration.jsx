import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import FileUploadField from '../components/FileUploadField';
import VehicleMasterSelector from '../components/VehicleMasterSelector';
import { formatINR } from '../utils/policyCatalog';
import carBg from '../assets/backgrounds/CarRegistration.jpg';

const steps = ['Car Details', 'Documents', 'Vehicle Photos', 'Review & Submit'];

const DOC_FIELDS = [
  { key: 'rc_document', label: 'Registration Certificate (RC)', required: true, hint: 'Front/back of RC book or smart card' },
  { key: 'driving_license', label: 'Driving License', required: true, hint: 'Valid DL of registered owner' },
  { key: 'insurance_certificate', label: 'Insurance Certificate', required: false, hint: 'Previous or current policy copy' },
  { key: 'pollution_certificate', label: 'Pollution Certificate (PUC)', required: false, hint: 'Valid PUC if available' },
];

const initialMaster = {
  brand_id: '',
  model_id: '',
  brand: '',
  model: '',
  fuel_type: '',
  transmission: '',
  vehicle_master_id: '',
  year: '',
  accessory_value: '0',
  rc_date: '',
};

export default function CarRegistration() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [master, setMaster] = useState(initialMaster);
  const [valuation, setValuation] = useState(null);
  const [details, setDetails] = useState({
    license_plate: '',
    color: '',
    chassis_number: '',
  });
  const [documents, setDocuments] = useState({});
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setDetails({ ...details, [k]: v });
  const setDoc = (key, file) => setDocuments((prev) => ({ ...prev, [key]: file }));

  const validateStep = () => {
    if (step === 0) {
      if (!master.brand_id || !master.model_id) {
        return 'Please select brand and car model from the catalogue.';
      }
      if (!master.brand || !master.model || !master.fuel_type || !master.transmission) {
        return 'Please complete vehicle selection from the catalogue.';
      }
      if (!master.vehicle_master_id || !master.year) {
        return 'Please select variant and manufacturing year.';
      }
      if (!valuation?.valuation?.final_idv) {
        return 'Waiting for IDV calculation — check year and variant.';
      }
      if (!details.license_plate) {
        return 'License plate is required.';
      }
    }
    if (step === 1) {
      if (!documents.rc_document) return 'Please upload the RC document.';
      if (!documents.driving_license) return 'Please upload the driving license.';
    }
    if (step === 2 && images.length < 3) {
      return 'Please upload at least 3 vehicle photos.';
    }
    return '';
  };

  const next = () => {
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    setError('');
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const submit = async () => {
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/api/vehicles', {
        vehicle_master_id: parseInt(master.vehicle_master_id, 10),
        brand_id: parseInt(master.brand_id, 10),
        model_id: parseInt(master.model_id, 10),
        year: parseInt(master.year, 10),
        license_plate: details.license_plate,
        color: details.color,
        chassis_number: details.chassis_number,
        rc_date: master.rc_date || undefined,
        accessory_value: parseFloat(master.accessory_value || 0),
      });
      const vehicleId = res.data.vehicle.id;

      const docFd = new FormData();
      Object.entries(documents).forEach(([key, file]) => {
        if (file) docFd.append(key, file);
      });
      if ([...docFd.keys()].length > 0) {
        await api.post(`/api/vehicles/${vehicleId}/documents`, docFd);
      }

      if (images.length) {
        const imgFd = new FormData();
        images.forEach((f) => imgFd.append('images', f));
        await api.post(`/api/vehicles/${vehicleId}/images`, imgFd);
      }

      await api.post(`/api/vehicles/${vehicleId}/submit-for-verification`);
      navigate(`/customer/video-verification/${vehicleId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  const val = valuation?.valuation;
  const vm = valuation?.vehicle_master;

  return (
    <div
      className="relative min-h-[90vh] py-10"
      style={{ backgroundImage: `url(${carBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 mx-auto max-w-3xl px-4">
        <div className="glass glass-form p-8 text-white">
          <h1 className="mb-2 text-2xl font-bold">Vehicle Registration</h1>
          <p className="mb-6 text-sm text-white/70">
            Select your vehicle from the master catalogue — ex-showroom price and IDV are calculated automatically.
          </p>

          <div className="mb-8 flex items-center justify-between">
            {steps.map((s, i) => (
              <div key={s} className="flex flex-1 items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  i <= step ? 'bg-brand text-white' : 'bg-white/20 text-white/60'}`}>
                  {i + 1}
                </div>
                <span className="ml-2 hidden text-xs sm:block">{s}</span>
                {i < steps.length - 1 && <div className="mx-2 h-0.5 flex-1 bg-white/20" />}
              </div>
            ))}
          </div>

          {error && <div className="mb-4 rounded-lg bg-red-500/20 px-4 py-2 text-sm">{error}</div>}

          {step === 0 && (
            <div className="space-y-6">
              <VehicleMasterSelector
                value={master}
                onChange={setMaster}
                onValuation={setValuation}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="License Plate *">
                  <input className="input uppercase" value={details.license_plate}
                    onChange={(e) => set('license_plate', e.target.value.toUpperCase())} />
                </Field>
                <Field label="Chassis Number">
                  <input className="input" value={details.chassis_number}
                    onChange={(e) => set('chassis_number', e.target.value.toUpperCase())} />
                </Field>
                <Field label="Color">
                  <input className="input" value={details.color} onChange={(e) => set('color', e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {DOC_FIELDS.map((doc) => (
                <FileUploadField
                  key={doc.key}
                  label={doc.label}
                  hint={doc.hint}
                  required={doc.required}
                  file={documents[doc.key]}
                  onChange={(file) => setDoc(doc.key, file)}
                />
              ))}
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-white/40 bg-white px-4 py-10 text-center">
                <input type="file" multiple accept="image/*" className="hidden"
                  onChange={(e) => setImages([...images, ...Array.from(e.target.files)])} />
                <p className="font-semibold text-ink">Click to upload vehicle photos</p>
                <p className="text-sm text-slate-500">Front, back, sides, interior — minimum 3 images</p>
              </label>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {images.map((f, i) => (
                  <div key={i} className="relative">
                    <img src={URL.createObjectURL(f)} alt="" className="h-24 w-full rounded-lg object-cover" />
                    <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))}
                      className="absolute right-1 top-1 rounded-full bg-red-500 px-2 text-xs text-white">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="rounded-xl bg-white/90 p-4 text-sm text-ink">
              <p className="mb-3 font-semibold text-navy">Submission summary</p>
              <div className="space-y-1">
                <Row label="Brand" value={vm?.brand || master.brand} />
                <Row label="Model" value={vm?.model || master.model} />
                <Row label="Variant" value={vm?.variant} />
                <Row label="Fuel" value={vm?.fuel_type || master.fuel_type} />
                <Row label="Transmission" value={vm?.transmission || master.transmission} />
                <Row label="Year" value={master.year} />
                <Row label="Ex-Showroom" value={formatINR(vm?.ex_showroom_price)} />
                <Row label="IDV" value={formatINR(val?.final_idv)} />
                <Row label="Max Claim" value={formatINR(val?.max_claim_amount)} />
                <Row label="License Plate" value={details.license_plate} />
              </div>
              <p className="mt-3 text-slate-600">
                Documents: {Object.keys(documents).filter((k) => documents[k]).length} uploaded
              </p>
              <p className="text-slate-600">{images.length} vehicle photo(s) ready.</p>
            </div>
          )}

          <div className="mt-8 flex justify-between">
            <button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)}
              className="rounded-xl border border-white/40 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-30">
              Back
            </button>
            {step < steps.length - 1 ? (
              <button type="button" onClick={next} className="btn-brand">Next</button>
            ) : (
              <button type="button" onClick={submit} disabled={busy} className="btn-brand">
                {busy ? 'Submitting...' : 'Submit & Start Video KYC'}
              </button>
            )}
          </div>
        </div>
      </div>
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

function Row({ label, value }) {
  return (
    <div className="flex justify-between border-b border-slate-200 py-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium">{value || '—'}</span>
    </div>
  );
}
