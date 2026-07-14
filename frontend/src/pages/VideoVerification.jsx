import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';
import LiveVideoPanel from '../components/LiveVideoPanel';
import StatusBadge from '../components/StatusBadge';

export default function VideoVerification() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    api.get(`/api/vehicles/${vehicleId}`)
      .then((res) => setVehicle(res.data.vehicle))
      .catch((err) => setError(err.response?.data?.error || 'Vehicle not found'));
  }, [vehicleId]);

  useEffect(() => {
    let timer;
    const poll = async () => {
      try {
        const res = await api.get(`/api/verification/vehicles/${vehicleId}/active-session`);
        setSession(res.data.session);
        setWaiting(!res.data.session);
      } catch {
        setWaiting(true);
      }
    };
    poll();
    timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [vehicleId]);

  if (error) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-red-600">{error}</div>;
  }

  if (!vehicle) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-slate-500">Loading video verification...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div>
        <Link to="/customer/dashboard" className="text-sm text-brand">← Back to Dashboard</Link>
        <h1 className="mt-2 text-3xl font-bold text-navy">Vehicle Video Verification</h1>
        <p className="text-sm text-slate-500">
          Stay on this page while a company verifier inspects your vehicle in real time.
        </p>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-navy">
              {vehicle.make} {vehicle.model} ({vehicle.year || '-'})
            </p>
            <p className="text-sm text-slate-500">
              Plate: {vehicle.license_plate || '-'} · Color: {vehicle.color || '-'}
            </p>
          </div>
          <StatusBadge status={vehicle.status} />
        </div>

        {waiting && (
          <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Waiting for verifier to join. Keep your camera ready and remain on this page.
          </div>
        )}

        <div className="mt-6">
          <LiveVideoPanel
            vehicleId={Number(vehicleId)}
            role="user"
            sessionId={session?.id}
            onSessionChange={setSession}
          />
        </div>

        {vehicle.status === 'verified' && (
          <div className="mt-6 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
            Verification completed successfully. You can continue to policy purchase.
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate('/customer/policy')}
            className="btn-brand"
            disabled={vehicle.status !== 'verified'}
          >
            Continue to Buy Policy
          </button>
          <button type="button" onClick={() => navigate('/customer/dashboard')} className="btn-outline">
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
