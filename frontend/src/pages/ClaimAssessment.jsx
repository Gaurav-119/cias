import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import DamageImagePreview, { downloadAnnotatedCanvas } from '../components/claims/DamageImagePreview';
import { fetchFileBlobUrl } from '../utils/fileMedia';
import { formatINR } from '../utils/policyCatalog';

function AssessmentCard({ title, children, className = '' }) {
  return (
    <section className={`flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card ${className}`}>
      <header className="bg-navy px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-white">
        {title}
      </header>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-2.5 text-sm last:border-0">
      <span className="text-slatey">{label}</span>
      <span className="text-right font-semibold text-ink">{value ?? '—'}</span>
    </div>
  );
}

function SeverityPill({ severity }) {
  const styles = {
    Minor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Moderate: 'bg-amber-50 text-amber-800 border-amber-200',
    Severe: 'bg-red-50 text-red-700 border-red-200',
    'Inspection Required': 'bg-slate-100 text-slate-700 border-slate-300',
  };
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${styles[severity] || styles['Inspection Required']}`}>
      {severity}
    </span>
  );
}

function DecisionBadge({ decision }) {
  const styles = {
    Approved: 'bg-emerald-600 text-white',
    'Needs Manual Inspection': 'bg-amber-500 text-white',
    Rejected: 'bg-red-600 text-white',
  };
  return (
    <span className={`inline-block rounded-md px-3 py-1 text-sm font-bold ${styles[decision] || 'bg-slate-500 text-white'}`}>
      {decision}
    </span>
  );
}

export default function ClaimAssessment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [resolvedImageUrl, setResolvedImageUrl] = useState('');
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    api.get(`/api/claims/${id}/assessment`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || 'Assessment not available'));
  }, [id]);

  const downloadPdf = async () => {
    setBusy('pdf');
    try {
      const res = await api.get(`/api/claims/${id}/reports/damage.pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `damage-report-${data?.claim?.claim_number || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not download PDF.');
    } finally {
      setBusy('');
    }
  };

  const downloadAnnotated = () => {
    downloadAnnotatedCanvas(canvasRef.current, `annotated-${data?.claim?.claim_number || id}.png`);
  };

  const requestInspection = async () => {
    setBusy('inspect');
    try {
      await api.post(`/api/claims/${id}/request-inspection`);
      setToast('Manual inspection requested. Our team will contact you shortly.');
    } catch (e) {
      setError(e.response?.data?.error || 'Request failed.');
    } finally {
      setBusy('');
    }
  };

  const claimImage = data ? (data.assessment?.image || data.images?.[0]) : null;

  useEffect(() => {
    if (!claimImage?.object_key && !claimImage?.url) {
      setResolvedImageUrl('');
      setImageLoading(false);
      return undefined;
    }

    let blobUrl = '';
    let cancelled = false;
    setImageLoading(true);

    fetchFileBlobUrl(claimImage)
      .then((url) => {
        blobUrl = url;
        if (!cancelled) setResolvedImageUrl(url);
      })
      .catch(() => {
        if (!cancelled) setResolvedImageUrl('');
      })
      .finally(() => {
        if (!cancelled) setImageLoading(false);
      });

    return () => {
      cancelled = true;
      if (blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
    };
  }, [claimImage]);

  if (error && !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-red-600">{error}</p>
        <Link to={`/customer/claims/${id}`} className="mt-4 inline-block text-brand">← Back to claim</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-100">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      </div>
    );
  }

  const { claim, assessment, images, vehicle, ai_result: aiResult } = data;
  const summary = assessment?.summary || {};
  const v = assessment?.vehicle || vehicle || {};
  const image = claimImage;
  const policyNumber = assessment?.policy_number || '—';
  const lineItems = assessment?.line_items || [];

  return (
    <div className="min-h-screen bg-slate-100 px-3 py-5 sm:px-6">
      {toast && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {toast}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="mx-auto grid max-w-[1500px] gap-4 lg:grid-cols-3 lg:items-stretch">
        {/* LEFT — Vehicle & claim details */}
        <AssessmentCard title="Upload Details">
          {image && (
            <div className="mb-4 overflow-hidden rounded-lg border border-slate-200">
              {imageLoading ? (
                <div className="flex aspect-video items-center justify-center bg-slate-100 text-sm text-slatey">
                  Loading image...
                </div>
              ) : resolvedImageUrl ? (
                <img src={resolvedImageUrl} alt="Thumbnail" className="aspect-video w-full object-cover" />
              ) : (
                <div className="flex aspect-video items-center justify-center bg-slate-100 text-sm text-slatey">
                  Image unavailable
                </div>
              )}
              <p className="truncate bg-slate-50 px-2 py-1.5 text-xs text-slatey">
                {image?.original_name || image?.filename || 'damage-image.jpg'}
              </p>
            </div>
          )}
          <DetailRow label="Claim Number" value={claim.claim_number} />
          <DetailRow label="Policy Number" value={policyNumber} />
          <DetailRow label="Vehicle Brand" value={v.brand || v.make} />
          <DetailRow label="Vehicle Model" value={v.model} />
          <DetailRow label="Registration Number" value={v.registration_number || v.license_plate} />
          <DetailRow label="Manufacturing Year" value={v.manufacturing_year || v.year} />
          <DetailRow label="Claim Status" value={<span className="capitalize">{claim.status?.replace('_', ' ')}</span>} />
        </AssessmentCard>

        {/* CENTER — Annotated preview */}
        <AssessmentCard title="Preview">
          {imageLoading ? (
            <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 text-sm text-slatey">
              Loading preview...
            </div>
          ) : resolvedImageUrl ? (
            <DamageImagePreview
              imageUrl={resolvedImageUrl}
              raw={aiResult?.raw || assessment?.ai_raw}
              onCanvasReady={(c) => { canvasRef.current = c; }}
            />
          ) : image ? (
            <p className="text-center text-slatey">Could not load image preview.</p>
          ) : (
            <p className="text-center text-slatey">No image available.</p>
          )}
        </AssessmentCard>

        {/* RIGHT — Damage report */}
        <AssessmentCard title="Estimation" className="lg:max-h-[85vh]">
          <div className="flex h-full max-h-[calc(85vh-56px)] flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-1">
              <p className="text-xs text-slatey">Here is the analysis report:</p>
              <h2 className="mt-1 text-xl font-bold text-navy">AI Damage Report</h2>

              <div className="mt-4">
                <p className="text-sm font-bold text-navy">Detected Panels:</p>
                <ul className="mt-1 list-inside list-disc text-sm text-ink">
                  {(assessment?.detected_panels || []).map((p) => <li key={p}>{p}</li>)}
                </ul>
              </div>

              <div className="mt-3">
                <p className="text-sm font-bold text-navy">Detected Damages:</p>
                <ul className="mt-1 list-inside list-disc text-sm text-ink">
                  {(assessment?.detected_damages || []).map((d) => <li key={d}>{d}</li>)}
                </ul>
              </div>

              <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-navy text-white">
                      <th className="px-2 py-2 font-semibold">Panel</th>
                      <th className="px-2 py-2 font-semibold">Damage</th>
                      <th className="px-2 py-2 font-semibold">Severity</th>
                      <th className="px-2 py-2 font-semibold">Conf.</th>
                      <th className="px-2 py-2 font-semibold">Repair Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-4 text-slatey">No damages detected.</td></tr>
                    )}
                    {lineItems.map((row, i) => (
                      <tr key={i} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                        <td className="px-2 py-2 font-medium text-ink">{row.panel}</td>
                        <td className="px-2 py-2 text-ink">{row.damage || row.damage_type}</td>
                        <td className="px-2 py-2"><SeverityPill severity={row.severity} /></td>
                        <td className="px-2 py-2 text-ink">{row.confidence}%</td>
                        <td className="px-2 py-2 font-semibold text-navy">{formatINR(row.repair_cost ?? row.estimated_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm">
                <FinancialRow label="Total Repair Cost" value={formatINR(summary.total_repair_cost)} bold />
                <FinancialRow label="Estimated IDV" value={formatINR(summary.estimated_idv)} />
                <FinancialRow label="Maximum Claim Eligible" value={formatINR(summary.maximum_claim_eligible)} />
                <FinancialRow label="Deductibles" value={formatINR(summary.deductibles)} />
                <FinancialRow label="Depreciation" value={formatINR(summary.depreciation)} />
                <FinancialRow label="Final Claim Amount" value={formatINR(summary.final_claim_amount)} bold />
                <FinancialRow label="Fraud Score" value={`${summary.fraud_score ?? 0} / 100`} />
                <div className="flex items-center justify-between pt-2">
                  <span className="font-semibold text-navy">Claim Decision</span>
                  <DecisionBadge decision={summary.claim_decision} />
                </div>
              </div>
            </div>
          </div>
        </AssessmentCard>
      </div>

      {/* Action bar */}
      <div className="mx-auto mt-5 flex max-w-[1500px] flex-wrap justify-center gap-3">
        <button type="button" className="btn-outline min-w-[160px]" disabled={!!busy} onClick={downloadPdf}>
          {busy === 'pdf' ? 'Generating…' : 'Download PDF Report'}
        </button>
        <button type="button" className="btn-outline min-w-[160px]" onClick={downloadAnnotated}>
          Download Annotated Image
        </button>
        <button type="button" className="btn-brand min-w-[160px]" onClick={() => navigate(`/customer/claims/${id}`)}>
          Submit Claim
        </button>
        <button type="button" className="min-w-[160px] rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50" disabled={!!busy} onClick={requestInspection}>
          {busy === 'inspect' ? 'Requesting…' : 'Request Manual Inspection'}
        </button>
      </div>
    </div>
  );
}

function FinancialRow({ label, value, bold }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slatey">{label}</span>
      <span className={bold ? 'font-bold text-navy' : 'font-medium text-ink'}>{value}</span>
    </div>
  );
}
