import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import api from '../api/client';
import StripePaymentForm from '../components/StripePaymentForm';
import { getStripePromise, stripeConfigured } from '../lib/stripe';
import { formatINR } from '../utils/policyCatalog';

const COVERAGE_LABELS = {
  own_damage: 'Own Damage',
  third_party: 'Third Party Cover',
  personal_accident: 'Personal Accident Cover',
};

export default function PaymentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [policies, setPolicies] = useState([]);
  const [policyId, setPolicyId] = useState(location.state?.policy?.id || '');
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [paymentId, setPaymentId] = useState(null);
  const [showPayForm, setShowPayForm] = useState(false);
  const [intentLoading, setIntentLoading] = useState(false);

  useEffect(() => {
    api.get('/api/policies').then((r) => {
      const list = r.data.policies || [];
      setPolicies(list);
      if (!policyId) {
        const pending = list.find((p) => p.status === 'pending');
        if (pending) setPolicyId(pending.id);
      }
    }).catch(() => {});
  }, [policyId]);

  useEffect(() => {
    if (!policyId) {
      setContext(null);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    setShowPayForm(false);
    setClientSecret('');

    api.get(`/api/payments/checkout/${policyId}`)
      .then((r) => {
        if (!cancelled) setContext(r.data);
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err.response?.data?.error
            || (err.response?.status === 404
              ? 'Checkout API not found — rebuild the API container (docker compose build api && docker compose up -d api).'
              : null)
            || 'Could not load checkout details.';
          setError(msg);
          setContext(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [policyId]);

  const pricing = context?.pricing;
  const totalLabel = useMemo(
    () => formatINR(pricing?.total_payable),
    [pricing?.total_payable],
  );

  const startStripePayment = async () => {
    if (!policyId) return;
    setIntentLoading(true);
    setError('');
    try {
      if (context?.stripe_enabled && stripeConfigured()) {
        const r = await api.post('/api/payments/create-intent', { policy_id: policyId });
        setClientSecret(r.data.client_secret);
        setPaymentId(r.data.payment_id);
        setShowPayForm(true);
        return;
      }

      const r = await api.post('/api/payments/checkout', {
        policy_id: policyId,
        amount: pricing?.total_payable,
      });
      navigate('/customer/payment/success', {
        state: { payment: r.data.payment, policy: r.data.policy },
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to start payment.');
    } finally {
      setIntentLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId, dbPaymentId, opts = {}) => {
    try {
      const r = await api.post('/api/payments/confirm', {
        payment_intent_id: paymentIntentId,
        payment_id: dbPaymentId,
      });
      navigate('/customer/payment/success', {
        state: {
          payment: r.data.payment,
          policy: r.data.policy,
          processing: opts.processing,
        },
      });
    } catch (err) {
      navigate('/customer/payment/failure', {
        state: {
          reason: err.response?.data?.error || 'Payment confirmation failed.',
          policyId,
        },
      });
    }
  };

  const handlePaymentFailure = (reason) => {
    navigate('/customer/payment/failure', {
      state: { reason, policyId },
    });
  };

  const providerInitials = (name = '') => name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy sm:text-3xl">Insurance Checkout</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review your policy, verify coverage, and pay securely with Stripe.
        </p>
      </div>

      {policies.length > 1 && (
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="label">Policy awaiting payment</label>
          <select
            className="input max-w-xl"
            value={policyId}
            onChange={(e) => setPolicyId(Number(e.target.value))}
          >
            <option value="">Select policy</option>
            {policies.filter((p) => p.status === 'pending').map((p) => (
              <option key={p.id} value={p.id}>
                {p.policy_number || `Policy #${p.id}`} — {formatINR(p.total_premium)}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {loading && (
        <div className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm">
          Loading checkout…
        </div>
      )}

      {!loading && !context && (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="text-slate-600">No pending policy found for payment.</p>
          <Link to="/customer/policy" className="btn-brand mt-4 inline-flex">
            Buy a Policy
          </Link>
        </div>
      )}

      {context && (
        <div className="grid gap-6 lg:grid-cols-10">
          <div className="space-y-6 lg:col-span-7">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand/10 text-lg font-bold text-brand">
                    {providerInitials(context.provider?.name)}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Insurance Provider
                    </p>
                    <h2 className="text-xl font-bold text-navy">
                      {context.provider?.name || 'Claim Nova Partner'}
                    </h2>
                    <p className="text-sm text-slate-500">{context.policy.policy_type_label}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
                <Info label="Policy Number" value={context.policy.policy_number || `#${context.policy.id}`} />
                <Info label="Vehicle Number" value={context.vehicle?.license_plate || '—'} />
                <Info
                  label="Vehicle Model"
                  value={context.vehicle
                    ? `${context.vehicle.make} ${context.vehicle.model} (${context.vehicle.year || '—'})`
                    : '—'}
                />
                <Info label="Policy Type" value={context.policy.policy_type_label} />
                <Info label="Tenure" value={`${context.policy.tenure_years} year(s)`} />
                <Info label="IDV" value={formatINR(context.policy.idv)} />
              </div>

              <div className="border-t border-slate-100 px-6 py-5">
                <h3 className="font-semibold text-navy">Premium Breakdown</h3>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <BreakdownRow label="Base Premium" value={formatINR(context.policy.base_premium)} />
                  <BreakdownRow label="Add-on Premium" value={formatINR(context.policy.addon_premium)} />
                  <BreakdownRow label="GST (18%)" value={formatINR(context.policy.gst)} />
                  <BreakdownRow label="Total Premium" value={formatINR(context.policy.total_premium)} bold />
                </div>
                {(context.coverage_addons?.length > 0) && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-slate-600">Selected add-ons</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {context.coverage_addons.map((addon) => (
                        <span
                          key={addon.id || addon.name}
                          className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand"
                        >
                          {addon.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-navy">Coverage Included</h3>
              <ul className="mt-4 space-y-3">
                {Object.entries(COVERAGE_LABELS).map(([key, label]) => {
                  const included = context.coverage?.[key];
                  return (
                    <li key={key} className="flex items-center gap-3 text-sm">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        included ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
                      }`}
                      >
                        {included ? '✓' : '—'}
                      </span>
                      <span className={included ? 'text-navy' : 'text-slate-400'}>{label}</span>
                    </li>
                  );
                })}
              </ul>
              {context.coverage_addons?.length > 0 && (
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-sm font-semibold text-navy">Add-on benefits</p>
                  <ul className="mt-2 space-y-1">
                    {context.coverage_addons.map((a) => (
                      <li key={a.id || a.name} className="flex gap-2 text-sm text-slate-600">
                        <span className="text-brand">✓</span> {a.name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-navy">Customer Information</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Info label="Name" value={context.customer.full_name} />
                <Info label="Email" value={context.customer.email} />
                <Info label="Phone" value={context.customer.phone || '—'} />
                <Info label="Address" value={context.customer.address || '—'} className="sm:col-span-2" />
              </div>
            </section>
          </div>

          <div className="lg:col-span-3">
            <div className="sticky top-6 space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
                <h3 className="text-lg font-bold text-navy">Payment Summary</h3>
                <div className="mt-4 space-y-2 text-sm">
                  <BreakdownRow label="Premium Amount" value={formatINR(pricing?.premium_amount)} />
                  <BreakdownRow label="GST" value={formatINR(pricing?.gst)} />
                  <BreakdownRow label="Platform Fee" value={formatINR(pricing?.platform_fee)} />
                  <BreakdownRow
                    label="Discount"
                    value={pricing?.discount ? `- ${formatINR(pricing.discount)}` : formatINR(0)}
                  />
                  <div className="my-2 border-t border-slate-200" />
                  <BreakdownRow label="Total Payable" value={totalLabel} bold />
                </div>

                {!showPayForm && (
                  <button
                    type="button"
                    onClick={startStripePayment}
                    disabled={intentLoading}
                    className="btn-brand mt-6 w-full py-3 text-base disabled:opacity-50"
                  >
                    {intentLoading
                      ? 'Preparing secure checkout…'
                      : context.stripe_enabled && stripeConfigured()
                        ? 'Pay Securely with Stripe'
                        : 'Complete Payment (Test Mode)'}
                  </button>
                )}

                {showPayForm && clientSecret && getStripePromise() && (
                  <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <Elements
                      stripe={getStripePromise()}
                      options={{
                        clientSecret,
                        appearance: {
                          theme: 'stripe',
                          variables: {
                            colorPrimary: '#00a6b5',
                            borderRadius: '12px',
                          },
                        },
                      }}
                    >
                      <StripePaymentForm
                        amount={totalLabel}
                        paymentId={paymentId}
                        onSuccess={handlePaymentSuccess}
                        onFailure={handlePaymentFailure}
                      />
                    </Elements>
                  </div>
                )}

                {context.stripe_enabled && !stripeConfigured() && (
                  <p className="mt-3 text-xs text-amber-600">
                    Stripe publishable key missing. Set VITE_STRIPE_PUBLISHABLE_KEY in the frontend environment.
                  </p>
                )}

                <div className="mt-6 space-y-2 border-t border-slate-100 pt-4">
                  <SecurityBadge icon="🔒" text="SSL Secured" />
                  <SecurityBadge icon="🛡️" text="PCI DSS Compliant" />
                  <SecurityBadge icon="💳" text="Stripe Protected" />
                  <SecurityBadge icon="✓" text="Secure Checkout" />
                </div>
              </section>

              {context.stripe_enabled && (
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
                  Stripe Test Mode: use test card 4242 4242 4242 4242, any future expiry and CVC.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value, className = '' }) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-medium text-navy">{value || '—'}</p>
    </div>
  );
}

function BreakdownRow({ label, value, bold }) {
  return (
    <div className="flex justify-between gap-3">
      <span className={bold ? 'font-bold text-navy' : 'text-slate-500'}>{label}</span>
      <span className={bold ? 'text-lg font-bold text-brand' : 'font-medium text-navy'}>{value}</span>
    </div>
  );
}

function SecurityBadge({ icon, text }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
}
