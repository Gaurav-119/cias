import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';

export default function ClaimHistory() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/claims')
      .then((r) => setClaims(r.data.claims))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-navy">My Claims</h1>
          <p className="text-slate-500">Track the status of your insurance claims</p>
        </div>
        <Link to="/claim" className="btn-brand">File New Claim</Link>
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3">Claim No</th>
              <th className="px-4 py-3">Damage</th>
              <th className="px-4 py-3">Cause</th>
              <th className="px-4 py-3">Estimated</th>
              <th className="px-4 py-3">Filed On</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-6 text-slate-400">Loading…</td></tr>
            )}
            {!loading && claims.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-slate-400">
                No claims yet. <Link to="/claim" className="text-brand">File a claim</Link>.
              </td></tr>
            )}
            {claims.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-navy">{c.claim_number || `#${c.id}`}</td>
                <td className="px-4 py-3">{c.damage_type}</td>
                <td className="px-4 py-3">{c.cause}</td>
                <td className="px-4 py-3">{c.estimated_cost ? `₹${c.estimated_cost}` : '-'}</td>
                <td className="px-4 py-3">{c.created_at?.slice(0, 10)}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3">
                  <Link to={`/claims/${c.id}`} className="font-medium text-brand">Track</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
