/**
 * AdminChatWindow.jsx
 * Private chat between admin and steph — draggable, resizable, minimizable.
 * Supports: text, emoji, GIFs, file uploads, voice messages, lead tags, alerts,
 *           delete messages, full-duplex WebRTC voice call, screen share.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#060c18';
const CHAT_USERS = ['admin', 'steph'];

const EMOJI_LIST = ['😀','😂','😍','🤔','👍','👎','🔥','💰','📞','✅','❌','⚡','🎯','💡','🚀','😎','🤝','💪','👀','🙏','😅','🤣','😊','🥳','😤','🤦','😴','💯','🎉','⚠️'];

async function searchGifs(query) {
  try {
    const res = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=AIzaSyAyimkuYQYF_FXVALexPzkcFUIlzPPkDPY&limit=12&media_filter=gif`);
    const data = await res.json();
    return (data.results || []).map(r => ({
      id: r.id,
      url: r.media_formats?.gif?.url || r.media_formats?.tinygif?.url || '',
      preview: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || '',
    })).filter(g => g.url);
  } catch { return []; }
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function fmtDay(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── WebRTC signalling via AdminChat entity with type='webrtc_signal' ──────────
// We store SDP/ICE as JSON in the content field with a special type.
// Both peers poll for new signals addressed to them.

export default function AdminChatWindow({ currentUsername, onOpenLeadCard, onOpenInvestorCard, onClose }) {
  const isAllowed = CHAT_USERS.includes(currentUsername);
  const otherUser = currentUsername === 'admin' ? 'steph' : 'admin';

  // Window state
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: window.innerWidth - 400, y: window.innerHeight - 520 });
  const [size, setSize] = useState({ w: 380, h: 480 });
  const dragging = useRef(false);
  const resizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const windowRef = useRef(null);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [tagResults, setTagResults] = useState([]);
  const [tagLoading, setTagLoading] = useState(false);
  const scrollRef = useRef(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  // ── Voice call state ──────────────────────────────────────────────────
  const [callState, setCallState] = useState('idle'); // idle | calling | incoming | active
  const [callMuted, setCallMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callDurationRef = useRef(null);
  const pcRef = useRef(null);            // RTCPeerConnection
  const localStreamRef = useRef(null);   // microphone stream
  const screenStreamRef = useRef(null);  // screen share stream
  const remoteAudioRef = useRef(null);   // <audio> element for remote audio
  const signalPollRef = useRef(null);
  const processedSignals = useRef(new Set());
  const pendingIceCandidates = useRef([]);

  // ── Screen share state ────────────────────────────────────────────────
  const [sharingScreen, setSharingScreen] = useState(false);
  const [remoteScreen, setRemoteScreen] = useState(null); // remote screen stream
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const screenTrackRef = useRef(null);  // the sender we added for screen track

  // Load messages
  const loadMessages = useCallback(async () => {
    try {
      const msgs = await base44.entities.AdminChat.list('-sentAt', 200);
      // Filter out WebRTC signalling messages from the chat display
      const chatMsgs = (msgs || []).filter(m => m.type !== 'webrtc_signal');
      setMessages(chatMsgs.reverse());
    } catch {}
  }, []);

  useEffect(() => {
    if (!isAllowed) return;
    loadMessages();
    pollRef.current = setInterval(loadMessages, 3000);
    return () => clearInterval(pollRef.current);
  }, [isAllowed, loadMessages]);

  useEffect(() => {
    if (scrollRef.current && !minimized) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, minimized]);

  // ── Drag ───────────────────────────────────────────────────────────────
  const onDragStart = (e) => {
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      setPos({ x: Math.max(0, e.clientX - dragOffset.current.x), y: Math.max(0, e.clientY - dragOffset.current.y) });
    };
    const onUp = () => { dragging.current = false; resizing.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // ── Resize ─────────────────────────────────────────────────────────────
  const onResizeStart = (e) => { e.stopPropagation(); resizing.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h }; };
  useEffect(() => {
    const onMove = (e) => {
      if (!resizing.current) return;
      setSize({ w: Math.max(300, resizing.current.w + (e.clientX - resizing.current.x)), h: Math.max(360, resizing.current.h + (e.clientY - resizing.current.y)) });
    };
    const onUp = () => { resizing.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // ── Message helpers ─────────────────────────────────────────────────────
  const sendMessage = async (overrideContent, overrideType, extra = {}) => {
    const content = overrideContent ?? input.trim();
    const type = overrideType ?? 'text';
    if (!content && type === 'text') return;
    setSending(true);
    try {
      await base44.entities.AdminChat.create({ sender: currentUsername, type, content: content || '', sentAt: new Date().toISOString(), ...extra });
      setInput('');
      setShowEmoji(false);
      setShowGif(false);
      await loadMessages();
    } catch (e) { console.error(e); }
    setSending(false);
  };

  const sendAlert = async () => {
    const content = input.trim();
    if (!content) { alert('Type a message first, then click 🚨 to send it as an alert.'); return; }
    setSending(true);
    try {
      await base44.entities.AdminChat.create({ sender: currentUsername, type: 'alert', content, isAlert: true, alertDismissedBy: '[]', sentAt: new Date().toISOString() });
      setInput('');
      await loadMessages();
    } catch {}
    setSending(false);
  };

  const deleteMessage = async (id) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await base44.entities.AdminChat.delete(id);
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch {}
  };

  const clearAllChat = async () => {
    if (!window.confirm('Delete all chat history? This cannot be undone.')) return;
    try {
      const msgs = await base44.entities.AdminChat.list('-sentAt', 500);
      await Promise.all((msgs || []).map(m => base44.entities.AdminChat.delete(m.id)));
      setMessages([]);
    } catch {}
  };

  // ── GIF ────────────────────────────────────────────────────────────────
  const handleGifSearch = async (q) => {
    setGifQuery(q);
    if (!q.trim()) { setGifs([]); return; }
    setGifLoading(true);
    const results = await searchGifs(q);
    setGifs(results);
    setGifLoading(false);
  };

  const sendGif = async (url) => {
    await sendMessage(url, 'gif', { fileUrl: url });
    setShowGif(false);
  };

  // ── File upload ────────────────────────────────────────────────────────
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await sendMessage(file.name, 'file', { fileUrl: file_url, fileName: file.name, fileType: file.type });
    } catch {}
    setUploading(false);
    e.target.value = '';
  };

  // ── Voice message recording ────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks.current = [];
      mediaRecorder.current = new MediaRecorder(stream);
      mediaRecorder.current.ondataavailable = e => audioChunks.current.push(e.data);
      mediaRecorder.current.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        setUploading(true);
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          await sendMessage('🎙 Voice message', 'voice', { fileUrl: file_url, fileName: file.name, fileType: 'audio/webm' });
        } catch {}
        setUploading(false);
      };
      mediaRecorder.current.start();
      setRecording(true);
    } catch {}
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setRecording(false);
  };

  // ── Tag lead/investor ──────────────────────────────────────────────────
  const handleTagSearch = async (q) => {
    setTagSearch(q);
    if (!q.trim()) { setTagResults([]); return; }
    setTagLoading(true);
    try {
      const [leads, investors] = await Promise.all([
        base44.entities.Lead.list('-created_date', 50),
        base44.entities.InvestorUser.list('-created_date', 50),
      ]);
      const lq = q.toLowerCase();
      const matchedLeads = (leads || []).filter(l => `${l.firstName} ${l.lastName}`.toLowerCase().includes(lq)).slice(0, 5).map(l => ({ id: l.id, name: `${l.firstName} ${l.lastName}`, type: 'lead' }));
      const matchedInvestors = (investors || []).filter(u => (u.name || '').toLowerCase().includes(lq)).slice(0, 5).map(u => ({ id: u.id, name: u.name, type: 'investor' }));
      setTagResults([...matchedLeads, ...matchedInvestors]);
    } catch {}
    setTagLoading(false);
  };

  const sendTaggedMessage = async (contact) => {
    const content = `@${contact.name}`;
    await sendMessage(content, 'text', { taggedLeadId: contact.id, taggedLeadName: contact.name, taggedLeadType: contact.type });
    setShowTagMenu(false);
    setTagSearch('');
    setTagResults([]);
  };

  const handleTaggedClick = (msg) => {
    if (!msg.taggedLeadId) return;
    if (msg.taggedLeadType === 'lead') onOpenLeadCard?.(msg.taggedLeadId);
    else onOpenInvestorCard?.(msg.taggedLeadId);
  };

  // ══════════════════════════════════════════════════════════════════════
  // WebRTC Voice Call (full-duplex)
  // Signalling channel: AdminChat entity with type='webrtc_signal'
  // Signal format: { to, from, kind, payload }
  // ══════════════════════════════════════════════════════════════════════

  const sendSignal = async (kind, payload) => {
    try {
      await base44.entities.AdminChat.create({
        sender: currentUsername,
        type: 'webrtc_signal',
        content: JSON.stringify({ to: otherUser, from: currentUsername, kind, payload }),
        sentAt: new Date().toISOString(),
      });
    } catch {}
  };

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal('ice', e.candidate.toJSON());
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (!stream) return;
      // Check if it's audio or video
      if (e.track.kind === 'audio' && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
      if (e.track.kind === 'video') {
        setRemoteScreen(stream);
      }
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        endCall(true);
      }
    };

    return pc;
  };

  const startCallTimer = () => {
    setCallDuration(0);
    callDurationRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  };

  const stopCallTimer = () => {
    clearInterval(callDurationRef.current);
    setCallDuration(0);
  };

  const getMicStream = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    return stream;
  };

  const startCall = async () => {
    try {
      setCallState('calling');
      const pc = createPeerConnection();
      pcRef.current = pc;

      const stream = await getMicStream();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal('offer', offer);
    } catch (err) {
      console.error('startCall error:', err);
      setCallState('idle');
    }
  };

  const answerCall = async (offerPayload) => {
    try {
      setCallState('active');
      const pc = createPeerConnection();
      pcRef.current = pc;

      const stream = await getMicStream();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offerPayload));

      // Apply any buffered ICE candidates
      for (const c of pendingIceCandidates.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
      pendingIceCandidates.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal('answer', answer);
      startCallTimer();
    } catch (err) {
      console.error('answerCall error:', err);
      setCallState('idle');
    }
  };

  const endCall = async (silent = false) => {
    stopCallTimer();
    if (!silent) await sendSignal('hangup', {});
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(t => t.stop()); screenStreamRef.current = null; }
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setSharingScreen(false);
    setRemoteScreen(null);
    setCallMuted(false);
    setCallState('idle');
    clearInterval(signalPollRef.current);
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setCallMuted(m => !m);
  };

  // ── Screen share ──────────────────────────────────────────────────────
  const startScreenShare = async () => {
    if (!pcRef.current) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = screenStream;
      const track = screenStream.getVideoTracks()[0];

      // Add the screen track to the peer connection
      const sender = pcRef.current.addTrack(track, screenStream);
      screenTrackRef.current = sender;

      // Show local preview
      if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;

      // Stop sharing when the user stops via browser UI
      track.onended = () => stopScreenShare();

      setSharingScreen(true);
    } catch (err) {
      console.error('Screen share error:', err);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(t => t.stop()); screenStreamRef.current = null; }
    if (screenTrackRef.current && pcRef.current) {
      pcRef.current.removeTrack(screenTrackRef.current);
      screenTrackRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setSharingScreen(false);
  };

  // ── Signal polling ─────────────────────────────────────────────────────
  const pollSignals = useCallback(async () => {
    try {
      const msgs = await base44.entities.AdminChat.list('-sentAt', 30);
      const signals = (msgs || []).filter(m =>
        m.type === 'webrtc_signal' && !processedSignals.current.has(m.id)
      );
      for (const sig of signals.reverse()) {
        processedSignals.current.add(sig.id);
        let parsed;
        try { parsed = JSON.parse(sig.content); } catch { continue; }
        if (parsed.to !== currentUsername) continue;

        const { kind, payload } = parsed;

        if (kind === 'offer' && callState === 'idle') {
          setCallState('incoming');
          // Stash offer for when user clicks Answer
          window._pendingOffer = payload;
        } else if (kind === 'answer' && pcRef.current && callState !== 'active') {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload));
          for (const c of pendingIceCandidates.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          }
          pendingIceCandidates.current = [];
          setCallState('active');
          startCallTimer();
        } else if (kind === 'ice' && pcRef.current) {
          if (pcRef.current.remoteDescription) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(payload)).catch(() => {});
          } else {
            pendingIceCandidates.current.push(payload);
          }
        } else if (kind === 'hangup') {
          endCall(true);
        }
      }
    } catch {}
  }, [currentUsername, callState]);

  useEffect(() => {
    if (!isAllowed) return;
    const id = setInterval(pollSignals, 2000);
    signalPollRef.current = id;
    return () => clearInterval(id);
  }, [isAllowed, pollSignals]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall(true);
      clearInterval(pollRef.current);
      clearInterval(signalPollRef.current);
    };
  }, []);

  const fmtDuration = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  if (!isAllowed) return null;

  // Group messages by day
  const grouped = [];
  let lastDay = null;
  messages.forEach(msg => {
    const day = fmtDay(msg.sentAt);
    if (day !== lastDay) { grouped.push({ type: 'day', label: day }); lastDay = day; }
    grouped.push({ type: 'msg', msg });
  });

  const callStateColor = { idle:'#4a5568', calling:'#f59e0b', incoming:'#4ade80', active:'#4ade80' }[callState] || '#4a5568';

  return (
    <div ref={windowRef} style={{ position:'fixed', left:pos.x, top:pos.y, width:minimized?220:size.w, height:minimized?40:size.h, zIndex:8000, background:'#0a1525', border:`1px solid rgba(184,147,58,0.4)`, borderRadius:'8px', boxShadow:'0 24px 80px rgba(0,0,0,0.8)', display:'flex', flexDirection:'column', overflow:'hidden', userSelect:'none', minWidth:minimized?0:300 }}>

      {/* Hidden remote audio player */}
      <audio ref={remoteAudioRef} autoPlay style={{ display:'none' }} />

      {/* ── Header ── */}
      <div onMouseDown={onDragStart} style={{ background:'linear-gradient(90deg,#0d1b2a,#121c2e)', borderBottom:minimized?'none':'1px solid rgba(184,147,58,0.2)', padding:'0 10px', height:'40px', display:'flex', alignItems:'center', gap:'8px', cursor:'grab', flexShrink:0 }}>
        <div style={{ width:7, height:7, borderRadius:'50%', background: callState==='active'?'#4ade80':'#4a5568', boxShadow: callState==='active'?'0 0 5px #4ade80':'none', transition:'all 0.3s' }} />
        <span style={{ color:GOLD, fontSize:'11px', letterSpacing:'1px', fontFamily:'Georgia,serif', flex:1 }}>
          💬 {currentUsername} ↔ {otherUser}
          {callState === 'active' && <span style={{ color:'#4ade80', marginLeft:'8px', fontSize:'10px' }}>📞 {fmtDuration(callDuration)}</span>}
          {callState === 'calling' && <span style={{ color:'#f59e0b', marginLeft:'8px', fontSize:'10px' }}>📞 Calling…</span>}
          {callState === 'incoming' && <span style={{ color:'#4ade80', marginLeft:'8px', fontSize:'10px', animation:'callPulse 0.8s ease-in-out infinite' }}>📲 Incoming!</span>}
        </span>
        <button onClick={() => setMinimized(v => !v)} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'14px', padding:'0 4px', lineHeight:1 }}>{minimized?'▲':'▼'}</button>
        <button onClick={clearAllChat} title="Clear all chat" style={{ background:'none', border:'none', color:'#4a5568', cursor:'pointer', fontSize:'11px', padding:'0 4px' }}>🗑</button>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7280', cursor:'pointer', fontSize:'16px', padding:'0 4px', lineHeight:1 }}>×</button>
      </div>

      {!minimized && (
        <>
          {/* ── Incoming Call Banner ── */}
          {callState === 'incoming' && (
            <div style={{ background:'rgba(74,222,128,0.08)', borderBottom:'1px solid rgba(74,222,128,0.3)', padding:'10px 14px', flexShrink:0, display:'flex', alignItems:'center', gap:'8px' }}>
              <div style={{ flex:1, color:'#4ade80', fontSize:'12px', fontWeight:'bold' }}>📲 {otherUser} is calling…</div>
              <button onClick={() => answerCall(window._pendingOffer)} style={{ background:'linear-gradient(135deg,#22c55e,#16a34a)', color:'#fff', border:'none', borderRadius:'4px', padding:'5px 12px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>Answer</button>
              <button onClick={() => { sendSignal('hangup', {}); setCallState('idle'); }} style={{ background:'rgba(239,68,68,0.15)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'4px', padding:'5px 12px', cursor:'pointer', fontSize:'11px' }}>Decline</button>
            </div>
          )}

          {/* ── Active Call Controls ── */}
          {callState === 'active' && (
            <div style={{ background:'rgba(74,222,128,0.05)', borderBottom:'1px solid rgba(74,222,128,0.2)', padding:'8px 12px', flexShrink:0, display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
              <span style={{ color:'#4ade80', fontSize:'11px', fontWeight:'bold' }}>📞 {fmtDuration(callDuration)}</span>
              <button onClick={toggleMute} style={{ background:callMuted?'rgba(239,68,68,0.15)':'rgba(255,255,255,0.06)', color:callMuted?'#ef4444':'#8a9ab8', border:`1px solid ${callMuted?'rgba(239,68,68,0.3)':'rgba(255,255,255,0.12)'}`, borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'10px' }}>
                {callMuted ? '🔇 Unmute' : '🎙 Mute'}
              </button>
              {!sharingScreen ? (
                <button onClick={startScreenShare} style={{ background:'rgba(96,165,250,0.1)', color:'#60a5fa', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'10px' }}>
                  🖥 Share Screen
                </button>
              ) : (
                <button onClick={stopScreenShare} style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'10px' }}>
                  ⏹ Stop Share
                </button>
              )}
              <button onClick={() => endCall(false)} style={{ background:'rgba(239,68,68,0.15)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'4px', padding:'4px 12px', cursor:'pointer', fontSize:'10px', fontWeight:'bold', marginLeft:'auto' }}>
                📵 Hang Up
              </button>
            </div>
          )}

          {/* ── Screen Share Preview ── */}
          {(sharingScreen || remoteScreen) && (
            <div style={{ background:'#000', flexShrink:0, position:'relative', maxHeight:'160px', overflow:'hidden' }}>
              {remoteScreen && (
                <video ref={remoteVideoRef} autoPlay playsInline style={{ width:'100%', maxHeight:'160px', objectFit:'contain', display:'block' }}
                  ref={el => { if (el && remoteScreen) el.srcObject = remoteScreen; }} />
              )}
              {sharingScreen && (
                <video autoPlay playsInline muted style={{ position:remoteScreen?'absolute':'static', bottom:0, right:0, width:remoteScreen?'80px':'100%', maxHeight:remoteScreen?'60px':'160px', objectFit:'contain', border:remoteScreen?'1px solid rgba(255,255,255,0.2)':undefined }}
                  ref={el => { if (el && screenStreamRef.current) el.srcObject = screenStreamRef.current; }} />
              )}
              <div style={{ position:'absolute', top:'4px', left:'6px', background:'rgba(0,0,0,0.6)', borderRadius:'3px', padding:'2px 6px', fontSize:'9px', color:'#60a5fa' }}>
                {remoteScreen ? `${otherUser}'s screen` : 'Your screen'}{sharingScreen && remoteScreen ? ' · yours (pip)' : ''}
              </div>
            </div>
          )}

          {/* ── Messages ── */}
          <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:'2px' }}>
            {grouped.map((item, i) => {
              if (item.type === 'day') return (
                <div key={`d-${i}`} style={{ textAlign:'center', color:'#4a5568', fontSize:'10px', margin:'8px 0 4px', letterSpacing:'1px' }}>{item.label}</div>
              );
              const msg = item.msg;
              const isMe = msg.sender === currentUsername;
              return (
                <div key={msg.id} className="chat-msg-row" style={{ display:'flex', justifyContent:isMe?'flex-end':'flex-start', marginBottom:'3px', position:'relative' }}>
                  <div style={{ maxWidth:'80%', position:'relative' }}>
                    {!isMe && <div style={{ color:'#4a5568', fontSize:'9px', marginBottom:'2px', paddingLeft:'2px' }}>{msg.sender}</div>}
                    <div style={{ padding:msg.type==='gif'?'4px':'7px 10px', borderRadius:isMe?'12px 12px 3px 12px':'12px 12px 12px 3px', background:msg.isAlert?'rgba(239,68,68,0.15)':isMe?'rgba(184,147,58,0.2)':'rgba(255,255,255,0.06)', border:msg.isAlert?'1px solid rgba(239,68,68,0.4)':`1px solid ${isMe?'rgba(184,147,58,0.3)':'rgba(255,255,255,0.08)'}`, fontSize:'13px', color:'#e8e0d0', lineHeight:1.5, wordBreak:'break-word' }}>
                      {msg.isAlert && <div style={{ color:'#ef4444', fontSize:'10px', fontWeight:'bold', marginBottom:'3px', letterSpacing:'1px' }}>🚨 ALERT</div>}
                      {msg.type === 'text' && msg.taggedLeadId ? (
                        <span onClick={() => handleTaggedClick(msg)} style={{ color:'#60a5fa', cursor:'pointer', textDecoration:'underline', fontWeight:'bold' }}>
                          @{msg.taggedLeadName}<span style={{ color:'#4a5568', fontSize:'10px', marginLeft:'4px' }}>({msg.taggedLeadType})</span>
                        </span>
                      ) : msg.type === 'text' ? <span>{msg.content}</span>
                        : msg.type === 'gif' ? <img src={msg.fileUrl||msg.content} alt="gif" style={{ maxWidth:'200px', borderRadius:'6px', display:'block' }} />
                        : msg.type === 'voice' ? <audio controls src={msg.fileUrl} style={{ maxWidth:'200px', height:'32px' }} />
                        : msg.type === 'file' ? (
                          <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color:'#60a5fa', textDecoration:'none', display:'flex', alignItems:'center', gap:'5px' }}>📎 {msg.fileName||msg.content}</a>
                        ) : <span>{msg.content}</span>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', justifyContent:isMe?'flex-end':'flex-start', marginTop:'2px' }}>
                      <span style={{ color:'#2d3748', fontSize:'9px' }}>{fmtTime(msg.sentAt)}</span>
                      {/* Delete — always visible, small */}
                      <button onClick={() => deleteMessage(msg.id)} title="Delete" className="delete-btn"
                        style={{ background:'none', border:'none', color:'#4a5568', cursor:'pointer', fontSize:'10px', padding:'0 2px', lineHeight:1, opacity:0, transition:'opacity 0.15s' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Emoji picker ── */}
          {showEmoji && (
            <div style={{ padding:'8px', borderTop:'1px solid rgba(255,255,255,0.07)', background:'rgba(0,0,0,0.3)', display:'flex', flexWrap:'wrap', gap:'4px', maxHeight:'100px', overflowY:'auto', flexShrink:0 }}>
              {EMOJI_LIST.map(e => (
                <button key={e} onClick={() => setInput(p => p + e)} style={{ background:'none', border:'none', fontSize:'18px', cursor:'pointer', padding:'2px', lineHeight:1 }}>{e}</button>
              ))}
            </div>
          )}

          {/* ── GIF picker ── */}
          {showGif && (
            <div style={{ padding:'8px', borderTop:'1px solid rgba(255,255,255,0.07)', background:'rgba(0,0,0,0.3)', flexShrink:0 }}>
              <input value={gifQuery} onChange={e => handleGifSearch(e.target.value)} placeholder="Search GIFs…"
                style={{ width:'100%', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'5px 8px', color:'#e8e0d0', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
              {gifLoading && <div style={{ color:'#6b7280', fontSize:'11px', textAlign:'center', padding:'6px' }}>Searching…</div>}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'4px', marginTop:'6px', maxHeight:'120px', overflowY:'auto' }}>
                {gifs.map(g => <img key={g.id} src={g.preview} alt="gif" onClick={() => sendGif(g.url)} style={{ width:'100%', aspectRatio:'4/3', objectFit:'cover', borderRadius:'4px', cursor:'pointer', border:'1px solid rgba(255,255,255,0.08)' }} />)}
              </div>
            </div>
          )}

          {/* ── Tag menu ── */}
          {showTagMenu && (
            <div style={{ padding:'8px', borderTop:'1px solid rgba(255,255,255,0.07)', background:'rgba(0,0,0,0.3)', flexShrink:0 }}>
              <input value={tagSearch} onChange={e => handleTagSearch(e.target.value)} placeholder="Search leads or investors…" autoFocus
                style={{ width:'100%', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'4px', padding:'5px 8px', color:'#e8e0d0', fontSize:'12px', outline:'none', boxSizing:'border-box' }} />
              {tagLoading && <div style={{ color:'#6b7280', fontSize:'11px', padding:'5px' }}>Searching…</div>}
              {tagResults.map(c => (
                <div key={c.id} onClick={() => sendTaggedMessage(c)}
                  style={{ padding:'6px 8px', cursor:'pointer', color:'#e8e0d0', fontSize:'12px', borderRadius:'3px', display:'flex', alignItems:'center', gap:'6px' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}>
                  <span style={{ fontSize:'10px', color:c.type==='lead'?'#60a5fa':'#a78bfa' }}>{c.type==='lead'?'🏷 Lead':'💼 Investor'}</span>{c.name}
                </div>
              ))}
            </div>
          )}

          {/* ── Input bar ── */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', padding:'8px 10px', display:'flex', gap:'5px', alignItems:'flex-end', flexShrink:0 }}>
            <div style={{ display:'flex', gap:'3px', alignItems:'center' }}>
              <button onClick={() => { setShowEmoji(v=>!v); setShowGif(false); setShowTagMenu(false); }} title="Emoji"
                style={{ background:showEmoji?'rgba(184,147,58,0.2)':'none', border:'none', cursor:'pointer', fontSize:'16px', padding:'3px', borderRadius:'4px', lineHeight:1 }}>😊</button>
              <button onClick={() => { setShowGif(v=>!v); setShowEmoji(false); setShowTagMenu(false); setGifQuery(''); setGifs([]); }} title="GIF"
                style={{ background:showGif?'rgba(184,147,58,0.2)':'none', border:'none', cursor:'pointer', fontSize:'10px', padding:'3px 5px', borderRadius:'4px', color:'#60a5fa', fontWeight:'bold' }}>GIF</button>
              <button onClick={() => fileInputRef.current?.click()} title="Attach file" disabled={uploading}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:'14px', padding:'3px', color:'#8a9ab8' }}>{uploading?'⏳':'📎'}</button>
              <button onMouseDown={startRecording} onMouseUp={stopRecording} title="Hold to record voice"
                style={{ background:recording?'rgba(239,68,68,0.2)':'none', border:'none', cursor:'pointer', fontSize:'14px', padding:'3px', borderRadius:'4px', color:recording?'#ef4444':'#8a9ab8' }}>🎙</button>
              <button onClick={() => { setShowTagMenu(v=>!v); setShowEmoji(false); setShowGif(false); }} title="Tag a lead"
                style={{ background:showTagMenu?'rgba(96,165,250,0.15)':'none', border:'none', cursor:'pointer', fontSize:'14px', padding:'3px', color:'#60a5fa' }}>@</button>

              {/* ── Voice Call button ── */}
              {callState === 'idle' && (
                <button onClick={startCall} title="Start voice call"
                  style={{ background:'rgba(74,222,128,0.1)', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'4px', cursor:'pointer', fontSize:'13px', padding:'3px 6px', color:'#4ade80' }}>📞</button>
              )}
              {callState === 'calling' && (
                <button onClick={() => endCall(false)} title="Cancel call"
                  style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'4px', cursor:'pointer', fontSize:'10px', padding:'3px 7px', color:'#ef4444', fontWeight:'bold' }}>📵</button>
              )}
              {callState === 'active' && !sharingScreen && (
                <button onClick={startScreenShare} title="Share screen"
                  style={{ background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.3)', borderRadius:'4px', cursor:'pointer', fontSize:'13px', padding:'3px 6px', color:'#60a5fa' }}>🖥</button>
              )}
            </div>

            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Message…"
              style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'6px', padding:'7px 10px', color:'#e8e0d0', fontSize:'13px', outline:'none', fontFamily:'Georgia,serif' }} />

            <button onClick={() => sendMessage()} disabled={sending||!input.trim()}
              style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'6px', padding:'7px 12px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', opacity:(!input.trim()||sending)?0.4:1, flexShrink:0 }}>▶</button>

            {/* ── Notify / Alert button ── */}
            <button onClick={sendAlert} disabled={sending} title={input.trim() ? 'Send as alert popup' : 'Type a message first'}
              style={{ background:input.trim()?'rgba(239,68,68,0.15)':'rgba(255,255,255,0.04)', color:input.trim()?'#ef4444':'#4a5568', border:`1px solid ${input.trim()?'rgba(239,68,68,0.3)':'rgba(255,255,255,0.1)'}`, borderRadius:'6px', padding:'7px 10px', cursor:'pointer', fontSize:'11px', fontWeight:'bold', flexShrink:0, transition:'all 0.2s' }}>
              🚨
            </button>
          </div>

          {/* Resize handle */}
          <div onMouseDown={onResizeStart} style={{ position:'absolute', bottom:0, right:0, width:'14px', height:'14px', cursor:'se-resize', background:'rgba(184,147,58,0.3)', borderTopLeftRadius:'4px' }} />
        </>
      )}

      <input ref={fileInputRef} type="file" onChange={handleFile} style={{ display:'none' }} />

      <style>{`
        .chat-msg-row:hover .delete-btn { opacity: 1 !important; }
        @keyframes callPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}