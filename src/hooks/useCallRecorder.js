/**
 * useCallRecorder — records the live call audio (agent + customer mixed) to a
 * private file via MediaRecorder + UploadPrivateFile.
 *
 * Usage:
 *   const rec = useCallRecorder();
 *   rec.start(agentStream, customerStream);   // begin recording
 *   const uri = await rec.stop();               // stop → uploads, returns file_uri
 *
 * The returned file_uri can be saved to DebtCallTranscript.recordingUrl.
 */
import { useRef, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useCallRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState(null);
  const [recordingError, setRecordingError] = useState('');
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recCtxRef = useRef(null);
  const recStreamRef = useRef(null);
  const startTimeRef = useRef(null);

  const start = useCallback((agentStream, customerStream) => {
    if (!agentStream) { setRecordingError('No audio stream available to record.'); return; }
    if (recorderRef.current) return; // already recording
    setRecordingError('');
    chunksRef.current = [];
    try {
      // Separate recording context at standard rate for quality
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      recCtxRef.current = ctx;
      const destination = ctx.createMediaStreamDestination();
      const agentSrc = ctx.createMediaStreamSource(agentStream);
      agentSrc.connect(destination);
      if (customerStream) {
        const customerSrc = ctx.createMediaStreamSource(customerStream);
        customerSrc.connect(destination);
      }
      recStreamRef.current = destination.stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(recStreamRef.current, { mimeType });
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(1000); // gather chunks every 1s for resilience
      startTimeRef.current = Date.now();
      setIsRecording(true);
    } catch (e) {
      setRecordingError('Failed to start recording: ' + (e?.message || String(e)));
    }
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setIsRecording(false);
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      recorder.onstop = async () => {
        let uri = null;
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          chunksRef.current = [];
          if (blob.size > 0) {
            const file = new File([blob], `call-recording-${Date.now()}.webm`, { type: 'audio/webm' });
            const res = await base44.integrations.Core.UploadPrivateFile({ file });
            uri = res?.file_uri || null;
            if (uri) setRecordingUri(uri);
          }
        } catch (e) {
          setRecordingError('Recording upload failed: ' + (e?.message || String(e)));
        } finally {
          if (recCtxRef.current) { try { recCtxRef.current.close(); } catch {} recCtxRef.current = null; }
          recorderRef.current = null;
          recStreamRef.current = null;
          setIsRecording(false);
        }
        resolve(uri);
      };
      try { recorder.stop(); } catch { resolve(null); }
    });
  }, []);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') { try { recorder.stop(); } catch {} }
    if (recCtxRef.current) { try { recCtxRef.current.close(); } catch {} recCtxRef.current = null; }
    recorderRef.current = null;
    recStreamRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
  }, []);

  return { isRecording, recordingUri, recordingError, start, stop, cancel };
}