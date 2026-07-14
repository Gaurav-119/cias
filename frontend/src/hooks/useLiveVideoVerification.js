import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/client';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export default function useLiveVideoVerification({ sessionId, role, enabled }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pollRef = useRef(null);
  const signalCursorRef = useRef(0);
  const sessionIdRef = useRef(sessionId);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const [callState, setCallState] = useState('idle');
  const [snapshots, setSnapshots] = useState([]);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');

  const postSignal = useCallback(async (type, payload, sid = sessionIdRef.current) => {
    if (!sid) return;
    await api.post(`/api/verification/sessions/${sid}/signals`, { type, payload });
  }, []);

  const cleanupPeer = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const ensurePeerConnection = useCallback(async () => {
    if (pcRef.current) return pcRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setCallState('in_call');
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        postSignal('ice', event.candidate);
      }
    };
    pcRef.current = pc;
    return pc;
  }, [postSignal]);

  const processSignal = useCallback(async (message) => {
    if (!message || message.from_role === role) return;

    const pc = pcRef.current || (await ensurePeerConnection());

    if (message.type === 'offer' && role === 'user') {
      await pc.setRemoteDescription(message.payload);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await postSignal('answer', answer);
      setCallState('connecting');
    }

    if (message.type === 'answer' && role !== 'user') {
      await pc.setRemoteDescription(message.payload);
      setCallState('in_call');
    }

    if (message.type === 'ice' && message.payload) {
      try {
        await pc.addIceCandidate(message.payload);
      } catch {
        /* ignore stale ICE */
      }
    }

    if (message.type === 'leave') {
      setCallState('ended');
    }
  }, [ensurePeerConnection, postSignal, role]);

  const pollSignals = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      const res = await api.get(
        `/api/verification/sessions/${sid}/signals?after=${signalCursorRef.current}`,
      );
      const messages = res.data.messages || [];
      for (const message of messages) {
        signalCursorRef.current = Math.max(signalCursorRef.current, message.id);
        await processSignal(message);
      }
    } catch {
      /* polling errors are non-fatal */
    }
  }, [processSignal]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      pollSignals();
    }, 1000);
    pollSignals();
  }, [pollSignals]);

  const startCall = useCallback(async (activeSessionId) => {
    const sid = activeSessionId || sessionIdRef.current;
    if (!sid) {
      setError('No active verification session.');
      return;
    }
    sessionIdRef.current = sid;
    setError('');
    try {
      const pc = await ensurePeerConnection();
      startPolling();

      if (role === 'verifier' || role === 'admin') {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await postSignal('offer', offer, sid);
      }

      if (localStreamRef.current) {
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';
        const recorder = new MediaRecorder(localStreamRef.current, { mimeType });
        chunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.start(1000);
        recorderRef.current = recorder;
        setRecording(true);
      }
      setCallState('connecting');
    } catch (err) {
      setError(err.message || 'Unable to start camera/microphone.');
      cleanupPeer();
      setCallState('idle');
    }
  }, [cleanupPeer, ensurePeerConnection, postSignal, role, startPolling]);

  const captureSnapshot = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid || !localVideoRef.current) return null;
    const video = localVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    const fd = new FormData();
    fd.append('file', blob, `snapshot-${Date.now()}.jpg`);
    const res = await api.post(`/api/verification/sessions/${sid}/snapshot`, fd);
    const media = res.data.media;
    setSnapshots((prev) => [...prev, media]);
    return media;
  }, []);

  const endCall = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        await new Promise((resolve) => {
          recorderRef.current.onstop = resolve;
          recorderRef.current.stop();
        });
      }
      if (chunksRef.current.length > 0) {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const fd = new FormData();
        fd.append('file', blob, `recording-${Date.now()}.webm`);
        await api.post(`/api/verification/sessions/${sid}/recording`, fd);
      }
      await api.post(`/api/verification/sessions/${sid}/end`);
      await postSignal('leave', {}, sid);
    } finally {
      cleanupPeer();
      setRecording(false);
      setCallState('ended');
    }
  }, [cleanupPeer, postSignal]);

  useEffect(() => {
    if (!enabled || !sessionId) return undefined;
    api.get(`/api/verification/sessions/${sessionId}`)
      .then((res) => {
        const snaps = (res.data.session?.media || []).filter((m) => m.kind === 'snapshot');
        if (snaps.length) setSnapshots((prev) => (prev.length ? prev : snaps));
      })
      .catch(() => {});
    startPolling();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [enabled, sessionId, startPolling]);

  useEffect(() => () => cleanupPeer(), [cleanupPeer]);

  return {
    localVideoRef,
    remoteVideoRef,
    callState,
    snapshots,
    recording,
    error,
    startCall,
    captureSnapshot,
    endCall,
  };
}
