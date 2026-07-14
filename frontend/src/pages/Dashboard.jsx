import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import dashboardBg from '../assets/backgrounds/Dashboard.jpg';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ vehicles: 0, policies: 0, claims: 0, payments: 0 });
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/api/vehicles'),
      api.get('/api/policies'),
      api.get('/api/claims'),
      api.get('/api/payments'),
    ]).then(([v, p, c, pay]) => {
      setStats({
        vehicles: v.data.vehicles.length,
        policies: p.data.policies.length,
        claims: c.data.claims.length,
        payments: pay.data.payments.length,
      });
      setPayments(pay.data.payments.slice(0, 5));
    }).catch(() => {});
  }, []);

  const cards = [
    ['Registered Vehicles', stats.vehicles],
    ['Total Policies', stats.policies],
    ['Active Claims', stats.claims],
    ['Payments Made', stats.payments],
  ];
  const actions = [
    ['Register Car', '/customer/car-registration'],
    ['Buy Policy', '/customer/policy'],
    ['Premium Payment', '/customer/payment'],
    ['My Policies', '/customer/policies'],
    ['File Claim', '/customer/claim'],
    ['My Claims', '/customer/claims'],
  ];

  return (
    <div
      className="relative min-h-[90vh] py-10"
      style={{ backgroundImage: `url(${dashboardBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 text-white">
        <h1 className="text-3xl font-bold">Welcome, {user?.full_name || 'User'}</h1>
        <p className="text-white/70">Role: {user?.role}</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(([label, value]) => (
            <div key={label} className="glass p-6">
              <p className="text-sm text-white/70">{label}</p>
              <p className="mt-1 text-3xl font-bold text-brand">{value}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-xl font-semibold">Quick Actions</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map(([label, to]) => (
            <Link key={to} to={to} className="glass p-6 text-center transition hover:bg-white/10">
              <span className="font-semibold">{label}</span>
            </Link>
          ))}
        </div>

        <h2 className="mt-10 text-xl font-semibold">Recent Payments</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl bg-white/95 text-ink">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr><td className="px-4 py-4 text-slate-400" colSpan={4}>No payments yet</td></tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="px-4 py-3">{p.created_at?.slice(0, 10)}</td>
                  <td className="px-4 py-3">{p.description}</td>
                  <td className="px-4 py-3">₹{p.amount}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
