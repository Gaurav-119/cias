import { useEffect, useMemo, useState } from 'react';
import api from '../../api/client';

const TABS = ['Dashboard', 'Providers', 'Pricing', 'Add-ons'];

export default function AgentPortal({ defaultTab = 'Providers' }) {
  const [tab, setTab] = useState(defaultTab);
  const [stats, setStats] = useState(null);
  const [providers, setProviders] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [addons, setAddons] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  const reload = async () => {
    const [statsRes, providersRes, pricingRes, addonsRes] = await Promise.all([
      api.get('/api/agent/stats'),
      api.get('/api/agent/providers'),
      api.get('/api/agent/pricing'),
      api.get('/api/agent/addons'),
    ]);
    setStats(statsRes.data.stats);
    setProviders(providersRes.data.providers);
    setPricing(pricingRes.data.pricing);
    setAddons(addonsRes.data.addons);
  };

  useEffect(() => {
    reload().catch(() => {});
  }, []);

  const providerOptions = useMemo(
    () => providers.map((provider) => ({ label: provider.name, value: provider.id })),
    [providers],
  );

  const notify = async (work) => {
    setMessage('');
    try {
      await work();
      setMessage('Changes saved successfully.');
      await reload();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to save changes.');
    }
  };

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

      {tab === 'Dashboard' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Active Providers" value={stats?.providers ?? 0} />
            <StatCard label="Pricing Rules" value={stats?.pricing_rules ?? 0} />
            <StatCard label="Add-ons" value={stats?.addons ?? 0} />
            <StatCard label="Policies Available" value={stats?.policies ?? 0} />
            <StatCard label="Revenue Recorded" value={`₹${formatCurrency(stats?.monthly_revenue)}`} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <SummaryList
              title="Latest Providers"
              subtitle="Maintain insurers and sector details"
              items={providers.slice(0, 6).map((provider) => ({
                id: provider.id,
                title: provider.name,
                meta: provider.sector || 'Unspecified sector',
              }))}
            />
            <SummaryList
              title="Popular Add-ons"
              subtitle="Quick snapshot of configured add-on plans"
              items={addons.slice(0, 6).map((addon) => ({
                id: addon.id,
                title: addon.name,
                meta: `₹${formatCurrency(addon.price)}`,
              }))}
            />
          </div>
        </div>
      )}

      {tab === 'Providers' && (
        <CrudSection
          title="Insurance Providers"
          subtitle="Add and maintain insurance company information with sector details."
          fields={[
            { name: 'name', label: 'Provider Name', type: 'text' },
            { name: 'sector', label: 'Sector', type: 'text' },
          ]}
          items={providers}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'sector', label: 'Sector' },
            { key: 'active', label: 'Active' },
          ]}
          onCreate={(payload) => notify(() => api.post('/api/agent/providers', payload))}
          onUpdate={(id, payload) => notify(() => api.put(`/api/agent/providers/${id}`, payload))}
          onDelete={(id) => notify(() => api.delete(`/api/agent/providers/${id}`))}
        />
      )}

      {tab === 'Pricing' && (
        <CrudSection
          title="Pricing Rules"
          subtitle="Manage policy premium ranges for third party, own damage, and comprehensive plans."
          fields={[
            { name: 'provider_id', label: 'Provider', type: 'select', options: providerOptions },
            { name: 'policy_type', label: 'Policy Type', type: 'text' },
            { name: 'price_min', label: 'Minimum Premium', type: 'number' },
            { name: 'price_max', label: 'Maximum Premium', type: 'number' },
          ]}
          items={pricing}
          columns={[
            {
              key: 'provider_id',
              label: 'Provider',
              render: (item) => providers.find((provider) => provider.id === item.provider_id)?.name || item.provider_id,
            },
            { key: 'policy_type', label: 'Policy Type' },
            { key: 'price_min', label: 'Minimum' },
            { key: 'price_max', label: 'Maximum' },
          ]}
          onCreate={(payload) => notify(() => api.post('/api/agent/pricing', payload))}
          onUpdate={(id, payload) => notify(() => api.put(`/api/agent/pricing/${id}`, payload))}
          onDelete={(id) => notify(() => api.delete(`/api/agent/pricing/${id}`))}
        />
      )}

      {tab === 'Add-ons' && (
        <CrudSection
          title="Policy Add-ons"
          subtitle="Configure optional benefits like Zero Depreciation and Engine Protection."
          fields={[
            { name: 'name', label: 'Add-on Name', type: 'text' },
            { name: 'price', label: 'Price', type: 'number' },
          ]}
          items={addons}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'price', label: 'Price' },
            { key: 'active', label: 'Active' },
          ]}
          onCreate={(payload) => notify(() => api.post('/api/agent/addons', payload))}
          onUpdate={(id, payload) => notify(() => api.put(`/api/agent/addons/${id}`, payload))}
          onDelete={(id) => notify(() => api.delete(`/api/agent/addons/${id}`))}
        />
      )}

    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-brand">{value}</p>
    </div>
  );
}

