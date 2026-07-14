import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { formatINR } from '../utils/policyCatalog';

export default function PolicyCertificate() {
  const { id } = useParams();
  const [cert, setCert] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/api/policies/${id}/certificate`)
      .then((r) => setCert(r.data.certificate))
      .catch((e) => setError(e.response?.data?.error || 'Certificate not found'));
  }, [id]);

  const downloadPdf = async () => {
    const res = await api.get(`/api/policies/${id}/certificate.pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ClaimNova-${cert?.header?.policy_number || id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sharePolicy = async () => {
    const text = `Claim Nova Policy ${cert?.header?.policy_number} — ${cert?.vehicle?.registration}`;
    if (navigator.share) {
      await navigator.share({ title: 'Claim Nova Policy', text, url: window.location.href });
    } else {
      await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
      alert('Policy link copied to clipboard.');
    }
  };

  if (error) {
    return <div className="mx-auto max-w-5xl px-4 py-10 text-red-600">{error}</div>;
  }
  if (!cert) {
    return <div className="mx-auto max-w-5xl px-4 py-10 text-slate-500">Loading policy schedule…</div>;
  }

  const h = cert.header || {};
  const holder = cert.holder || {};
  const vehicle = cert.vehicle || {};
  const ins = cert.insurance || {};
  const premium = cert.premium || {};
  const payment = cert.payment || {};
  const nominee = cert.nominee || {};
  const company = cert.company || {};

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/customer/policies/${id}`} className="text-sm font-semibold text-brand">
          ← Back to Policy
        </Link>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} className="btn-outline px-4 py-2 text-sm">
            Print Policy
          </button>
          <button type="button" onClick={downloadPdf} className="btn-brand px-4 py-2 text-sm">
            Download PDF
          </button>
          <button type="button" onClick={sharePolicy} className="btn-outline px-4 py-2 text-sm">
            Share Policy
          </button>
        </div>
      </div>

      <div className="print-area overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="bg-navy px-6 py-5 text-white sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand">Claim Nova Insurance</p>
              <h1 className="mt-1 text-xl font-bold sm:text-2xl">{h.title}</h1>
              <p className="mt-2 text-xs text-white/70">{company.address}</p>
            </div>
            <div className="text-right text-sm">
              <StatusBadge status={h.status?.toLowerCase()} />
              <p className="mt-2">Policy No: <b>{h.policy_number}</b></p>
              <p>Proposal: {h.proposal_number}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6 sm:px-8">
          <GridSection title="Policy Header">
            <Row label="Issue Date" value={h.issue_date} />
            <Row label="Effective Date" value={h.effective_date} />
            <Row label="Expiry Date" value={h.expiry_date} />
            <Row label="Status" value={h.status} bold />
          </GridSection>

          <GridSection title="Policy Holder">
            <Row label="Name" value={holder.name} />
            <Row label="DOB" value={holder.dob} />
            <Row label="Mobile" value={holder.mobile} />
            <Row label="Email" value={holder.email} />
            <Row label="Address" value={`${holder.address}, ${holder.city}, ${holder.state} ${holder.pincode}`} />
          </GridSection>

          <GridSection title="Vehicle Details">
            <Row label="Registration" value={vehicle.registration} bold />
            <Row label="Make / Model" value={`${vehicle.manufacturer} ${vehicle.model}`} />
            <Row label="Fuel / Year" value={`${vehicle.fuel_type} / ${vehicle.year}`} />
            <Row label="Chassis" value={vehicle.chassis_number} />
            <Row label="IDV" value={vehicle.idv} bold />
          </GridSection>

          <GridSection title="Insurance Details">
            <Row label="Insurer" value={ins.company} />
            <Row label="Policy Type" value={ins.policy_type} />
            <Row label="Coverage" value={`${ins.coverage_start} to ${ins.coverage_end}`} />
            <Row label="NCB" value={ins.ncb} />
            <Row label="Zero Dep" value={ins.zero_depreciation} />
            <Row label="RSA" value={ins.roadside_assistance} />
          </GridSection>

          <Section title="Premium Breakdown">
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-navy text-white">
                  <tr>
                    <th className="px-4 py-2">Particulars</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(premium.rows || []).map(([label, amount]) => (
                    <tr key={label} className="border-t border-slate-100">
                      <td className={`px-4 py-2 ${label === 'Grand Total' ? 'font-bold text-navy' : 'text-slate-600'}`}>
                        {label}
                      </td>
                      <td className={`px-4 py-2 text-right ${label === 'Grand Total' ? 'font-bold text-brand' : ''}`}>
                        {amount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Coverage Schedule">
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-brand text-white">
                  <tr>
                    <th className="px-4 py-2">Coverage</th>
                    <th className="px-4 py-2">Limit</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(cert.coverage_table || []).map((row) => (
                    <tr key={row.item} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-600">{row.item}</td>
                      <td className="px-4 py-2">{row.limit}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          row.status === 'Covered' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <GridSection title="Payment Details">
            <Row label="Transaction ID" value={payment.transaction_id} />
            <Row label="Stripe Payment ID" value={payment.stripe_payment_id} />
            <Row label="Payment Date" value={payment.payment_date} />
            <Row label="Method" value={payment.payment_method} />
            <Row label="Amount Paid" value={payment.amount_paid} bold />
            <Row label="Status" value={payment.status} />
          </GridSection>

          <GridSection title="Nominee">
            <Row label="Name" value={nominee.name} />
            <Row label="Relationship" value={nominee.relationship} />
            <Row label="Contact" value={nominee.contact} />
          </GridSection>

          <Section title="How to File a Claim">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
              {(cert.claim_process || []).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </Section>

          <Section title="Terms & Conditions">
            <ul className="space-y-1 text-xs text-slate-500">
              {(cert.terms || []).map((t) => (
                <li key={t}>• {t}</li>
              ))}
            </ul>
          </Section>

          <div className="border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
            <p className="font-semibold text-navy">{company.name}</p>
            <p>{company.email} | {company.phone} | {company.website}</p>
            <p className="mt-2 italic">
              This is a digitally generated policy document and does not require a physical signature.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="mb-3 border-l-4 border-brand pl-3 text-sm font-bold uppercase tracking-wide text-navy">
        {title}
      </h2>
      {children}
    </div>
  );
}

function GridSection({ title, children }) {
  return (
    <Section title={title}>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </Section>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right ${bold ? 'font-bold text-navy' : 'text-ink'}`}>{value || '—'}</span>
    </div>
  );
}
