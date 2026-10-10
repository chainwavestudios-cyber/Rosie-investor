/**
 * InterviewPage.jsx — Step-by-step interview wizard for hiring fronters.
 * Collects candidate info, guides the interviewer through a script, and
 * creates a fronter user with email login instructions on hire.
 * Requires super admin access.
 */
import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDebtCoachAuth } from '@/lib/DebtCoachAuthContext';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const RED = '#ef4444';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '10px 14px', color: '#e8e0d0', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };
const scriptBox = { background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '8px', padding: '20px 24px', color: '#e8e0d0', fontSize: '15px', lineHeight: 1.8, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' };
const btnGold = { background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '6px', padding: '10px 28px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' };
const btnGhost = { background: 'rgba(255,255,255,0.05)', color: '#8a9ab8', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '10px 24px', cursor: 'pointer', fontSize: '14px' };
const btnPass = { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', padding: '10px 24px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' };

const STEP_LABELS = ['Start', 'Name', 'Contact', 'Company', 'About', 'Job', 'Credentials', 'Complete'];

export default function InterviewPage() {
  const { user, loading, isAuthenticated, isSuperAdmin, logout } = useDebtCoachAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ firstName: '', lastName: '', telegramId: '', email: '', notes: '' });
  const [credForm, setCredForm] = useState({ firstName: '', lastName: '', username: '', password: 'fronter2026!!', email: '' });
  const [saving, setSaving] = useState(false);
  const [hireResult, setHireResult] = useState(null);
  const [recentInterviews, setRecentInterviews] = useState([]);

  useEffect(() => {
    if (step === 0) {
      base44.entities.Interview.list('-created_date', 10).then(all => {
        setRecentInterviews(Array.isArray(all) ? all : (all?.items || []));
      }).catch(() => {});
    }
  }, [step]);

  // Pre-fill credential form when entering the credentials step
  useEffect(() => {
    if (step === 6 && !credForm.username) {
      const auto = (data.firstName + (data.lastName[0] || '')).toLowerCase();
      setCredForm({
        firstName: data.firstName,
        lastName: data.lastName,
        username: auto,
        password: 'fronter2026!!',
        email: data.email,
      });
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

  const hireCandidate = async () => {
    if (!credForm.firstName.trim() || !credForm.lastName.trim() || !credForm.username.trim() || !credForm.email.trim()) return;
    setSaving(true);
    try {
      // Check for duplicate username
      const existing = await base44.entities.DebtCoachUser.filter({ username: credForm.username.trim() });
      if (existing && existing.length > 0) {
        alert('Username already exists. Please choose a different one.');
        setSaving(false);
        return;
      }
      // Hash password
      const hashRes = await base44.functions.invoke('hashPassword', { action: 'hash', password: credForm.password });
      const hash = hashRes?.data?.hash || hashRes?.hash;
      if (!hash) throw new Error('Password hashing failed');
      // Create fronter user — same as FronterUsersTab
      await base44.entities.DebtCoachUser.create({
        username: credForm.username.trim(),
        firstName: credForm.firstName.trim(),
        lastName: credForm.lastName.trim(),
        email: credForm.email.trim(),
        passwordHash: hash,
        role: 'fronter',
        isActive: true,
        mustResetPassword: true,
        createdBy: user.username,
      });
      // Send welcome email with login instructions + training schedule
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
      // Save interview record
      await base44.entities.Interview.create({
        firstName: data.firstName,
        lastName: data.lastName,
        telegramId: data.telegramId,
        email: data.email,
        status: 'hired',
        hiredUsername: credForm.username.trim(),
        notes: data.notes,
        createdBy: user.username,
      });
      setHireResult('hired');
      setStep(7);
    } catch (e) {
      alert('Failed: ' + (e?.message || String(e)));
    }
    setSaving(false);
  };

  const passForNow = async () => {
    setSaving(true);
    try {
      await base44.entities.Interview.create({
        firstName: data.firstName,
        lastName: data.lastName,
        telegramId: data.telegramId,
        email: data.email,
        status: 'passed',
        notes: data.notes,
        createdBy: user.username,
      });
      setHireResult('passed');
      setStep(7);
    } catch (e) {
      alert('Failed: ' + (e?.message || String(e)));
    }
    setSaving(false);
  };

  const resetInterview = () => {
    setStep(0);
    setData({ firstName: '', lastName: '', telegramId: '', email: '', notes: '' });
    setCredForm({ firstName: '', lastName: '', username: '', password: 'fronter2026!!', email: '' });
    setHireResult(null);
  };

  const next = () => setStep(s => Math.min(s + 1, 7));
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
      {step > 0 && step < 7 && (
        <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {STEP_LABELS.slice(1, 7).map((label, i) => {
            const stepNum = i + 1;
            const isActive = step === stepNum;
            const isDone = step > stepNum;
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', background: isActive ? GOLD : isDone ? `${GOLD}33` : 'rgba(255,255,255,0.05)', color: isActive ? DARK : isDone ? GOLD : '#6b7280', border: `1px solid ${isActive ? GOLD : isDone ? `${GOLD}44` : 'rgba(255,255,255,0.1)'}` }}>{isDone ? '✓' : stepNum}</div>
                <span style={{ color: isActive ? GOLD : '#6b7280', fontSize: '11px', fontWeight: isActive ? 'bold' : 'normal' }}>{label}</span>
                {i < 5 && <div style={{ width: '20px', height: '1px', background: isDone ? `${GOLD}44` : 'rgba(255,255,255,0.1)' }} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '40px 24px' }}>
        {/* Step 0: Start */}
        {step === 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎤</div>
            <h1 style={{ color: '#e8e0d0', fontSize: '28px', marginBottom: '8px' }}>Interview Portal</h1>
            <p style={{ color: '#8a9ab8', fontSize: '15px', marginBottom: '32px' }}>Conduct a step-by-step interview and hire new fronters.</p>
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
            <h2 style={{ color: GOLD, fontSize: '20px', marginBottom: '6px' }}>Candidate Name</h2>
            <p style={{ color: '#8a9ab8', fontSize: '13px', marginBottom: '24px' }}>Enter the candidate's first and last name.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
              <div><label style={ls}>First Name *</label><input value={data.firstName} onChange={e => setData(p => ({ ...p, firstName: e.target.value }))} style={inp} placeholder="John" /></div>
              <div><label style={ls}>Last Name *</label><input value={data.lastName} onChange={e => setData(p => ({ ...p, lastName: e.target.value }))} style={inp} placeholder="Smith" /></div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={back} style={btnGhost}>← Back</button>
              <button onClick={next} disabled={!canNextName} style={{ ...btnGold, opacity: canNextName ? 1 : 0.4, cursor: canNextName ? 'pointer' : 'not-allowed' }}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 2: Contact */}
        {step === 2 && (
          <div>
            <h2 style={{ color: GOLD, fontSize: '20px', marginBottom: '6px' }}>Contact Information</h2>
            <p style={{ color: '#8a9ab8', fontSize: '13px', marginBottom: '24px' }}>Confirm the candidate's Telegram ID and email address.</p>
            <div style={{ marginBottom: '14px' }}>
              <label style={ls}>Telegram ID *</label>
              <input value={data.telegramId} onChange={e => setData(p => ({ ...p, telegramId: e.target.value }))} style={inp} placeholder="@username" />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={ls}>Email Address *</label>
              <input type="email" value={data.email} onChange={e => setData(p => ({ ...p, email: e.target.value }))} style={inp} placeholder="name@example.com" />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={back} style={btnGhost}>← Back</button>
              <button onClick={next} disabled={!canNextContact} style={{ ...btnGold, opacity: canNextContact ? 1 : 0.4, cursor: canNextContact ? 'pointer' : 'not-allowed' }}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 3: Company Background */}
        {step === 3 && (
          <div>
            <h2 style={{ color: GOLD, fontSize: '20px', marginBottom: '6px' }}>Company Background</h2>
            <p style={{ color: '#8a9ab8', fontSize: '13px', marginBottom: '16px' }}>📖 Read this to the candidate:</p>
            <div style={scriptBox}>{`So we are a debt settlement company. But due to compliance rules, we can't pitch the company name or its services. But we can pitch the idea, and then state you are going to transfer you to Chris Bongiorno, a Sr Debt Specialist at the company.

But really what we are looking for are experienced phone jockeys. See, you're not selling anything in this gig. You are connecting a consumer, who is drowning in debt, with a very good solution to getting them debt free, reducing overall debt load, and increasing their monthly cash flow, within weeks. Our team connects these consumers with one of the best companies in the industry. In fact, this company came in second place last year, NATIONWIDE, for the annual BBB ethics award, and that covers all businesses in the USA. Only one company in the US was ahead of them. So that's impressive.`}</div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={back} style={btnGhost}>← Back</button>
              <button onClick={next} style={btnGold}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 4: About Them */}
        {step === 4 && (
          <div>
            <h2 style={{ color: GOLD, fontSize: '20px', marginBottom: '6px' }}>More About Them</h2>
            <p style={{ color: '#8a9ab8', fontSize: '13px', marginBottom: '16px' }}>📖 Read these questions to the candidate:</p>
            <div style={scriptBox}>{`So tell me a little bit about your experience working on the phone, handling objections...

Are you comfortable reading a script?

Ok cool, well look, the best part is that we have an advanced CRM that is hyper focused on giving agents live realtime support as your potential customers ask questions...

Our AI tools will make your job a lot easier.`}</div>
            <div style={{ marginTop: '16px' }}>
              <label style={ls}>Interviewer Notes (optional)</label>
              <textarea value={data.notes} onChange={e => setData(p => ({ ...p, notes: e.target.value }))} rows={4} style={{ ...inp, resize: 'vertical' }} placeholder="Jot down the candidate's responses…" />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={back} style={btnGhost}>← Back</button>
              <button onClick={next} style={btnGold}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 5: Job Details */}
        {step === 5 && (
          <div>
            <h2 style={{ color: GOLD, fontSize: '20px', marginBottom: '6px' }}>Job Details</h2>
            <p style={{ color: '#8a9ab8', fontSize: '13px', marginBottom: '16px' }}>📖 Read this to the candidate:</p>
            <div style={scriptBox}>{`So, when could you start? We are looking for people to train later today and tomorrow and Monday morning hit the ground running.

The job pays $300 per month, payments made on the 1st and 15th of the month. There are daily deal and volume bonuses as well. You can make a lot of money. All of the details on the bonuses are on the portal I am going to get you into today. When you log in for the first time, it will have you fill out a form, and then it will bring you to a dialer agreement that goes through all the specifics of your employment.

Once you sign that, it's automatically counter-signed, and you will be emailed a copy or you can download it.`}</div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={back} style={btnGhost}>← Back</button>
              <button onClick={next} style={btnGold}>Next →</button>
            </div>
          </div>
        )}

        {/* Step 6: Credential Setup */}
        {step === 6 && (
          <div>
            <h2 style={{ color: GOLD, fontSize: '20px', marginBottom: '6px' }}>Credential Setup</h2>
            <p style={{ color: '#8a9ab8', fontSize: '13px', marginBottom: '24px' }}>Create fronter access for this candidate. Username is auto-generated from their name.</p>
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
              <div>
                <label style={ls}>Email Address *</label>
                <input type="email" value={credForm.email} onChange={e => setCredForm(p => ({ ...p, email: e.target.value }))} style={inp} placeholder="name@example.com" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={back} style={btnGhost}>← Back</button>
              <button onClick={passForNow} disabled={saving} style={{ ...btnPass, opacity: saving ? 0.5 : 1 }}>⏸ Pass for Now</button>
              <button onClick={hireCandidate} disabled={saving || !canHire} style={{ ...btnGold, opacity: saving || !canHire ? 0.5 : 1, cursor: saving || !canHire ? 'not-allowed' : 'pointer' }}>{saving ? '⏳ Creating…' : '✅ Hire & Create User'}</button>
            </div>
          </div>
        )}

        {/* Step 7: Result */}
        {step === 7 && hireResult === 'hired' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎉</div>
            <h1 style={{ color: GOLD, fontSize: '26px', marginBottom: '8px' }}>User Created & Email Sent!</h1>
            <p style={{ color: '#8a9ab8', fontSize: '14px', marginBottom: '28px' }}>Fronter account <strong style={{ color: '#e8e0d0' }}>{credForm.username}</strong> was created and login instructions were emailed to {credForm.email}.</p>
            <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', padding: '20px 24px', textAlign: 'left', marginBottom: '28px' }}>
              <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px' }}>📋 Next Steps for the New Hire</div>
              <ul style={{ color: '#e8e0d0', fontSize: '14px', lineHeight: 2, paddingLeft: '20px', margin: 0 }}>
                <li>Have them <strong>check their email</strong> and log in at <span style={{ color: BLUE }}>https://rosieai-investorpage.base44.app/debt-call-coach-login</span></li>
                <li>Make sure they can attend <strong>training tonight at 8:30 PM EST</strong></li>
                <li>They will get a <strong>Zoom link</strong> in their email</li>
                <li>If they can't make tonight, there's a <strong>2nd class tomorrow at 12:00 PM EST</strong></li>
                <li>Must be <strong>fully trained by tomorrow, October 11th</strong></li>
                <li>Ready to work <strong>11:00 AM - 7:30 PM EST, Monday</strong></li>
              </ul>
            </div>
            <button onClick={resetInterview} style={{ ...btnGold, fontSize: '16px', padding: '14px 40px' }}>▶ Start New Interview</button>
          </div>
        )}

        {step === 7 && hireResult === 'passed' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>👋</div>
            <h1 style={{ color: '#8a9ab8', fontSize: '24px', marginBottom: '8px' }}>Thank You</h1>
            <p style={{ color: '#8a9ab8', fontSize: '15px', marginBottom: '32px' }}>We'll be in touch with {data.firstName} {data.lastName}.</p>
            <button onClick={resetInterview} style={{ ...btnGold, fontSize: '16px', padding: '14px 40px' }}>▶ Start New Interview</button>
          </div>
        )}
      </div>
    </div>
  );
}