/**
 * AdminChatWindow.jsx
 * Discord-style private chat between admin and steph.
 * Features: text, emoji, GIFs, file uploads, voice messages, lead tags,
 *           alerts, delete messages, full-duplex WebRTC voice call, screen share,
 *           mic/speaker selection, incoming call popup.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import IncomingCallPopupChat from './IncomingCallPopupChat';

const GOLD = '#b8933a';
const CHAT_USERS = ['admin', 'steph'];

const EMOJI_LIST = ['😀','😂','😍','🤔','👍','👎','🔥','💰','📞','✅','❌','⚡','🎯','💡','🚀','😎','🤝','💪','👀','🙏','😅','🤣','😊','🥳','😤','🤦','😴','💯','🎉','⚠️'];

const AVATARS = {
  admin: { bg: '#7c3aed', letter: 'A' },
  steph: { bg: '#0891b2', letter: 'S' },
};

async function searchGifs(query) {
  try {
    const res = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=AIzaSyAyimkuYQYF_FXVALexPzkcFUIlzPPkDPY&limit=12&media_filter=gif`);
    const data = await res.json();
    return (data.results || []).map(r => ({
      id: r.id,
      url: r.media_formats?.gif?.url || '',
      preview: r.media_formats?.tinygif?.url || r.media_formats?.gif?.url || '',
    })).filter(g => g.url);
  } catch { return []; }
}

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function fmtDay(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
function fmtDur(s) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }

function Avatar({ username, size = 32 }) {
  const av = AVATARS[username] || { bg: '#4a5568', letter: (username||'?')[0].toUpperCase() };
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: av.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.44, color: '#fff', fontWeight: 'bold', flexShrink: 0 }}>
      {av.letter}
    </div>
  );
}

export default function AdminChatWindow({ currentUsername, onOpenLeadCard, onOpenInvestorCard, onClose }) {
  const isAllowed = CHAT_USERS.includes(currentUsername);
  const otherUser = currentUsername === 'admin' ? 'steph' : 'admin';

  // Window state
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: Math.max(0, window.innerWidth - 480), y: Math.max(0, window.innerHeight - 620) });
  const [size, setSize] = useState({ w: 460, h: 580 });
  const dragging = useRef(false);
  const resizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

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
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const scrollRef = useRef(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const pollRef = useRef(null);

  // Voice call state
  const [callState, setCallState] = useState('idle'); // idle | calling | incoming | active
  const [callMuted, setCallMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [incomingCallFrom, setIncomingCallFrom] = useState('');
  const callDurationRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const signalPollRef = useRef(null);
  const processedSignals = useRef(new Set());
  const pendingIce = useRef([]);

  // Screen share
  const [sharingScreen, setSharingScreen] = useState(false);
  const [remoteScreen, setRemoteScreen] = useState(null);
  const screenTrackRef = useRef(null);

  // Audio devices
  const [micDevices, setMicDevices] = useState([]);
  const [speakerDevices, setSpeakerDevices] = useState([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [showAudioSettings, setShowAudioSettings] = useState(false);

  // Load audio devices
  useEffect(() => {
    const load = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        setMicDevices(devices.filter(d => d.kind === 'audioinput'));
        setSpeakerDevices(devices.filter(d => d.kind === 'audiooutput'));
      } catch {}
    };
    load();
  }, []);

  // Apply speaker to remote audio
  useEffect(() => {
    if (remoteAudioRef.current && selectedSpeaker && remoteAudioRef.current.setSinkId) {
      remoteAudioRef.current.setSinkId(selectedSpeaker).catch(() => {});
    }
  }, [selectedSpeaker]);

  // Load messages
  const loadMessages = useCallback(async () => {
    try {
      const msgs = await base44.entities.AdminChat.list('-sentAt', 200);
      setMessages((msgs || []).filter(m => m.type !== 'webrtc_signal').reverse());
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

  // Drag
  const onDragStart = (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };
  useEffect(() => {
    const onMove = (e) => {
      if (dragging.current) setPos({ x: Math.max(0, e.clientX - dragOffset.current.x), y: Math.max(0, e.clientY - dragOffset.current.y) });
      if (resizing.current) setSize({ w: Math.max(360, resizing.current.w + (e.clientX - resizing.current.mx)), h: Math.max(400, resizing.current.h + (e.clientY - resizing.current.my)) });
    };
    const onUp = () => { dragging.current = false; resizing.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);
  const onResizeStart = (e) => { e.stopPropagation(); resizing.current = { mx: e.clientX, my: e.clientY, w: size.w, h: size.h }; };

  // Send message
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
      setShowTagMenu(false);
      await loadMessages();
    } catch {}
    setSending(false);
  };

  const sendAlert = async () => {
    const content = input.trim();
    if (!content) { alert('Type a message first, then click Notify to send it as an alert popup.'); return; }
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
    if (!window.confirm('Delete ALL chat history? This cannot be undone.')) return;
    try {
      const msgs = await base44.entities.AdminChat.list('-sentAt', 500);
      await Promise.all((msgs || []).map(m => base44.entities.AdminChat.delete(m.id)));
      setMessages([]);
    } catch {}
  };

  // GIF
  const handleGifSearch = async (q) => {
    setGifQuery(q);
    if (!q.trim()) { setGifs([]); return; }
    setGifLoading(true);
    setGifs(await searchGifs(q));
    setGifLoading(false);
  };

  // File upload
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

  // Voice message
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: selectedMic ? { deviceId: { exact: selectedMic } } : true });
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
  const stopRecording = () => { mediaRecorder.current?.stop(); setRecording(false); };

  // Tag
  const handleTagSearch = async (q) => {
    setTagSearch(q);
    if (!q.trim()) { setTagResults([]); return; }
    setTagLoading(true);
    try {
      const [leads, investors] = await Promise.all([base44.entities.Lead.list('-created_date', 50), base44.entities.InvestorUser.list('-created_date', 50)]);
      const lq = q.toLowerCase();
      setTagResults([
        ...(leads||[]).filter(l=>`${l.firstName} ${l.lastName}`.toLowerCase().includes(lq)).slice(0,4).map(l=>({id:l.id,name:`${l.firstName} ${l.lastName}`,type:'lead'})),
        ...(investors||[]).filter(u=>(u.name||'').toLowerCase().includes(lq)).slice(0,4).map(u=>({id:u.id,name:u.name,type:'investor'})),
      ]);
    } catch {}
    setTagLoading(false);
  };
  const sendTaggedMessage = async (c) => {
    await sendMessage(`@${c.name}`, 'text', { taggedLeadId: c.id, taggedLeadName: c.name, taggedLeadType: c.type });
    setShowTagMenu(false); setTagSearch(''); setTagResults([]);
  };

  // ── WebRTC ────────────────────────────────────────────────────────────
  const sendSignal = async (kind, payload) => {
    try {
      await base44.entities.AdminChat.create({ sender: currentUsername, type: 'webrtc_signal', content: JSON.stringify({ to: otherUser, from: currentUsername, kind, payload }), sentAt: new Date().toISOString() });
    } catch {}
  };

  const createPC = () => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] });
    pc.onicecandidate = e => { if (e.candidate) sendSignal('ice', e.candidate.toJSON()); };
    pc.ontrack = e => {
      const stream = e.streams[0];
      if (!stream) return;
      if (e.track.kind === 'audio' && remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
      if (e.track.kind === 'video') setRemoteScreen(stream);
    };
    pc.onconnectionstatechange = () => { if (['disconnected','failed','closed'].includes(pc.connectionState)) endCall(true); };
    return pc;
  };

  const getMic = async () => {
    if (localStreamRef.current) return localStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: selectedMic ? { deviceId: { exact: selectedMic } } : true });
    localStreamRef.current = stream;
    return stream;
  };

  const startCall = async () => {
    try {
      setCallState('calling');
      const pc = createPC(); pcRef.current = pc;
      const stream = await getMic();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal('offer', offer);
    } catch { setCallState('idle'); }
  };

  const answerCall = async (offerPayload) => {
    try {
      setCallState('active');
      const pc = createPC(); pcRef.current = pc;
      const stream = await getMic();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(offerPayload));
      for (const c of pendingIce.current) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(()=>{});
      pendingIce.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal('answer', answer);
      setCallDuration(0);
      callDurationRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    } catch { setCallState('idle'); }
  };

  const endCall = async (silent = false) => {
    clearInterval(callDurationRef.current);
    if (!silent) await sendSignal('hangup', {});
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(t => t.stop()); screenStreamRef.current = null; }
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setSharingScreen(false); setRemoteScreen(null); setCallMuted(false); setCallDuration(0); setCallState('idle');
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setCallMuted(m => !m);
  };

  const startScreenShare = async () => {
    if (!pcRef.current) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = screenStream;
      const track = screenStream.getVideoTracks()[0];
      screenTrackRef.current = pcRef.current.addTrack(track, screenStream);
      setSharingScreen(true);
      track.onended = stopScreenShare;
    } catch {}
  };
  const stopScreenShare = () => {
    if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(t => t.stop()); screenStreamRef.current = null; }
    if (screenTrackRef.current && pcRef.current) { pcRef.current.removeTrack(screenTrackRef.current); screenTrackRef.current = null; }
    setSharingScreen(false);
  };

  // Signal polling
  const pollSignals = useCallback(async () => {
    try {
      const msgs = await base44.entities.AdminChat.list('-sentAt', 30);
      const signals = (msgs || []).filter(m => m.type === 'webrtc_signal' && !processedSignals.current.has(m.id));
      for (const sig of signals.reverse()) {
        processedSignals.current.add(sig.id);
        let parsed; try { parsed = JSON.parse(sig.content); } catch { continue; }
        if (parsed.to !== currentUsername) continue;
        const { kind, payload, from } = parsed;
        if (kind === 'offer' && callState === 'idle') {
          setIncomingCallFrom(from || otherUser);
          setCallState('incoming');
          window._pendingOffer = payload;
        } else if (kind === 'answer' && pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload));
          for (const c of pendingIce.current) await pcRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(()=>{});
          pendingIce.current = [];
          setCallState('active');
          setCallDuration(0);
          callDurationRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
        } else if (kind === 'ice' && pcRef.current) {
          if (pcRef.current.remoteDescription) await pcRef.current.addIceCandidate(new RTCIceCandidate(payload)).catch(()=>{});
          else pendingIce.current.push(payload);
        } else if (kind === 'hangup') {
          endCall(true);
        }
      }
    } catch {}
  }, [currentUsername, callState, otherUser]);

  useEffect(() => {
    if (!isAllowed) return;
    signalPollRef.current = setInterval(pollSignals, 2000);
    return () => clearInterval(signalPollRef.current);
  }, [isAllowed, pollSignals]);

  useEffect(() => () => { endCall(true); clearInterval(pollRef.current); clearInterval(signalPollRef.current); }, []);

  if (!isAllowed) return null;

  // Group messages by day
  const grouped = [];
  let lastDay = null;
  let lastSender = null;
  messages.forEach((msg, idx) => {
    const day = fmtDay(msg.sentAt);
    if (day !== lastDay) { grouped.push({ type: 'day', label: day }); lastDay = day; lastSender = null; }
    const isFirst = msg.sender !== lastSender;
    grouped.push({ type: 'msg', msg, isFirst });
    lastSender = msg.sender;
  });

  const inputStyle = { flex:1, background:'transparent', border:'none', outline:'none', color:'#dcddde', fontSize:'14px', fontFamily:'sans-serif', padding:'0', resize:'none', lineHeight:'1.4' };

  return (
    <>
      {/* ── Incoming Call Popup ── */}
      {callState === 'incoming' && (
        <IncomingCallPopupChat
          from={incomingCallFrom}
          onAnswer={() => answerCall(window._pendingOffer)}
          onDecline={() => { sendSignal('hangup', {}); setCallState('idle'); }}
        />
      )}

      <audio ref={remoteAudioRef} autoPlay style={{ display:'none' }} />

      <div style={{ position:'fixed', left:pos.x, top:pos.y, width:minimized?240:size.w, height:minimized?44:size.h, zIndex:8000, background:'#313338', border:'1px solid rgba(0,0,0,0.5)', borderRadius:'8px', boxShadow:'0 8px 32px rgba(0,0,0,0.6)', display:'flex', flexDirection:'column', overflow:'hidden', userSelect:'none' }}>

        {/* ── Title bar ── */}
        <div onMouseDown={onDragStart} style={{ height:'44px', background:'#2b2d31', borderBottom:minimized?'none':'1px solid rgba(0,0,0,0.3)', display:'flex', alignItems:'center', padding:'0 12px', gap:'10px', cursor:'grab', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'6px', flex:1, minWidth:0 }}>
            <span style={{ color:'#80848e', fontSize:'15px' }}>@</span>
            <span style={{ color:'#f2f3f5', fontSize:'14px', fontWeight:'600', fontFamily:'sans-serif' }}>{otherUser}</span>
            {callState === 'active' && (
              <span style={{ background:'rgba(87,242,135,0.15)', color:'#57f287', border:'1px solid rgba(87,242,135,0.3)', borderRadius:'10px', padding:'1px 8px', fontSize:'10px', fontWeight:'600', marginLeft:'4px' }}>
                📞 {fmtDur(callDuration)}
              </span>
            )}
            {callState === 'calling' && (
              <span style={{ background:'rgba(250,168,26,0.15)', color:'#faa81a', border:'1px solid rgba(250,168,26,0.3)', borderRadius:'10px', padding:'1px 8px', fontSize:'10px', fontWeight:'600', marginLeft:'4px' }}>
                📞 Calling…
              </span>
            )}
          </div>
          <div style={{ display:'flex', gap:'2px', alignItems:'center' }}>
            {callState === 'idle' && (
              <TitleBtn title="Voice Call" onClick={startCall}>📞</TitleBtn>
            )}
            {callState === 'calling' && (
              <TitleBtn title="Cancel Call" onClick={() => endCall(false)} red>📵</TitleBtn>
            )}
            {callState === 'active' && (
              <>
                <TitleBtn title={callMuted ? 'Unmute' : 'Mute'} onClick={toggleMute} active={callMuted}>
                  {callMuted ? '🔇' : '🎙'}
                </TitleBtn>
                <TitleBtn title={sharingScreen ? 'Stop Screen Share' : 'Share Screen'} onClick={sharingScreen ? stopScreenShare : startScreenShare} active={sharingScreen}>
                  🖥
                </TitleBtn>
                <TitleBtn title="Hang Up" onClick={() => endCall(false)} red>📵</TitleBtn>
              </>
            )}
            <TitleBtn title="Audio Settings" onClick={() => setShowAudioSettings(v => !v)} active={showAudioSettings}>⚙️</TitleBtn>
            <TitleBtn title={minimized ? 'Expand' : 'Minimize'} onClick={() => setMinimized(v => !v)}>{minimized ? '▲' : '▼'}</TitleBtn>
            <TitleBtn title="Clear All History" onClick={clearAllChat}>🗑</TitleBtn>
            <TitleBtn title="Close" onClick={onClose}>✕</TitleBtn>
          </div>
        </div>

        {!minimized && (
          <>
            {/* ── Audio Settings Dropdown ── */}
            {showAudioSettings && (
              <div style={{ background:'#2b2d31', borderBottom:'1px solid rgba(0,0,0,0.3)', padding:'12px 14px', flexShrink:0 }}>
                <div style={{ color:'#b5bac1', fontSize:'10px', fontWeight:'700', letterSpacing:'1px', textTransform:'uppercase', marginBottom:'8px' }}>Audio Settings</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                  <div>
                    <label style={{ color:'#80848e', fontSize:'10px', display:'block', marginBottom:'4px' }}>🎙 Microphone</label>
                    <select value={selectedMic} onChange={e => setSelectedMic(e.target.value)}
                      style={{ width:'100%', background:'#1e1f22', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'5px 8px', color:'#dcddde', fontSize:'11px', outline:'none', cursor:'pointer' }}>
                      <option value="">Default Mic</option>
                      {micDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,6)}`}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ color:'#80848e', fontSize:'10px', display:'block', marginBottom:'4px' }}>🔊 Speaker</label>
                    <select value={selectedSpeaker} onChange={e => setSelectedSpeaker(e.target.value)}
                      style={{ width:'100%', background:'#1e1f22', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'5px 8px', color:'#dcddde', fontSize:'11px', outline:'none', cursor:'pointer' }}>
                      <option value="">Default Speaker</option>
                      {speakerDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0,6)}`}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ── Screen share preview ── */}
            {(sharingScreen || remoteScreen) && (
              <div style={{ background:'#000', flexShrink:0, maxHeight:'140px', overflow:'hidden', position:'relative' }}>
                {remoteScreen && (
                  <video autoPlay playsInline style={{ width:'100%', maxHeight:'140px', objectFit:'contain', display:'block' }}
                    ref={el => { if (el && remoteScreen) el.srcObject = remoteScreen; }} />
                )}
                {sharingScreen && screenStreamRef.current && (
                  <video autoPlay playsInline muted style={{ position:remoteScreen?'absolute':'static', bottom:0, right:0, width:remoteScreen?'80px':'100%', maxHeight:remoteScreen?'56px':'140px', objectFit:'contain', border:remoteScreen?'1px solid #5865f2':undefined }}
                    ref={el => { if (el && screenStreamRef.current) el.srcObject = screenStreamRef.current; }} />
                )}
                <div style={{ position:'absolute', top:'4px', left:'6px', background:'rgba(0,0,0,0.7)', borderRadius:'3px', padding:'2px 7px', fontSize:'10px', color:'#b5bac1' }}>
                  {remoteScreen ? `${otherUser}'s screen` : 'Your screen (sharing)'}
                </div>
              </div>
            )}

            {/* ── Messages ── */}
            <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:'16px 0 8px', display:'flex', flexDirection:'column', scrollbarWidth:'thin', scrollbarColor:'#1e1f22 transparent' }}>
              {grouped.map((item, i) => {
                if (item.type === 'day') return (
                  <div key={`d-${i}`} style={{ display:'flex', alignItems:'center', padding:'0 16px', margin:'16px 0 8px' }}>
                    <div style={{ flex:1, height:'1px', background:'rgba(255,255,255,0.07)' }} />
                    <span style={{ color:'#80848e', fontSize:'11px', fontWeight:'600', margin:'0 10px', whiteSpace:'nowrap' }}>{item.label}</span>
                    <div style={{ flex:1, height:'1px', background:'rgba(255,255,255,0.07)' }} />
                  </div>
                );
                const { msg, isFirst } = item;
                const isMe = msg.sender === currentUsername;
                const hovered = hoveredMsgId === msg.id;
                return (
                  <div key={msg.id}
                    onMouseEnter={() => setHoveredMsgId(msg.id)}
                    onMouseLeave={() => setHoveredMsgId(null)}
                    style={{ display:'flex', padding:isFirst?'8px 16px 2px':'2px 16px', gap:'14px', alignItems:'flex-start', position:'relative', background:hovered?'rgba(0,0,0,0.15)':'transparent', transition:'background 0.1s' }}>

                    {/* Avatar or spacer */}
                    <div style={{ width:36, flexShrink:0, paddingTop:isFirst?'2px':'0' }}>
                      {isFirst ? <Avatar username={msg.sender} size={36} /> : null}
                    </div>

                    <div style={{ flex:1, minWidth:0 }}>
                      {isFirst && (
                        <div style={{ display:'flex', alignItems:'baseline', gap:'8px', marginBottom:'2px' }}>
                          <span style={{ color:'#f2f3f5', fontSize:'14px', fontWeight:'600', fontFamily:'sans-serif' }}>{msg.sender}</span>
                          <span style={{ color:'#80848e', fontSize:'11px' }}>{fmtTime(msg.sentAt)}</span>
                          {msg.isAlert && <span style={{ background:'rgba(237,66,69,0.2)', color:'#ed4245', border:'1px solid rgba(237,66,69,0.4)', borderRadius:'4px', padding:'0px 6px', fontSize:'10px', fontWeight:'700', letterSpacing:'0.5px' }}>ALERT</span>}
                        </div>
                      )}

                      {/* Message content */}
                      {msg.type === 'text' && msg.taggedLeadId ? (
                        <span onClick={() => { if (msg.taggedLeadType==='lead') onOpenLeadCard?.(msg.taggedLeadId); else onOpenInvestorCard?.(msg.taggedLeadId); }}
                          style={{ color:'#5865f2', cursor:'pointer', fontWeight:'600', fontSize:'14px', fontFamily:'sans-serif' }}>
                          @{msg.taggedLeadName}
                          <span style={{ color:'#80848e', fontSize:'11px', marginLeft:'4px', fontWeight:'normal' }}>({msg.taggedLeadType})</span>
                        </span>
                      ) : msg.type === 'text' || msg.type === 'alert' ? (
                        <span style={{ color:'#dcddde', fontSize:'14px', fontFamily:'sans-serif', lineHeight:'1.5', wordBreak:'break-word' }}>{msg.content}</span>
                      ) : msg.type === 'gif' ? (
                        <img src={msg.fileUrl||msg.content} alt="gif" style={{ maxWidth:'240px', maxHeight:'160px', borderRadius:'4px', display:'block', marginTop:'4px' }} />
                      ) : msg.type === 'voice' ? (
                        <audio controls src={msg.fileUrl} style={{ maxWidth:'240px', height:'32px', marginTop:'4px' }} />
                      ) : msg.type === 'file' ? (
                        <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                          style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'#2b2d31', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'6px 12px', color:'#00a8fc', textDecoration:'none', fontSize:'13px', marginTop:'4px' }}>
                          📎 {msg.fileName || msg.content}
                        </a>
                      ) : <span style={{ color:'#dcddde', fontSize:'14px' }}>{msg.content}</span>}
                    </div>

                    {/* Hover actions */}
                    {hovered && (
                      <div style={{ position:'absolute', top:'-12px', right:'16px', background:'#2b2d31', border:'1px solid rgba(0,0,0,0.4)', borderRadius:'6px', display:'flex', gap:'2px', padding:'3px', boxShadow:'0 4px 12px rgba(0,0,0,0.4)', zIndex:10 }}>
                        <HoverBtn title="Delete" onClick={() => deleteMessage(msg.id)}>🗑</HoverBtn>
                      </div>
                    )}
                  </div>
                );
              })}
              {messages.length === 0 && (
                <div style={{ textAlign:'center', padding:'40px 20px', color:'#80848e', fontFamily:'sans-serif' }}>
                  <div style={{ fontSize:'48px', marginBottom:'12px' }}>💬</div>
                  <div style={{ fontSize:'20px', color:'#f2f3f5', fontWeight:'700', marginBottom:'4px' }}>Start your conversation</div>
                  <div style={{ fontSize:'13px' }}>This is the beginning of your direct message history with {otherUser}.</div>
                </div>
              )}
            </div>

            {/* ── Emoji / GIF picker ── */}
            {showEmoji && (
              <div style={{ padding:'10px 12px', borderTop:'1px solid rgba(0,0,0,0.3)', background:'#2b2d31', display:'flex', flexWrap:'wrap', gap:'4px', maxHeight:'90px', overflowY:'auto', flexShrink:0 }}>
                {EMOJI_LIST.map(e => (
                  <button key={e} onClick={() => { setInput(p => p + e); inputRef.current?.focus(); }}
                    style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', padding:'3px', borderRadius:'4px', lineHeight:1, transition:'background 0.1s' }}
                    onMouseEnter={e2 => e2.currentTarget.style.background='rgba(255,255,255,0.08)'}
                    onMouseLeave={e2 => e2.currentTarget.style.background='none'}>
                    {e}
                  </button>
                ))}
              </div>
            )}
            {showGif && (
              <div style={{ padding:'10px 12px', borderTop:'1px solid rgba(0,0,0,0.3)', background:'#2b2d31', flexShrink:0 }}>
                <input value={gifQuery} onChange={e => handleGifSearch(e.target.value)} placeholder="Search GIFs…" autoFocus
                  style={{ width:'100%', background:'#1e1f22', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'6px 10px', color:'#dcddde', fontSize:'13px', outline:'none', boxSizing:'border-box', fontFamily:'sans-serif' }} />
                {gifLoading && <div style={{ color:'#80848e', fontSize:'12px', textAlign:'center', padding:'6px' }}>Searching…</div>}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'4px', marginTop:'6px', maxHeight:'110px', overflowY:'auto' }}>
                  {gifs.map(g => <img key={g.id} src={g.preview} alt="gif" onClick={async () => { await sendMessage(g.url, 'gif', { fileUrl: g.url }); setShowGif(false); }}
                    style={{ width:'100%', aspectRatio:'4/3', objectFit:'cover', borderRadius:'4px', cursor:'pointer', border:'1px solid rgba(255,255,255,0.06)' }} />)}
                </div>
              </div>
            )}
            {showTagMenu && (
              <div style={{ padding:'10px 12px', borderTop:'1px solid rgba(0,0,0,0.3)', background:'#2b2d31', flexShrink:0 }}>
                <input value={tagSearch} onChange={e => handleTagSearch(e.target.value)} placeholder="Search leads or investors…" autoFocus
                  style={{ width:'100%', background:'#1e1f22', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'4px', padding:'6px 10px', color:'#dcddde', fontSize:'13px', outline:'none', boxSizing:'border-box', fontFamily:'sans-serif' }} />
                {tagLoading && <div style={{ color:'#80848e', fontSize:'12px', padding:'5px' }}>Searching…</div>}
                {tagResults.map(c => (
                  <div key={c.id} onClick={() => sendTaggedMessage(c)}
                    style={{ padding:'7px 10px', cursor:'pointer', color:'#dcddde', fontSize:'13px', borderRadius:'4px', display:'flex', alignItems:'center', gap:'8px', fontFamily:'sans-serif' }}
                    onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background='none'}>
                    <span style={{ fontSize:'11px', color:c.type==='lead'?'#5865f2':'#57f287' }}>{c.type==='lead'?'🏷':'💼'}</span>
                    {c.name}
                    <span style={{ color:'#80848e', fontSize:'10px', marginLeft:'auto' }}>{c.type}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Input area ── */}
            <div style={{ padding:'0 16px 16px', flexShrink:0 }}>
              <div style={{ background:'#383a40', borderRadius:'8px', padding:'10px 14px', display:'flex', flexDirection:'column', gap:'8px' }}>
                <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={`Message @${otherUser}`}
                  style={inputStyle} />
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', gap:'2px' }}>
                    <ToolBtn active={showEmoji} onClick={() => { setShowEmoji(v=>!v); setShowGif(false); setShowTagMenu(false); }} title="Emoji">😊 Emoji</ToolBtn>
                    <ToolBtn active={showGif} onClick={() => { setShowGif(v=>!v); setShowEmoji(false); setShowTagMenu(false); setGifQuery(''); setGifs([]); }} title="Send a GIF">GIF</ToolBtn>
                    <ToolBtn onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Attach File">📎 File</ToolBtn>
                    <ToolBtn active={recording} onMouseDown={startRecording} onMouseUp={stopRecording} title="Hold to record voice message">
                      {recording ? '⏺ Recording…' : '🎙 Voice'}
                    </ToolBtn>
                    <ToolBtn active={showTagMenu} onClick={() => { setShowTagMenu(v=>!v); setShowEmoji(false); setShowGif(false); }} title="Tag a lead or investor">@ Tag</ToolBtn>
                  </div>
                  <div style={{ display:'flex', gap:'4px' }}>
                    <button onClick={sendAlert} title="Send as alert popup to the other user"
                      style={{ background:input.trim()?'rgba(237,66,69,0.15)':'rgba(255,255,255,0.05)', color:input.trim()?'#ed4245':'#80848e', border:`1px solid ${input.trim()?'rgba(237,66,69,0.4)':'rgba(255,255,255,0.1)'}`, borderRadius:'5px', padding:'4px 10px', cursor:'pointer', fontSize:'11px', fontWeight:'700', transition:'all 0.15s', whiteSpace:'nowrap' }}>
                      🚨 Notify
                    </button>
                    <button onClick={() => sendMessage()} disabled={sending || !input.trim()}
                      style={{ background:input.trim()?'#5865f2':'rgba(255,255,255,0.06)', color:input.trim()?'#fff':'#80848e', border:'none', borderRadius:'5px', padding:'4px 14px', cursor:input.trim()?'pointer':'default', fontSize:'12px', fontWeight:'700', transition:'all 0.15s', whiteSpace:'nowrap' }}>
                      Send ▶
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Resize handle */}
            <div onMouseDown={onResizeStart} style={{ position:'absolute', bottom:0, right:0, width:'14px', height:'14px', cursor:'se-resize' }}>
              <svg viewBox="0 0 10 10" style={{ width:'10px', height:'10px', position:'absolute', bottom:'3px', right:'3px' }}>
                <path d="M2 9L9 2M5 9L9 5M8 9L9 8" stroke="#4e5058" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </>
        )}
      </div>

      <input ref={fileInputRef} type="file" onChange={handleFile} style={{ display:'none' }} />
    </>
  );
}

