import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';

export default function PolicyHistory() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/policies')
      .then((r) => setPolicies(r.data.policies))
      .finally(() => setLoading(false));
  }, []);

  const active = policies.filter((p) => p.status === 'active');
  const totalPremium = policies.reduce((s, p) => s + (p.total_premium || 0), 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-navy">My Policies</h1>
          <p className="text-slate-500">Purchased policies &amp; history</p>
        </div>
        <Link to="/customer/policy" className="btn-brand">Buy New Policy</Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Total Policies" value={policies.length} />
        <Stat label="Active Policies" value={active.length} />
        <Stat label="Total Premium Paid" value={`₹${totalPremium.toLocaleString()}`} />
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3">Policy No</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">IDV</th>
              <th className="px-4 py-3">Premium</th>
              <th className="px-4 py-3">Valid Till</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-6 text-slate-400">Loading…</td></tr>
            )}
            {!loading && policies.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-slate-400">
                No policies yet. <Link to="/customer/policy" className="text-brand">Buy your first policy</Link>.
              </td></tr>
            )}
            {policies.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-navy">{p.policy_number || `#${p.id}`}</td>
                <td className="px-4 py-3 capitalize">{p.policy_type?.replace('_', ' ')}</td>
                <td className="px-4 py-3">₹{p.idv?.toLocaleString?.() ?? p.idv ?? '-'}</td>
                <td className="px-4 py-3">₹{p.total_premium}</td>
                <td className="px-4 py-3">{p.end_date || '-'}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-3">
                  <Link to={`/customer/policies/${p.id}`} className="font-medium text-brand">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand">{value}</p>
    </div>
  );
}
