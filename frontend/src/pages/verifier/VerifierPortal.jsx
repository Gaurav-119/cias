import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/client';
import LiveVideoPanel from '../../components/LiveVideoPanel';
import StatusBadge from '../../components/StatusBadge';

const CHECKLIST_ITEMS = [
  ['owner_identity_verified', 'Owner identity document verified'],
  ['owner_photo_matches', 'Passport photo matches live call'],
  ['rc_document_verified', 'RC document verified'],
  ['driving_license_verified', 'Driving license verified'],
  ['car_number_matches', 'Car number matches registration'],
  ['car_color_matches', 'Car color matches registration'],
  ['condition_matches_images', 'Condition matches uploaded images'],
  ['no_hidden_damage', 'No hidden damage observed'],
  ['vehicle_present', 'Vehicle present on live call'],
  ['owner_present', 'Owner present on live call'],
];

const DEFAULT_CHECKLIST = Object.fromEntries(CHECKLIST_ITEMS.map(([key]) => [key, false]));

function mapChecklist(raw = {}) {
  return {
    owner_identity_verified: !!(raw.owner_identity_verified),
    owner_photo_matches: !!(raw.owner_photo_matches),
    rc_document_verified: !!(raw.rc_document_verified),
    driving_license_verified: !!(raw.driving_license_verified),
    car_number_matches: !!(raw.car_number_matches ?? raw.registration_match),
    car_color_matches: !!(raw.car_color_matches),
    condition_matches_images: !!(raw.condition_matches_images ?? raw.images_clear),
    no_hidden_damage: !!(raw.no_hidden_damage ?? !raw.damage_visible),
    vehicle_present: !!(raw.vehicle_present ?? raw.identity_verified),
    owner_present: !!(raw.owner_present ?? raw.fraud_indicators_checked),
  };
}

