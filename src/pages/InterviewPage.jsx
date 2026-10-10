/**
 * InterviewPage.jsx — Streamlined step-by-step interview wizard for hiring fronters.
 * Steps: 1 Name → 2 Contact → 3 Company Background → 4 Experience → 5 Job Details
 * → 6 Credential Setup → 7 Complete. Includes AI assistant, answer recording at each
 * step, and a full details summary for the interviewer on completion.
 * Requires super admin access.
 */
import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { base44 } from '@/api/base44Client';
import InterviewAssistant from '@/components/interviews/InterviewAssistant';
import InterviewAudioRecorder from '@/components/interviews/InterviewAudioRecorder';
import CandidateNotesBox from '@/components/interviews/CandidateNotesBox';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };
const scriptBox = { background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '8px', padding: '20px 24px', color: '#e8e0d0', fontSize: '15px', lineHeight: 1.8, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' };
const answerBox = { background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '8px', padding: '16px 20px', marginTop: '16px' };
const btnGold = { background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '6px', padding: '10px 28px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' };
const btnGhost = { background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '10px 24px', cursor: 'pointer', fontSize: '14px' };
const btnPass = { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '10px 24px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' };

const STEP_LABELS = ['Start', 'Name', 'Contact', 'Company', 'Opportunity', 'Experience', 'Job Details', 'Credentials', 'Complete'];

export default function InterviewPage() {
  const { user, loading, isAuthenticated, isSuperAdmin, logout } = useDebtCoachAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    firstName: '', lastName: '', telegramId: '', email: '', notes: '',
    responses: { companyReaction: '', phoneExperience: '', scriptComfort: '', canStart: '', candidateQuestions: '', opportunityReaction: '', trainingAttendance: '' },
    candidateRating: 0, candidateNotes: '',
  });
  const [credForm, setCredForm] = useState({ firstName: '', lastName: '', username: '', password: 'fronter2026!!', email: '' });
  const [saving, setSaving] = useState(false);
  const [hireResult, setHireResult] = useState(null);
  const [recentInterviews, setRecentInterviews] = useState([]);
  const [audioFileUri, setAudioFileUri] = useState('');

  useEffect(() => {
    if (step === 0) {
      base44.entities.Interview.list('-created_date', 10).then(all => {
        setRecentInterviews(Array.isArray(all) ? all : (all?.items || []));
      }).catch(() => {});
    }
  }, [step]);

  useEffect(() => {
    if (step === 7 && !credForm.username) {
      const auto = (data.firstName + (data.lastName[0] || '')).toLowerCase();
      setCredForm({ firstName: data.firstName, lastName: data.lastName, username: auto, password: 'fronter2026!!', email: data.email });
    }
  }, [step]); // eslint-disable-line

  if (loading) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6b7280', fontSize: '14px' }}>Loading…</div>
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/debt-call-coach-login" replace />;
  if (!isSuperAdmin) return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', fontFamily: 'Georgia, serif' }}>
      <div style={{ color: RED, fontSize: '18px', fontWeight: 'bold' }}>Access Denied</div>
      <div style={{ color: '#8a9ab8', fontSize: '14px' }}>Super admin access required to conduct interviews.</div>
      <button onClick={() => navigate('/debt-call-coach-login')} style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}44`, borderRadius: '4px', padding: '8px 18px', cursor: 'pointer', fontSize: '13px' }}>Go to Login</button>
    </div>
  );

  const updateResp = (field, value) => setData(prev => ({ ...prev, responses: { ...prev.responses, [field]: value } }));

  const saveInterview = async (status, extra = {}) => {
    await base44.entities.Interview.create({
      firstName: data.firstName, lastName: data.lastName, telegramId: data.telegramId, email: data.email,
      status, notes: data.notes, responsesJson: JSON.stringify(data.responses), createdBy: user.username,
      audioFileUri: audioFileUri || '', ...extra,
    });
  };

  const hireCandidate = async () => {
    if (!credForm.firstName.trim() || !credForm.lastName.trim() || !credForm.username.trim() || !credForm.email.trim()) return;
    setSaving(true);
    try {
      const existing = await base44.entities.DebtCoachUser.filter({ username: credForm.username.trim() });
      if (existing && existing.length > 0) { alert('Username already exists. Please choose a different one.'); setSaving(false); return; }
      const hashRes = await base44.functions.invoke('hashPassword', { action: 'hash', password: credForm.password });
      const hash = hashRes?.data?.hash || hashRes?.hash;
      if (!hash) throw new Error('Password hashing failed');
      await base44.entities.DebtCoachUser.create({
        username: credForm.username.trim(), firstName: credForm.firstName.trim(), lastName: credForm.lastName.trim(),
        email: credForm.email.trim(), passwordHash: hash, role: 'fronter', isActive: true, mustResetPassword: true, createdBy: user.username,
      });
      try {
        await base44.integrations.Core.SendEmail({
          to: credForm.email.trim(),
          subject: 'Welcome to the Team — Login Instructions & Training Schedule',
          html: `<div style="font-family:Georgia,serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