function SummaryList({ title, subtitle, items }) {
  return (
    <div className="card">
      <h2 className="text-xl font-bold text-navy">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      <div className="mt-5 space-y-3">
        {items.length === 0 && (
          <div className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-400">
            No records available.
          </div>
        )}
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 px-4 py-3">
            <p className="font-medium text-navy">{item.title}</p>
            <p className="mt-1 text-sm text-slate-500">{item.meta}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CrudSection({ title, subtitle, fields, items, columns, onCreate, onUpdate, onDelete }) {
  const [form, setForm] = useState(makeInitialState(fields));
  const [editingId, setEditingId] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (editingId) {
      await onUpdate(editingId, normalizePayload(form, fields));
    } else {
      await onCreate(normalizePayload(form, fields));
    }
    setForm(makeInitialState(fields));
    setEditingId(null);
  };

  const startEdit = (item) => {
    const next = makeInitialState(fields);
    fields.forEach((field) => {
      next[field.name] = item[field.name] ?? '';
    });
    setForm(next);
    setEditingId(item.id);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <h2 className="text-xl font-bold text-navy">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {fields.map((field) => (
          <FieldInput
            key={field.name}
            field={field}
            value={form[field.name]}
            onChange={(value) => setForm((prev) => ({ ...prev, [field.name]: value }))}
          />
        ))}
        <div className="flex gap-3">
          <button className="btn-brand flex-1">{editingId ? 'Save Changes' : 'Save'}</button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(makeInitialState(fields));
              }}
              className="btn-outline flex-1 px-4 py-3 text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="card overflow-hidden p-0">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="font-semibold text-navy">Saved Records</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                {columns.map((column) => (
                  <th key={column.label} className="px-4 py-3">{column.label}</th>
                ))}
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td className="px-4 py-4 text-slate-400" colSpan={columns.length + 1}>No records available.</td></tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  {columns.map((column) => (
                    <td key={column.label} className="px-4 py-3">
                      {String(column.render ? column.render(item) : item[column.key] ?? '-')}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(item)} className="rounded-lg bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
                        Edit
                      </button>
                      <button onClick={() => onDelete(item.id)} className="rounded-lg bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                        Delete
                      </button>
                    </div>
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

function FieldInput({ field, value, onChange }) {
  if (field.type === 'select') {
    return (
      <div>
        <label className="label">{field.label}</label>
        <select className="input" value={value} onChange={(e) => onChange(Number(e.target.value))}>
          <option value="">Select</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div>
      <label className="label">{field.label}</label>
      <input
        type={field.type}
        className="input"
        value={value}
        onChange={(e) => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
      />
    </div>
  );
}

function makeInitialState(fields) {
  return Object.fromEntries(fields.map((field) => [field.name, '']));
}

function normalizePayload(form, fields) {
  const payload = {};
  fields.forEach((field) => {
    payload[field.name] = field.type === 'number' && form[field.name] !== ''
      ? Number(form[field.name])
      : form[field.name];
  });
  return payload;
}

function formatCurrency(value) {
  if (value == null || value === '') return '0';
  return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
