import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from './SearchableSelect';
import { formatINR } from '../utils/policyCatalog';
const EMPTY = [];

/**
 * Cascading Vehicle Master: Brand → Model → Fuel → Transmission → Variant
 * Uses /api/vehicles/brands and /api/vehicles/models?brand_id=
 */
export default function VehicleMasterSelector({ value, onChange, onValuation, disabled = false }) {
  const { user, loading: authLoading } = useAuth();
  const [brands, setBrands] = useState(EMPTY);
  const [models, setModels] = useState(EMPTY);
  const [fuelTypes, setFuelTypes] = useState(EMPTY);
  const [transmissions, setTransmissions] = useState(EMPTY);
  const [variants, setVariants] = useState(EMPTY);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [brandsError, setBrandsError] = useState('');
  const [valuation, setValuation] = useState(null);
  const [idvLoading, setIdvLoading] = useState(false);
  const [error, setError] = useState('');
  const selection = value || {
    brand_id: '',
    model_id: '',
    brand: '',
    model: '',
    fuel_type: '',
    transmission: '',
    vehicle_master_id: '',
    year: '',
    accessory_value: '0',
    rc_date: '',
  };

  const patch = useCallback((updates) => {
    onChange({ ...selection, ...updates });
  }, [onChange, selection]);

  const brandName = useMemo(() => {
    if (selection.brand) return selection.brand;
    const hit = brands.find((b) => String(b.id) === String(selection.brand_id));
    return hit?.name || '';
  }, [brands, selection.brand, selection.brand_id]);

  const modelName = useMemo(() => {
    if (selection.model) return selection.model;
    const hit = models.find((m) => String(m.id) === String(selection.model_id));
    return hit?.name || '';
  }, [models, selection.model, selection.model_id]);

  const loadBrands = useCallback(() => {
    if (authLoading || !user) return undefined;
    let cancelled = false;
    setBrandsLoading(true);
    setBrandsError('');
    api.get('/api/vehicles/brands')
      .then((r) => {
        if (cancelled) return;
        const list = r.data || [];
        setBrands(list);
        if (!list.length) {
          setBrandsError('Vehicle catalogue is empty. Ask an admin to import the master data.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setBrands([]);
        const status = err.response?.status;
        if (status === 404) {
          setBrandsError('Vehicle catalogue API is unavailable. Rebuild the API container (docker compose build api).');
        } else {
          setBrandsError(err.response?.data?.error || 'Could not load brands. Check your connection and try again.');
        }
      })
      .finally(() => {
        if (!cancelled) setBrandsLoading(false);
      });
    return () => { cancelled = true; };
  }, [authLoading, user]);

  useEffect(() => loadBrands(), [loadBrands]);
  useEffect(() => {
    if (!selection.brand_id) {
      setModels(EMPTY);
      return undefined;
    }
    let cancelled = false;
    setModelsLoading(true);
    setModels(EMPTY);
    api.get('/api/vehicles/models', { params: { brand_id: selection.brand_id } })
      .then((r) => {
        if (!cancelled) setModels(r.data || []);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => { cancelled = true; };
  }, [selection.brand_id]);

  useEffect(() => {
    if (!brandName || !modelName) {
      setFuelTypes(EMPTY);
      return;
    }
    api.get('/api/vehicle-master/fuel-types', { params: { brand: brandName, model: modelName } })
      .then((r) => setFuelTypes(r.data.fuel_types || []))
      .catch(() => setFuelTypes([]));
  }, [brandName, modelName]);

  useEffect(() => {
    if (!brandName || !modelName || !selection.fuel_type) {
      setTransmissions(EMPTY);
      return;
    }
    api.get('/api/vehicle-master/transmissions', {
      params: { brand: brandName, model: modelName, fuel_type: selection.fuel_type },
    })
      .then((r) => setTransmissions(r.data.transmissions || []))
      .catch(() => setTransmissions([]));
  }, [brandName, modelName, selection.fuel_type]);

  useEffect(() => {
    if (!brandName || !modelName) {
      setVariants(EMPTY);
      return;
    }
    const params = { brand: brandName, model: modelName };
    if (selection.fuel_type) params.fuel_type = selection.fuel_type;
    if (selection.transmission) params.transmission = selection.transmission;
    api.get('/api/vehicle-master/variants', { params })
      .then((r) => setVariants(r.data.variants || []))
      .catch(() => setVariants([]));
  }, [brandName, modelName, selection.fuel_type, selection.transmission]);

  const selectedVariant = useMemo(
    () => variants.find((v) => String(v.id) === String(selection.vehicle_master_id)),
    [variants, selection.vehicle_master_id],
  );

  useEffect(() => {
    if (!selection.vehicle_master_id || !selection.year) {
      setValuation(null);
      return undefined;
    }
    let cancelled = false;
    setIdvLoading(true);
    setError('');
    api.post('/api/vehicle-master/calculate-idv', {
      vehicle_master_id: selection.vehicle_master_id,
      manufacturing_year: parseInt(selection.year, 10),
      accessory_value: parseFloat(selection.accessory_value || 0),
      rc_date: selection.rc_date || undefined,
    })
      .then((r) => {
        if (!cancelled) {
          setValuation(r.data);
          onValuation?.(r.data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Could not calculate IDV');
          setValuation(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIdvLoading(false);
      });
    return () => { cancelled = true; };
  }, [selection.vehicle_master_id, selection.year, selection.accessory_value, selection.rc_date, onValuation]);

  const onBrandChange = (brandId) => {
    const brand = brands.find((b) => String(b.id) === String(brandId));
    patch({
      brand_id: brandId,
      brand: brand?.name || '',
      model_id: '',
      model: '',
      fuel_type: '',
      transmission: '',
      vehicle_master_id: '',
    });
  };

  const onModelChange = (modelId) => {
    const model = models.find((m) => String(m.id) === String(modelId));
    patch({
      model_id: modelId,
      model: model?.name || '',
      fuel_type: '',
      transmission: '',
      vehicle_master_id: '',
    });
  };

  const exShowroom = selectedVariant?.ex_showroom_price;
  const idv = valuation?.valuation;

  return (
    <div className="space-y-4">
      {brandsError && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-500/20 px-3 py-2 text-sm text-amber-50">
          <span>{brandsError}</span>
          <button
            type="button"
            className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-medium hover:bg-white/30"
            onClick={loadBrands}
          >
            Retry
          </button>
        </div>
      )}
      {error && (        <div className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-100">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Brand *">
          <SearchableSelect
            className="input"
            options={brands}
            value={selection.brand_id}
            onChange={onBrandChange}
            disabled={disabled}
            loading={brandsLoading || authLoading}
            placeholder="Select brand"
            loadingText="Loading brands…"
            emptyText={brandsError ? 'Unable to load brands' : 'No brands available'}          />
        </Field>

        <Field label="Car Model *">
          <SearchableSelect
            className="input"
            options={models}
            value={selection.model_id}
            onChange={onModelChange}
            disabled={disabled || !selection.brand_id}
            loading={modelsLoading}
            placeholder="Select Car Model"
            loadingText="Loading models…"
            emptyText={selection.brand_id ? 'No models available' : 'Select a brand first'}
          />
        </Field>

        <Field label="Fuel Type *">
          <select
            className="input"
            disabled={disabled || !selection.model_id}
            value={selection.fuel_type}
            onChange={(e) => patch({
              fuel_type: e.target.value,
              transmission: '',
              vehicle_master_id: '',
            })}
          >
            <option value="">Select fuel type</option>
            {fuelTypes.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>

        <Field label="Transmission *">
          <select
            className="input"
            disabled={disabled || !selection.fuel_type}
            value={selection.transmission}
            onChange={(e) => patch({
              transmission: e.target.value,
              vehicle_master_id: '',
            })}
          >
            <option value="">Select transmission</option>
            {transmissions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>

        <Field label="Variant *">
          <select
            className="input"
            disabled={disabled || !selection.model_id || !variants.length}
            value={selection.vehicle_master_id}
            onChange={(e) => patch({ vehicle_master_id: e.target.value })}
          >
            <option value="">Select variant</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.variant}
                {' — '}
                {formatINR(v.ex_showroom_price)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Ex-Showroom Price (read-only)">
          <input
            className="input bg-white/30"
            readOnly
            disabled
            value={exShowroom ? formatINR(exShowroom) : '—'}
          />
        </Field>

        <Field label="Manufacturing Year *">
          <input
            type="number"
            min="1990"
            max={new Date().getFullYear() + 1}
            className="input"
            disabled={disabled}
            value={selection.year}
            onChange={(e) => patch({ year: e.target.value })}
          />
        </Field>

        <Field label="RC Registration Date">
          <input
            type="date"
            className="input"
            disabled={disabled}
            value={selection.rc_date}
            onChange={(e) => patch({ rc_date: e.target.value })}
          />
        </Field>
      </div>

      {idvLoading && (
        <p className="text-sm text-white/70">Calculating IDV…</p>
      )}

      {idv && (
        <div className="rounded-xl border border-brand/40 bg-brand/10 p-4 text-sm text-white">
          <p className="font-semibold text-brand">Automatic Valuation</p>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            <span>Vehicle Age: {idv.vehicle_age_years} years</span>
            <span>Depreciation: {idv.depreciation_percentage}%</span>
            <span>Depreciation Amount: {formatINR(idv.depreciation_amount)}</span>
            <span>Calculated IDV: {formatINR(idv.final_idv)}</span>
            <span className="font-semibold text-brand sm:col-span-2">
              Maximum Claim Amount: {formatINR(idv.max_claim_amount)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-white/90">{label}</label>
      {children}
    </div>
  );
}