<h2 style="color:#10b981;margin-bottom:20px;">Welcome to the Team, ${credForm.firstName}!</h2>
<p>Congratulations on a successful interview. Here are your login instructions and training schedule.</p>
<h3 style="color:#0a0f1e;border-bottom:2px solid #10b981;padding-bottom:4px;margin-top:24px;">Login Instructions</h3>
<p><strong>Login URL:</strong> https://rosieai-investorpage.base44.app/debt-call-coach-login</p>
<p><strong>Username:</strong> ${credForm.username}</p>
<p><strong>Password:</strong> ${credForm.password}</p>
<p style="color:#e53e3e;"><em>You will be required to change your password on first login.</em></p>
<h3 style="color:#0a0f1e;border-bottom:2px solid #10b981;padding-bottom:4px;margin-top:24px;">Training Schedule</h3>
<p><strong>Training Class 1:</strong> Tonight at 8:30 PM EST</p>
<p>A Zoom link will be sent to your email shortly.</p>
<p><strong>Training Class 2:</strong> Tomorrow at 12:00 PM EST (if you can't make tonight's class)</p>
<h3 style="color:#0a0f1e;border-bottom:2px solid #10b981;padding-bottom:4px;margin-top:24px;">Important Dates</h3>
<p>You must be fully trained by tomorrow, October 11th.</p>
<p>Your working hours: 11:00 AM - 7:30 PM EST, Monday.</p>
<h3 style="color:#0a0f1e;border-bottom:2px solid #10b981;padding-bottom:4px;margin-top:24px;">What to Expect on First Login</h3>
<p>When you log in for the first time, you will:</p>
<ol>
<li>Fill out a form with your details</li>
<li>Review and sign a dialer agreement covering all specifics of your employment</li>
<li>The agreement will be automatically counter-signed</li>
<li>You will be emailed a copy or you can download it</li>
</ol>
<p style="margin-top:24px;">We look forward to having you on the team!</p>
<p style="color:#6b7280;font-size:12px;">Rosie AI Team</p>
</div>`,
        });
      } catch (e) { console.warn('Email send failed:', e?.message || String(e)); }
      await saveInterview('hired', { hiredUsername: credForm.username.trim() });
      setHireResult('hired');
      setStep(8);
    } catch (e) { alert('Failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const passForNow = async () => {
    setSaving(true);
    try { await saveInterview('passed'); setHireResult('passed'); setStep(8); }
    catch (e) { alert('Failed: ' + (e?.message || String(e))); }
    setSaving(false);
  };

  const resetInterview = () => {
    setStep(0);
    setData({ firstName: '', lastName: '', telegramId: '', email: '', notes: '', responses: { companyReaction: '', phoneExperience: '', scriptComfort: '', canStart: '', candidateQuestions: '', opportunityReaction: '', trainingAttendance: '' }, candidateRating: 0, candidateNotes: '' });
    setCredForm({ firstName: '', lastName: '', username: '', password: 'fronter2026!!', email: '' });
    setHireResult(null);
    setAudioFileUri('');
  };

  const next = () => setStep(s => Math.min(s + 1, 8));
  const back = () => setStep(s => Math.max(s - 1, 0));
  const canNextName = data.firstName.trim() && data.lastName.trim();
  const canNextContact = data.telegramId.trim() && data.email.trim();
  const canHire = credForm.firstName.trim() && credForm.lastName.trim() && credForm.username.trim() && credForm.email.trim();

  return (
    <div style={{ minHeight: '100vh', background: DARK, fontFamily: 'Georgia, serif', color: '#e8e0d0' }}>
      {/* Header */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ color: GOLD, fontSize: '18px', fontWeight: 'bold', letterSpacing: '2px' }}>INTERVIEWS</div>
          <span style={{ color: '#6b7280', fontSize: '12px' }}>|</span>
          <span style={{ color: '#8a9ab8', fontSize: '13px' }}>{user?.username}</span>
          <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(16,185,129,0.15)', color: GOLD, fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>Super Admin</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate('/fronter')} style={{ background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>← Fronter Dashboard</button>
          <button onClick={() => { logout(); navigate('/debt-call-coach-login', { replace: true }); }} style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '6px 14px', cursor: 'pointer', fontSize: '11px' }}>Logout</button>
        </div>
      </div>

      {/* Progress indicator */}
      {step > 0 && step < 8 && (
        <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {STEP_LABELS.slice(1, 8).map((label, i) => {
            const stepNum = i + 1;
            const isActive = step === stepNum;
            const isDone = step > stepNum;
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', background: isActive ? GOLD : isDone ? `${GOLD}33` : 'rgba(255,255,255,0.05)', color: isActive ? DARK : isDone ? GOLD : '#6b7280', border: `1px solid ${isActive ? GOLD : isDone ? `${GOLD}44` : 'rgba(255,255,255,0.1)'}` }}>{isDone ? '✓' : stepNum}</div>
                <span style={{ color: isActive ? GOLD : '#6b7280', fontSize: '11px', fontWeight: isActive ? 'bold' : 'normal' }}>{label}</span>
                {i < 6 && <div style={{ width: '20px', height: '1px', background: isDone ? `${GOLD}44` : 'rgba(255,255,255,0.1)' }} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '40px 24px 100px' }}>
        {/* Step 0: Start */}
        {step === 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎤</div>
            <h1 style={{ color: '#e8e0d0', fontSize: '28px', marginBottom: '8px' }}>Interview Portal</h1>
            <p style={{ color: '#8a9ab8', fontSize: '15px', marginBottom: '32px' }}>Conduct a step-by-step interview and hire new fronters. The AI assistant is available throughout to help you.</p>
            <button onClick={next} style={{ ...btnGold, fontSize: '16px', padding: '14px 40px' }}>▶ Start Interview</button>
            {recentInterviews.length > 0 && (
              <div style={{ marginTop: '40px', textAlign: 'left' }}>
                <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>Recent Interviews</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {recentInterviews.map(iv => (
                    <div key={iv.id} style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ color: '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{iv.firstName} {iv.lastName}</span>
                        {iv.telegramId && <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '8px' }}>TG: {iv.telegramId}</span>}
                        {iv.email && <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: '8px' }}>{iv.email}</span>}
                      </div>
                      <span style={{ padding: '2px 10px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', background: iv.status === 'hired' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: iv.status === 'hired' ? GOLD : '#f59e0b' }}>{iv.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Name */}
        {step === 1 && (
          <div>
            <StepHeader num={1} title="Candidate Name" instruction="Read the introduction to the candidate, then enter their name and rate them." />
            {/* Introduction script */}
            <div style={{ ...scriptBox, marginBottom: '20px', position: 'relative' }}>
              <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>🎙️ Introduction — Read to Candidate</div>
              <div style={{ color: '#e8e0d0', fontSize: '14px', lineHeight: 1.8, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>{`<Candidate Name>, thank you so much for taking this interview. I am excited to talk to you about the position. So a little bit about me and the company. I am one of the founding managing partners. We built a very unique AI CRM sales training and sales agent solution. Today we are doing use case studies, but real world examples, so every choice counts, ok? We are only looking for top tier phone jockeys that wanna make some real money. You prove that you are worthy and talented, we will create a pathway for great success for you, and that's a promise.

