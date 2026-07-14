import { Link } from 'react-router-dom';

export default function Unauthorized() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center px-4">
      <div className="card w-full text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">Access Restricted</p>
        <h1 className="mt-3 text-3xl font-bold text-navy">Unauthorized</h1>
        <p className="mt-3 text-slate-500">
          Your account does not have permission to access this portal. Sign in with the correct
          role or return to the public home page.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn-outline px-5 py-3 text-sm">Go Home</Link>
          <Link to="/login/user" className="btn-brand px-5 py-3 text-sm">Role Login</Link>
        </div>
      </div>
    </div>
  );
}
