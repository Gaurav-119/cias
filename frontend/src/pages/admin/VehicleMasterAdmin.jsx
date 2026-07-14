import { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';
import { formatINR } from '../../utils/policyCatalog';

const EMPTY_FORM = {
  brand: '',
  model: '',
  variant: '',
  fuel_type: 'Petrol',
  transmission: 'Manual',
  body_type: '',
  segment: '',
  manufacturing_start_year: new Date().getFullYear(),
  manufacturing_end_year: '',
  engine_cc: '',
  ex_showroom_price: '',
  currency: 'INR',
  is_active: true,
};

export default function VehicleMasterAdmin() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [depConfig, setDepConfig] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [subTab, setSubTab] = useState('list');
  const perPage = 20;

  const load = useCallback(async () => {
    const res = await api.get('/api/admin/vehicle-master', {
      params: { page, per_page: perPage, q: q || undefined },
    });
    setItems(res.data.items || []);
    setTotal(res.data.total || 0);
  }, [page, q]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  useEffect(() => {
    if (subTab === 'depreciation') {
      api.get('/api/admin/vehicle-master/depreciation-config')
        .then((r) => setDepConfig(r.data.config))
        .catch(() => {});
    }
    if (subTab === 'audit') {
      api.get('/api/admin/vehicle-master/audit-logs')
        .then((r) => setAuditLogs(r.data.logs || []))
        .catch(() => {});
    }
  }, [subTab]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const save = async () => {
    setMessage('');
    setError('');
    try {
      const payload = {
        ...form,
        manufacturing_start_year: parseInt(form.manufacturing_start_year, 10),
        manufacturing_end_year: form.manufacturing_end_year
          ? parseInt(form.manufacturing_end_year, 10) : null,
        engine_cc: form.engine_cc ? parseInt(form.engine_cc, 10) : null,
        ex_showroom_price: parseFloat(form.ex_showroom_price),
      };
      if (editingId) {
        await api.put(`/api/admin/vehicle-master/${editingId}`, payload);
        setMessage('Vehicle updated.');
      } else {
        await api.post('/api/admin/vehicle-master', payload);
        setMessage('Vehicle added.');
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.');
    }
  };

  const edit = (row) => {
    setEditingId(row.id);
    setForm({
      brand: row.brand,
      model: row.model,
      variant: row.variant,
      fuel_type: row.fuel_type,
      transmission: row.transmission,
      body_type: row.body_type || '',
      segment: row.segment || '',
      manufacturing_start_year: row.manufacturing_start_year,
      manufacturing_end_year: row.manufacturing_end_year || '',
      engine_cc: row.engine_cc || '',
      ex_showroom_price: row.ex_showroom_price,
      currency: row.currency || 'INR',
      is_active: row.is_active,
    });
    setSubTab('form');
  };

  const deactivate = async (id) => {
    if (!window.confirm('Deactivate this vehicle record?')) return;
    await api.delete(`/api/admin/vehicle-master/${id}`);
    setMessage('Vehicle deactivated.');
    await load();
  };

  const importCsv = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.post('/api/admin/vehicle-master/import', fd);
    setMessage(`Import: ${res.data.created} created, ${res.data.updated} updated.`);
    await load();
  };

  const exportCsv = async () => {
    const res = await api.get('/api/admin/vehicle-master/export', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vehicle_master_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveDepreciation = async () => {
    await api.put('/api/admin/vehicle-master/depreciation-config', depConfig);
    setMessage('Depreciation configuration saved.');
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-navy">Vehicle Master Database</h2>
        <p className="text-sm text-slate-500">
          Manage brands, models, variants and ex-showroom prices. Customers cannot edit prices.
        </p>
      </div>

      {message && <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap gap-2">
        {['list', 'form', 'depreciation', 'audit'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
              subTab === t ? 'bg-brand text-white' : 'bg-white text-slate-600 shadow-sm'
            }`}
          >
            {t === 'list' ? 'Catalogue' : t}
          </button>
        ))}
      </div>

      {subTab === 'list' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              className="input max-w-xs"
              placeholder="Search brand, model, variant…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
            />
            <button type="button" className="btn-outline text-sm" onClick={() => load()}>Search</button>
            <button type="button" className="btn-outline text-sm" onClick={exportCsv}>Export CSV</button>
            <label className="btn-brand cursor-pointer text-sm">
              Import CSV
              <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files[0] && importCsv(e.target.files[0])} />
            </label>
            <button type="button" className="btn-brand text-sm" onClick={() => { resetForm(); setSubTab('form'); }}>
              Add Vehicle
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl bg-white shadow-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="px-3 py-2">Brand</th>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">Variant</th>
                  <th className="px-3 py-2">Fuel</th>
                  <th className="px-3 py-2">Trans.</th>
                  <th className="px-3 py-2">Ex-Showroom</th>
                  <th className="px-3 py-2">Active</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">{row.brand}</td>
                    <td className="px-3 py-2">{row.model}</td>
                    <td className="px-3 py-2">{row.variant}</td>
                    <td className="px-3 py-2">{row.fuel_type}</td>
                    <td className="px-3 py-2">{row.transmission}</td>
                    <td className="px-3 py-2">{formatINR(row.ex_showroom_price)}</td>
                    <td className="px-3 py-2">{row.is_active ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" className="text-brand" onClick={() => edit(row)}>Edit</button>
                      {row.is_active && (
                        <button type="button" className="ml-2 text-red-600" onClick={() => deactivate(row.id)}>Deactivate</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>Page {page} of {totalPages} ({total} records)</span>
            <button type="button" disabled={page <= 1} className="btn-outline px-3 py-1" onClick={() => setPage((p) => p - 1)}>Prev</button>
            <button type="button" disabled={page >= totalPages} className="btn-outline px-3 py-1" onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}

      {subTab === 'form' && (
        <div className="card grid gap-4 sm:grid-cols-2">
          <h3 className="sm:col-span-2 font-semibold text-navy">{editingId ? 'Edit Vehicle' : 'Add Vehicle'}</h3>
          {['brand', 'model', 'variant', 'fuel_type', 'transmission', 'body_type', 'segment'].map((key) => (
            <label key={key} className="block text-sm">
              <span className="text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
              <input className="input mt-1" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </label>
          ))}
          <label className="block text-sm">
            <span className="text-slate-500">Start Year</span>
            <input type="number" className="input mt-1" value={form.manufacturing_start_year}
              onChange={(e) => setForm({ ...form, manufacturing_start_year: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">End Year (optional)</span>
            <input type="number" className="input mt-1" value={form.manufacturing_end_year}
              onChange={(e) => setForm({ ...form, manufacturing_end_year: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Engine CC</span>
            <input type="number" className="input mt-1" value={form.engine_cc}
              onChange={(e) => setForm({ ...form, engine_cc: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">Ex-Showroom Price (INR)</span>
            <input type="number" className="input mt-1" value={form.ex_showroom_price}
              onChange={(e) => setForm({ ...form, ex_showroom_price: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" className="btn-brand" onClick={save}>{editingId ? 'Update' : 'Create'}</button>
            <button type="button" className="btn-outline" onClick={resetForm}>Reset</button>
          </div>
        </div>
      )}

      {subTab === 'depreciation' && depConfig && (
        <div className="card max-w-lg space-y-4">
          <h3 className="font-semibold text-navy">Depreciation over 10 years</h3>
          <p className="text-sm text-slate-500">Configurable between min and max percentage (default 40%–50%).</p>
          {['over_10_years_min_pct', 'over_10_years_max_pct', 'over_10_years_applied_pct'].map((key) => (
            <label key={key} className="block text-sm">
              <span className="text-slate-500">{key.replace(/_/g, ' ')}</span>
              <input type="number" step="0.1" className="input mt-1" value={depConfig[key]}
                onChange={(e) => setDepConfig({ ...depConfig, [key]: e.target.value })} />
            </label>
          ))}
          <button type="button" className="btn-brand" onClick={saveDepreciation}>Save Configuration</button>
        </div>
      )}

      {subTab === 'audit' && (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Admin</th>
                <th className="px-3 py-2">Operation</th>
                <th className="px-3 py-2">Vehicle ID</th>
                <th className="px-3 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">{log.created_at?.slice(0, 19)}</td>
                  <td className="px-3 py-2">{log.admin_user_id}</td>
                  <td className="px-3 py-2">{log.operation}</td>
                  <td className="px-3 py-2">{log.vehicle_master_id || '—'}</td>
                  <td className="px-3 py-2">{log.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
