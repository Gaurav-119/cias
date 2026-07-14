import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { formatINR } from '../utils/policyCatalog';

export default function PaymentSuccessPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [payment, setPayment] = useState(location.state?.payment || null);
  const [policy, setPolicy] = useState(location.state?.policy || null);
  const [loading, setLoading] = useState(!location.state?.payment);

  useEffect(() => {
    if (location.state?.payment) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      const paymentId = searchParams.get('payment_id');
      const paymentIntent = searchParams.get('payment_intent');
      const redirectStatus = searchParams.get('redirect_status');

      try {
        if (paymentIntent && redirectStatus === 'succeeded') {
          const r = await api.post('/api/payments/confirm', {
            payment_intent_id: paymentIntent,
            payment_id: paymentId || undefined,
          });
          if (!cancelled) {
            setPayment(r.data.payment);
            setPolicy(r.data.policy || null);
          }
          return;
        }

        if (paymentId) {
          const r = await api.get(`/api/payments/${paymentId}`);
          if (!cancelled) {
            setPayment(r.data.payment);
            setPolicy(r.data.payment.policy || null);
          }
        }
      } catch {
        if (!cancelled) {
          setPayment(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [location.state, searchParams]);

  const downloadPdf = async () => {
    if (!policy?.id) return;
    const res = await api.get(`/api/policies/${policy.id}/certificate.pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ClaimNova-${policy.policy_number || policy.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center text-slate-500">
        Confirming your payment…
      </div>
    );
  }

  const processing = location.state?.processing;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-3xl border border-green-100 bg-white p-8 text-center shadow-card sm:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl text-green-600">
          ✓
        </div>
        <h1 className="mt-6 text-2xl font-bold text-navy">
          {processing ? 'Payment Processing' : 'Payment Successful'}
        </h1>
        <p className="mt-2 text-slate-500">
          {processing
            ? 'Your payment is being processed. We will activate your policy shortly.'
            : 'Your insurance policy is now active. A confirmation has been recorded.'}
        </p>

        {payment && (
          <div className="mt-8 rounded-2xl bg-slate-50 p-5 text-left text-sm">
            <Row label="Policy Number" value={policy?.policy_number || payment.policy_id} />
            <Row
              label="Transaction ID"
              value={payment.stripe_transaction_id || payment.transaction_ref || `#${payment.id}`}
            />
            <Row label="Amount Paid" value={formatINR(payment.amount)} highlight />
            <Row
              label="Payment Date"
              value={payment.created_at
                ? new Date(payment.created_at).toLocaleString('en-IN')
                : new Date().toLocaleString('en-IN')}
            />
            <Row label="Customer" value={payment.customer_name || '—'} />
            {payment.payment_method && (
              <Row label="Method" value={payment.payment_method} />
            )}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {policy?.id && (
            <>
              <button type="button" onClick={downloadPdf} className="btn-outline px-5 py-2.5 text-sm">
                Download Policy PDF
              </button>
              <Link to={`/customer/policies/${policy.id}`} className="btn-outline px-5 py-2.5 text-sm">
                View Policy Details
              </Link>
            </>
          )}
          <Link to="/customer/dashboard" className="btn-brand px-5 py-2.5 text-sm">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-200 py-2 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right font-medium ${highlight ? 'text-brand' : 'text-navy'}`}>
        {value}
      </span>
    </div>
  );
}
