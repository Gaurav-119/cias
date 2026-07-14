import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { formatINR } from '../utils/policyCatalog';

export default function PolicyDetails() {
  const { id } = useParams();
  const [policy, setPolicy] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/policies/${id}`)
      .then((r) => setPolicy(r.data.policy))
      .catch((e) => setError(e.response?.data?.error || 'Policy not found'));
    api.get(`/api/policies/${id}/certificate`)
      .then((r) => setSchedule(r.data.certificate))
      .catch(() => {});
  }, [id]);

  const downloadPdf = async () => {
    const res = await api.get(`/api/policies/${id}/certificate.pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ClaimNova-${policy?.policy_number || id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sharePolicy = async () => {
    const url = `${window.location.origin}/customer/policies/${id}/certificate`;
    const text = `Claim Nova Policy ${policy?.policy_number}`;
    if (navigator.share) {
      await navigator.share({ title: 'Claim Nova Policy', text, url });
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      alert('Policy link copied.');
    }
  };

  if (error) return <div className="mx-auto max-w-5xl px-4 py-10 text-red-600">{error}</div>;
  if (!policy) return <div className="mx-auto max-w-5xl px-4 py-10 text-slate-500">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/customer/policies" className="text-sm font-semibold text-brand">← My Policies</Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy sm:text-3xl">
            {policy.policy_number || `Policy #${policy.id}`}
          </h1>
          <div className="mt-2"><StatusBadge status={policy.status} /></div>
          <p className="mt-2 text-sm text-slate-500">
            {schedule?.insurance?.policy_type || policy.policy_type?.replace(/_/g, ' ')}
            {' · '}
            {policy.tenure_years} year(s)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/customer/policies/${id}/certificate`} className="btn-outline px-4 py-2 text-sm">
            View Policy
          </Link>
          <button type="button" onClick={() => window.print()} className="btn-outline px-4 py-2 text-sm">
            Print
          </button>
          <button type="button" onClick={downloadPdf} className="btn-brand px-4 py-2 text-sm">
            Download PDF
          </button>
          <button type="button" onClick={sharePolicy} className="btn-outline px-4 py-2 text-sm">
            Share
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-4 text-lg font-bold text-navy">Policy Summary</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Insurance Company" value={schedule?.insurance?.company || policy.provider_name} />
            <Info label="Policy Type" value={schedule?.insurance?.policy_type} />
            <Info label="Effective" value={schedule?.header?.effective_date || policy.start_date} />
            <Info label="Expiry" value={schedule?.header?.expiry_date || policy.end_date} />
            <Info label="IDV" value={formatINR(policy.idv)} />
            <Info label="Grand Total" value={formatINR(policy.total_premium)} highlight />
          </div>
          {policy.vehicle && (
            <div className="mt-6 rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-400">Insured Vehicle</p>
              <p className="mt-1 font-bold text-navy">
                {policy.vehicle.make} {policy.vehicle.model}
              </p>
              <p className="text-sm text-slate-600">
                {policy.vehicle.license_plate} · {policy.vehicle.fuel_type} · {policy.vehicle.year}
                {policy.vehicle.variant ? ` · ${policy.vehicle.variant}` : ''}
                {policy.vehicle.transmission ? ` · ${policy.vehicle.transmission}` : ''}
              </p>
              {(schedule?.vehicle?.ex_showroom_price_raw || policy.vehicle.max_claim_amount) && (
                <div className="mt-3 grid gap-1 text-sm text-slate-600">
                  {schedule?.vehicle?.ex_showroom_price && (
                    <p>Ex-Showroom: {schedule.vehicle.ex_showroom_price}</p>
                  )}
                  {schedule?.vehicle?.depreciation_percentage && (
                    <p>Depreciation: {schedule.vehicle.depreciation_percentage}</p>
                  )}
                  <p className="font-semibold text-navy">
                    Max Claim: {schedule?.vehicle?.max_claim_amount || formatINR(policy.vehicle.max_claim_amount)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="card">
            <h2 className="mb-3 text-lg font-bold text-navy">Premium</h2>
            <Row label="Base Premium" value={formatINR(policy.base_premium)} />
            <Row label="Add-ons" value={formatINR(policy.addon_premium)} />
            <Row label="GST" value={formatINR(policy.gst)} />
            <div className="my-2 border-t border-slate-200" />
            <Row label="Total" value={formatINR(policy.total_premium)} bold />
          </div>

          {schedule?.payment && (
            <div className="card">
              <h2 className="mb-3 text-lg font-bold text-navy">Last Payment</h2>
              <Row label="Status" value={schedule.payment.status} />
              <Row label="Date" value={schedule.payment.payment_date} />
              <Row label="Amount" value={schedule.payment.amount_paid} />
            </div>
          )}

          {(policy.addons || []).length > 0 && (
            <div className="card">
              <h2 className="mb-2 text-sm font-bold text-navy">Add-ons</h2>
              <div className="flex flex-wrap gap-2">
                {policy.addons.map((a) => (
                  <span key={a.id || a.name} className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                    {a.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, highlight }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 text-sm ${highlight ? 'font-bold text-brand' : 'font-semibold text-navy'}`}>
        {value || '—'}
      </p>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className={bold ? 'font-bold text-navy' : 'text-slate-500'}>{label}</span>
      <span className={bold ? 'font-bold text-brand' : 'text-ink'}>{value}</span>
    </div>
  );
}
