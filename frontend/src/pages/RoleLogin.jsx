import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleHome, getRoleLabel } from '../utils/roles';
import { currentPortalRole, portalLoginUrl } from '../utils/portals';

const allowedRoles = ['user', 'agent', 'verifier', 'admin'];

export default function RoleLogin() {
  const { role = 'user' } = useParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const activeRole = useMemo(
    () => (allowedRoles.includes(role) ? role : 'user'),
    [role],
  );
  const roleLabel = getRoleLabel(activeRole);
  const verifierMode = activeRole === 'verifier';
  const dedicatedPortal = currentPortalRole();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      if (user.role !== activeRole) {
        setError(`This account does not have access to the ${roleLabel.toLowerCase()} portal.`);
        return;
      }
      navigate(getRoleHome(user.role));
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md items-center px-4">
      <div className="card w-full">
        {verifierMode ? (
          <>
            <h1 className="text-2xl font-bold text-navy">Company Verifier Portal</h1>
            <p className="mt-2 text-sm text-slate-500">
              Separate login/register for company verifier users only.
            </p>
            <p className="mt-4 text-xs text-slate-400">Password must be 6 to 128 characters.</p>
            <div className="mb-5 mt-4 flex rounded-xl border border-slate-200 p-1">
              <Link
                to="/login/verifier"
                className="flex-1 rounded-lg bg-brand px-3 py-2 text-center text-xs font-semibold text-white"
              >
                Verifier Login
              </Link>
              <Link
                to="/register"
                className="flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold text-slate-500"
              >
                Verifier Register
              </Link>
            </div>
          </>
        ) : !dedicatedPortal ? (
          <div className="mb-5 flex flex-wrap gap-2">
            {allowedRoles.map((entry) => {
              const href = portalLoginUrl(entry);
              const cls = `rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                entry === activeRole ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500'
              }`;
              return href.startsWith('http') ? (
                <a key={entry} href={href} className={cls}>{getRoleLabel(entry)}</a>
              ) : (
                <Link key={entry} to={href} className={cls}>{getRoleLabel(entry)}</Link>
              );
            })}
          </div>
        ) : null}

        {!verifierMode && (
          <>
            <h1 className="text-center text-2xl font-bold text-navy">
              {roleLabel} Login
            </h1>
            <p className="mb-6 text-center text-sm text-slate-500">
              Sign in to access the {roleLabel.toLowerCase()} portal
            </p>
          </>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-brand w-full">
            {loading ? 'Logging in...' : verifierMode ? 'Login to Queue' : `Login as ${roleLabel}`}
          </button>
        </form>

        {verifierMode && !dedicatedPortal && (
          <p className="mt-4 text-center text-sm text-slate-500">
            <a href={portalLoginUrl('user')} className="font-semibold text-brand">
              Customer portal
            </a>
          </p>
        )}

        {activeRole === 'user' && (
          <p className="mt-4 text-center text-sm text-slate-500">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-semibold text-brand">Register here</Link>
          </p>
        )}
      </div>
    </div>
  );
}
