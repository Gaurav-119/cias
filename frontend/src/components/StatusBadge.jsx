const STYLES = {
  pending: 'bg-amber-100 text-amber-700',
  waiting_for_verifier: 'bg-amber-100 text-amber-700',
  pending_video_verification: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-green-100 text-green-700',
  paid: 'bg-green-100 text-green-700',
  approved: 'bg-green-100 text-green-700',
  under_review: 'bg-blue-100 text-blue-700',
  expired: 'bg-slate-200 text-slate-600',
  rejected: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
};

export default function StatusBadge({ status }) {
  const cls = STYLES[status] || 'bg-slate-100 text-slate-600';
  const label = String(status || '-').replace(/_/g, ' ');
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {label}
    </span>
  );
}