function TitleBtn({ onClick, onMouseDown, onMouseUp, title, children, active, red }) {
  return (
    <button onClick={onClick} onMouseDown={onMouseDown} onMouseUp={onMouseUp} title={title}
      style={{ background:active?'rgba(255,255,255,0.12)':red?'rgba(237,66,69,0.15)':'none', color:red?'#ed4245':active?'#f2f3f5':'#80848e', border:'none', borderRadius:'4px', padding:'4px 7px', cursor:'pointer', fontSize:'14px', lineHeight:1, transition:'all 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background=red?'rgba(237,66,69,0.25)':'rgba(255,255,255,0.08)'}
      onMouseLeave={e => e.currentTarget.style.background=active?'rgba(255,255,255,0.12)':red?'rgba(237,66,69,0.15)':'none'}>
      {children}
    </button>
  );
}

function ToolBtn({ onClick, onMouseDown, onMouseUp, title, children, active, disabled }) {
  return (
    <button onClick={onClick} onMouseDown={onMouseDown} onMouseUp={onMouseUp} title={title} disabled={disabled}
      style={{ background:active?'rgba(255,255,255,0.12)':'none', color:active?'#f2f3f5':'#80848e', border:'none', borderRadius:'4px', padding:'3px 7px', cursor:disabled?'not-allowed':'pointer', fontSize:'11px', fontWeight:'600', fontFamily:'sans-serif', transition:'all 0.15s', whiteSpace:'nowrap', opacity:disabled?0.5:1 }}
      onMouseEnter={e => { if(!disabled) e.currentTarget.style.background='rgba(255,255,255,0.08)'; e.currentTarget.style.color='#dcddde'; }}
      onMouseLeave={e => { e.currentTarget.style.background=active?'rgba(255,255,255,0.12)':'none'; e.currentTarget.style.color=active?'#f2f3f5':'#80848e'; }}>
      {children}
    </button>
  );
}

function HoverBtn({ onClick, title, children }) {
  return (
    <button onClick={onClick} title={title}
      style={{ background:'none', border:'none', color:'#80848e', cursor:'pointer', fontSize:'13px', padding:'3px 6px', borderRadius:'4px', lineHeight:1 }}
      onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#ed4245'; }}
      onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='#80848e'; }}>
      {children}
    </button>
  );
}