So today, I am going to go through some basic information, and onboard you into our CRM with a new username and password. Then I will need you to attend training either tonight at 8:30 PM EST or tomorrow at 1:00 PM EST. Training will only last 30-60 min. Why so short you ask? Are we on our own? Not even close! You see, here at Rosie, we built a suite of sales and training tools that are fully automated. So when you train and work on your pitch, instead of roleplaying with your boss, you will be pitching BOB — our in-house AI agent and our forever customer to train with. It's that easy. Also, we have a live Q&A — we are talking real time analysis of your calls, and when BOB or a real customer asks a question, within a second, the exact answer, ready for you to tell the customer, is right before your eyes. Yeah, Rosie is a little cheater, buttttt you're always gonna be on point.

So, I said a lot. I wanna know more about you. First I need the spelling of your first and last name, and tell me where you're from, and have you ever traveled to the United States?`}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div><label style={ls}>First Name *</label><input value={data.firstName} onChange={e => setData(p => ({ ...p, firstName: e.target.value }))} style={inp} placeholder="John" /></div>
              <div><label style={ls}>Last Name *</label><input value={data.lastName} onChange={e => setData(p => ({ ...p, lastName: e.target.value }))} style={inp} placeholder="Smith" /></div>
            </div>
            {/* Candidate Notes with star rating */}
            <CandidateNotesBox rating={data.candidateRating || 0} notes={data.candidateNotes || ''} onRatingChange={v => setData(p => ({ ...p, candidateRating: v }))} onNotesChange={v => setData(p => ({ ...p, candidateNotes: v }))} />
            <NavButtons onBack={back} onNext={next} nextDisabled={!canNextName} />
          </div>
        )}

        {/* Step 2: Contact */}
        {step === 2 && (
          <div>
            <StepHeader num={2} title="Contact Information" instruction="Read the phone sales script, then confirm the candidate's Telegram ID and email." />
            <div style={{ ...scriptBox, marginBottom: '20px' }}>
              <div style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px' }}>🎙️ Read to Candidate — Phone Sales Experience</div>
              <div style={{ color: '#e8e0d0', fontSize: '14px', lineHeight: 1.8, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>{`So tell me about your experience working the phones, talking to customers, selling customers a solution, and the art of overcoming objections!

Let them talk.....

What do you feel is most challenging about phone sales?

Well, I think you're going to be very excited when you see our system fully at work. An average smart person can take 2 weeks of intense training and condense it into 3 days with our system.

We provide you not just with knowledge at the tip of your fingers, but CONFIDENCE — one of the biggest traits required to make consistent sales. Your customer asks a question, there is no hesitation. You always reply with, "that's a great question, and I'm definitely going to give you a complete answer." Again, great question.

Now at this point, that's been enough time for your personal AI agent to query the intense knowledge base I have built. It gets a full, verbatim answer in about 2 seconds. It will pop up on the screen, ready to read word for word. No stressing, looking through notes. Just pure confidence — the most important thing a consumer looks for in a phone sales person.`}</div>
            </div>
            <div style={{ marginBottom: '14px' }}><label style={ls}>Telegram ID *</label><input value={data.telegramId} onChange={e => setData(p => ({ ...p, telegramId: e.target.value }))} style={inp} placeholder="@username" /></div>
            <div style={{ marginBottom: '24px' }}><label style={ls}>Email Address *</label><input type="email" value={data.email} onChange={e => setData(p => ({ ...p, email: e.target.value }))} style={inp} placeholder="name@example.com" /></div>
            <NavButtons onBack={back} onNext={next} nextDisabled={!canNextContact} />
          </div>
        )}

        {/* Step 3: Company Background */}
        {step === 3 && (
          <div>
            <StepHeader num={3} title="Company Background" instruction="Read this to the candidate, then record their reaction below." />
            <div style={{ ...scriptBox, whiteSpace: 'normal' }}>
              <div style={{ color: GOLD, fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>Our Use Case, This Opportunity, and the Path Forward</div>
              <div style={{ marginBottom: '16px' }}>This is our initial use case, and this gig is what will help build the momentum needed to license the app. For the right candidate, this could be an incredible opportunity to grow with a new startup and work toward becoming a senior member of the team as we expand.</div>
              <div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>What This Gig Is All About</div>
              <div style={{ marginBottom: '12px' }}>We operate in the debt settlement industry. Due to compliance requirements, our callers cannot directly pitch the company's name or its specific services during the initial conversation. Instead, your job is to introduce the general concept of debt relief, identify consumers who may benefit from exploring their options, and then connect them with Chris Bongiorno, a Senior Debt Specialist at the company.</div>
              <div style={{ marginBottom: '12px' }}>We're looking for experienced phone jockeys — people who know how to control a conversation, build rapport quickly, handle objections confidently, and keep a call moving toward its intended outcome.</div>
              <div style={{ marginBottom: '12px' }}>Here's the important part: you're not responsible for selling or closing a debt settlement program. Your job is to connect the right consumer with the right specialist.</div>
              <div style={{ marginBottom: '12px' }}>Think about it: we're reaching people who may be struggling under the weight of high-interest debt and looking for a way forward. Our team helps connect those consumers with an established company that can evaluate their situation and determine whether debt settlement could help them reduce their overall debt, improve their monthly cash flow, and work toward becoming debt-free.</div>
              <div style={{ marginBottom: '12px' }}>For consumers who qualify, some programs may begin improving their monthly cash flow within weeks, depending on their circumstances and program terms.</div>
              <div>We're also connecting consumers with a company that has built a strong reputation in the industry. According to our information, the company finished second nationwide last year in the annual Better Business Bureau ethics awards. That's a significant distinction, provided we can verify the award and its exact ranking.</div>
            </div>
            <div style={answerBox}>
              <label style={{ ...ls, color: BLUE }}>✍️ Candidate's Reaction / Response</label>
              <textarea value={data.responses.companyReaction} onChange={e => updateResp('companyReaction', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical', marginTop: '6px' }} placeholder="How did they react? Any questions about the company?" />
            </div>
            <NavButtons onBack={back} onNext={next} />
          </div>
        )}

        {/* Step 4: Opportunity */}
        {step === 4 && (
          <div>
            <StepHeader num={4} title="Why This Opportunity Is Different" instruction="Read this to the candidate, then ask the question and record their response." />
            <div style={{ ...scriptBox, whiteSpace: 'normal' }}>
              <div style={{ marginBottom: '14px' }}>We're not simply looking for someone to read a script. We want people who understand how to have a real conversation, listen to the person on the other end of the phone, recognize a potential opportunity, and confidently guide that person to the next step.</div>
              <div style={{ marginBottom: '14px' }}>If you have experience in cold calling, lead generation, appointment setting, or high-volume outbound calling, this could be an excellent fit.</div>
              <div style={{ marginBottom: '14px' }}>And there's a bigger picture here.</div>
              <div style={{ marginBottom: '14px' }}>This initial campaign is the use case that can help demonstrate the app's value, generate traction, and build momentum toward licensing the technology. We're building something with room to grow, and we want the right people involved from the beginning.</div>
              <div>For the right candidate, this isn't just another phone job. It's an opportunity to prove yourself, contribute to a growing startup, and potentially earn a place as a senior member of the team as the business develops.</div>
            </div>
            <div style={answerBox}>
              <label style={{ ...ls, color: BLUE }}>✍️ Question to Ask the Candidate</label>
              <div style={{ color: '#e8e0d0', fontSize: '14px', lineHeight: 1.8, fontFamily: 'Georgia, serif', marginBottom: '10px', fontStyle: 'italic' }}>So what do you think so far, does this sound like something you would be willing to put 150% effort into? We are looking for 3 people. 3 people that are willing to work hard, willing to grind, willing to take their expertise and strength, and onboard new people every single day.</div>
              <textarea value={data.responses.opportunityReaction} onChange={e => updateResp('opportunityReaction', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical', marginTop: '6px' }} placeholder="Record the candidate's response…" />
            </div>
            <NavButtons onBack={back} onNext={next} />
          </div>
        )}

        {/* Step 5: Experience */}
        {step === 5 && (
          <div>
            <StepHeader num={4} title="Experience & Skills" instruction="Ask these questions, then record the candidate's answers below." />
            <div style={scriptBox}>{`So tell me a little bit about your experience working on the phone, handling objections...

Are you comfortable reading a script?

Ok cool, well look, the best part is that we have an advanced CRM that is hyper focused on giving agents live realtime support as your potential customers ask questions...

Our AI tools will make your job a lot easier.`}</div>
            <div style={answerBox}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ ...ls, color: BLUE }}>✍️ Phone Experience & Objection Handling</label>
                <textarea value={data.responses.phoneExperience} onChange={e => updateResp('phoneExperience', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical', marginTop: '6px' }} placeholder="What experience do they have? How did they describe objection handling?" />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ ...ls, color: BLUE }}>✍️ Comfortable Reading a Script?</label>
                <select value={data.responses.scriptComfort} onChange={e => updateResp('scriptComfort', e.target.value)} style={{ ...inp, marginTop: '6px' }}>
                  <option value="">— Select —</option>
                  <option value="yes">Yes — comfortable</option>
                  <option value="hesitant">Hesitant but willing</option>
                  <option value="no">No — not comfortable</option>
                </select>
              </div>
              <div>
                <label style={{ ...ls, color: BLUE }}>✍️ Additional Notes</label>
                <textarea value={data.notes} onChange={e => setData(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical', marginTop: '6px' }} placeholder="Any other observations about the candidate…" />
              </div>
            </div>
            <NavButtons onBack={back} onNext={next} />
          </div>
        )}

        {/* Step 6: Job Details */}
        {step === 6 && (
          <div>
            <StepHeader num={5} title="Job Details & Availability" instruction="Read this to the candidate, then record their availability and any questions." />
            <div style={scriptBox}>{`So, when could you start? We are looking for people to train later today and tomorrow and Monday morning hit the ground running.

The job pays $300 per month, payments made on the 1st and 15th of the month. There are daily deal and volume bonuses as well. You can make a lot of money. All of the details on the bonuses are on the portal I am going to get you into today. When you log in for the first time, it will have you fill out a form, and then it will bring you to a dialer agreement that goes through all the specifics of your employment.

Once you sign that, it's automatically counter-signed, and you will be emailed a copy or you can download it.`}</div>
            <div style={answerBox}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ ...ls, color: BLUE }}>✍️ When Can They Start?</label>
                <input value={data.responses.canStart} onChange={e => updateResp('canStart', e.target.value)} style={{ ...inp, marginTop: '6px' }} placeholder="e.g. Today, Tomorrow, Monday…" />
              </div>
              <div>
                <label style={{ ...ls, color: BLUE }}>✍️ Candidate's Questions / Concerns</label>
                <textarea value={data.responses.candidateQuestions} onChange={e => updateResp('candidateQuestions', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical', marginTop: '6px' }} placeholder="Any questions they asked about the job, pay, or training?" />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ ...ls, color: BLUE }}>✍️ Can They Make the Training?</label>
                <select value={data.responses.trainingAttendance} onChange={e => updateResp('trainingAttendance', e.target.value)} style={{ ...inp, marginTop: '6px' }}>
                  <option value="">— Select —</option>
                  <option value="tonight_830">Yes — 8:30 PM EST tonight</option>
                  <option value="tomorrow_1pm">Yes — 1:00 PM EST tomorrow</option>
                  <option value="both">Yes — Both work</option>
                  <option value="neither">No — Neither works</option>
                </select>
              </div>
            </div>
            <NavButtons onBack={back} onNext={next} />
          </div>
        )}

        {/* Step 7: Credential Setup */}
        {step === 7 && (
          <div>
            <StepHeader num={6} title="Credential Setup" instruction="Review the candidate's responses, then create their fronter account or pass for now." />
            {/* Response summary */}
            {(data.responses.companyReaction || data.responses.phoneExperience || data.responses.scriptComfort || data.responses.canStart || data.responses.candidateQuestions) && (
              <div style={{ background: 'rgba(96,165,250,0.04)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: '8px', padding: '14px 18px', marginBottom: '16px' }}>
                <div style={{ color: BLUE, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>📋 Candidate Responses Summary</div>
                {data.responses.companyReaction && <RespRow label="Company reaction" value={data.responses.companyReaction} />}
                {data.responses.phoneExperience && <RespRow label="Phone experience" value={data.responses.phoneExperience} />}
                {data.responses.scriptComfort && <RespRow label="Script comfort" value={data.responses.scriptComfort === 'yes' ? 'Comfortable' : data.responses.scriptComfort === 'hesitant' ? 'Hesitant but willing' : 'Not comfortable'} />}
                {data.responses.canStart && <RespRow label="Can start" value={data.responses.canStart} />}
                {data.responses.candidateQuestions && <RespRow label="Questions" value={data.responses.candidateQuestions} />}
                {data.responses.opportunityReaction && <RespRow label="Opportunity reaction" value={data.responses.opportunityReaction} />}
                {data.responses.trainingAttendance && <RespRow label="Training" value={data.responses.trainingAttendance === 'tonight_830' ? '8:30 PM tonight' : data.responses.trainingAttendance === 'tomorrow_1pm' ? '1:00 PM tomorrow' : data.responses.trainingAttendance === 'both' ? 'Both sessions' : 'Neither'} />}
              </div>
            )}
            <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div><label style={ls}>First Name *</label><input value={credForm.firstName} onChange={e => setCredForm(p => ({ ...p, firstName: e.target.value }))} style={inp} /></div>
                <div><label style={ls}>Last Name *</label><input value={credForm.lastName} onChange={e => setCredForm(p => ({ ...p, lastName: e.target.value }))} style={inp} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={ls}>Username *</label>
                  <input value={credForm.username} onChange={e => setCredForm(p => ({ ...p, username: e.target.value }))} style={inp} placeholder="auto-generated" />
                  <div style={{ color: '#4a5568', fontSize: '10px', marginTop: '4px' }}>First name + first initial of last name</div>
                </div>
                <div>
                  <label style={ls}>Password</label>
                  <input value={credForm.password} onChange={e => setCredForm(p => ({ ...p, password: e.target.value }))} style={inp} />
                  <div style={{ color: '#f59e0b', fontSize: '10px', marginTop: '4px' }}>User will be forced to change on first login</div>
                </div>
              </div>
              <div><label style={ls}>Email Address *</label><input type="email" value={credForm.email} onChange={e => setCredForm(p => ({ ...p, email: e.target.value }))} style={inp} placeholder="name@example.com" /></div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={back} style={btnGhost}>← Back</button>
              <button onClick={passForNow} disabled={saving} style={{ ...btnPass, opacity: saving ? 0.5 : 1 }}>⏸ Pass for Now</button>
              <button onClick={hireCandidate} disabled={saving || !canHire} style={{ ...btnGold, opacity: saving || !canHire ? 0.5 : 1, cursor: saving || !canHire ? 'not-allowed' : 'pointer' }}>{saving ? '⏳ Creating…' : '✅ Hire & Create User'}</button>
            </div>
          </div>
        )}

        {/* Step 8: Result — Hired */}
        {step === 8 && hireResult === 'hired' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ fontSize: '56px', marginBottom: '8px' }}>🎉</div>
              <h1 style={{ color: GOLD, fontSize: '26px', marginBottom: '4px' }}>User Created & Email Sent!</h1>
              <p style={{ color: '#8a9ab8', fontSize: '14px' }}>Fronter account <strong style={{ color: '#e8e0d0' }}>{credForm.username}</strong> was created and login instructions were emailed to {credForm.email}.</p>
            </div>

            {/* All details for the interviewer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <DetailCard title="👤 Candidate Info" rows={[
                ['Name', `${data.firstName} ${data.lastName}`],
                ['Telegram', data.telegramId || '—'],
                ['Email', data.email || '—'],
              ]} />
              <DetailCard title="🔐 Credentials Created" rows={[
                ['Username', credForm.username],
                ['Password', credForm.password],
                ['Login URL', 'https://rosieai-investorpage.base44.app/debt-call-coach-login'],
              ]} />
              <DetailCard title="📝 Candidate Responses" rows={[
                ['Company reaction', data.responses.companyReaction || '—'],
                ['Phone experience', data.responses.phoneExperience || '—'],
                ['Script comfort', data.responses.scriptComfort === 'yes' ? 'Comfortable' : data.responses.scriptComfort === 'hesitant' ? 'Hesitant but willing' : data.responses.scriptComfort === 'no' ? 'Not comfortable' : '—'],
                ['Can start', data.responses.canStart || '—'],
                ['Questions', data.responses.candidateQuestions || '—'],
                ['Opportunity reaction', data.responses.opportunityReaction || '—'],
                ['Training', data.responses.trainingAttendance === 'tonight_830' ? '8:30 PM tonight' : data.responses.trainingAttendance === 'tomorrow_1pm' ? '1:00 PM tomorrow' : data.responses.trainingAttendance === 'both' ? 'Both sessions' : data.responses.trainingAttendance === 'neither' ? 'Neither' : '—'],
              ]} />
              <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '18px 22px' }}>
                <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📋 Next Steps — Tell the New Hire</div>
                <ul style={{ color: '#e8e0d0', fontSize: '14px', lineHeight: 2, paddingLeft: '20px', margin: 0 }}>
                  <li>Check their <strong>email</strong> and log in at <span style={{ color: BLUE }}>https://rosieai-investorpage.base44.app/debt-call-coach-login</span></li>
                  <li>Attend <strong>training tonight at 8:30 PM EST</strong> — Zoom link is in the email</li>
                  <li>Can't make tonight? <strong>2nd class tomorrow at 12:00 PM EST</strong></li>
                  <li>Must be <strong>fully trained by tomorrow, October 11th</strong></li>
                  <li>Ready to work <strong>11:00 AM - 7:30 PM EST, Monday</strong></li>
                </ul>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '28px', flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/training')} style={{ background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', color: '#fff', border: 'none', borderRadius: '6px', padding: '14px 28px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>📅 Schedule Training</button>
              <button onClick={resetInterview} style={{ ...btnGold, fontSize: '16px', padding: '14px 40px' }}>▶ Start New Interview</button>
            </div>
          </div>
        )}

        {/* Step 8: Result — Passed */}
        {step === 8 && hireResult === 'passed' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👋</div>
            <h1 style={{ color: '#8a9ab8', fontSize: '24px', marginBottom: '8px' }}>Thank You</h1>
            <p style={{ color: '#8a9ab8', fontSize: '15px', marginBottom: '8px' }}>We'll be in touch with {data.firstName} {data.lastName}.</p>
            {(data.responses.phoneExperience || data.responses.scriptComfort) && (
              <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '14px 18px', maxWidth: '400px', margin: '20px auto', textAlign: 'left' }}>
                <div style={{ color: '#6b7280', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Notes for Reference</div>
                {data.responses.phoneExperience && <RespRow label="Experience" value={data.responses.phoneExperience} />}
                {data.responses.scriptComfort && <RespRow label="Script comfort" value={data.responses.scriptComfort} />}
                {data.responses.canStart && <RespRow label="Can start" value={data.responses.canStart} />}
              </div>
            )}
            <button onClick={resetInterview} style={{ ...btnGold, fontSize: '16px', padding: '14px 40px', marginTop: '20px' }}>▶ Start New Interview</button>
          </div>
        )}
      </div>

      {/* AI Assistant — available on all steps */}
      {step > 0 && step < 8 && (
        <InterviewAssistant step={step} stepLabel={STEP_LABELS[step]} candidateData={data} />
      )}

      {/* Audio recorder — available during interview steps */}
      {step > 0 && step < 8 && (
        <InterviewAudioRecorder onAudioReady={setAudioFileUri} candidateName={`${data.firstName}_${data.lastName}`} />
      )}

      {/* Add bottom padding so content isn't hidden behind the fixed recorder bar */}
      {step > 0 && step < 8 && <div style={{ height: '70px' }} />}
    </div>
  );
}

function StepHeader({ num, title, instruction }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: GOLD, color: DARK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold', flexShrink: 0 }}>{num}</div>
        <h2 style={{ color: GOLD, fontSize: '20px', margin: 0 }}>{title}</h2>
      </div>
      <p style={{ color: '#8a9ab8', fontSize: '13px', marginLeft: '48px' }}>{instruction}</p>
    </div>
  );
}

function NavButtons({ onBack, onNext, nextDisabled }) {
  return (
    <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
      <button onClick={onBack} style={btnGhost}>← Back</button>
      <button onClick={onNext} disabled={nextDisabled} style={{ ...btnGold, opacity: nextDisabled ? 0.4 : 1, cursor: nextDisabled ? 'not-allowed' : 'pointer' }}>Next →</button>
    </div>
  );
}

function RespRow({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '4px', fontSize: '12px' }}>
      <span style={{ color: '#6b7280', minWidth: '120px', flexShrink: 0 }}>{label}:</span>
      <span style={{ color: '#e8e0d0' }}>{value}</span>
    </div>
  );
}

function DetailCard({ title, rows }) {
  return (
    <div style={{ background: '#0d1b2a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '18px 22px' }}>
      <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>{title}</div>
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '13px' }}>
          <span style={{ color: '#6b7280', minWidth: '140px', flexShrink: 0 }}>{label}:</span>
          <span style={{ color: '#e8e0d0', wordBreak: 'break-word' }}>{value}</span>
        </div>
      ))}
    </div>
  );
}