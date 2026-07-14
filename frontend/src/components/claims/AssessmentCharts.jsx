import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatINR } from '../../utils/policyCatalog';

const COLORS = ['#00C1D4', '#002147', '#64748b', '#ef4444', '#f59e0b', '#8b5cf6'];

function toChartData(dist = {}) {
  return Object.entries(dist).map(([name, value]) => ({ name, value }));
}

export default function AssessmentCharts({ charts }) {
  if (!charts) return null;
  const damageData = toChartData(charts.damage_distribution);
  const panelData = toChartData(charts.panel_distribution);
  const severityData = toChartData(charts.severity_distribution);

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      <ChartCard title="Damage Distribution">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={damageData} dataKey="value" nameKey="name" outerRadius={60} label>
              {damageData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Panel Distribution">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={panelData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#002147" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Severity Distribution">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={severityData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#00C1D4" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-card">
      <h4 className="mb-2 text-sm font-bold text-navy">{title}</h4>
      {children}
    </div>
  );
}

export function DamageReportTable({ items = [] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="bg-navy text-white">
            <th className="px-3 py-2 font-semibold">Damaged Part</th>
            <th className="px-3 py-2 font-semibold">Damage Type</th>
            <th className="px-3 py-2 font-semibold">Severity</th>
            <th className="px-3 py-2 font-semibold">Confidence</th>
            <th className="px-3 py-2 font-semibold">Estimated Repair Cost</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr><td colSpan={5} className="px-3 py-4 text-slatey">No damage regions detected.</td></tr>
          )}
          {items.map((row, i) => (
            <tr key={i} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
              <td className="px-3 py-2 text-ink">{row.panel}</td>
              <td className="px-3 py-2 text-ink">{row.damage_type}</td>
              <td className="px-3 py-2">
                <SeverityBadge severity={row.severity} />
              </td>
              <td className="px-3 py-2 text-ink">{row.confidence}%</td>
              <td className="px-3 py-2 font-semibold text-navy">{formatINR(row.estimated_cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const styles = {
    Minor: 'bg-emerald-100 text-emerald-800',
    Moderate: 'bg-amber-100 text-amber-800',
    Severe: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles[severity] || 'bg-slate-100 text-slate-700'}`}>
      {severity}
    </span>
  );
}
