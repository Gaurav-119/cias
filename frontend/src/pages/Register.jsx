import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FileUploadField from '../components/FileUploadField';
import registerBg from '../assets/backgrounds/UserRegistration.jpg';
import {
  ID_NUMBER_HINTS,
  ID_PROOF_TYPES,
  INDIAN_CITIES,
  stateForCity,
} from '../utils/registration';
import {
  formatIndianMobileDisplay,
  INDIAN_MOBILE_ERROR,
  isValidIndianMobile,
  parseIndianMobileDigits,
  toIndianMobileE164,
} from '../utils/phone';

const STEPS = ['Personal Details', 'Identity KYC', 'Create Account'];

const initialForm = {
  full_name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  date_of_birth: '',
  identity_proof_type: 'aadhaar',
  identity_proof_number: '',
  password: '',
  confirmPassword: '',
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [identityProof, setIdentityProof] = useState(null);
  const [passportPhoto, setPassportPhoto] = useState(null);
  const [addressProof, setAddressProof] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onCityChange = (city) => {
    setForm((prev) => ({
      ...prev,
      city,
      state: stateForCity(city) || prev.state,
    }));
  };

  const validateStep = () => {
    if (step === 0) {
      if (!form.full_name || !form.email || !form.phone || !form.date_of_birth || !form.address || !form.city || !form.pincode) {
        return 'Please complete all required personal details.';
      }
      if (!isValidIndianMobile(form.phone)) {
        return INDIAN_MOBILE_ERROR;
      }
    }
    if (step === 1) {
      if (!form.identity_proof_number) return 'Please enter your identity document number.';
      if (!identityProof) return 'Please upload your identity proof document.';
      if (!passportPhoto) return 'Please upload a passport-size photo.';
    }
    if (step === 2) {
      if (!form.password || form.password.length < 8) return 'Password must be at least 8 characters.';
      if (form.password !== form.confirmPassword) return 'Passwords do not match.';
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
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async (e) => {
    e.preventDefault();
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === 'confirmPassword' || !value) return;
        fd.append(key, key === 'phone' ? toIndianMobileE164(value) : value);
      });
      if (identityProof) fd.append('identity_proof', identityProof);
      if (passportPhoto) fd.append('passport_photo', passportPhoto);
      if (addressProof) fd.append('address_proof', addressProof);
      await register(fd);
      navigate('/customer/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-[90vh] py-12"
      style={{ backgroundImage: `url(${registerBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 mx-auto max-w-3xl px-4">
        <div className="glass glass-form p-8 text-white">
          <h1 className="mb-2 text-center text-2xl font-bold">Register for Claim Nova</h1>
          <p className="mb-6 text-center text-sm text-white/70">
            Complete identity verification to register your vehicle and buy insurance.
          </p>

          <Stepper steps={STEPS} active={step} />

          {error && (
            <div className="mb-4 rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-100">{error}</div>
          )}

          <form onSubmit={submit}>
            {step === 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full Name *">
                  <input className="input" required value={form.full_name}
                    onChange={(e) => set('full_name', e.target.value)} />
                </Field>
                <Field label="Email Address *">
                  <input type="email" className="input" required value={form.email}
                    onChange={(e) => set('email', e.target.value)} />
                </Field>
                <Field label="Mobile Number *">
                  <div className="input-phone-group">
                    <span className="input-phone-prefix">+91</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      className="input flex-1"
                      placeholder="9876543210"
                      required
                      maxLength={10}
                      value={form.phone}
                      onChange={(e) => set('phone', parseIndianMobileDigits(e.target.value))}
                    />
                  </div>
                  <p className="mt-1 text-xs text-white/60">10-digit Indian mobile number only</p>
                </Field>
                <Field label="Date of Birth *">
                  <input
                    type="date"
                    className="input"
                    required
                    max={new Date().toISOString().split('T')[0]}
                    value={form.date_of_birth}
                    onChange={(e) => set('date_of_birth', e.target.value)}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Address *">
                    <input className="input" required value={form.address}
                      onChange={(e) => set('address', e.target.value)} />
                  </Field>
                </div>
                <Field label="City *">
                  <select className="input" required value={form.city} onChange={(e) => onCityChange(e.target.value)}>
                    <option value="">Select city</option>
                    {INDIAN_CITIES.map((city) => <option key={city} value={city}>{city}</option>)}
                  </select>
                </Field>
                <Field label="State">
                  <input className="input" readOnly value={form.state}
                    placeholder="Auto-filled from city" />
                </Field>
                <Field label="PIN Code *">
                  <input className="input" required maxLength={6} value={form.pincode}
                    onChange={(e) => set('pincode', e.target.value)} />
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <Field label="Identity Proof Type *">
                  <select className="input" value={form.identity_proof_type}
                    onChange={(e) => set('identity_proof_type', e.target.value)}>
                    {ID_PROOF_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Identity Document Number *">
                  <input
                    className="input"
                    required
                    value={form.identity_proof_number}
                    placeholder={ID_NUMBER_HINTS[form.identity_proof_type]}
                    onChange={(e) => set('identity_proof_number', e.target.value)}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FileUploadField
                    label="Upload Identity Proof"
                    hint="Aadhaar / PAN / Passport scan (JPG, PNG, PDF)"
                    required
                    file={identityProof}
                    onChange={setIdentityProof}
                  />
                  <FileUploadField
                    label="Passport-size Photo"
                    hint="Clear front-facing photo for KYC"
                    required
                    accept="image/*"
                    file={passportPhoto}
                    onChange={setPassportPhoto}
                  />
                </div>
                <FileUploadField
                  label="Address Proof (optional)"
                  hint="Utility bill or bank statement if address differs from ID"
                  file={addressProof}
                  onChange={setAddressProof}
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="rounded-xl bg-white/90 p-4 text-sm text-ink">
                  <p className="font-semibold text-navy">Review your details</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <ReviewRow label="Name" value={form.full_name} />
                    <ReviewRow label="Email" value={form.email} />
                    <ReviewRow label="Phone" value={formatIndianMobileDisplay(form.phone)} />
                    <ReviewRow label="Date of Birth" value={form.date_of_birth} />
                    <ReviewRow label="City" value={`${form.city}, ${form.state}`} />
                    <ReviewRow label="ID Type" value={ID_PROOF_TYPES.find((i) => i.value === form.identity_proof_type)?.label} />
                    <ReviewRow label="Documents" value={`${identityProof ? 'ID ✓' : ''} ${passportPhoto ? 'Photo ✓' : ''}`} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Password *">
                    <input type="password" className="input" required minLength={8}
                      value={form.password} onChange={(e) => set('password', e.target.value)} />
                  </Field>
                  <Field label="Confirm Password *">
                    <input type="password" className="input" required
                      value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} />
                  </Field>
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-between">
              <button
                type="button"
                disabled={step === 0}
                onClick={() => setStep((s) => s - 1)}
                className="rounded-xl border border-white/40 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-30"
              >
                Back
              </button>
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={next} className="btn-brand px-6 py-2.5 text-sm">
                  Next
                </button>
              ) : (
                <button type="submit" disabled={loading} className="btn-brand px-6 py-2.5 text-sm">
                  {loading ? 'Registering...' : 'Register'}
                </button>
              )}
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-white/80">
            Already have an account?{' '}
            <Link to="/login/user" className="font-semibold text-brand">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Stepper({ steps, active }) {
  return (
    <div className="mb-8 flex items-center justify-between">
      {steps.map((label, index) => (
        <div key={label} className="flex flex-1 items-center">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
            index <= active ? 'bg-brand text-white' : 'bg-white/20 text-white/60'
          }`}>
            {index + 1}
          </div>
          <span className="ml-2 hidden text-xs sm:block">{label}</span>
          {index < steps.length - 1 && <div className="mx-2 h-0.5 flex-1 bg-white/20" />}
        </div>
      ))}
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

function ReviewRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-200 py-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-navy">{value || '-'}</span>
    </div>
  );
}
