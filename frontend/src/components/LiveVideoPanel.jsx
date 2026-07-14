import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import useLiveVideoVerification from '../hooks/useLiveVideoVerification';

export default function LiveVideoPanel({
  vehicleId,
  role,
  sessionId: externalSessionId,
  onSessionChange,
  onSnapshotsChange,
}) {
  const [sessionId, setSessionId] = useState(externalSessionId || null);
  const [statusText, setStatusText] = useState('Not in call');
  const autoJoinedRef = useRef(false);
  const {
    localVideoRef,
    remoteVideoRef,
    callState,
    snapshots,
    recording,
    error,
    startCall,
    captureSnapshot,
    endCall,
  } = useLiveVideoVerification({
    sessionId,
    role,
    enabled: Boolean(sessionId),
  });

  useEffect(() => {
    if (externalSessionId) setSessionId(externalSessionId);
  }, [externalSessionId]);

  useEffect(() => {
    onSnapshotsChange?.(snapshots);
  }, [onSnapshotsChange, snapshots]);

  useEffect(() => {
    if (callState === 'idle') setStatusText('Not in call');
    if (callState === 'connecting') setStatusText('Connecting live video...');
    if (callState === 'in_call') setStatusText('Live call in progress');
    if (callState === 'ended') setStatusText('Call ended');
  }, [callState]);

  const ensureSession = async () => {
    if (sessionId) return sessionId;
    const res = await api.get(`/api/verification/vehicles/${vehicleId}/active-session`);
    if (res.data.session) {
      setSessionId(res.data.session.id);
      onSessionChange?.(res.data.session);
      return res.data.session.id;
    }
    return null;
  };

  useEffect(() => {
    if (role !== 'user' || !sessionId || autoJoinedRef.current) return;
    if (callState !== 'idle') return;
    autoJoinedRef.current = true;
    startCall(sessionId);
  }, [role, sessionId, callState, startCall]);

  const handleStart = async () => {
    let activeId = sessionId;
    if (!activeId && (role === 'verifier' || role === 'admin')) {
      const res = await api.post('/api/verification/sessions/start', { vehicle_id: vehicleId });
      activeId = res.data.session.id;
      setSessionId(activeId);
      onSessionChange?.(res.data.session);
    } else {
      activeId = await ensureSession();
    }
    if (!activeId) return;
    await startCall(activeId);
  };

  const handleSnapshot = async () => {
    await captureSnapshot();
  };

  const handleEnd = async () => {
    await endCall();
  };

  const userLabel = role === 'user' ? 'Your Camera' : 'User Camera';
  const verifierLabel = role === 'user' ? 'Verifier Camera' : 'Your Camera';

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-lg font-semibold text-navy">Live Video</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleStart}
          disabled={callState === 'in_call' || callState === 'connecting'}
          className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          Start Video Call
        </button>
        <button
          type="button"
          onClick={handleSnapshot}
          disabled={callState !== 'in_call' && callState !== 'connecting'}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50"
        >
          Capture Snapshot
        </button>
        <button
          type="button"
          onClick={handleEnd}
          disabled={callState === 'idle' || callState === 'ended'}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50"
        >
          End Call
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-xs text-slate-500">{userLabel}</p>
          <video
            ref={role === 'user' ? localVideoRef : remoteVideoRef}
            autoPlay
            muted={role === 'user'}
            playsInline
            className="h-36 w-full rounded-lg bg-black object-cover"
          />
        </div>
        <div>
          <p className="mb-1 text-xs text-slate-500">{verifierLabel}</p>
          <video
            ref={role === 'user' ? remoteVideoRef : localVideoRef}
            autoPlay
            muted={role !== 'user'}
            playsInline
            className="h-36 w-full rounded-lg bg-black object-cover"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span>{statusText}</span>
        <span>{recording ? 'Recording' : 'Not recording'}</span>
        {sessionId && <span>Session #{sessionId}</span>}
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-semibold text-navy">Captured Snapshots</h4>
        {snapshots.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No snapshots captured yet.</p>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {snapshots.map((item) => (
              <a key={item.id} href={item.file?.url} target="_blank" rel="noreferrer">
                <img
                  src={item.file?.url}
                  alt="snapshot"
                  className="h-20 w-full rounded-lg object-cover"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
