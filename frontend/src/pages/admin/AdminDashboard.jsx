import { useEffect, useMemo, useState } from 'react';
import api from '../../api/client';
import StatusBadge from '../../components/StatusBadge';

const TABS = ['Overview', 'Users', 'Cars', 'Policies', 'Claims', 'Payments', 'Audit Logs', 'Catalog'];

export default function AdminDashboard({ defaultTab = 'Overview' }) {
  const [tab, setTab] = useState(defaultTab);
  const [stats, setStats] = useState(null);
  const [data, setData] = useState({
    users: [],
    cars: [],
    policies: [],
    claims: [],
    payments: [],
    logs: [],
    providers: [],
    pricing: [],
    addons: [],
    base_prices: [],
  });
  const [message, setMessage] = useState('');
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [userForm, setUserForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    role: 'user',
  });

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  const loadStats = async () => {
    const res = await api.get('/api/admin/stats');
    setStats(res.data.stats);
  };

  const loaders = useMemo(() => ({
    Users: async () => {
      const res = await api.get('/api/admin/users');
      setData((prev) => ({ ...prev, users: res.data.users }));
    },
    Cars: async () => {
      const res = await api.get('/api/admin/cars');
      setData((prev) => ({ ...prev, cars: res.data.cars }));
    },
    Policies: async () => {
      const res = await api.get('/api/admin/policies');
      setData((prev) => ({ ...prev, policies: res.data.policies }));
    },
    Claims: async () => {
      const res = await api.get('/api/admin/claims');
      setData((prev) => ({ ...prev, claims: res.data.claims }));
    },
    Payments: async () => {
      const res = await api.get('/api/admin/payments');
      setData((prev) => ({ ...prev, payments: res.data.payments }));
    },
    'Audit Logs': async () => {
      const res = await api.get('/api/admin/audit-logs');
      setData((prev) => ({ ...prev, logs: res.data.logs }));
    },
    Catalog: async () => {
      const [providersRes, pricingRes, addonsRes, basePricesRes] = await Promise.all([
        api.get('/api/agent/providers'),
        api.get('/api/agent/pricing'),
        api.get('/api/agent/addons'),
        api.get('/api/agent/base-prices'),
      ]);
      setData((prev) => ({
        ...prev,
        providers: providersRes.data.providers,
        pricing: pricingRes.data.pricing,
        addons: addonsRes.data.addons,
        base_prices: basePricesRes.data.base_prices,
      }));
    },
  }), []);

  useEffect(() => {
    loadStats().catch(() => {});
  }, []);

  useEffect(() => {
    if (loaders[tab]) loaders[tab]().catch(() => {});
  }, [tab, loaders]);

  const notify = async (work, refreshKey) => {
    setMessage('');
    try {
      await work();
      setMessage('Changes saved successfully.');
      await loadStats();
      if (refreshKey && loaders[refreshKey]) {
        await loaders[refreshKey]();
      }
    } catch (err) {
      setMessage(err.response?.data?.error || 'Operation failed.');
    }
  };

  const openClaim = async (claimId) => {
    try {
      const res = await api.get(`/api/claims/${claimId}`);
      setSelectedClaim(res.data.claim);
    } catch {
      setSelectedClaim(null);
    }
  };

  const overviewCards = [
    ['Total Users', stats?.users],
    ['Agents', stats?.agents],
    ['Verifiers', stats?.verifiers],
    ['Policies', stats?.policies],
    ['Claims', stats?.claims],
    ['Revenue', `₹${formatCurrency(stats?.revenue)}`],
  ];

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-xl bg-brand/10 px-4 py-3 text-sm text-brand">{message}</div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((entry) => (
          <button
            key={entry}
            onClick={() => setTab(entry)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === entry ? 'bg-brand text-white' : 'bg-white text-slate-600'
            }`}
          >
            {entry}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {overviewCards.map(([label, value]) => (
              <div key={label} className="card">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-bold text-brand">{value ?? 0}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <div className="card">
              <h2 className="text-xl font-bold text-navy">Claims Snapshot</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <MiniStat label="Pending" value={stats?.pending_claims ?? 0} tone="amber" />
                <MiniStat label="Under Review" value={stats?.under_review_claims ?? 0} tone="blue" />
                <MiniStat label="Approved" value={stats?.approved_claims ?? 0} tone="green" />
                <MiniStat label="Rejected" value={stats?.rejected_claims ?? 0} tone="red" />
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-bold text-navy">System Summary</h2>
              <div className="mt-4 space-y-3 text-sm">
                <SummaryRow label="Registered Vehicles" value={stats?.vehicles ?? 0} />
                <SummaryRow label="Payments Recorded" value={stats?.payments ?? 0} />
                <SummaryRow label="Administrators" value={stats?.admins ?? 0} />
                <SummaryRow label="Operational Status" value="Healthy" />
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'Users' && (
        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              notify(() => api.post('/api/admin/users', userForm), 'Users');
              setUserForm({ full_name: '', email: '', password: '', phone: '', role: 'user' });
            }}
            className="card space-y-4"
          >
            <div>
              <h2 className="text-xl font-bold text-navy">Create User</h2>
              <p className="mt-1 text-sm text-slate-500">Add customer, agent, verifier, or admin accounts.</p>
            </div>
            <Field label="Full Name" value={userForm.full_name} onChange={(value) => setUserForm((prev) => ({ ...prev, full_name: value }))} />
            <Field label="Email" type="email" value={userForm.email} onChange={(value) => setUserForm((prev) => ({ ...prev, email: value }))} />
            <Field label="Phone" value={userForm.phone} onChange={(value) => setUserForm((prev) => ({ ...prev, phone: value }))} />
            <Field label="Password" type="password" value={userForm.password} onChange={(value) => setUserForm((prev) => ({ ...prev, password: value }))} />
            <div>
              <label className="label">Role</label>
              <select className="input" value={userForm.role} onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value }))}>
                {['user', 'agent', 'verifier', 'surveyor', 'claims_manager', 'admin'].map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <button className="btn-brand w-full">Create User</button>
          </form>

          <TableCard
            title="User Management"
            subtitle="Manage roles and account status."
            head={['ID', 'Name', 'Email', 'Role', 'Status', 'Actions']}
          >
            {data.users.map((user) => (
              <tr key={user.id} className="border-b border-slate-100">
                <Td>{user.id}</Td>
                <Td>{user.full_name}</Td>
                <Td>{user.email}</Td>
                <Td>{user.role}</Td>
                <Td><StatusBadge status={user.is_active ? 'active' : 'rejected'} /></Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      value={user.role}
                      onChange={(e) => notify(() => api.put(`/api/admin/users/${user.id}/role`, { role: e.target.value }), 'Users')}
                    >
                      {['user', 'agent', 'verifier', 'surveyor', 'claims_manager', 'admin'].map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => notify(() => api.delete(`/api/admin/users/${user.id}`), 'Users')}
                      className="rounded-lg bg-red-100 px-2 py-1 text-xs font-medium text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </TableCard>
        </div>
      )}

      {tab === 'Cars' && (
        <TableCard title="Vehicle Management" subtitle="Centralized vehicle records and verification status." head={['ID', 'Make', 'Model', 'Plate', 'Fuel', 'Status']}>
          {data.cars.map((car) => (
            <tr key={car.id} className="border-b border-slate-100">
              <Td>{car.id}</Td>
              <Td>{car.make}</Td>
              <Td>{car.model}</Td>
              <Td>{car.license_plate || '-'}</Td>
              <Td>{car.fuel_type || '-'}</Td>
              <Td><StatusBadge status={car.status} /></Td>
            </tr>
          ))}
        </TableCard>
      )}

      {tab === 'Policies' && (
        <TableCard title="Policy Management" subtitle="View policy lifecycle and premium records." head={['ID', 'Policy No', 'Type', 'Tenure', 'Premium', 'Status']}>
          {data.policies.map((policy) => (
            <tr key={policy.id} className="border-b border-slate-100">
              <Td>{policy.id}</Td>
              <Td>{policy.policy_number}</Td>
              <Td>{policy.policy_type}</Td>
              <Td>{policy.tenure_years}</Td>
              <Td>₹{formatCurrency(policy.total_premium)}</Td>
              <Td><StatusBadge status={policy.status} /></Td>
            </tr>
          ))}
        </TableCard>
      )}

      {tab === 'Claims' && (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <TableCard title="Claim Management" subtitle="Review AI-backed claim submissions and update decisions." head={['ID', 'Claim No', 'Damage', 'Estimate', 'Fraud', 'Status', 'Actions']}>
            {data.claims.map((claim) => (
              <tr key={claim.id} className="border-b border-slate-100">
                <Td>{claim.id}</Td>
                <Td>{claim.claim_number}</Td>
                <Td>{claim.damage_type || '-'}</Td>
                <Td>₹{formatCurrency(claim.estimated_cost)}</Td>
                <Td>{claim.fraud_flag ? 'Flagged' : 'Clear'}</Td>
                <Td><StatusBadge status={claim.status} /></Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => openClaim(claim.id)} className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">View</button>
                    <button onClick={() => notify(() => api.put(`/api/admin/claims/${claim.id}`, { status: 'approved' }), 'Claims')} className="rounded-lg bg-green-100 px-2 py-1 text-xs text-green-700">Approve</button>
                    <button onClick={() => notify(() => api.put(`/api/admin/claims/${claim.id}`, { status: 'rejected' }), 'Claims')} className="rounded-lg bg-red-100 px-2 py-1 text-xs text-red-700">Reject</button>
                  </div>
                </Td>
              </tr>
            ))}
          </TableCard>

          <div className="card">
            <h2 className="text-xl font-bold text-navy">Claim Detail</h2>
            {!selectedClaim ? (
              <p className="mt-4 text-sm text-slate-400">Select a claim to inspect AI analysis, images, and timeline.</p>
            ) : (
              <div className="mt-4 space-y-4">
                <SummaryRow label="Claim Number" value={selectedClaim.claim_number} />
                <SummaryRow label="Status" value={selectedClaim.status} />
                <SummaryRow label="Estimated Cost" value={`₹${formatCurrency(selectedClaim.estimated_cost)}`} />
                <SummaryRow label="Final Amount" value={`₹${formatCurrency(selectedClaim.final_amount)}`} />
                <SummaryRow label="Fraud Flag" value={selectedClaim.fraud_flag ? 'Flagged' : 'Clear'} />
                {selectedClaim.description && (
                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    {selectedClaim.description}
                  </div>
                )}
                {(selectedClaim.images || []).length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {selectedClaim.images.map((image) => (
                      <img key={image.id} src={image.url} alt="claim" className="h-28 w-full rounded-xl object-cover" />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'Payments' && (
        <TableCard title="Payment Records" subtitle="Track transaction status and recorded references." head={['ID', 'Policy', 'Amount', 'Method', 'Status', 'Reference']}>
          {data.payments.map((payment) => (
            <tr key={payment.id} className="border-b border-slate-100">
              <Td>{payment.id}</Td>
              <Td>{payment.policy_id || '-'}</Td>
              <Td>₹{formatCurrency(payment.amount)}</Td>
              <Td>{payment.method}</Td>
              <Td><StatusBadge status={payment.status} /></Td>
              <Td>{payment.transaction_ref || '-'}</Td>
            </tr>
          ))}
        </TableCard>
      )}

      {tab === 'Audit Logs' && (
        <TableCard title="Audit Logs" subtitle="Recent sensitive operations and role-based actions." head={['Time', 'Actor', 'Action', 'Entity', 'Entity ID', 'IP']}>
          {data.logs.map((log) => (
            <tr key={log.id} className="border-b border-slate-100">
              <Td>{log.created_at ? new Date(log.created_at).toLocaleString() : '-'}</Td>
              <Td>{log.actor_id || '-'}</Td>
              <Td>{log.action}</Td>
              <Td>{log.entity || '-'}</Td>
              <Td>{log.entity_id || '-'}</Td>
              <Td>{log.ip || '-'}</Td>
            </tr>
          ))}
        </TableCard>
      )}

      {tab === 'Catalog' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Providers" value={data.providers.length} />
            <Stat label="Pricing Rules" value={data.pricing.length} />
            <Stat label="Add-ons" value={data.addons.length} />
            <Stat label="Vehicle Base Prices" value={data.base_prices.length} />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <TableCard title="Providers" subtitle="Managed insurer catalog." head={['Name', 'Sector', 'Active']}>
              {data.providers.map((provider) => (
                <tr key={provider.id} className="border-b border-slate-100">
                  <Td>{provider.name}</Td>
                  <Td>{provider.sector || '-'}</Td>
                  <Td>{String(provider.active)}</Td>
                </tr>
              ))}
            </TableCard>
            <TableCard title="Add-ons" subtitle="Available policy benefits." head={['Name', 'Price', 'Active']}>
              {data.addons.map((addon) => (
                <tr key={addon.id} className="border-b border-slate-100">
                  <Td>{addon.name}</Td>
                  <Td>₹{formatCurrency(addon.price)}</Td>
                  <Td>{String(addon.active)}</Td>
                </tr>
              ))}
            </TableCard>
          </div>
        </div>
      )}
    </div>
  );
}

function TableCard({ title, subtitle, head, children }) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-xl font-bold text-navy">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>{head.map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, type = 'text', value, onChange }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-navy">{value}</span>
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  const toneClass = {
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
  }[tone] || 'bg-slate-50 text-slate-700';

  return (
    <div className={`rounded-2xl px-4 py-5 ${toneClass}`}>
      <p className="text-sm">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-brand">{value}</p>
    </div>
  );
}

function Td({ children }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

function formatCurrency(value) {
  if (value == null || value === '') return '0';
  return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
