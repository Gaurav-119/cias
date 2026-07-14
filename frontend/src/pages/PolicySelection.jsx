import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import policyBg from '../assets/backgrounds/InsuranceClaim.jpg';
import {
  formatDate,
  formatINR,
  isNewlyRegisteredVehicle,
  POLICY_CATALOG,
} from '../utils/policyCatalog';

const POLICY_IDS = POLICY_CATALOG.map((p) => p.id);

export default function PolicySelection() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [catalog, setCatalog] = useState({ providers: [], addons: [] });
  const [sel, setSel] = useState({
    vehicle_id: '',
    provider_id: '',
    policy_type: '',
    tenure_years: 1,
    addon_ids: [],
  });
  const [quotes, setQuotes] = useState({});
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/vehicles').then((r) => setVehicles(r.data.vehicles || []));
    api.get('/api/policies/catalog').then((r) => setCatalog(r.data));
  }, []);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => String(v.id) === String(sel.vehicle_id)),
    [vehicles, sel.vehicle_id],
  );

  const selectedProvider = useMemo(
    () => catalog.providers.find((p) => String(p.id) === String(sel.provider_id)),
    [catalog.providers, sel.provider_id],
  );

  const allowMultiYear = isNewlyRegisteredVehicle(selectedVehicle);
  const activeQuote = sel.policy_type ? quotes[sel.policy_type] : null;

  const fetchQuotes = useCallback(async (policyType, addonIds = sel.addon_ids) => {
    if (!sel.vehicle_id || !sel.provider_id) return null;
    const payload = {
      vehicle_id: sel.vehicle_id,
      provider_id: sel.provider_id,
      tenure_years: sel.tenure_years,
      policy_type: policyType,
      addon_ids: addonIds,
    };
    const r = await api.post('/api/policies/quote', payload);
    return r.data.quote;
  }, [sel.vehicle_id, sel.provider_id, sel.tenure_years, sel.addon_ids]);

  useEffect(() => {
    if (!sel.vehicle_id || !sel.provider_id) {
      setQuotes({});
      return undefined;
    }

    let cancelled = false;
    setQuoteLoading(true);
    setError('');

    Promise.all(
      POLICY_IDS.map(async (type) => {
        try {
          const quote = await fetchQuotes(type, sel.policy_type === type ? sel.addon_ids : []);
          return [type, quote];
        } catch {
          return [type, null];
        }
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        setQuotes(Object.fromEntries(entries));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Could not load policy premiums.');
        }
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });

    return () => { cancelled = true; };
  }, [sel.vehicle_id, sel.provider_id, sel.tenure_years, fetchQuotes]);

  useEffect(() => {
    if (!sel.policy_type || !sel.vehicle_id || !sel.provider_id) return undefined;

    let cancelled = false;
    fetchQuotes(sel.policy_type, sel.addon_ids)
      .then((quote) => {
        if (!cancelled && quote) {
          setQuotes((prev) => ({ ...prev, [sel.policy_type]: quote }));
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [sel.addon_ids, sel.policy_type, sel.vehicle_id, sel.provider_id, fetchQuotes]);

  useEffect(() => {
    if (!allowMultiYear && sel.tenure_years > 1) {
      setSel((s) => ({ ...s, tenure_years: 1 }));
    }
  }, [allowMultiYear, sel.tenure_years]);

  const toggleAddon = (id) => {
    setSel((s) => ({
      ...s,
      addon_ids: s.addon_ids.includes(id)
        ? s.addon_ids.filter((a) => a !== id)
        : [...s.addon_ids, id],
    }));
  };

  const selectPolicy = (policyType) => {
    setSel((s) => ({ ...s, policy_type: policyType, addon_ids: [] }));
  };

  const buy = async () => {
    if (!activeQuote || !sel.policy_type) {
      setError('Select a policy to continue.');
      return;
    }
    setBuying(true);
    setError('');
    try {
      const r = await api.post('/api/policies', {
        ...sel,
        policy_type: sel.policy_type,
        idv: activeQuote.idv,
        base_premium: activeQuote.base_premium,
        addon_premium: activeQuote.addon_premium,
        total_premium: activeQuote.total_premium,
        gst: activeQuote.gst,
        addons: activeQuote.addons,
      });
      navigate('/customer/payment', { state: { policy: r.data.policy } });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create policy.');
    } finally {
      setBuying(false);
    }
  };

  const estimatedIdv = selectedVehicle?.market_value
    || (activeQuote?.idv ?? Object.values(quotes).find(Boolean)?.idv);

  return (
    <div
      className="relative -mx-4 -my-6 min-h-[calc(100vh-5rem)] py-8 sm:-mx-6"
      style={{ backgroundImage: `url(${policyBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        <div className="glass glass-form p-6 text-white sm:p-8">
          <h1 className="text-2xl font-bold sm:text-3xl">Select Your Insurance Policy</h1>
          <p className="mt-2 text-sm text-white/70">
            Compare coverage, premiums, and add-ons — then continue to payment in one flow.
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-100">{error}</div>
          )}

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            <SelectBlock step="1" label="Registered Car *">
              <select
                className="input"
                value={sel.vehicle_id}
                onChange={(e) => setSel((s) => ({
                  ...s,
                  vehicle_id: e.target.value,
                  policy_type: '',
                  addon_ids: [],
                }))}
              >
                <option value="">Select car</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.make} {v.model} ({v.license_plate}) • {v.year || '—'}
                  </option>
                ))}
              </select>
              {selectedVehicle && (
                <p className="mt-2 text-xs text-white/60">
                  RC Registration Date: {formatDate(selectedVehicle.rc_date)}
                  {' · '}
                  Estimated IDV: {formatINR(estimatedIdv)}
                </p>
              )}
            </SelectBlock>

            <SelectBlock step="2" label="Insurance Company *">
              <select
                className="input"
                value={sel.provider_id}
                onChange={(e) => setSel((s) => ({
                  ...s,
                  provider_id: e.target.value,
                  policy_type: '',
                  addon_ids: [],
                }))}
              >
                <option value="">Select company</option>
                {catalog.providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </SelectBlock>

            <SelectBlock step="3" label="Tenure *">
              <select
                className="input"
                value={sel.tenure_years}
                onChange={(e) => setSel((s) => ({
                  ...s,
                  tenure_years: parseInt(e.target.value, 10),
                  policy_type: '',
                  addon_ids: [],
                }))}
              >
                {[1, 2, 3].map((y) => (
                  <option key={y} value={y} disabled={y > 1 && !allowMultiYear}>
                    {y} Year{y > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-white/60">
                Tenure 2–3 years is available only for newly registered cars (within 12 months).
              </p>
            </SelectBlock>
          </div>

          <section className="mt-10">
            <h2 className="text-lg font-semibold">Policies</h2>
            {!sel.vehicle_id || !sel.provider_id ? (
              <p className="mt-3 text-sm text-white/60">
                Select your car and insurance company to compare policies.
              </p>
            ) : quoteLoading && !Object.keys(quotes).length ? (
              <p className="mt-3 text-sm text-white/60">Calculating premiums…</p>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {POLICY_CATALOG.map((policy) => {
                  const quote = quotes[policy.id];
                  const selected = sel.policy_type === policy.id;
                  return (
                    <button
                      key={policy.id}
                      type="button"
                      onClick={() => selectPolicy(policy.id)}
                      className={`rounded-2xl border p-5 text-left transition ${
                        selected
                          ? 'border-brand bg-brand/10 ring-2 ring-brand/40'
                          : 'border-white/30 bg-white/5 hover:border-white/50 hover:bg-white/10'
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand">
                        {policy.subtitle}
                      </p>
                      <h3 className="mt-1 text-lg font-bold text-white">{policy.title}</h3>
                      <p className="mt-1 text-xs text-white/60">{policy.tagline}</p>

                      <div className="mt-4 flex items-end justify-between gap-2">
                        <div className="text-xs text-white/70">
                          <p>IDV: {quote ? formatINR(quote.idv) : '—'}</p>
                          <p>{sel.tenure_years} year(s)</p>
                        </div>
                        <p className="text-2xl font-bold text-brand">
                          {quote ? formatINR(quote.total_premium) : '—'}
                        </p>
                      </div>

                      <div className="mt-4 border-t border-white/15 pt-4">
                        <p className="text-xs font-semibold text-white/80">What it covers</p>
                        <ul className="mt-2 space-y-1.5">
                          {policy.covers.map((item) => (
                            <li key={item} className="flex gap-2 text-xs text-white/75">
                              <span className="text-brand">✓</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {sel.policy_type && (
            <section className="mt-8">
              <div className="rounded-xl border border-brand/30 bg-brand/10 px-4 py-3 text-sm text-white/90">
                Select optional add-ons for your {POLICY_CATALOG.find((p) => p.id === sel.policy_type)?.title}.
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {catalog.addons.map((addon) => {
                  const active = sel.addon_ids.includes(addon.id);
                  return (
                    <button
                      key={addon.id}
                      type="button"
                      onClick={() => toggleAddon(addon.id)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                        active
                          ? 'border-brand bg-brand text-white'
                          : 'border-white/40 text-white/80 hover:border-brand hover:text-white'
                      }`}
                    >
                      {addon.name} (+{formatINR(addon.price)})
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="mt-10 rounded-2xl border border-white/20 bg-white/5 p-5">
            <h2 className="text-lg font-semibold">Summary</h2>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <SummaryRow label="Car" value={selectedVehicle
                ? `${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.license_plate})`
                : '—'} />
              <SummaryRow label="Company" value={selectedProvider?.name || '—'} />
              <SummaryRow
                label="Policy"
                value={POLICY_CATALOG.find((p) => p.id === sel.policy_type)?.title || '—'}
              />
              <SummaryRow label="Tenure" value={sel.tenure_years ? `${sel.tenure_years} year(s)` : '—'} />
              <SummaryRow label="Estimated IDV" value={formatINR(activeQuote?.idv ?? estimatedIdv)} />
              <SummaryRow
                label="Add-ons"
                value={activeQuote?.addons?.length
                  ? activeQuote.addons.map((a) => a.name).join(', ')
                  : 'None'}
              />
              <SummaryRow
                label="Total Premium (incl. GST)"
                value={activeQuote ? formatINR(activeQuote.total_premium) : '—'}
                highlight
              />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={buy}
                disabled={buying || !activeQuote || !sel.policy_type}
                className="btn-brand px-8 py-3 disabled:opacity-40"
              >
                {buying ? 'Processing…' : 'Continue to Payment'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SelectBlock({ step, label, children }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
        {step}) {label}
      </p>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, highlight }) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/10 py-2">
      <span className={highlight ? 'font-semibold text-white' : 'text-white/60'}>{label}</span>
      <span className={`text-right ${highlight ? 'font-bold text-brand' : 'text-white'}`}>{value}</span>
    </div>
  );
}
