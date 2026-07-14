import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { goToPortalLogin } from '../utils/portals';

const portalNav = {
  user: [
    { label: 'Dashboard', to: '/customer/dashboard' },
    { label: 'Register Vehicle', to: '/customer/car-registration' },
    { label: 'Buy Policy', to: '/customer/policy' },
    { label: 'Payments', to: '/customer/payment' },
    { label: 'My Policies', to: '/customer/policies' },
    { label: 'Submit Claim', to: '/customer/claim' },
    { label: 'Claim Tracking', to: '/customer/claims' },
  ],
  agent: [
    { label: 'Dashboard', to: '/agent/dashboard' },
    { label: 'Providers', to: '/agent/providers' },
    { label: 'Pricing', to: '/agent/pricing' },
    { label: 'Add-ons', to: '/agent/addons' },
  ],
  verifier: [
    { label: 'Dashboard', to: '/verifier/dashboard' },
    { label: 'Queue', to: '/verifier/queue' },
    { label: 'Verification Desk', to: '/verifier/verify' },
    { label: 'Verification History', to: '/verifier/history' },
  ],
  admin: [
    { label: 'Dashboard', to: '/admin/dashboard' },
    { label: 'Users', to: '/admin/users' },
    { label: 'Cars', to: '/admin/cars' },
    { label: 'Policies', to: '/admin/policies' },
    { label: 'Claims', to: '/admin/claims' },
    { label: 'Payments', to: '/admin/payments' },
    { label: 'Audit Logs', to: '/admin/audit-logs' },
    { label: 'Vehicle Master', to: '/admin/vehicle-master' },
    { label: 'Repair Cost Master', to: '/admin/repair-master' },
    { label: 'Catalog Editor', to: '/admin/catalog' },
  ],
};

export default function PortalLayout({ role, title, subtitle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const items = portalNav[role] || [];

  const handleLogout = async () => {
    await logout();
    goToPortalLogin(role === 'user' ? 'user' : role, navigate);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-slate-200 bg-navy px-5 py-6 text-white">
          <Link to="/" className="block text-2xl font-extrabold">
            <span>Claim</span>
            <span className="text-brand"> Nova</span>
          </Link>
          <p className="mt-2 text-sm text-white/70">{title}</p>

          <nav className="mt-8 space-y-2">
            {items.map((item) => {
              const active = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`block rounded-xl px-4 py-3 text-sm font-medium transition ${
                    active ? 'bg-brand text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-navy">{title}</h1>
                <p className="text-sm text-slate-500">{subtitle}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-navy">{user?.full_name}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{user?.role}</p>
                </div>
                <button onClick={handleLogout} className="btn-outline px-4 py-2 text-sm">
                  Logout
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
