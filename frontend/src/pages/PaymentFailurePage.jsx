import { Link, useLocation } from 'react-router-dom';

export default function PaymentFailurePage() {
  const location = useLocation();
  const reason = location.state?.reason || 'Your payment could not be completed.';
  const policyId = location.state?.policyId;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-3xl border border-red-100 bg-white p-8 text-center shadow-card sm:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-4xl text-red-500">
          ✕
        </div>
        <h1 className="mt-6 text-2xl font-bold text-navy">Payment Failed</h1>
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{reason}</p>
        <p className="mt-4 text-sm text-slate-500">
          No amount was charged, or the payment was declined. You can retry safely.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/customer/payment"
            state={policyId ? { policy: { id: policyId } } : undefined}
            className="btn-brand px-5 py-2.5 text-sm"
          >
            Retry Payment
          </Link>
          <a
            href="mailto:support@claimnova.com"
            className="btn-outline px-5 py-2.5 text-sm"
          >
            Contact Support
          </a>
          <Link to="/customer/dashboard" className="text-sm font-semibold text-slate-500 hover:text-brand">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
