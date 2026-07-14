import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleHome } from '../utils/roles';

const roleItem = {
  admin: { label: 'Admin Portal', to: '/admin/dashboard' },
  agent: { label: 'Agent Portal', to: '/agent/dashboard' },
  verifier: { label: 'Verifier Portal', to: '/verifier/dashboard' },
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const items = [{ label: 'Home', to: '/', public: true }];
  if (user) {
    items.push({ label: 'My Portal', to: getRoleHome(user.role) });
    if (user.role === 'user') {
      items.push(
        { label: 'Register Car', to: '/customer/car-registration' },
        { label: 'My Policies', to: '/customer/policies' },
        { label: 'My Claims', to: '/customer/claims' },
      );
    }
  }
  if (user && roleItem[user.role]) items.push(roleItem[user.role]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="no-print sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-xl font-extrabold">
          <span className="text-navy">Claim</span>
          <span className="text-brand"> Nova</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                location.pathname === item.to
                  ? 'bg-brand/10 text-brand'
                  : 'text-slate-600 hover:bg-brand/5 hover:text-brand'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <span className="text-sm text-slate-500">{user.email}</span>
              <button onClick={handleLogout} className="btn-outline px-4 py-2 text-sm">
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login/user" className="btn-outline px-4 py-2 text-sm">Sign In</Link>
              <Link to="/register" className="btn-brand px-4 py-2 text-sm">Get Started</Link>
            </>
          )}
        </div>

        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="menu">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-brand/5"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-2 flex gap-2">
            {user ? (
              <button onClick={handleLogout} className="btn-outline w-full py-2 text-sm">Sign Out</button>
            ) : (
              <>
                <Link to="/login/user" className="btn-outline w-full py-2 text-sm">Sign In</Link>
                <Link to="/register" className="btn-brand w-full py-2 text-sm">Get Started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
