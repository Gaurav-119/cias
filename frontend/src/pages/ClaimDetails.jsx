import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';

const STAGES = ['pending', 'under_review', 'approved', 'paid'];
const STAGE_LABEL = {
  pending: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  paid: 'Settled',
};

export default function ClaimDetails() {
  const { id } = useParams();
  const [claim, setClaim] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/claims/${id}`)
      .then((r) => setClaim(r.data.claim))
      .catch((e) => setError(e.response?.data?.error || 'Claim not found'));
  }, [id]);

  if (error) return <div className="mx-auto max-w-4xl px-4 py-10 text-red-600">{error}</div>;
  if (!claim) return <div className="mx-auto max-w-4xl px-4 py-10 text-slate-500">Loading…</div>;

  const rejected = claim.status === 'rejected';
  const currentIdx = STAGES.indexOf(claim.status);
  const ai = (claim.ai_results || [])[claim.ai_results?.length - 1];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link to="/claims" className="text-sm text-brand">← Back to My Claims</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-navy">{claim.claim_number || `Claim #${claim.id}`}</h1>
          <div className="mt-1"><StatusBadge status={claim.status} /></div>
        </div>
      </div>

      {/* Status tracker */}
      <div className="card mt-6">
        <h2 className="mb-5 text-lg font-bold text-navy">Claim Status</h2>
        {rejected ? (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            This claim was rejected. See the timeline below for details.
          </div>
        ) : (
          <div className="flex items-center justify-between">
            {STAGES.map((s, i) => {
              const done = i <= currentIdx;
              return (
                <div key={s} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                      done ? 'bg-brand text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {i + 1}
                    </div>
                    <span className={`mt-1 text-xs ${done ? 'text-navy' : 'text-slate-400'}`}>
                      {STAGE_LABEL[s]}
                    </span>
                  </div>
                  {i < STAGES.length - 1 && (
                    <div className={`mx-1 h-0.5 flex-1 ${i < currentIdx ? 'bg-brand' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-lg font-bold text-navy">Claim Details</h2>
          <Row label="Damage Type" value={claim.damage_type} />
          <Row label="Cause" value={claim.cause} />
          <Row label="Incident Date" value={claim.incident_date || '-'} />
          <Row label="Police Report" value={claim.police_report || '-'} />
          <Row label="Witness" value={claim.witness_info || '-'} />
          <Row label="Estimated Cost" value={claim.estimated_cost ? `₹${claim.estimated_cost}` : '-'} />
          <Row label="Final Amount" value={claim.final_amount ? `₹${claim.final_amount}` : '-'} />
          <Row label="Fraud Flag" value={claim.fraud_flag ? 'Flagged' : 'Clear'} />
          {claim.description && (
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{claim.description}</p>
          )}
        </div>

        {ai && (
          <div className="card">
            <h2 className="mb-3 text-lg font-bold text-navy">AI Assessment</h2>
            <Row label="Severity" value={ai.severity} />
            <Row label="Severity Score" value={ai.severity_score} />
            <Row label="Estimated Repair" value={`₹${ai.total_cost}`} />
            <Row label="Valid" value={ai.valid ? 'Yes' : 'Review required'} />
            <Row label="Fraud Flag" value={ai.fraud_flag ? 'Flagged' : 'Clear'} />
            {ai.report && (
              <Link
                to={`/customer/claims/${claim.id}/assessment`}
                className="mt-3 inline-block text-sm font-semibold text-brand"
              >
                View full AI Damage Assessment →
              </Link>
            )}
          </div>
        )}
      </div>

      {(claim.images || []).length > 0 && (
        <div className="card mt-6">
          <h2 className="mb-3 text-lg font-bold text-navy">Damage Images</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {claim.images.map((img) => (
              <img key={img.id} src={img.url} alt="damage" className="h-24 w-full rounded-lg object-cover" />
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="card mt-6">
        <h2 className="mb-4 text-lg font-bold text-navy">Activity Timeline</h2>
        <ol className="relative border-l border-slate-200 pl-6">
          {(claim.events || []).length === 0 && (
            <li className="text-sm text-slate-400">No activity recorded.</li>
          )}
          {(claim.events || []).map((e) => (
            <li key={e.id} className="mb-5 last:mb-0">
              <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-brand" />
              <div className="flex items-center gap-2">
                <StatusBadge status={e.status} />
                <span className="text-xs text-slate-400">
                  {e.created_at ? new Date(e.created_at).toLocaleString() : ''}
                </span>
              </div>
              {e.note && <p className="mt-1 text-sm text-slate-600">{e.note}</p>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className={bold ? 'font-bold text-navy' : 'text-slate-500'}>{label}</span>
      <span className={`capitalize ${bold ? 'font-bold text-navy' : 'text-ink'}`}>{value}</span>
    </div>
  );
}