export default function VerifierPortal({ defaultView = 'dashboard' }) {
  const navigate = useNavigate();
  const { vehicleId } = useParams();
  const [view, setView] = useState(defaultView);
  const [stats, setStats] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [history, setHistory] = useState([]);
  const [detail, setDetail] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    remarks: '',
    decision: 'approved',
    ocrNumber: '',
    aiSummary: '',
    fraudFlag: '',
    fraudNotes: '',
    checklist: { ...DEFAULT_CHECKLIST },
  });
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    setView(defaultView);
  }, [defaultView]);

  const loadStats = async () => {
    const res = await api.get('/api/admin/verification/stats');
    setStats(res.data.stats);
  };

  const loadPending = async () => {
    const res = await api.get('/api/admin/verification/pending');
    setVehicles(res.data.vehicles);
  };

  const loadHistory = async () => {
    const res = await api.get('/api/admin/verification/history');
    setHistory(res.data.sessions);
  };

  useEffect(() => {
    Promise.all([loadStats(), loadPending(), loadHistory()]).catch(() => {});
  }, []);

  useEffect(() => {
    if (defaultView === 'verify' && vehicleId) {
      setView('verify');
    }
  }, [defaultView, vehicleId]);

  useEffect(() => {
    if (!vehicleId || view !== 'verify') {
      setDetail(null);
      setSession(null);
      return;
    }
    setLoading(true);
    Promise.all([
      api.get(`/api/admin/verification/${vehicleId}`),
      api.get(`/api/verification/vehicles/${vehicleId}/active-session`),
    ])
      .then(([detailRes, sessionRes]) => {
        setDetail(detailRes.data);
        setSession(sessionRes.data.session || null);
        const latest = detailRes.data.sessions?.[0];
        setForm({
          remarks: latest?.remarks || '',
          decision: latest?.decision || 'approved',
          ocrNumber: latest?.ocrNumber || detailRes.data.vehicle?.license_plate || '',
          aiSummary: latest?.aiSummary || '',
          fraudFlag: latest?.fraudFlag || '',
          fraudNotes: latest?.fraudNotes || '',
          checklist: mapChecklist(latest?.checklist),
        });
      })
      .catch(() => {
        setDetail(null);
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, [vehicleId, view]);

  const pendingCards = useMemo(() => ([
    ['Pending Verifications', stats?.pending_verifications ?? 0],
    ['Approved', stats?.approved ?? 0],
    ['Rejected', stats?.rejected ?? 0],
    ['Completed Sessions', stats?.completed_sessions ?? 0],
  ]), [stats]);

  const decide = async (decision) => {
    if (!vehicleId) return;
    setSubmitting(true);
    setMessage('');
    try {
      const payload = {
        decision,
        remarks: form.remarks,
        checklist: {
          ...form.checklist,
          ocr_number: form.ocrNumber,
          ai_summary: form.aiSummary,
          fraud_flag: form.fraudFlag,
          fraud_notes: form.fraudNotes,
        },
      };

      if (session?.id) {
        await api.post(`/api/verification/sessions/${session.id}/decision`, payload);
      } else {
        await api.post(`/api/admin/verification/${vehicleId}/decision`, payload);
      }

      setMessage(`Vehicle verification ${decision} successfully.`);
      await Promise.all([loadStats(), loadPending(), loadHistory()]);
      navigate('/verifier/queue');
    } catch (err) {
      setMessage(err.response?.data?.error || 'Decision failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const queueView = view === 'queue' || view === 'dashboard' || view === 'pending';

  return (
    <div className="space-y-6">
      {previewFile && (
        <MediaPreviewOverlay file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {pendingCards.map(([label, value]) => (
          <div key={label} className="card">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-brand">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['dashboard', 'Dashboard'],
          ['queue', 'Pending Queue'],
          ['history', 'Verification History'],
        ].map(([entry, label]) => (
          <button
            key={entry}
            onClick={() => {
              setView(entry);
              if (entry === 'queue') navigate('/verifier/queue');
              if (entry === 'history') navigate('/verifier/history');
              if (entry === 'dashboard') navigate('/verifier/dashboard');
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              view === entry || (entry === 'queue' && view === 'pending') ? 'bg-brand text-white' : 'bg-white text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {message && (
        <div className="rounded-xl bg-brand/10 px-4 py-3 text-sm text-brand">{message}</div>
      )}

      {view === 'history' ? (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-navy">Verification History</h2>
              <p className="text-sm text-slate-500">Recent completed verifier decisions</p>
            </div>
            <button onClick={loadHistory} className="btn-outline px-4 py-2 text-sm">Reload</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Decision</th>
                  <th className="px-4 py-3">Remarks</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 && (
                  <tr><td className="px-4 py-4 text-slate-400" colSpan={5}>No verification history available.</td></tr>
                )}
                {history.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-4 py-3">#{item.id}</td>
                    <td className="px-4 py-3">Vehicle #{item.vehicle_id}</td>
                    <td className="px-4 py-3"><StatusBadge status={item.decision || item.status} /></td>
                    <td className="px-4 py-3 text-slate-600">{item.remarks || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.ended_at ? new Date(item.ended_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : view === 'verify' ? (
        <div className="card">
          {loading ? (
            <div className="py-12 text-center text-slate-500">Loading verification details...</div>
          ) : !detail?.vehicle ? (
            <div className="py-12 text-center text-slate-400">Open a vehicle from the queue to begin verification.</div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-navy">
                    {detail.vehicle.make} {detail.vehicle.model} ({detail.vehicle.year || '-'})
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Plate: {detail.vehicle.license_plate || '-'} · Fuel: {detail.vehicle.fuel_type || '-'} · Color: {detail.vehicle.color || '-'}
                  </p>
                </div>
                <StatusBadge status={detail.vehicle.status} />
              </div>

              <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                <div>
                  <LiveVideoPanel
                    vehicleId={Number(vehicleId)}
                    role="verifier"
                    sessionId={session?.id}
                    onSessionChange={setSession}
                  />

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-lg font-semibold text-navy">Owner Identity (KYC)</h3>
                    <div className="mt-2 space-y-1 text-sm text-slate-600">
                      <p>ID: {detail.vehicle.owner?.identity_proof_type || '-'} · {detail.vehicle.owner?.identity_proof_number || '-'}</p>
                      <p>DOB: {detail.vehicle.owner?.date_of_birth || '-'} · KYC: {detail.vehicle.owner?.kyc_status || '-'}</p>
                    </div>
                    <DocumentGallery
                      title="Identity proof"
                      files={detail.vehicle.owner?.kyc_documents?.identity_proof}
                      onPreview={setPreviewFile}
                    />
                    <DocumentGallery
                      title="Passport photo"
                      files={detail.vehicle.owner?.kyc_documents?.passport_photo}
                      onPreview={setPreviewFile}
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-lg font-semibold text-navy">Vehicle Documents</h3>
                    <DocumentGallery title="RC" files={detail.vehicle.documents?.rc_document} onPreview={setPreviewFile} />
                    <DocumentGallery title="Driving license" files={detail.vehicle.documents?.driving_license} onPreview={setPreviewFile} />
                    <DocumentGallery title="Insurance" files={detail.vehicle.documents?.insurance_certificate} onPreview={setPreviewFile} />
                    <DocumentGallery title="PUC" files={detail.vehicle.documents?.pollution_certificate} onPreview={setPreviewFile} />
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-lg font-semibold text-navy">Vehicle Photos</h3>
                    {detail.vehicle.images?.length ? (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {detail.vehicle.images.map((img) => (
                          <MediaThumb
                            key={img.id}
                            file={img}
                            label="vehicle"
                            imageClassName="h-24 w-full rounded-lg object-cover"
                            onPreview={setPreviewFile}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">No uploaded images found.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-lg font-semibold text-navy">Verification Checklist</h3>
                  <div className="space-y-3">
                    {CHECKLIST_ITEMS.map(([key, label]) => (
                      <label key={key} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={form.checklist[key]}
                          onChange={(e) => setForm((prev) => ({
                            ...prev,
                            checklist: { ...prev.checklist, [key]: e.target.checked },
                          }))}
                        />
                        <span className="text-sm text-slate-700">{label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div>
                      <label className="label">Decision</label>
                      <select
                        className="input"
                        value={form.decision}
                        onChange={(e) => setForm((prev) => ({ ...prev, decision: e.target.value }))}
                      >
                        <option value="approved">Approve</option>
                        <option value="rejected">Reject</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Remarks</label>
                      <input
                        className="input"
                        value={form.remarks}
                        onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
                        placeholder="Remarks"
                      />
                    </div>
                    <div>
                      <label className="label">OCR Detected Vehicle Number (optional)</label>
                      <input
                        className="input"
                        value={form.ocrNumber}
                        onChange={(e) => setForm((prev) => ({ ...prev, ocrNumber: e.target.value }))}
                        placeholder="OCR detected vehicle number"
                      />
                    </div>
                    <div>
                      <label className="label">AI Summary (optional)</label>
                      <input
                        className="input"
                        value={form.aiSummary}
                        onChange={(e) => setForm((prev) => ({ ...prev, aiSummary: e.target.value }))}
                        placeholder="AI review summary"
                      />
                    </div>
                    <div>
                      <label className="label">Fraud Flag Raised (optional)</label>
                      <input
                        className="input"
                        value={form.fraudFlag}
                        onChange={(e) => setForm((prev) => ({ ...prev, fraudFlag: e.target.value }))}
                        placeholder="Fraud flag raised"
                      />
                    </div>
                    <textarea
                      className="input min-h-24"
                      value={form.fraudNotes}
                      onChange={(e) => setForm((prev) => ({ ...prev, fraudNotes: e.target.value }))}
                      placeholder="Fraud notes"
                    />
                    <button
                      onClick={() => decide(form.decision)}
                      disabled={submitting}
                      className="btn-brand w-full"
                    >
                      {submitting ? 'Submitting decision...' : 'Submit Verification Decision'}
                    </button>
                  </div>
                  <div className="mt-6">
                    <h3 className="mb-3 text-lg font-semibold text-navy">Owner & Vehicle Details</h3>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                      <Row label="Owner" value={detail.vehicle.owner?.full_name || '-'} />
                      <Row label="Email" value={detail.vehicle.owner?.email || '-'} />
                      <Row label="Phone" value={detail.vehicle.owner?.phone || '-'} />
                      <Row label="Vehicle No." value={detail.vehicle.license_plate || '-'} />
                      <Row label="Model" value={`${detail.vehicle.make} ${detail.vehicle.model}`} />
                      <Row label="Color" value={detail.vehicle.color || '-'} />
                      <Row label="Status" value={detail.vehicle.status || '-'} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : queueView ? (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-navy">Verifier Queue</h2>
              <p className="text-sm text-slate-500">Separate queue for vehicles waiting for real-time verification.</p>
            </div>
            <button onClick={loadPending} className="btn-outline px-4 py-2 text-sm">Reload Queue</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Vehicle No.</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Color</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.length === 0 && (
                  <tr><td className="px-4 py-4 text-slate-400" colSpan={8}>No vehicles are waiting in the verifier queue.</td></tr>
                )}
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="border-b border-slate-100">
                    <td className="px-4 py-3">{vehicle.id}</td>
                    <td className="px-4 py-3">{vehicle.owner?.email || vehicle.owner?.full_name || '-'}</td>
                    <td className="px-4 py-3">{vehicle.license_plate || '-'}</td>
                    <td className="px-4 py-3">{vehicle.make} {vehicle.model}</td>
                    <td className="px-4 py-3">{vehicle.color || '-'}</td>
                    <td className="px-4 py-3"><StatusBadge status={vehicle.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {vehicle.created_at ? new Date(vehicle.created_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/verifier/verify/${vehicle.id}`)}
                        className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white"
                      >
                        Verify
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-navy">{value}</span>
    </div>
  );
}

function DocumentGallery({ title, files, onPreview }) {
  if (!files?.length) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {files.map((file) => (
          <MediaThumb
            key={file.id}
            file={file}
            label={title}
            onPreview={onPreview}
          />
        ))}
      </div>
    </div>
  );
}

function isPdfFile(file) {
  const name = file?.original_name || file?.url || '';
  return file?.content_type?.includes('pdf') || /\.pdf($|\?)/i.test(name);
}

function fileApiPath(file) {
  if (file?.object_key) {
    return `/api/files/${file.object_key.split('/').map(encodeURIComponent).join('/')}`;
  }
  if (file?.url?.includes('/api/files/')) {
    try {
      const parsed = new URL(file.url, 'http://localhost');
      return `${parsed.pathname}${parsed.search}`;
    } catch {
      return file.url.startsWith('/') ? file.url : `/${file.url}`;
    }
  }
  return '';
}

async function fetchFileBlobUrl(file) {
  const path = fileApiPath(file);
  if (!path) {
    throw new Error('File location unavailable');
  }
  const res = await api.get(path, { responseType: 'blob' });
  const mime = file.content_type || res.headers['content-type'] || 'application/octet-stream';
  const blob = res.data.type === mime
    ? res.data
    : new Blob([res.data], { type: mime });
  return URL.createObjectURL(blob);
}

function MediaThumb({ file, label, onPreview, imageClassName = 'h-20 w-full rounded-lg object-cover' }) {
  const [thumbSrc, setThumbSrc] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const isPdf = isPdfFile(file);

  useEffect(() => {
    let blobUrl = '';
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        blobUrl = await fetchFileBlobUrl(file);
        if (!cancelled) {
          setThumbSrc(blobUrl);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
    };
  }, [file]);

  const openPreview = () => onPreview?.({ ...file, label });

  return (
    <div className="group relative overflow-hidden rounded-lg">
      {isPdf ? (
        <div className="flex h-20 items-center justify-center bg-white text-xs text-slate-600 ring-1 ring-slate-200">
          PDF · {file.original_name || 'document'}
        </div>
      ) : loading ? (
        <div className="flex h-20 items-center justify-center bg-slate-100 text-xs text-slate-500 ring-1 ring-slate-200">
          Loading...
        </div>
      ) : loadError ? (
        <div className="flex h-20 items-center justify-center bg-slate-100 text-xs text-slate-500 ring-1 ring-slate-200">
          Preview unavailable
        </div>
      ) : (
        <img
          src={thumbSrc}
          alt={label}
          className={imageClassName}
          onClick={openPreview}
          onKeyDown={(e) => e.key === 'Enter' && openPreview()}
          role="button"
          tabIndex={0}
        />
      )}
      <button
        type="button"
        onClick={openPreview}
        className="absolute bottom-1 right-1 rounded-md bg-brand px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm hover:bg-brand/90"
      >
        Preview
      </button>
    </div>
  );
}

function MediaPreviewOverlay({ file, onClose }) {
  const [previewSrc, setPreviewSrc] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isPdf = isPdfFile(file);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let blobUrl = '';
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        blobUrl = await fetchFileBlobUrl(file);
        if (!cancelled) setPreviewSrc(blobUrl);
      } catch {
        if (!cancelled) setError('Could not load document preview.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
    };
  }, [file]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="truncate text-sm font-semibold text-navy">
            {file.original_name || file.label || 'Document preview'}
          </p>
          <button
            type="button"
            className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-navy hover:bg-slate-200"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-[50vh] flex-1 items-center justify-center bg-slate-900 p-4">
          {loading && <p className="text-sm text-white/80">Loading preview...</p>}
          {!loading && error && <p className="text-sm text-red-200">{error}</p>}
          {!loading && !error && isPdf && (
            <iframe
              title={file.original_name || 'PDF preview'}
              src={previewSrc}
              className="h-[75vh] w-full rounded-lg bg-white"
            />
          )}
          {!loading && !error && !isPdf && (
            <img
              src={previewSrc}
              alt={file.original_name || file.label || 'Preview'}
              className="max-h-[75vh] max-w-full object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );
}
