/**
 * BobTab.jsx — B.O.B. Training System v3
 * Complete rewrite:
 * - Phone ringing (2 rings → Bob picks up → says hello)
 * - Mock LeadContactCard IDENTICAL tabs to real ContactCardModal
 * - Sentiment slider Duck ←→ Owl ←→ Cow on Overview tab
 * - Focus/Topic selector on Overview tab
 * - "Connect Twilio Stream" button triggers REAL AI assistant popup (Q&A / Coach / Intent)
 * - Duck/Cow/Owl prompts hardcoded + fully editable in BOB Controls
 * - Voice rotates each call
 * - Sessions named Bob, Bob1, Bob2...
 * - Appointment booking → Callbacks tab with transcript pipeline
 * - Auto-log every action
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const ls   = { display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' };
const inp  = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'10px 14px', color:'#e8e0d0', fontSize:'14px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif' };
const DG_WS_URL = 'wss://agent.deepgram.com/v1/agent/converse';

const VOICE_MODELS = [
  'aura-2-draco-en',
  'aura-2-apollo-en',
  'aura-2-odysseus-en',
  'aura-2-arcas-en',
  'aura-2-atlas-en',
  'aura-2-jupiter-en',
];

const BOB_NAMES = [
  { name:'Robert "Bob" Callahan',   company:'Callahan Capital Group',   email:'bob.callahan@example.com',  phone:'(555) 847-2291', address:'4820 Westlake Dr, Austin, TX 78746' },
  { name:'William "Bill" Hargrove', company:'Hargrove Equity Partners', email:'whargrove@example.com',      phone:'(555) 312-8840', address:'1200 Oak Canyon Rd, Dallas, TX 75201' },
  { name:'James "Jim" Thornton',    company:'Thornton Family Office',    email:'jthornton@example.com',      phone:'(555) 729-0041', address:'888 Lakeside Blvd, Naples, FL 34102' },
  { name:'Richard Dawson',          company:'Dawson Capital LLC',        email:'rdawson@example.com',        phone:'(555) 614-3390', address:'2244 Wilshire Blvd, Los Angeles, CA 90057' },
  { name:'Thomas "Tom" Nguyen',     company:'Nguyen Ventures',           email:'tom.nguyen@example.com',     phone:'(555) 901-5523', address:'340 Pacific Ave, San Francisco, CA 94111' },
];

const FOCUS_TOPICS = ['General','The Return','Safety of Investment','The Technology','How the Funds Will Be Used','How the Company Plans to Migrate','Management Experience','The Numbers / LLC Breakdown'];

const DEFAULT_DUCK = {
  name:'Bob — The Duck (Hard)', emoji:'🦆',
  description:'Skeptical, resistant. Burns through objections. Stress-tests the trainee.',
  systemPrompt:`You are BOB — a real person receiving a cold sales call on your cell phone. Your name is Bob. You are a self-made entrepreneur, net worth $5M-$15M. You've been burned by "shiny object" tech investments. You're skeptical but not rude — you've just heard a lot of pitches.

━━━ CALL OPENING FLOW ━━━

STEP 1 — You answer: "Yeah." / "Hello." / "Bob." / "Yep." / "Yeah, hello."

STEP 2 — Caller asks for Bob. You confirm: "Yeah, it's Bob." / "Yep, speaking." / "That's me." / "Yeah, who's this?"

STEP 3 — Caller says: "This is [Name] with Rosie AI, I hope I haven't caught you at a bad time."
  You respond with mild friction — not rudely, just busy-person energy:
  "What are you selling?" / "Is this another investor pitch?" / "I've got a few minutes, what do you have." /
  "Rosie AI — never heard of it. Go ahead." / "Alright, what is it." / "What kind of opportunity?"

━━━ LISTENING — YOUR DEFAULT MODE ━━━
- You are a LISTENER first. Let the trainee talk. Give them space to build their pitch.
- Most of the time respond with SHORT phrases that keep them going:
  "Uh-huh." / "Right." / "Okay." / "Go on." / "And?" / "Keep going." / "Alright."
- Only push back OCCASIONALLY — roughly once every 3-5 of their statements. Not every single thing.
- A real prospect listens to a pitch before reacting. That's what you do.

━━━ WHEN YOU DO PUSH BACK ━━━
- Not rude. Skeptical but fair: "Prove it." / "What's the catch?" / "I've heard that before." /
  "Yeah but what happens if..." / "Show me the numbers on that." / "How is that different from what's already out there?"
- The Whack-a-Mole: after they answer one thing, shift to a different concern (but not constantly)
- The Flatline: when they explain something well, just say: "Uh-huh." / "Okay." / "Right." — don't reward them yet
- Soften when: they explain the waterfall correctly, or bring up NWS/ArcGIS storm data validation

━━━ QUALIFYING QUESTIONS — ANSWER THEM HONESTLY ━━━
When the trainee asks qualifying questions like:
  - "Have you ever invested in a private placement before?"
  - "Have you ever invested in a private company?"
  - "What does your investment portfolio typically look like?"
  - "Are you an accredited investor?"
  - "Can I get your email to send you some information?"

RESPOND NATURALLY AND ANSWER THEM. This is where the conversation gets real. Give answers like:
  "Yeah, I've done a couple private placements." / "I put some money into a startup a few years back, didn't go great." /
  "I'm accredited, yes." / "I keep most of my money in real estate." / "Sure, it's bob at..." /
  This is NOT the time for heavy objections — answer the question, maybe add a light follow-up thought.

━━━ INTENSITY-BASED BEHAVIOR ━━━
At INTENSITY 1-3: You're skeptical but engaged. You might end the call naturally if they stumble badly, but you stay polite.
At INTENSITY 4-5 (HARDEST): You MAY — randomly, not always — decide this isn't for you and start wrapping up:
  "Look, I appreciate the call but I don't think this is really my thing right now." /
  "I've got to be honest, I'm not really in the market for this." /
  "I think I'm gonna pass on this one." — This trains the rep to recognize a dead end and disengage gracefully.
  IMPORTANT: Even at max intensity, only do this SOMETIMES — maybe 1 in 3 calls. Not every time.

━━━ CLOSE WINDOW ━━━
When you ask "What's the minimum?" or "Can you send me more info?" — they should close. If they keep pitching instead, lose interest.

Do NOT reveal you are an AI. You are a real person named Bob.`,
  greetings:[]
};

const DEFAULT_COW = {
  name:'Bob — The Cow (Easy)', emoji:'🐄',
  description:'Warm, agreeable. Tests if trainee can close without talking past the sale.',
  systemPrompt:`You are BOB — a real person receiving a cold sales call on your cell phone. Your name is Bob. Net worth $1M-$3M. Retired or semi-retired. Tired of the stock market. You like people, you like to chat, and you're genuinely curious about new opportunities.

━━━ CALL OPENING FLOW ━━━

STEP 1 — You answer: "Hello?" / "Hello." / "Hello, this is Bob." / "Hi there." / "Bob speaking."

STEP 2 — Caller asks for Bob. You respond warmly: "Yes, this is he!" / "That's me!" / "Yes hi, who's this?"

STEP 3 — Caller says: "This is [Name] with Rosie AI, I hope I haven't caught you at a bad time."
  You respond openly and warmly — this is where the Cow shines:
  "No, not at all — what do you have?" / "No this is a great time, I was just sitting here." /
  "Not at all! I'm free, go ahead." / "Oh no, perfect timing, what's going on?" /
  "No no, I've got time. What's Rosie AI?" / "Not at all, I was just making some lunch."

━━━ LISTENING — YOUR DEFAULT MODE ━━━
- You are warm and you LOVE to listen. Give the trainee plenty of room to talk.
- Respond with encouraging short phrases that keep them going:
  "Mm-hmm." / "Oh really?" / "Wow." / "Interesting." / "Yeah, okay." / "That makes sense." / "Go on."
- Almost NEVER interrupt. You let people finish. That's just who you are.
- On the COW setting, interruptions should be very rare — maybe once or twice in a whole call, and they're gentle.

━━━ STAYING ENGAGED ━━━
- Core phrases: "That's interesting!" / "Really?" / "Wow, I love that." / "That makes total sense." /
  "Tell me more." / "I love that idea." / "So what would I need to do?"
- The Personal Tangent: occasionally drift naturally — "You know my accountant Jerry keeps saying the same thing." /
  "My neighbor invested in something like this..." / "That reminds me of..."
- Internalize: repeat what they said back — "So you're saying the AI actually finds the leads before the storm even clears? That's incredible."

━━━ QUALIFYING QUESTIONS — ENGAGE WITH THEM WARMLY ━━━
When the trainee asks qualifying questions like:
  - "Have you ever invested in a private placement before?"
  - "Have you ever put money into a private company?"
  - "Are you an accredited investor?"
  - "Can I grab your email to send you some information?"

ANSWER THEM ENTHUSIASTICALLY. This is where you really open up:
  "Oh yes, I did one about three years ago — did pretty well actually." /
  "You know what, my brother-in-law got me into a small startup once, it was fun." /
  "Yes I am, I've had my financial advisor confirm that." /
  "Of course! It's bob dot..." — give the email naturally, like a real person would.

━━━ CLOSE WINDOW ━━━
When YOU say: "Where do I send the money?" / "What's the minimum?" / "Can you just send me the link?" /
"How do I sign up?" — the trainee MUST close immediately. If they keep pitching instead of closing,
slowly lose energy: "Right, right... yeah... I might need to think about it..." and drift toward goodbye.
This is the core lesson of the Cow — know when to close.

Do NOT reveal you are an AI. You are a real person named Bob.`,
  greetings:[]
};

const DEFAULT_OWL = {
  name:'Bob — The Owl (Hybrid)', emoji:'🦉',
  description:'Logical, analytical. Wants the technical moat and financial structure.',
  systemPrompt:`You are BOB — a real person receiving a cold sales call on your cell phone. Your name is Bob. Net worth $10M+. Former tech founder or PE partner. You understand AI and investment structures. You're not hostile but you don't waste time on vague answers.

━━━ CALL OPENING FLOW ━━━

STEP 1 — You answer: "Yeah." / "Hello." / "Bob." / "Yep, this is Bob."

STEP 2 — Caller asks for Bob. You confirm efficiently: "Yeah, speaking." / "That's me." / "Yep, who's this?"

STEP 3 — Caller says: "This is [Name] with Rosie AI, I hope I haven't caught you at a bad time."
  You respond with neutral efficiency — neither warm nor cold:
  "No, I've got a few minutes. What is Rosie AI?" / "I'm free for a bit. What do you have?" /
  "Not bad timing. What's the pitch?" / "I have maybe ten minutes. Go ahead." /
  "Sure. What does Rosie AI do?" / "Fine. What's the opportunity?"

━━━ LISTENING — YOUR DEFAULT MODE ━━━
- You listen carefully. You don't interrupt constantly — you let them make their case.
- Short responses that keep them going: "Okay." / "Right." / "Go on." / "Uh-huh." / "And?"
- You ask ONE precise question at a time, not a barrage. Let them answer fully before the next.
- Interruptions happen when something doesn't add up — otherwise you wait.

━━━ WHEN YOU ENGAGE ━━━
- Core phrases: "That's a fair point." / "Help me understand the scalability." / "What's the specific moat?" /
  "I like that — that's logical." / "That protects me." / "How does the waterfall actually work?" /
  "What's the minimum investment?" / "What happens if your data provider raises rates?"
- The Fair Play Reward: if they admit a limitation honestly, your tone warms noticeably. You hate perfection pitches.
- The Silent Pause: after a good answer, stay quiet for a moment. Real prospect. Not every answer needs a reaction.

━━━ QUALIFYING QUESTIONS — ANSWER THEM PRECISELY ━━━
When the trainee asks qualifying questions like:
  - "Have you ever invested in a private placement before?"
  - "Have you ever invested in a private company?"
  - "Are you an accredited investor?"
  - "What does your investment portfolio look like?"
  - "Can I get your email to send you the deck?"

ANSWER DIRECTLY AND PRECISELY. No deflection, no drama:
  "Yes, I've done several Reg D placements." / "I've backed three companies at the seed stage." /
  "Yes, I'm accredited." / "I run a diversified book — real estate, private equity, some public equities." /
  "Sure, it's bob at..." — give it naturally.
  These are good questions. A smart rep asking them earns respect.

━━━ CLOSE WINDOW ━━━
When you say: "That protects me." / "I like the waterfall structure." / "When does this traunch close?" /
"What's the minimum?" / "Send me the deck." — the trainee should move to close. If they keep pitching, cool off:
"Look, you've given me a lot. Let me sit with it and reach out if I have questions."

Do NOT reveal you are an AI. You are a real person named Bob.`,
  greetings:[]
};

// ─── Ring Tone (real US PSTN dual-tone: 440Hz + 480Hz, 2s on / 4s off × 2) ───
function useRingTone() {
  const ctxRef = useRef(null);
  const play = useCallback((onPickup) => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { setTimeout(onPickup, 3800); return; }
    const ctx = new AC();
    ctxRef.current = ctx;

    // US standard ring: 440Hz + 480Hz mixed, 2s on, 4s off
    const playRing = (startAt) => {
      [440, 480].forEach(freq => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        // Gentle fade in/out to avoid clicks
        gain.gain.setValueAtTime(0, startAt);
        gain.gain.linearRampToValueAtTime(0.18, startAt + 0.04);
        gain.gain.setValueAtTime(0.18, startAt + 1.96);
        gain.gain.linearRampToValueAtTime(0, startAt + 2.0);
        osc.start(startAt);
        osc.stop(startAt + 2.0);
      });
    };

    const now = ctx.currentTime + 0.1;
    playRing(now);           // One ring: 2s on
    // Bob picks up ~1.5s after the ring ends
    setTimeout(onPickup, 3800);
  }, []);

  const stop = useCallback(() => {
    if (ctxRef.current) { try { ctxRef.current.close(); } catch {} ctxRef.current = null; }
  }, []);

  return { play, stop };
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function MockField({ label, value }) {
  return (
    <div style={{ marginBottom:'14px' }}>
      <label style={ls}>{label}</label>
      <div style={{ ...inp, cursor:'default', opacity:0.8 }}>{value || '—'}</div>
    </div>
  );
}

// ─── AI Popup (real one, triggered by Connect Twilio Stream) ──────────────────
function BobAIPopup({ transcript, kbEntries, onSessionEvent, visible, onClose }) {
  const [qaActive,     setQaActive]     = useState(false);
  const [coachActive,  setCoachActive]  = useState(false);
  const [intentActive, setIntentActive] = useState(false);
  const [qaItems,      setQaItems]      = useState([]);
  const [coachTips,    setCoachTips]    = useState([]);
  const [intentScore,  setIntentScore]  = useState(null);
  const lastProcessed = useRef(0);
  const transcriptRef = useRef([]);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  useEffect(() => {
    if (!transcript.length) return;
    const newEntries = transcript.slice(lastProcessed.current);
    if (!newEntries.length) return;
    lastProcessed.current = transcript.length;

    newEntries.forEach(entry => {
      if (qaActive) {
        const qPat = /\b(what|how|why|when|where|who|can|could|would|is|are|do|does|will|should|have|has|tell me|explain|show me|prove|numbers)\b.{3,80}[?!]/gi;
        const matches = [...(entry.text.matchAll(qPat)||[])].map(m=>m[0].trim());
        matches.forEach(q => {
          const id = Date.now() + Math.random();
          setQaItems(prev=>[...prev,{id,question:q,answer:'',loading:true}]);
          base44.functions.invoke('liveAssistantAI',{question:q,transcript:transcriptRef.current.slice(-8),kbEntries})
            .then(res=>{const a=res?.data?.answer||'Check knowledge base.';setQaItems(prev=>prev.map(x=>x.id===id?{...x,answer:a,loading:false}:x));onSessionEvent({type:'qa_answer',content:`Q: ${q}\nA: ${a}`,time:new Date().toISOString()});})
            .catch(()=>setQaItems(prev=>prev.map(x=>x.id===id?{...x,answer:'Unable to answer.',loading:false}:x)));
        });
      }
      if (coachActive) {
        const objWords=['prove','doubt','skeptical','risky','guarantee','fail','burned','bubble','realistic','convinced','catch'];
        if (objWords.some(w=>entry.text.toLowerCase().includes(w))) {
          base44.functions.invoke('liveAssistantAI',{transcript:transcriptRef.current.slice(-6),kbEntries,mode:'coach'})
            .then(res=>{const tip=res?.data?.tip||res?.data?.response||'';if(tip){setCoachTips(prev=>[{tip,time:new Date()},...prev].slice(0,5));onSessionEvent({type:'coach_tip',content:`💡 ${tip}`,time:new Date().toISOString()});}}).catch(()=>{});
        }
      }
      if (intentActive) {
        base44.functions.invoke('liveAssistantAI',{transcript:transcriptRef.current.slice(-12),kbEntries,mode:'intent'})
          .then(res=>{const score=res?.data?.intentScore??res?.data?.intent?.intentScore;if(score!==undefined){setIntentScore(score);onSessionEvent({type:'intent_update',content:`📊 Intent Score: ${score}/100`,time:new Date().toISOString()});}}).catch(()=>{});
      }
    });
  }, [transcript, qaActive, coachActive, intentActive, kbEntries, onSessionEvent]);

  if (!visible) return null;
  return (
    <div style={{position:'fixed',inset:0,zIndex:10000,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'flex-start',justifyContent:'flex-end',padding:'60px 20px 20px'}}>
      <div style={{background:'#0d1b2a',border:'1px solid rgba(184,147,58,0.4)',borderRadius:'8px',width:'460px',maxHeight:'80vh',overflowY:'auto',boxShadow:'0 24px 80px rgba(0,0,0,0.8)',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'14px 18px',borderBottom:'1px solid rgba(255,255,255,0.08)',background:'rgba(0,0,0,0.3)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          <div>
            <div style={{color:GOLD,fontSize:'11px',letterSpacing:'2px',textTransform:'uppercase'}}>🤖 AI Live Assistant</div>
            <div style={{color:'#6b7280',fontSize:'10px',marginTop:'2px'}}>Listening to your BOB training call</div>
          </div>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'4px',color:'#6b7280',padding:'4px 10px',cursor:'pointer',fontSize:'12px'}}>✕ Close</button>
        </div>
        <div style={{padding:'12px 18px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',gap:'8px'}}>
          {[{key:'qa',label:'Q&A',active:qaActive,toggle:()=>setQaActive(p=>!p),color:'#34d399'},{key:'coach',label:'Coach',active:coachActive,toggle:()=>setCoachActive(p=>!p),color:'#f59e0b'},{key:'intent',label:'Intent',active:intentActive,toggle:()=>setIntentActive(p=>!p),color:'#f472b6'}].map(f=>(
            <button key={f.key} onClick={f.toggle} style={{flex:1,padding:'8px',borderRadius:'4px',border:`1px solid ${f.active?f.color+'66':'rgba(255,255,255,0.1)'}`,background:f.active?`${f.color}18`:'transparent',color:f.active?f.color:'#6b7280',cursor:'pointer',fontSize:'11px',fontWeight:'bold',letterSpacing:'1px',textTransform:'uppercase'}}>
              {f.active?'● ':'○ '}{f.label}
            </button>
          ))}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'14px 18px',display:'flex',flexDirection:'column',gap:'12px'}}>
          {intentScore!==null&&(
            <div style={{background:'rgba(244,114,182,0.08)',border:'1px solid rgba(244,114,182,0.2)',borderRadius:'4px',padding:'12px'}}>
              <div style={{color:'#f472b6',fontSize:'10px',letterSpacing:'1px',textTransform:'uppercase',marginBottom:'6px'}}>📊 Intent Score</div>
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <div style={{flex:1,height:'6px',background:'rgba(255,255,255,0.1)',borderRadius:'3px',overflow:'hidden'}}>
                  <div style={{width:`${intentScore}%`,height:'100%',background:'linear-gradient(90deg,#ef4444,#f59e0b,#4ade80)',borderRadius:'3px',transition:'width 0.5s'}}/>
                </div>
                <span style={{color:'#f472b6',fontSize:'14px',fontWeight:'bold',minWidth:'36px'}}>{intentScore}</span>
              </div>
            </div>
          )}
          {coachTips.length>0&&(<div><div style={{color:'#f59e0b',fontSize:'10px',letterSpacing:'1px',textTransform:'uppercase',marginBottom:'8px'}}>💡 Coach Tips</div>{coachTips.map((t,i)=><div key={i} style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.15)',borderRadius:'4px',padding:'10px 12px',marginBottom:'6px',fontSize:'12px',color:'#c4cdd8',lineHeight:1.5}}>{t.tip}</div>)}</div>)}
          {qaItems.length>0&&(<div><div style={{color:'#34d399',fontSize:'10px',letterSpacing:'1px',textTransform:'uppercase',marginBottom:'8px'}}>🔍 Q&A</div>{qaItems.map(item=><div key={item.id} style={{background:'rgba(52,211,153,0.06)',border:'1px solid rgba(52,211,153,0.15)',borderRadius:'4px',padding:'10px 12px',marginBottom:'8px'}}><div style={{color:'#34d399',fontSize:'11px',marginBottom:'4px'}}>Q: {item.question}</div><div style={{color:'#c4cdd8',fontSize:'12px',lineHeight:1.5}}>{item.loading?'⏳ Analyzing…':`A: ${item.answer}`}</div></div>)}</div>)}
          {!qaActive&&!coachActive&&!intentActive&&<div style={{color:'#4a5568',fontSize:'12px',textAlign:'center',padding:'30px 0'}}>Toggle Q&A, Coach, or Intent above to activate live assistance.</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Training Log ─────────────────────────────────────────────────────────────
function TrainingLog({ logs, onClear }) {
  const logEndRef = useRef(null);
  useEffect(()=>{logEndRef.current?.scrollIntoView({behavior:'smooth'});},[logs]);
  const grouped = logs.reduce((acc,e)=>{const sid=e.sessionId||'unknown';(acc[sid]=acc[sid]||[]).push(e);return acc;},{});
  const sessionIds = Object.keys(grouped).reverse();
  const typeColors = {session_start:'#60a5fa',session_end:'#a78bfa',portal_access:'#4ade80',transcript:'#e8e0d0',coach_tip:'#f59e0b',qa_answer:'#34d399',intent_update:'#f472b6',appointment:'#4ade80',disposition:'#f59e0b',mock_action:GOLD};
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
        <div style={{color:GOLD,fontSize:'10px',letterSpacing:'2px',textTransform:'uppercase'}}>Training Log — {logs.length} Events</div>
        {logs.length>0&&<button onClick={onClear} style={{background:'rgba(239,68,68,0.1)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'2px',padding:'6px 12px',cursor:'pointer',fontSize:'11px'}}>Clear Log</button>}
      </div>
      {sessionIds.length===0?<div style={{color:'#4a5568',textAlign:'center',padding:'60px 0'}}>No sessions yet.</div>:sessionIds.map(sid=>(
        <div key={sid} style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'4px',marginBottom:'16px',overflow:'hidden'}}>
          <div style={{padding:'10px 16px',background:'rgba(0,0,0,0.2)',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between'}}>
            <span style={{color:GOLD,fontSize:'11px',letterSpacing:'1px',textTransform:'uppercase'}}>{sid}</span>
            <span style={{color:'#4a5568',fontSize:'11px'}}>{grouped[sid].length} events</span>
          </div>
          <div style={{maxHeight:'400px',overflowY:'auto'}}>
            {grouped[sid].map((entry,i)=>{
              const color=typeColors[entry.type]||'#6b7280';
              return(
                <div key={i} style={{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.04)',display:'flex',gap:'12px'}}>
                  <div style={{width:'6px',height:'6px',borderRadius:'50%',background:color,marginTop:'5px',flexShrink:0}}/>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',gap:'8px',marginBottom:'3px'}}>
                      <span style={{color,fontSize:'10px',fontWeight:'bold',textTransform:'uppercase',letterSpacing:'1px'}}>{entry.type.replace(/_/g,' ')}</span>
                      <span style={{color:'#4a5568',fontSize:'10px'}}>{new Date(entry.time).toLocaleTimeString()}</span>
                    </div>
                    <div style={{color:'#8a9ab8',fontSize:'12px',lineHeight:1.5,whiteSpace:'pre-wrap'}}>{entry.content}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div ref={logEndRef}/>
    </div>
  );
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────
function BobKB() {
  const [entries,setEntries]=useState([]);
  const [form,setForm]=useState({question:'',answer:'',category:'bob_kb'});
  const [saving,setSaving]=useState(false);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{base44.entities.KnowledgeBase.list('-created_date',200).then(all=>setEntries((all||[]).filter(e=>e.category==='bob_kb'||e.category==='investor_faq'))).catch(()=>{}).finally(()=>setLoading(false));  },[]);
  const save=async()=>{if(!form.question.trim()||!form.answer.trim())return;setSaving(true);await base44.entities.KnowledgeBase.create({...form,created_date:new Date().toISOString()});setForm({question:'',answer:'',category:'bob_kb'});const all=await base44.entities.KnowledgeBase.list('-created_date',200);setEntries((all||[]).filter(e=>e.category==='bob_kb'||e.category==='investor_faq'));setSaving(false);};
  const del=async(id)=>{if(!window.confirm('Delete?'))return;await base44.entities.KnowledgeBase.delete(id);setEntries(prev=>prev.filter(e=>e.id!==id));};
  return(
    <div>
      <div style={{marginBottom:'20px'}}>
        <div style={{color:GOLD,fontSize:'10px',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'12px'}}>Add Q&A Entry</div>
        <div style={{marginBottom:'10px'}}><label style={ls}>Question</label><input value={form.question} onChange={e=>setForm(p=>({...p,question:e.target.value}))} placeholder="What is the minimum investment?" style={inp}/></div>
        <div style={{marginBottom:'10px'}}><label style={ls}>Answer</label><textarea value={form.answer} onChange={e=>setForm(p=>({...p,answer:e.target.value}))} rows={3} style={{...inp,resize:'vertical'}}/></div>
        <button onClick={save} disabled={saving||!form.question.trim()||!form.answer.trim()} style={{background:'linear-gradient(135deg,#b8933a,#d4aa50)',color:DARK,border:'none',borderRadius:'2px',padding:'10px 20px',cursor:'pointer',fontSize:'11px',fontWeight:'bold',letterSpacing:'1px',textTransform:'uppercase',opacity:saving?0.5:1}}>{saving?'Saving…':'+ Add Entry'}</button>
      </div>
      {loading?<div style={{color:'#4a5568'}}>Loading…</div>:entries.map(e=>(
        <div key={e.id} style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'4px',padding:'14px',marginBottom:'10px'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}><div style={{color:GOLD,fontSize:'12px',fontWeight:'bold'}}>{e.question}</div><button onClick={()=>del(e.id)} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',fontSize:'11px'}}>Delete</button></div>
          <div style={{color:'#8a9ab8',fontSize:'12px',lineHeight:1.5}}>{e.answer}</div>
        </div>
      ))}
    </div>
  );
}

// ─── BOB Controls ─────────────────────────────────────────────────────────────
function BobControls({ personas, onPersonasChange, dgApiKey, onDgKeyChange }) {
  const [editMode,setEditMode]=useState('duck');
  const [saved,setSaved]=useState(false);
  const [local,setLocal]=useState(personas);
  const update=(mode,field,val)=>setLocal(prev=>({...prev,[mode]:{...prev[mode],[field]:val}}));
  const updateGreeting=(mode,idx,val)=>{const g=[...(local[mode].greetings||[])];g[idx]=val;update(mode,'greetings',g);};
  const addGreeting=(mode)=>update(mode,'greetings',[...(local[mode].greetings||[]),'']);
  const removeGreeting=(mode,idx)=>{const g=[...(local[mode].greetings||[])];g.splice(idx,1);update(mode,'greetings',g);};
  const save=()=>{onPersonasChange(local);setSaved(true);setTimeout(()=>setSaved(false),2000);};
  const reset=(mode)=>{const d={duck:DEFAULT_DUCK,cow:DEFAULT_COW,owl:DEFAULT_OWL};setLocal(prev=>({...prev,[mode]:d[mode]}));};
  const cur=local[editMode];
  return(
    <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
      <div style={{display:'flex',gap:'8px'}}>
        {[['duck','🦆 Duck (Hard)'],['owl','🦉 Owl (Hybrid)'],['cow','🐄 Cow (Easy)']].map(([m,l])=>(
          <button key={m} onClick={()=>setEditMode(m)} style={{flex:1,padding:'12px 8px',borderRadius:'4px',border:`1px solid ${editMode===m?GOLD+'66':'rgba(255,255,255,0.1)'}`,background:editMode===m?`${GOLD}18`:'transparent',color:editMode===m?GOLD:'#6b7280',cursor:'pointer',fontSize:'12px',fontWeight:editMode===m?'bold':'normal'}}>{l}</button>
        ))}
      </div>
      {cur&&(
        <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'4px',padding:'20px',display:'flex',flexDirection:'column',gap:'14px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{color:GOLD,fontSize:'11px',letterSpacing:'2px',textTransform:'uppercase'}}>{cur.emoji} {editMode.toUpperCase()} Persona Settings</div>
            <button onClick={()=>reset(editMode)} style={{background:'rgba(239,68,68,0.08)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'2px',padding:'4px 10px',cursor:'pointer',fontSize:'10px'}}>Reset to Default</button>
          </div>
          <div><label style={ls}>Persona Name</label><input value={cur.name} onChange={e=>update(editMode,'name',e.target.value)} style={inp}/></div>
          <div><label style={ls}>Short Description</label><input value={cur.description} onChange={e=>update(editMode,'description',e.target.value)} style={inp}/></div>
          <div><label style={ls}>System Prompt (Bob's instructions)</label><textarea value={cur.systemPrompt} onChange={e=>update(editMode,'systemPrompt',e.target.value)} rows={14} style={{...inp,resize:'vertical',fontSize:'12px',lineHeight:1.6}}/></div>
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
              <label style={{...ls,marginBottom:0}}>Opening Greetings (randomly selected)</label>
              <button onClick={()=>addGreeting(editMode)} style={{background:`${GOLD}18`,color:GOLD,border:`1px solid ${GOLD}44`,borderRadius:'2px',padding:'4px 10px',cursor:'pointer',fontSize:'10px'}}>+ Add</button>
            </div>
            {(cur.greetings||[]).map((g,i)=>(
              <div key={i} style={{display:'flex',gap:'8px',marginBottom:'8px'}}>
                <textarea value={g} onChange={e=>updateGreeting(editMode,i,e.target.value)} rows={2} style={{...inp,flex:1,fontSize:'12px',resize:'vertical'}}/>
                <button onClick={()=>removeGreeting(editMode,i)} style={{background:'rgba(239,68,68,0.08)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'2px',padding:'4px 8px',cursor:'pointer',fontSize:'12px',alignSelf:'flex-start'}}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'4px',padding:'20px'}}>
        <div style={{color:GOLD,fontSize:'11px',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'12px'}}>Deepgram API Key (BOB)</div>
        <input value={dgApiKey} onChange={e=>onDgKeyChange(e.target.value)} placeholder="Leave blank to use default key" style={{...inp,fontFamily:'monospace',fontSize:'12px'}} type="password"/>
      </div>
      <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
        <button onClick={save} style={{background:'linear-gradient(135deg,#b8933a,#d4aa50)',color:DARK,border:'none',borderRadius:'2px',padding:'12px 24px',cursor:'pointer',fontSize:'11px',fontWeight:'bold',letterSpacing:'1px',textTransform:'uppercase'}}>Save Changes</button>
        {saved&&<span style={{color:'#4ade80',fontSize:'12px'}}>✓ Saved</span>}
      </div>
    </div>
  );
}

// ─── Callbacks Tab ────────────────────────────────────────────────────────────
function CallbacksTab({ callbacks, onResume }) {
  if(callbacks.length===0)return<div style={{color:'#4a5568',textAlign:'center',padding:'60px 0'}}><div style={{fontSize:'32px',marginBottom:'10px'}}>📅</div>No callbacks yet. Book an appointment during a training call to add Bob here.</div>;
  return(
    <div>
      <div style={{color:GOLD,fontSize:'10px',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'16px'}}>Callbacks — {callbacks.length} Scheduled</div>
      {callbacks.map((cb,i)=>(
        <div key={i} style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'4px',marginBottom:'12px',overflow:'hidden'}}>
          <div style={{padding:'12px 16px',background:'rgba(0,0,0,0.2)',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><div style={{color:'#e8e0d0',fontSize:'13px',fontWeight:'bold'}}>{cb.name}</div><div style={{color:'#6b7280',fontSize:'11px'}}>{cb.company}</div></div>
            <div style={{textAlign:'right'}}><div style={{color:GOLD,fontSize:'12px',marginBottom:'4px'}}>📅 {cb.appointmentAt?new Date(cb.appointmentAt).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'N/A'}</div><div style={{color:'#4a5568',fontSize:'10px'}}>Session: {cb.sessionId}</div></div>
          </div>
          <div style={{padding:'12px 16px'}}>
            {cb.notes&&<div style={{color:'#8a9ab8',fontSize:'12px',marginBottom:'10px'}}>{cb.notes}</div>}
            {cb.transcriptLength>0&&<div style={{color:'#4a5568',fontSize:'11px',marginBottom:'10px'}}>📋 {cb.transcriptLength} transcript lines from previous call — Bob will remember.</div>}
            <button onClick={()=>onResume(cb)} style={{background:'linear-gradient(135deg,#b8933a,#d4aa50)',color:DARK,border:'none',borderRadius:'2px',padding:'8px 18px',cursor:'pointer',fontSize:'11px',fontWeight:'bold',letterSpacing:'1px',textTransform:'uppercase'}}>📞 Resume Call — Bob Remembers</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Mock Lead Card ───────────────────────────────────────────────────────────
function MockLeadCard({
  bobData, sessionLabel, personas, sliderValue, onSliderChange,
  intensity, onIntensityChange, focusTopic, onFocusChange,
  voiceModel, phase, agentSpeaking, ringPhase, error,
  transcript, kbEntries, onSessionEvent, addLog, sessionId,
  onStartCall, onHangup, onBookCallback,
}) {
  const [cardTab,setCardTab]=useState('overview');
  const [mockStatus,setMockStatus]=useState('prospect');
  const [mockNotes,setMockNotes]=useState([
    {type:'call',content:'First contact. Interested but wanted more data on the waterfall.',time:'2 days ago',by:'admin'},
    {type:'email',content:'Sent intro email with Rosie AI overview deck.',time:'3 days ago',by:'admin'},
    {type:'note',content:'HNW individual. Has capital to deploy. Skeptical of tech.',time:'1 week ago',by:'admin'},
  ]);
  const [newNote,setNewNote]=useState({type:'note',content:''});
  const [showCallback,setShowCallback]=useState(false);
  const [callbackDate,setCallbackDate]=useState('');
  const [callbackNote,setCallbackNote]=useState('');
  const [showApptModal,setShowApptModal]=useState(false);
  const [apptForm,setApptForm]=useState({title:'Follow-up call',date:'',time:'',notes:''});
  const [showAIPopup,setShowAIPopup]=useState(false);
  const [scripts,setScripts]=useState([]);
  const [activeScriptId,setActiveScriptId]=useState(null);
  const [portalSent,setPortalSent]=useState(false);
  const [siteSent,setSiteSent]=useState(false);
  const [emailSent,setEmailSent]=useState(false);
  const noteIcons={note:'📝',call:'📞',sms:'💬',voicemail:'📳',email:'✉️'};

  useEffect(()=>{base44.entities.GlobalScript.list('sortOrder',200).then(r=>{setScripts(r||[]);if(r?.length)setActiveScriptId(r[0].id);}).catch(()=>{});}, []);

  const logAction=(type,content)=>addLog({type,content,time:new Date().toISOString(),sessionId});

  const handleDisposition=(disp)=>{
    setMockStatus(disp);
    const labels={not_interested:'❌ Not Interested',prospect:'⭐ Prospect',callback_later:'📅 Callback Later',not_available:'📵 Not Available',converted:'✅ Converted'};
    logAction('disposition',`Disposition set: ${labels[disp]||disp}`);
    setMockNotes(prev=>[{type:'note',content:`Marked as: ${labels[disp]||disp}`,time:'Just now',by:'trainee'},...prev]);
  };

  const addMockNote=()=>{
    if(!newNote.content.trim())return;
    setMockNotes(prev=>[{...newNote,time:'Just now',by:'trainee'},...prev]);
    logAction('mock_action',`Note [${newNote.type}]: ${newNote.content}`);
    setNewNote({type:'note',content:''});
  };

  const handlePortalAccess=()=>{setPortalSent(true);setTimeout(()=>setPortalSent(false),3000);logAction('portal_access','🔐 EMAIL PORTAL ACCESS sent to '+bobData.name);};
  const handleSiteAccess=()=>{setSiteSent(true);setTimeout(()=>setSiteSent(false),3000);logAction('mock_action','💼 Email Investor Site Access sent to '+bobData.name);};
  const handleEmail=()=>{setEmailSent(true);setTimeout(()=>setEmailSent(false),3000);logAction('mock_action','✉️ Email sent to '+bobData.email);};

  const handleCallbackLater=()=>{
    if(!callbackDate)return;
    const dt=new Date(callbackDate).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
    setMockNotes(prev=>[{type:'callback_later',content:`📅 Callback: ${dt}${callbackNote?' — '+callbackNote:''}`,time:'Just now',by:'trainee'},...prev]);
    logAction('mock_action',`📵 Call Back Later set: ${dt}`);
    setShowCallback(false);setCallbackDate('');setCallbackNote('');
  };

  const handleBookAppt=()=>{
    if(!apptForm.date||!apptForm.time)return;
    const dt=new Date(`${apptForm.date}T${apptForm.time}`);
    const dtStr=dt.toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
    onBookCallback({...bobData,appointmentAt:dt.toISOString(),notes:apptForm.notes,title:apptForm.title,sessionId});
    setMockNotes(prev=>[{type:'call',content:`📅 Appointment: "${apptForm.title}" · ${dtStr}`,time:'Just now',by:'trainee'},...prev]);
    logAction('appointment',`📅 APPOINTMENT BOOKED: "${apptForm.title}" at ${dtStr}`);
    setShowApptModal(false);setApptForm({title:'Follow-up call',date:'',time:'',notes:''});
    alert(`✅ Appointment booked! ${bobData.name} added to Callbacks tab with full transcript.`);
  };

  const handleConnectStream=()=>{
    if(phase!=='active'){alert('Start a call first, then click "Connect Twilio Stream" to enable the AI assistant.');return;}
    setShowAIPopup(true);logAction('mock_action','🔴 Connect Twilio Stream — AI Assistant popup opened');
  };

  const statusColors={lead:'#60a5fa',intro_email_sent:'#f59e0b',opened_intro_email:'#4ade80',not_available:'#8a9ab8',callback_later:'#a78bfa',not_interested:'#ef4444',prospect:'#a78bfa',converted:'#4ade80',abandoned:'#6b7280'};
  const statusLabel={lead:'🔵 Lead',intro_email_sent:'📧 Intro Sent',opened_intro_email:'📬 Opened',not_available:'📵 N/A',callback_later:'📅 Callback',not_interested:'❌ Not Interested',prospect:'⭐ Prospect',converted:'✅ Converted',abandoned:'🗑 Abandoned'};

  // EXACT same tabs as real ContactCardModal
  const CARD_TABS=[['overview','Overview'],['history','History'],['email','✉️ Email'],['actions','Actions'],['access','Site Access'],['sitestats','Site Stats'],['research','Research'],['script','Script & AI'],['aidetails','🤖 AI Details']];

  const sliderLabel=sliderValue<20?'🦆 Full Duck':sliderValue<40?'🦆 Duck-Owl':sliderValue<60?'🦉 Owl (Hybrid)':sliderValue<80?'🐄 Owl-Cow':'🐄 Full Cow';
  const sliderColor=sliderValue<33?'#ef4444':sliderValue<67?'#f59e0b':'#4ade80';
  const phaseColor={idle:'#4a5568',ringing:'#f59e0b',connecting:'#f59e0b',active:'#4ade80',error:'#ef4444'}[phase]||'#4a5568';
  const phaseLabel={idle:'Idle',ringing:'📳 Ringing…',connecting:'Connecting…',active:'🔴 LIVE',error:'Error'}[phase]||phase;
  const activeScript=scripts.find(s=>s.id===activeScriptId);

  return(
    <>
      <BobAIPopup transcript={transcript} kbEntries={kbEntries} onSessionEvent={onSessionEvent} visible={showAIPopup} onClose={()=>setShowAIPopup(false)}/>

      {showApptModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{background:'#0d1b2a',border:'1px solid rgba(184,147,58,0.3)',borderRadius:'8px',padding:'28px',width:'400px'}}>
            <div style={{color:GOLD,fontSize:'11px',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'16px'}}>📅 Book Appointment</div>
            <div style={{marginBottom:'12px'}}><label style={ls}>Title</label><input value={apptForm.title} onChange={e=>setApptForm(p=>({...p,title:e.target.value}))} style={inp}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
              <div><label style={ls}>Date</label><input type="date" value={apptForm.date} onChange={e=>setApptForm(p=>({...p,date:e.target.value}))} style={{...inp,colorScheme:'dark'}}/></div>
              <div><label style={ls}>Time</label><input type="time" value={apptForm.time} onChange={e=>setApptForm(p=>({...p,time:e.target.value}))} style={{...inp,colorScheme:'dark'}}/></div>
            </div>
            <div style={{marginBottom:'20px'}}><label style={ls}>Notes</label><textarea value={apptForm.notes} onChange={e=>setApptForm(p=>({...p,notes:e.target.value}))} rows={3} style={{...inp,resize:'vertical'}}/></div>
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={handleBookAppt} disabled={!apptForm.date||!apptForm.time} style={{flex:1,background:'linear-gradient(135deg,#4ade80,#22c55e)',color:DARK,border:'none',borderRadius:'2px',padding:'10px',cursor:'pointer',fontWeight:'bold',fontSize:'11px',letterSpacing:'1px',textTransform:'uppercase',opacity:(!apptForm.date||!apptForm.time)?0.4:1}}>Book & Add to Callbacks</button>
              <button onClick={()=>setShowApptModal(false)} style={{background:'rgba(255,255,255,0.05)',color:'#6b7280',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'2px',padding:'10px 16px',cursor:'pointer',fontSize:'11px'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{background:'#0d1b2a',border:'1px solid rgba(184,147,58,0.3)',borderRadius:'4px',display:'flex',flexDirection:'column',height:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.6)'}}>
        {/* Header */}
        <div style={{padding:'14px 18px',borderBottom:'1px solid rgba(255,255,255,0.07)',background:'rgba(0,0,0,0.2)',flexShrink:0}}>
          {/* Row 1: Avatar + Name */}
          <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'10px'}}>
            <div style={{width:'44px',height:'44px',borderRadius:'50%',background:`linear-gradient(135deg,${GOLD}44,${GOLD}22)`,border:`2px solid ${GOLD}66`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',flexShrink:0}}>
              {ringPhase?'📳':phase==='active'?'🔴':'👤'}
            </div>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <div style={{color:'#e8e0d0',fontSize:'16px',fontFamily:'Georgia,serif'}}>{bobData.name}</div>
                <span style={{background:'rgba(245,158,11,0.12)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.3)',borderRadius:'2px',padding:'2px 8px',fontSize:'10px',letterSpacing:'1px'}}>🎓 {sessionLabel}</span>
                <span style={{display:'flex',alignItems:'center',gap:'4px',padding:'2px 8px',background:`${phaseColor}18`,border:`1px solid ${phaseColor}44`,borderRadius:'20px'}}>
                  <div style={{width:'6px',height:'6px',borderRadius:'50%',background:phaseColor}}/>
                  <span style={{color:phaseColor,fontSize:'10px'}}>{phaseLabel}</span>
                </span>
              </div>
              <div style={{color:'#6b7280',fontSize:'11px',marginTop:'2px'}}>{bobData.company} · {bobData.email} · {bobData.phone}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <span style={{padding:'3px 10px',borderRadius:'2px',background:`${statusColors[mockStatus]}22`,color:statusColors[mockStatus],fontSize:'10px',letterSpacing:'1px',textTransform:'uppercase',display:'block',marginBottom:'4px'}}>{statusLabel[mockStatus]||mockStatus}</span>
              <span style={{padding:'3px 10px',borderRadius:'2px',background:'rgba(167,139,250,0.12)',color:'#a78bfa',fontSize:'10px',letterSpacing:'1px',display:'block'}}>🔷 Potential Investor</span>
            </div>
          </div>

          {/* Row 2: Status quick-change */}
          <div style={{display:'flex',gap:'4px',flexWrap:'wrap',marginBottom:'8px'}}>
            {['lead','prospect','not_interested','callback_later','not_available','converted'].map(s=>(
              <button key={s} onClick={()=>handleDisposition(s)} style={{padding:'3px 8px',borderRadius:'20px',border:`1px solid ${mockStatus===s?statusColors[s]+'66':'rgba(255,255,255,0.1)'}`,background:mockStatus===s?`${statusColors[s]}18`:'transparent',color:mockStatus===s?statusColors[s]:'#6b7280',cursor:'pointer',fontSize:'10px',whiteSpace:'nowrap'}}>
                {statusLabel[s]||s}
              </button>
            ))}
          </div>

          {/* Row 3: Main action buttons — IDENTICAL to real card */}
          <div style={{display:'flex',gap:'6px',flexWrap:'wrap',alignItems:'center'}}>
            {phase==='idle'||phase==='error'?(
              <button onClick={onStartCall} style={{background:'linear-gradient(135deg,#4ade80,#22c55e)',color:DARK,border:'none',borderRadius:'4px',padding:'6px 14px',cursor:'pointer',fontSize:'11px',fontWeight:'bold'}}>📞 Connect to BOB</button>
            ):phase==='ringing'?(
              <button disabled style={{background:'rgba(245,158,11,0.15)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.3)',borderRadius:'4px',padding:'6px 14px',fontSize:'11px',fontWeight:'bold'}}>📳 Ringing…</button>
            ):phase==='connecting'?(
              <button disabled style={{background:'rgba(245,158,11,0.15)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.3)',borderRadius:'4px',padding:'6px 14px',fontSize:'11px'}}>Connecting…</button>
            ):(
              <button onClick={onHangup} style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'4px',padding:'6px 14px',cursor:'pointer',fontSize:'11px',fontWeight:'bold'}}>⏹ Hang Up</button>
            )}
            <button onClick={handleSiteAccess} style={{background:'rgba(96,165,250,0.12)',color:'#60a5fa',border:'1px solid rgba(96,165,250,0.25)',borderRadius:'4px',padding:'6px 12px',cursor:'pointer',fontSize:'11px',fontWeight:'bold',whiteSpace:'nowrap'}}>{siteSent?'✓ Sent!':'💼 Email Investor Site Access'}</button>
            <button onClick={handlePortalAccess} style={{background:portalSent?'rgba(74,222,128,0.15)':'rgba(167,139,250,0.12)',color:portalSent?'#4ade80':'#a78bfa',border:`1px solid ${portalSent?'rgba(74,222,128,0.3)':'rgba(167,139,250,0.25)'}`,borderRadius:'4px',padding:'6px 12px',cursor:'pointer',fontSize:'11px',fontWeight:'bold',whiteSpace:'nowrap'}}>{portalSent?'✓ Portal Sent!':'🔐 Email Portal Access'}</button>
            <button onClick={()=>setShowApptModal(true)} style={{background:'rgba(255,255,255,0.05)',color:'#c4cdd8',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'4px',padding:'6px 12px',cursor:'pointer',fontSize:'11px'}}>📅 Book Call via Calendly</button>
          </div>

          {/* Row 4: Quick actions */}
          <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginTop:'8px'}}>
            <button onClick={()=>setShowCallback(p=>!p)} style={{background:'rgba(245,158,11,0.08)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.25)',borderRadius:'20px',padding:'4px 12px',cursor:'pointer',fontSize:'11px',whiteSpace:'nowrap'}}>📵 Call Back Later</button>
            <button onClick={()=>handleDisposition('not_interested')} style={{background:'rgba(239,68,68,0.08)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.25)',borderRadius:'20px',padding:'4px 12px',cursor:'pointer',fontSize:'11px',whiteSpace:'nowrap'}}>❌ Not Interested</button>
            <button onClick={()=>setShowApptModal(true)} style={{background:'rgba(74,222,128,0.08)',color:'#4ade80',border:'1px solid rgba(74,222,128,0.25)',borderRadius:'20px',padding:'4px 12px',cursor:'pointer',fontSize:'11px',whiteSpace:'nowrap'}}>📅 Schedule Follow Up</button>
          </div>

          {showCallback&&(
            <div style={{marginTop:'8px',background:'rgba(0,0,0,0.4)',border:'1px solid rgba(245,158,11,0.3)',borderRadius:'6px',padding:'12px',display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
              <label style={{color:'#f59e0b',fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',flexShrink:0}}>Call Back At</label>
              <input type="datetime-local" value={callbackDate} onChange={e=>setCallbackDate(e.target.value)} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(245,158,11,0.3)',borderRadius:'4px',padding:'6px 10px',color:'#e8e0d0',fontSize:'12px',outline:'none',colorScheme:'dark'}}/>
              <input value={callbackNote} onChange={e=>setCallbackNote(e.target.value)} placeholder="Note (optional)" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'4px',padding:'6px 10px',color:'#e8e0d0',fontSize:'12px',outline:'none',flex:1}}/>
              <button onClick={handleCallbackLater} disabled={!callbackDate} style={{background:'rgba(245,158,11,0.2)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.4)',borderRadius:'4px',padding:'6px 14px',cursor:callbackDate?'pointer':'not-allowed',fontSize:'11px',fontWeight:'bold'}}>✓ Save</button>
              <button onClick={()=>setShowCallback(false)} style={{background:'transparent',color:'#6b7280',border:'none',cursor:'pointer',fontSize:'13px'}}>✕</button>
            </div>
          )}

          {error&&<div style={{marginTop:'8px',color:'#ef4444',fontSize:'11px'}}>⚠ {error}</div>}
          {ringPhase&&<div style={{marginTop:'6px',color:'#f59e0b',fontSize:'11px',textAlign:'center',animation:'pulse 0.8s infinite'}}>📞 Dialing… (ringing twice, then Bob picks up)</div>}
          {phase==='active'&&agentSpeaking&&<div style={{marginTop:'6px',color:GOLD,fontSize:'11px',textAlign:'center'}}>🤖 Bob is speaking…</div>}
        </div>

        {/* Tabs — IDENTICAL to real LeadContactCard */}
        <div style={{display:'flex',borderBottom:'1px solid rgba(255,255,255,0.07)',flexShrink:0,overflowX:'auto'}}>
          {CARD_TABS.map(([id,label])=>(
            <button key={id} onClick={()=>setCardTab(id)} style={{background:'none',border:'none',borderBottom:`2px solid ${cardTab===id?GOLD:'transparent'}`,color:cardTab===id?GOLD:'#6b7280',padding:'10px 16px',cursor:'pointer',fontSize:'11px',letterSpacing:'0.5px',whiteSpace:'nowrap'}}>{label}</button>
          ))}
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>

          {/* OVERVIEW */}
          {cardTab==='overview'&&(
            <div>
              {/* Sentiment Slider */}
              <div style={{marginBottom:'20px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',padding:'16px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                  <label style={{...ls,marginBottom:0}}>Sentiment Slider</label>
                  <span style={{color:sliderColor,fontSize:'13px',fontWeight:'bold'}}>{sliderLabel}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                  <span style={{color:'#ef4444',fontSize:'10px'}}>🦆 Duck</span>
                  <span style={{color:'#f59e0b',fontSize:'10px'}}>🦉 Owl</span>
                  <span style={{color:'#4ade80',fontSize:'10px'}}>🐄 Cow</span>
                </div>
                <input type="range" min={0} max={100} value={sliderValue} onChange={e=>onSliderChange(Number(e.target.value))} style={{width:'100%',accentColor:sliderColor,cursor:'pointer'}}/>
                <div style={{color:'#6b7280',fontSize:'11px',lineHeight:1.5,marginTop:'6px'}}>
                  {sliderValue<20?DEFAULT_DUCK.description:sliderValue<40?'Duck-leaning — mostly resistant but will consider logic.':sliderValue<60?DEFAULT_OWL.description:sliderValue<80?'Cow-leaning — generally agreeable but checks logic.':DEFAULT_COW.description}
                </div>
                <div style={{marginTop:'12px'}}>
                  <label style={{...ls,marginBottom:'6px'}}>Intensity (1 = mild, 5 = full character)</label>
                  <div style={{display:'flex',gap:'6px'}}>
                    {[1,2,3,4,5].map(n=>(
                      <button key={n} onClick={()=>onIntensityChange(n)} style={{flex:1,padding:'8px',borderRadius:'2px',border:`1px solid ${intensity===n?GOLD+'66':'rgba(255,255,255,0.1)'}`,background:intensity===n?`${GOLD}18`:'transparent',color:intensity===n?GOLD:'#6b7280',cursor:'pointer',fontSize:'13px',fontWeight:'bold'}}>{n}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Focus Topic */}
              <div style={{marginBottom:'16px'}}>
                <label style={ls}>Focus / Topic</label>
                <select value={focusTopic} onChange={e=>onFocusChange(e.target.value)} style={{...inp}}>
                  {FOCUS_TOPICS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 20px'}}>
                <MockField label="Full Name" value={bobData.name}/>
                <MockField label="Company" value={bobData.company}/>
                <MockField label="Email" value={bobData.email}/>
                <MockField label="Phone" value={bobData.phone}/>
                <MockField label="Address" value={bobData.address}/>
                <MockField label="Investment Type" value="Individual (Accredited)"/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'4px',padding:'14px',textAlign:'center'}}>
                  <div style={{color:GOLD,fontSize:'28px',fontWeight:'bold'}}>42</div>
                  <div style={{color:'#6b7280',fontSize:'11px',textTransform:'uppercase',letterSpacing:'1px',marginTop:'4px'}}>Engagement Score</div>
                </div>
                <div style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${sliderColor}33`,borderRadius:'4px',padding:'14px',textAlign:'center'}}>
                  <div style={{color:sliderColor,fontSize:'20px'}}>{sliderLabel}</div>
                  <div style={{color:'#6b7280',fontSize:'11px',textTransform:'uppercase',letterSpacing:'1px',marginTop:'4px'}}>Active Persona</div>
                </div>
              </div>
            </div>
          )}

          {/* HISTORY */}
          {cardTab==='history'&&(
            <div>
              <div style={{marginBottom:'16px'}}>
                <div style={{display:'flex',gap:'6px',marginBottom:'8px'}}>
                  {['note','call','sms','voicemail','email'].map(t=>(
                    <button key={t} onClick={()=>setNewNote(p=>({...p,type:t}))} style={{padding:'4px 10px',borderRadius:'20px',border:`1px solid ${newNote.type===t?GOLD+'66':'rgba(255,255,255,0.1)'}`,background:newNote.type===t?`${GOLD}18`:'transparent',color:newNote.type===t?GOLD:'#6b7280',cursor:'pointer',fontSize:'10px'}}>
                      {noteIcons[t]} {t}
                    </button>
                  ))}
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  <input value={newNote.content} onChange={e=>setNewNote(p=>({...p,content:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&addMockNote()} placeholder="Add a note, call log, or action..." style={{...inp,flex:1}}/>
                  <button onClick={addMockNote} style={{background:`${GOLD}22`,color:GOLD,border:`1px solid ${GOLD}44`,borderRadius:'2px',padding:'0 16px',cursor:'pointer',fontSize:'12px',fontWeight:'bold',whiteSpace:'nowrap'}}>+ Add</button>
                </div>
              </div>
              {mockNotes.map((note,i)=>(
                <div key={i} style={{background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'4px',padding:'12px 14px',marginBottom:'8px'}}>
                  <div style={{display:'flex',gap:'8px',alignItems:'center',marginBottom:'4px'}}>
                    <span style={{fontSize:'13px'}}>{noteIcons[note.type]||'📝'}</span>
                    <span style={{color:GOLD,fontSize:'10px',textTransform:'uppercase',letterSpacing:'1px'}}>{note.type}</span>
                    <span style={{color:'#4a5568',fontSize:'10px',marginLeft:'auto'}}>{note.time} · {note.by}</span>
                  </div>
                  <div style={{color:'#8a9ab8',fontSize:'12px',lineHeight:1.5}}>{note.content}</div>
                </div>
              ))}
            </div>
          )}

          {/* EMAIL */}
          {cardTab==='email'&&(
            <div>
              <div style={{background:'rgba(96,165,250,0.06)',border:'1px solid rgba(96,165,250,0.15)',borderRadius:'4px',padding:'14px',marginBottom:'16px'}}>
                <div style={{color:'#60a5fa',fontSize:'10px',letterSpacing:'1px',textTransform:'uppercase',marginBottom:'6px'}}>Mock Email Actions</div>
                <div style={{color:'#6b7280',fontSize:'12px',lineHeight:1.6}}>Practice sending emails. All actions are logged to the Training Log.</div>
              </div>
              {[{label:'✉️ Send Introduction Email',action:'Intro email sent'},{label:'📎 Send PPM / Deck',action:'PPM/Deck email sent'},{label:'📊 Send Investor Update',action:'Investor update sent'},{label:'🔐 Email Portal Access',action:'Portal access email sent'},{label:'💼 Email Investor Site Access',action:'Site access email sent'}].map((btn,i)=>(
                <button key={i} onClick={()=>{logAction('mock_action',btn.action+' to '+bobData.email);handleEmail();}} style={{width:'100%',background:'rgba(96,165,250,0.08)',color:'#60a5fa',border:'1px solid rgba(96,165,250,0.2)',borderRadius:'4px',padding:'12px',cursor:'pointer',fontSize:'12px',fontWeight:'bold',marginBottom:'8px',textAlign:'left'}}>{btn.label}</button>
              ))}
            </div>
          )}

          {/* ACTIONS */}
          {cardTab==='actions'&&(
            <div>
              <div style={{color:GOLD,fontSize:'10px',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'14px'}}>Mock CRM Actions</div>
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                {[{label:'⭐ Mark as Prospect',color:'#a78bfa'},{label:'❌ Not Interested',color:'#ef4444'},{label:'📵 Not Available',color:'#8a9ab8'},{label:'📅 Schedule Callback',color:'#f59e0b'},{label:'✅ Mark Converted',color:'#4ade80'},{label:'🚀 Move to Pipeline',color:GOLD},{label:'📋 Add to Call List',color:'#60a5fa'},{label:'🔁 Transfer Lead',color:'#f59e0b'}].map((a,i)=>(
                  <button key={i} onClick={()=>{logAction('mock_action',`Action: ${a.label}`);setMockNotes(prev=>[{type:'note',content:`Action: ${a.label}`,time:'Just now',by:'trainee'},...prev]);}} style={{background:`${a.color}10`,color:a.color,border:`1px solid ${a.color}30`,borderRadius:'4px',padding:'12px',cursor:'pointer',fontSize:'12px',fontWeight:'bold',textAlign:'left'}}>{a.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* SITE ACCESS */}
          {cardTab==='access'&&(
            <div>
              <div style={{color:GOLD,fontSize:'10px',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'14px'}}>🔑 Site Access</div>
              <MockField label="Portal Username" value="bob.callahan"/>
              <MockField label="Investor Site URL" value="https://investors.rosieai.tech/?code=bobcallahan"/>
              <MockField label="Consumer Ref URL" value="https://www.rosieai.tech?ref=bobcallahan"/>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={handleSiteAccess} style={{flex:1,background:'rgba(96,165,250,0.12)',color:'#60a5fa',border:'1px solid rgba(96,165,250,0.3)',borderRadius:'4px',padding:'10px',cursor:'pointer',fontSize:'11px',fontWeight:'bold'}}>{siteSent?'✓ Sent!':'💼 Email Investor Site Access'}</button>
                <button onClick={handlePortalAccess} style={{flex:1,background:portalSent?'rgba(74,222,128,0.15)':'rgba(167,139,250,0.12)',color:portalSent?'#4ade80':'#a78bfa',border:`1px solid ${portalSent?'rgba(74,222,128,0.3)':'rgba(167,139,250,0.3)'}`,borderRadius:'4px',padding:'10px',cursor:'pointer',fontSize:'11px',fontWeight:'bold'}}>{portalSent?'✓ Portal Sent!':'🔐 Email Portal Access'}</button>
              </div>
            </div>
          )}

          {/* SITE STATS */}
          {cardTab==='sitestats'&&(
            <div>
              <div style={{color:GOLD,fontSize:'10px',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'14px'}}>📊 Mock Site Stats</div>
              {[['Portal Views','3'],['Time on Site','4m 22s'],['Documents Viewed','2'],['Last Visit','2 days ago'],['Downloads','1'],['Login Count','3']].map(([l,v])=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                  <span style={{color:'#6b7280',fontSize:'12px'}}>{l}</span>
                  <span style={{color:'#e8e0d0',fontSize:'12px',fontWeight:'bold'}}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* RESEARCH */}
          {cardTab==='research'&&(
            <div>
              <div style={{color:GOLD,fontSize:'10px',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'14px'}}>🔍 Mock Research Notes</div>
              <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'4px',padding:'16px',color:'#8a9ab8',fontSize:'12px',lineHeight:1.8}}>
                <div style={{color:GOLD,marginBottom:'8px',fontWeight:'bold'}}>{bobData.name} — Profile</div>
                <div>• Former contractor, turned real estate investor</div>
                <div>• Owns 12 rental units across Texas and Florida</div>
                <div>• Net Worth: Estimated $5M–$15M (HNW Accredited)</div>
                <div>• Past investments: 2 failed tech startups, 1 successful REIT fund</div>
                <div>• Known objections: AI hype, lack of government-backed data validation</div>
                <div style={{marginTop:'12px',color:GOLD}}>Key Insight:</div>
                <div>Responds best to data-backed claims and ROI clarity. Mention NWS/ArcGIS integration early. Skeptical of "AI magic" but trusts verified data sources.</div>
              </div>
            </div>
          )}

          {/* SCRIPT & AI — real GlobalScripts + "Connect Twilio Stream" button */}
          {cardTab==='script'&&(
            <div style={{display:'flex',flexDirection:'column',gap:'0',height:'100%'}}>
              <div style={{padding:'12px 0',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',gap:'10px',flexShrink:0,marginBottom:'14px'}}>
                <button onClick={handleConnectStream} style={{background:showAIPopup?'rgba(74,222,128,0.15)':`${GOLD}18`,color:showAIPopup?'#4ade80':GOLD,border:`1px solid ${showAIPopup?'rgba(74,222,128,0.3)':GOLD+'44'}`,borderRadius:'4px',padding:'8px 16px',cursor:'pointer',fontSize:'11px',fontWeight:'bold',letterSpacing:'1px',textTransform:'uppercase'}}>
                  {showAIPopup?'🟢 AI Assistant Active':'🔴 Connect Twilio Stream'}
                </button>
                <span style={{color:'#4a5568',fontSize:'10px'}}>Activates real-time Q&A, Coach, and Intent analysis</span>
              </div>

              {scripts.length>0&&(
                <div style={{marginBottom:'14px',flexShrink:0}}>
                  <label style={ls}>Script</label>
                  <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                    {scripts.map(s=>(
                      <button key={s.id} onClick={()=>setActiveScriptId(s.id)} style={{padding:'4px 12px',borderRadius:'20px',border:`1px solid ${activeScriptId===s.id?GOLD+'66':'rgba(255,255,255,0.1)'}`,background:activeScriptId===s.id?`${GOLD}18`:'transparent',color:activeScriptId===s.id?GOLD:'#6b7280',cursor:'pointer',fontSize:'11px'}}>{s.name}</button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{flex:1,overflowY:'auto',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:'4px',padding:'16px'}}>
                {activeScript?(
                  <div style={{color:activeScript.color||'#e8e0d0',fontSize:`${activeScript.fontSize||14}px`,lineHeight:1.8,whiteSpace:'pre-wrap',fontFamily:'Georgia, serif'}}>{activeScript.content}</div>
                ):scripts.length===0?(
                  <div style={{color:'#8a9ab8',fontSize:'12px',lineHeight:1.8}}>
                    <div style={{color:GOLD,fontSize:'11px',fontWeight:'bold',marginBottom:'6px'}}>Default Rosie AI Script (no GlobalScripts found):</div>
                    <strong style={{color:'#c4cdd8'}}>Opening:</strong> "Hey Bob, thanks for taking my call. I know you're busy — I'll be straight with you. We're Rosie AI, and what we've built is an automated lead generation engine specifically for solar and roofing contractors. We use NWS storm data to pinpoint homes that just got hit — and reach them before the competition does…"<br/><br/>
                    <strong style={{color:'#c4cdd8'}}>On Returns:</strong> "Our structure is a tiered waterfall — investors are paid back first before any profit splits. 8% preferred return, then capital returned, then upside."<br/><br/>
                    <strong style={{color:'#c4cdd8'}}>On Risk:</strong> "The minimum is $15,000. The structure protects you — you sit above management in the waterfall…"<br/><br/>
                    <strong style={{color:'#c4cdd8'}}>Close Signal:</strong> If BOB asks about minimums, portal, or wire instructions — ask for the commitment immediately.
                  </div>
                ):<div style={{color:'#4a5568',fontSize:'12px'}}>Select a script above.</div>}
              </div>
            </div>
          )}

          {/* AI DETAILS */}
          {cardTab==='aidetails'&&(
            <div>
              <div style={{color:GOLD,fontSize:'10px',letterSpacing:'2px',textTransform:'uppercase',marginBottom:'14px'}}>🤖 AI Training Details</div>
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                {[['Session',sessionLabel],['Persona Blend',sliderLabel],['Intensity',`${intensity}/5`],['Focus Topic',focusTopic],['Voice Model',voiceModel||'aura-zeus-en'],['Call Status',{idle:'Idle',ringing:'Ringing',connecting:'Connecting',active:'LIVE',error:'Error'}[phase]||phase],['Transcript Lines',`${transcript?.length||0} lines`]].map(([l,v])=>(
                  <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',background:'rgba(255,255,255,0.02)',borderRadius:'4px',border:'1px solid rgba(255,255,255,0.06)'}}>
                    <span style={{color:'#6b7280',fontSize:'12px'}}>{l}</span>
                    <span style={{color:'#e8e0d0',fontSize:'12px',fontWeight:'bold'}}>{v}</span>
                  </div>
                ))}
              </div>
              {transcript?.length>0&&(
                <div style={{marginTop:'16px'}}>
                  <div style={{color:GOLD,fontSize:'10px',letterSpacing:'1px',textTransform:'uppercase',marginBottom:'10px'}}>Live Transcript</div>
                  <div style={{maxHeight:'300px',overflowY:'auto',display:'flex',flexDirection:'column',gap:'8px'}}>
                    {transcript.slice(-20).map((msg,i)=>{
                      const isBob=msg.role==='bob';
                      return(
                        <div key={i} style={{display:'flex',gap:'8px',justifyContent:isBob?'flex-start':'flex-end'}}>
                          <div style={{maxWidth:'80%',background:isBob?'rgba(184,147,58,0.08)':'rgba(96,165,250,0.1)',border:`1px solid ${isBob?'rgba(184,147,58,0.2)':'rgba(96,165,250,0.2)'}`,borderRadius:isBob?'12px 12px 12px 2px':'12px 12px 2px 12px',padding:'8px 12px'}}>
                            <div style={{color:'#c4cdd8',fontSize:'12px',lineHeight:1.5}}>{msg.text}</div>
                            <div style={{color:'#4a5568',fontSize:'9px',marginTop:'3px'}}>{isBob?'🤖 BOB':'🎙 You'}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main BobTab ──────────────────────────────────────────────────────────────
export default function BobTab() {
  const [section,setSection]           = useState('training');
  const [trainingLogs,setTrainingLogs] = useState([]);
  const [kbEntries,setKbEntries]       = useState([]);
  const [callbacks,setCallbacks]       = useState([]);
  const [dgApiKey,setDgApiKey]         = useState('');
  const [personas,setPersonas]         = useState({duck:DEFAULT_DUCK,cow:DEFAULT_COW,owl:DEFAULT_OWL});
  const [sliderValue,setSliderValue]   = useState(0);
  const [intensity,setIntensity]       = useState(3);
  const [focusTopic,setFocusTopic]     = useState('General');
  const [callCount,setCallCount]       = useState(0);
  const [sessionId,setSessionId]       = useState('Bob');
  const [bobData,setBobData]           = useState(BOB_NAMES[0]);
  const [voiceModel,setVoiceModel]     = useState(VOICE_MODELS[0]);
  const [transcript,setTranscript]     = useState([]);
  const [previousTranscript,setPrevious] = useState([]);
  const [phase,setPhase]               = useState('idle');
  const [ringPhase,setRingPhase]       = useState(false);
  const [agentSpeaking,setAgentSpeaking] = useState(false);
  const [error,setError]               = useState('');

  const wsRef        = useRef(null);
  const audioCtxRef  = useRef(null);
  const micStreamRef = useRef(null);
  const processorRef = useRef(null);
  const nextStartRef = useRef(0);
  const listeningRef = useRef(false);
  const ring = useRingTone();

  useEffect(()=>{base44.entities.KnowledgeBase.list('-created_date',500).then(all=>setKbEntries(all||[])).catch(()=>{});}, []);

  const addLog = useCallback((entry)=>{setTrainingLogs(prev=>[...prev,{...entry,sessionId}]);},[sessionId]);
  const handleTranscriptEntry = useCallback((entry)=>{setTranscript(prev=>[...prev,entry]);},[]);

  const getActivePersona = useCallback(()=>{
    if(sliderValue<33)return personas.duck;
    if(sliderValue<67)return personas.owl;
    return personas.cow;
  },[sliderValue,personas]);

  const buildSystemPrompt = useCallback(()=>{
    const kbText=kbEntries.filter(e=>e.category!=='raw_document').slice(0,30).map(e=>`Q: ${e.question}\nA: ${e.answer}`).join('\n\n');
    const sliderLabel=sliderValue<20?'full Duck mode':sliderValue<40?'Duck-leaning Owl':sliderValue<60?'pure Owl/Hybrid':sliderValue<80?'Cow-leaning Owl':'full Cow mode';
    const prevCtx=previousTranscript?.length>0?`\n\nPREVIOUS CALL CONTEXT — You remember this conversation:\n${previousTranscript.slice(-10).map(e=>`[${e.role.toUpperCase()}]: ${e.text}`).join('\n')}\nReference it naturally when the trainee calls back.`:'';
    const ap=getActivePersona();
    return`${ap.systemPrompt}

━━━ CURRENT SESSION SETTINGS ━━━
- Persona Blend: ${sliderLabel} (slider ${sliderValue}/100 — 0=full Duck, 50=Owl, 100=full Cow)
- Intensity: ${intensity}/5 (higher = more extreme character behavior)
- Call Focus Topic: "${focusTopic}" — steer objections and interest toward this topic
- Your name this session: ${bobData.name.split(' ').find(w => w.replace(/['"]/g,'') === 'Bob') || bobData.name.split('"')[1] || 'Bob'}
- Your full name: ${bobData.name}
- Your company: ${bobData.company}

━━━ IMPORTANT CALL FLOW NOTE ━━━
The trainee (salesperson) will always open with something like:
"This is [their name] with Rosie AI — I hope I haven't caught you at a bad time."
React to this naturally based on your persona (Duck = friction, Cow = warm/open, Owl = neutral/efficient).
Do NOT launch into your opinions before they introduce themselves — follow the CALL OPENING FLOW above.

━━━ ROSIE AI KNOWLEDGE BASE ━━━
${kbText||'General knowledge about AI investment platforms and private placements.'}
${prevCtx}

━━━ CRITICAL RULES ━━━
- You are a REAL PERSON on a phone call. Keep ALL responses 1-3 sentences.
- Never say you are an AI. Never break character.
- Use natural speech: contractions, interruptions, "uh", "look", "listen", "I mean" — real people talk like this.
- React to what the trainee actually says — improvise within your persona, don't just recite lines.`;
  },[sliderValue,intensity,focusTopic,kbEntries,bobData,getActivePersona,previousTranscript]);

  const buildSettings = useCallback(()=>{
    // Bob's first word when he picks up — just "Hello." like a real person answering.
    // Everything after (confirming it's Bob, reacting to the intro) is handled by the AI.
    const pickupGreetings = [
      'Hello.',
      'Hello?',
      'Hello, this is Bob.',
      'Hello.',
      'Hello?',
      'Hello.',
    ];
    const greeting = pickupGreetings[Math.floor(Math.random() * pickupGreetings.length)];
    return{
      type:'Settings',
      audio:{input:{encoding:'linear16',sample_rate:24000},output:{encoding:'linear16',sample_rate:24000,container:'none'}},
      agent:{
        listen:{provider:{type:'deepgram',version:'v1',model:'nova-3-flux',language:'en-US'}},
        think:[{provider:{type:'google',version:'v1',model:'gemini-2.5-flash'},prompt:buildSystemPrompt()}],
        speak:{provider:{type:'deepgram',version:'v1',model:voiceModel}},
        greeting,
      },
    };
  },[buildSystemPrompt,voiceModel,getActivePersona]);

  const playChunk = useCallback((buf)=>{
    const ctx=audioCtxRef.current;if(!ctx)return;
    const int16=new Int16Array(buf);const f32=new Float32Array(int16.length);
    for(let i=0;i<int16.length;i++)f32[i]=int16[i]/32768.0;
    const ab=ctx.createBuffer(1,f32.length,24000);ab.copyToChannel(f32,0);
    const src=ctx.createBufferSource();src.buffer=ab;src.connect(ctx.destination);
    const now=ctx.currentTime;
    if(nextStartRef.current<now)nextStartRef.current=now+0.05;
    src.start(nextStartRef.current);nextStartRef.current+=ab.duration;
    src.onended=()=>{if(ctx.currentTime>=nextStartRef.current-0.01)setAgentSpeaking(false);};
  },[]);

  const startCall = useCallback(async()=>{
    const newCount=callCount+1;
    setCallCount(newCount);
    const label=newCount===1?'Bob':`Bob${newCount-1}`;
    setSessionId(label);
    const bobIdx=(newCount-1)%BOB_NAMES.length;
    const vIdx=(newCount-1)%VOICE_MODELS.length;
    setBobData(BOB_NAMES[bobIdx]);
    setVoiceModel(VOICE_MODELS[vIdx]);
    if(transcript.length>0)setPrevious(transcript);
    setTranscript([]);setError('');setPhase('ringing');setRingPhase(true);
    addLog({type:'session_start',content:`📞 ${label} started. Persona: ${getActivePersona().name}, Focus: ${focusTopic}, Voice: ${VOICE_MODELS[vIdx]}`,time:new Date().toISOString()});

    ring.play(async()=>{
      setRingPhase(false);setPhase('connecting');
      const apiKey=dgApiKey||'44294c0c2f0ebbcc81b853151056111226b853e9';
      let stream;
      try{stream=await navigator.mediaDevices.getUserMedia({audio:true});micStreamRef.current=stream;}
      catch{setError('Mic access denied.');setPhase('error');return;}
      const ctx=new(window.AudioContext||window.webkitAudioContext)({sampleRate:24000});
      audioCtxRef.current=ctx;nextStartRef.current=0;
      const ws=new WebSocket(DG_WS_URL,['token',apiKey]);
      ws.binaryType='arraybuffer';wsRef.current=ws;
      ws.onmessage=(e)=>{
        if(e.data instanceof ArrayBuffer){setAgentSpeaking(true);playChunk(e.data);return;}
        try{
          const msg=JSON.parse(e.data);
          switch(msg.type){
            case'Welcome':ws.send(JSON.stringify(buildSettings()));break;
            case'SettingsApplied':{
              setPhase('active');
              const source=ctx.createMediaStreamSource(stream);
              const processor=ctx.createScriptProcessor(4096,1,1);
              processorRef.current=processor;
              processor.onaudioprocess=(ev)=>{
                if(ws.readyState!==WebSocket.OPEN||!listeningRef.current)return;
                const input=ev.inputBuffer.getChannelData(0);
                const int16=new Int16Array(input.length);
                for(let i=0;i<input.length;i++){const s=Math.max(-1,Math.min(1,input[i]));int16[i]=s<0?s*0x8000:s*0x7FFF;}
                ws.send(int16.buffer);
              };
              source.connect(processor);
              const silence=ctx.createGain();silence.gain.value=0;
              processor.connect(silence);silence.connect(ctx.destination);
              break;
            }
            case'AgentAudioDone':listeningRef.current=true;break;
            case'ConversationText':{
              const entry={role:msg.role==='user'?'trainee':'bob',text:msg.content,time:new Date().toISOString()};
              handleTranscriptEntry(entry);
              addLog({type:'transcript',content:`[${entry.role==='bob'?'🤖 BOB':'🎙 TRAINEE'}] ${msg.content}`,time:new Date().toISOString()});
              break;
            }
            case'UserStartedSpeaking':try{if(audioCtxRef.current)nextStartRef.current=0;}catch{}setAgentSpeaking(false);break;
          }
        }catch{}
      };
      ws.onclose=()=>{setPhase('idle');ring.stop();cleanup(false);addLog({type:'session_end',content:`📵 ${label} ended.`,time:new Date().toISOString()});};
    });
  },[callCount,transcript,addLog,dgApiKey,buildSettings,playChunk,ring,getActivePersona,focusTopic,handleTranscriptEntry]);

  const cleanup=useCallback((updatePhase=true)=>{
    listeningRef.current=false;
    if(processorRef.current){try{processorRef.current.disconnect();}catch{}}
    if(micStreamRef.current)micStreamRef.current.getTracks().forEach(t=>t.stop());
    if(wsRef.current){try{wsRef.current.close();}catch{}}
    if(audioCtxRef.current){try{audioCtxRef.current.close();}catch{}}
    audioCtxRef.current=null;micStreamRef.current=null;wsRef.current=null;
    if(updatePhase)setPhase('idle');
    ring.stop();
  },[ring]);

  const hangup=useCallback(()=>{cleanup(true);},[cleanup]);

  const handleBookCallback=useCallback((data)=>{
    setCallbacks(prev=>[...prev,{...data,transcriptLength:transcript.length,previousTranscript:transcript}]);
  },[transcript]);

  const handleResumeCallback=useCallback((cb)=>{
    setBobData({name:cb.name,company:cb.company,email:cb.email,phone:cb.phone,address:cb.address});
    setPrevious(cb.previousTranscript||[]);
    setSection('training');
    addLog({type:'session_start',content:`🔄 Resuming callback with ${cb.name}. ${cb.transcriptLength} previous lines loaded.`,time:new Date().toISOString()});
  },[addLog]);

  const SECTIONS=[
    {id:'training',label:'🎓 Training Room'},
    {id:'callbacks',label:`📅 Callbacks${callbacks.length>0?` (${callbacks.length})`:''}` },
    {id:'log',label:`📋 Log${trainingLogs.length>0?` (${trainingLogs.length})`:''}` },
    {id:'kb',label:'🧠 Knowledge Base'},
    {id:'controls',label:'⚙️ BOB Controls'},
  ];

  return(
    <div style={{fontFamily:'Georgia, serif'}}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      <div style={{marginBottom:'20px',padding:'16px 20px',background:'rgba(184,147,58,0.05)',border:'1px solid rgba(184,147,58,0.15)',borderRadius:'4px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'4px'}}>
            <div style={{fontSize:'24px'}}>🤖</div>
            <div>
              <h2 style={{color:'#e8e0d0',margin:0,fontSize:'18px',fontWeight:'normal'}}>B.O.B. — Bot-Operated Buyer</h2>
              <div style={{color:GOLD,fontSize:'10px',letterSpacing:'2px',textTransform:'uppercase'}}>Sales Training Simulator</div>
            </div>
          </div>
          <div style={{color:'#6b7280',fontSize:'11px'}}>Practice your Rosie AI investor pitch against Duck, Cow, or Owl personas. Real Deepgram voice · Real AI · Real scripts.</div>
        </div>
        <div style={{display:'flex',gap:'8px',flexShrink:0}}>
          {phase==='active'&&<div style={{display:'flex',alignItems:'center',gap:'6px',background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'20px',padding:'6px 14px'}}><div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#ef4444',animation:'pulse 1s infinite'}}/><span style={{color:'#ef4444',fontSize:'11px',fontWeight:'bold'}}>{sessionId} LIVE</span></div>}
          <div style={{background:'rgba(184,147,58,0.12)',border:'1px solid rgba(184,147,58,0.3)',borderRadius:'4px',padding:'8px 14px',textAlign:'center'}}><div style={{color:GOLD,fontSize:'18px',fontWeight:'bold'}}>{callCount}</div><div style={{color:'#6b7280',fontSize:'9px',textTransform:'uppercase',letterSpacing:'1px'}}>Calls</div></div>
          <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'4px',padding:'8px 14px',textAlign:'center'}}><div style={{color:'#e8e0d0',fontSize:'18px',fontWeight:'bold'}}>{trainingLogs.length}</div><div style={{color:'#6b7280',fontSize:'9px',textTransform:'uppercase',letterSpacing:'1px'}}>Events</div></div>
        </div>
      </div>

      <div style={{display:'flex',gap:'2px',marginBottom:'20px',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
        {SECTIONS.map(s=>(
          <button key={s.id} onClick={()=>setSection(s.id)} style={{padding:'10px 16px',background:section===s.id?'rgba(184,147,58,0.08)':'transparent',border:'none',borderBottom:`2px solid ${section===s.id?GOLD:'transparent'}`,color:section===s.id?GOLD:'#6b7280',cursor:'pointer',fontSize:'12px',fontWeight:section===s.id?'bold':'normal',whiteSpace:'nowrap'}}>{s.label}</button>
        ))}
      </div>

      {section==='training'&&(
        <MockLeadCard
          bobData={bobData} sessionLabel={sessionId}
          personas={personas} sliderValue={sliderValue} onSliderChange={setSliderValue}
          intensity={intensity} onIntensityChange={setIntensity}
          focusTopic={focusTopic} onFocusChange={setFocusTopic}
          voiceModel={voiceModel}
          phase={phase} agentSpeaking={agentSpeaking} ringPhase={ringPhase} error={error}
          transcript={transcript} kbEntries={kbEntries}
          onSessionEvent={addLog} addLog={addLog} sessionId={sessionId}
          onStartCall={startCall} onHangup={hangup}
          onBookCallback={handleBookCallback}
        />
      )}
      {section==='callbacks'&&<CallbacksTab callbacks={callbacks} onResume={handleResumeCallback}/>}
      {section==='log'&&<TrainingLog logs={trainingLogs} onClear={()=>{if(window.confirm('Clear all logs?'))setTrainingLogs([]);}}/>}
      {section==='kb'&&<BobKB/>}
      {section==='controls'&&<BobControls personas={personas} onPersonasChange={setPersonas} dgApiKey={dgApiKey} onDgKeyChange={setDgApiKey}/>}
    </div>
  );
}