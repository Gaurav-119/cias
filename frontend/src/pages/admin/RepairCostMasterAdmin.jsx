import { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';
import { formatINR } from '../../utils/policyCatalog';

const EMPTY = {
  vehicle_brand: '*',
  vehicle_model: '*',
  panel_name: '',
  damage_type: '',
  severity: 'Moderate',
  min_cost: '',
  max_cost: '',
  is_active: true,
};

export default function RepairCostMasterAdmin() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [rules, setRules] = useState(null);
  const [tab, setTab] = useState('costs');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await api.get('/api/admin/repair-master', { params: { page, per_page: 30, q: q || undefined } });
    setItems(res.data.items || []);
    setTotal(res.data.total || 0);
  }, [page, q]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  useEffect(() => {
    if (tab === 'rules') {
      api.get('/api/admin/repair-master/claim-rules').then((r) => setRules(r.data.config)).catch(() => {});
    }
  }, [tab]);

  const save = async () => {
    setMessage('');
    setError('');
    try {
      const payload = {
        ...form,
        min_cost: parseFloat(form.min_cost),
        max_cost: parseFloat(form.max_cost),
      };
      if (editingId) {
        await api.put(`/api/admin/repair-master/${editingId}`, payload);
        setMessage('Repair cost updated.');
      } else {
        await api.post('/api/admin/repair-master', payload);
        setMessage('Repair cost added.');
      }
      setForm(EMPTY);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.');
    }
  };

  const saveRules = async () => {
    try {
      const res = await api.put('/api/admin/repair-master/claim-rules', rules);
      setRules(res.data.config);
      setMessage('Claim rules updated.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save rules.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-navy">Repair Cost Master</h1>
      <p className="mt-1 text-sm text-slatey">Configure panel repair costs, severity thresholds, and claim rules.</p>

      <div className="mt-4 flex gap-2">
        {['costs', 'rules'].map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === t ? 'bg-brand text-white' : 'bg-white text-navy border'}`}>
            {t === 'costs' ? 'Repair Costs' : 'Severity & Claim Rules'}
          </button>
        ))}
      </div>

      {message && <p className="mt-3 text-sm text-emerald-600">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {tab === 'costs' && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="card space-y-3">
            <h2 className="font-bold text-navy">{editingId ? 'Edit' : 'Add'} Repair Cost</h2>
            {['vehicle_brand', 'vehicle_model', 'panel_name', 'damage_type'].map((k) => (
              <input key={k} className="input" placeholder={k.replace(/_/g, ' ')} value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            ))}
            <select className="input" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              {['Minor', 'Moderate', 'Severe'].map((s) => <option key={s}>{s}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input className="input" type="number" placeholder="Min cost" value={form.min_cost}
                onChange={(e) => setForm({ ...form, min_cost: e.target.value })} />
              <input className="input" type="number" placeholder="Max cost" value={form.max_cost}
                onChange={(e) => setForm({ ...form, max_cost: e.target.value })} />
            </div>
            <button type="button" className="btn-brand" onClick={save}>Save</button>
          </div>

          <div className="card">
            <div className="mb-3 flex gap-2">
              <input className="input flex-1" placeholder="Search panel or damage…" value={q}
                onChange={(e) => setQ(e.target.value)} />
              <button type="button" className="btn-outline" onClick={load}>Search</button>
            </div>
            <div className="max-h-[480px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="bg-navy text-white">
                  <th className="px-2 py-1">Brand</th><th className="px-2 py-1">Model</th>
                  <th className="px-2 py-1">Panel</th><th className="px-2 py-1">Damage</th>
                  <th className="px-2 py-1">Severity</th><th className="px-2 py-1">Range</th><th />
                </tr></thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="px-2 py-1 text-xs">{row.vehicle_brand || '*'}</td>
                      <td className="px-2 py-1 text-xs">{row.vehicle_model || '*'}</td>
                      <td className="px-2 py-1">{row.panel_name}</td>
                      <td className="px-2 py-1">{row.damage_type}</td>
                      <td className="px-2 py-1">{row.severity}</td>
                      <td className="px-2 py-1">{formatINR(row.min_cost)} – {formatINR(row.max_cost)}</td>
                      <td className="px-2 py-1">
                        <button type="button" className="text-brand text-xs" onClick={() => { setEditingId(row.id); setForm({ ...row, min_cost: row.min_cost, max_cost: row.max_cost }); }}>Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slatey">{total} record(s)</p>
          </div>
        </div>
      )}

      {tab === 'rules' && rules && (
        <div className="card mt-6 max-w-lg space-y-3">
          <h2 className="font-bold text-navy">Severity Thresholds (damage / panel area)</h2>
          <label className="block text-sm">Minor below
            <input className="input mt-1" type="number" step="0.01" value={rules.minor_threshold}
              onChange={(e) => setRules({ ...rules, minor_threshold: parseFloat(e.target.value) })} />
          </label>
          <label className="block text-sm">Moderate below
            <input className="input mt-1" type="number" step="0.01" value={rules.moderate_threshold}
              onChange={(e) => setRules({ ...rules, moderate_threshold: parseFloat(e.target.value) })} />
          </label>
          <label className="block text-sm">Cashless max amount (₹)
            <input className="input mt-1" type="number" value={rules.cashless_max_amount}
              onChange={(e) => setRules({ ...rules, cashless_max_amount: parseFloat(e.target.value) })} />
          </label>
          <label className="block text-sm">Min AI confidence for auto-review
            <input className="input mt-1" type="number" step="0.01" value={rules.auto_review_min_confidence}
              onChange={(e) => setRules({ ...rules, auto_review_min_confidence: parseFloat(e.target.value) })} />
          </label>
          <label className="block text-sm">Deductible %
            <input className="input mt-1" type="number" step="0.01" value={rules.deductible_percentage}
              onChange={(e) => setRules({ ...rules, deductible_percentage: parseFloat(e.target.value) })} />
          </label>
          <label className="block text-sm">IDV cap percentage
            <input className="input mt-1" type="number" step="0.01" value={rules.idv_cap_percentage}
              onChange={(e) => setRules({ ...rules, idv_cap_percentage: parseFloat(e.target.value) })} />
          </label>
          <button type="button" className="btn-brand" onClick={saveRules}>Save Rules</button>
        </div>
      )}
    </div>
  );
}
