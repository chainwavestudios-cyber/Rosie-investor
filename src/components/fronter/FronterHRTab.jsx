/**
 * FronterHRTab.jsx — HR tab for fronters.
 * Sub-tabs: Time Sheet (daily/weekly hours + bonuses) | Payment Info.
 * Time sheet shows clock in, lunch out, lunch in, clock out for each day (Sun-Sat),
 * total hours per day, and weekly total.
 * Bonuses (Closed Deals):
 *   Daily: 1 deal = $10, 2 deals = $25, 3+ deals = $50
 *   Weekly (Sun–Sat): 4+ deals = $50, 6+ deals = $80, 9+ deals = $125
 * Valid Transfer = transferred to Sr. Debt Specialist AND 30+ seconds on the phone with them.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const DARK = '#0a0f1e';
const BLUE = '#60a5fa';
const AMBER = '#f59e0b';
const GREEN = '#4ade80';
const PURPLE = '#a78bfa';
const RED = '#ef4444';
const ls = { display: 'block', color: '#8a9ab8', fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' };
const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '8px 12px', color: '#e8e0d0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'Georgia, serif' };

function getETDate() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); }

function getWeekDates(refDateStr) {
  const ref = new Date(refDateStr + 'T00:00:00');
  const day = ref.getDay();
  const sunday = new Date(ref);
  sunday.setDate(ref.getDate() - day);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    dates.push(d.toLocaleDateString('en-CA'));
  }
  return dates;
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
}

function fmtDur(s) {
  if (!s) return '0h 0m';
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function FronterHRTab({ username }) {
  const [subtab, setSubtab] = useState('timesheet');
  const [entries, setEntries] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [closedDeals, setClosedDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = getETDate();
  const weekDates = getWeekDates(today);

  const load = useCallback(async () => {
    try {
      const [allEntries, allLeads] = await Promise.all([
        base44.entities.FronterTimeEntry.filter({ username }, '-date', 50),
        base44.entities.FronterLead.filter({ assignedTo: username }, '-created_date', 500),
      ]);
      setEntries(allEntries || []);
      const leads = allLeads || [];
      setTransfers(leads.filter(l => (l.status === 'transferred' || l.status === 'closed_deal') && l.transferredAt));
      setClosedDeals(leads.filter(l => l.status === 'closed_deal' && l.closedDealAt));
    } catch {}
    setLoading(false);
  }, [username]);

  useEffect(() => { load(); const iv = setInterval(load, 30000); return () => clearInterval(iv); }, [load]);

  const entryByDate = {};
  (entries || []).forEach(e => { entryByDate[e.date] = e; });

  const weekTotal = weekDates.reduce((sum, d) => sum + (entryByDate[d]?.totalSeconds || 0), 0);

  // Daily transfer counts
  const transfersByDate = {};
  (transfers || []).forEach(l => {
    if (!l.transferredAt) return;
    const d = new Date(l.transferredAt).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    transfersByDate[d] = (transfersByDate[d] || 0) + 1;
  });

  const todayTransfers = transfersByDate[today] || 0;
  const weekTransfers = weekDates.reduce((sum, d) => sum + (transfersByDate[d] || 0), 0);

  // Closed deals by date
  const closedDealsByDate = {};
  (closedDeals || []).forEach(l => {
    if (!l.closedDealAt) return;
    const d = new Date(l.closedDealAt).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    closedDealsByDate[d] = (closedDealsByDate[d] || 0) + 1;
  });

  const todayClosedDeals = closedDealsByDate[today] || 0;
  const weekClosedDeals = weekDates.reduce((sum, d) => sum + (closedDealsByDate[d] || 0), 0);

  // Valid transfers: transferred to Sr. Debt Specialist AND 30+ seconds on the phone
  const validTransfers = (transfers || []).filter(l => l.transferredTo && (l.lastCallDurationSeconds || 0) >= 30);
  const invalidTransfers = (transfers || []).filter(l => !l.transferredTo || (l.lastCallDurationSeconds || 0) < 30);

  // Daily bonus: 1 deal = $10, 2 deals = $25, 3+ deals = $50
  const dailyBonus = todayClosedDeals >= 3 ? 50 : todayClosedDeals === 2 ? 25 : todayClosedDeals === 1 ? 10 : 0;

  // Weekly bonus: 4+ = $50, 6+ = $80, 9+ = $125
  const weeklyBonus = weekClosedDeals >= 9 ? 125 : weekClosedDeals >= 6 ? 80 : weekClosedDeals >= 4 ? 50 : 0;
  const totalBonus = dailyBonus + weeklyBonus;

  return (
    <div>
      <div style={{ display: 'flex', gap: '2px', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <button onClick={() => setSubtab('timesheet')} style={{ padding: '10px 14px', background: 'none', border: 'none', borderBottom: `2px solid ${subtab === 'timesheet' ? GOLD : 'transparent'}`, color: subtab === 'timesheet' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: subtab === 'timesheet' ? 'bold' : 'normal' }}>🕐 Time Sheet</button>
        <button onClick={() => setSubtab('bonuses')} style={{ padding: '10px 14px', background: 'none', border: 'none', borderBottom: `2px solid ${subtab === 'bonuses' ? GOLD : 'transparent'}`, color: subtab === 'bonuses' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: subtab === 'bonuses' ? 'bold' : 'normal' }}>💰 Bonuses</button>
        <button onClick={() => setSubtab('payment')} style={{ padding: '10px 14px', background: 'none', border: 'none', borderBottom: `2px solid ${subtab === 'payment' ? GOLD : 'transparent'}`, color: subtab === 'payment' ? GOLD : '#6b7280', cursor: 'pointer', fontSize: '12px', fontWeight: subtab === 'payment' ? 'bold' : 'normal' }}>💳 Payment Info</button>
      </div>

      {loading && <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px' }}>Loading…</div>}

      {/* ── TIME SHEET ── */}
      {subtab === 'timesheet' && !loading && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase' }}>📋 This Week (Sun–Sat)</div>
            <div style={{ display: 'flex', gap: '14px' }}>
              <div style={{ textAlign: 'center', padding: '6px 16px', background: `${GOLD}12`, border: `1px solid ${GOLD}33`, borderRadius: '6px' }}>
                <div style={{ color: GOLD, fontSize: '20px', fontWeight: 'bold', fontFamily: 'monospace' }}>{fmtDur(weekTotal)}</div>
                <div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Week Total</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {weekDates.map((d, i) => {
              const e = entryByDate[d];
              const isToday = d === today;
              const dayTransfers = transfersByDate[d] || 0;
              return (
                <div key={d} style={{ background: isToday ? 'rgba(16,185,129,0.06)' : '#0d1b2a', border: `1px solid ${isToday ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '6px', padding: '12px 16px', display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr 1fr 100px 80px 80px', gap: '10px', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: isToday ? GOLD : '#e8e0d0', fontSize: '13px', fontWeight: 'bold' }}>{DAY_NAMES[i]}</div>
                    <div style={{ color: '#6b7280', fontSize: '10px' }}>{new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </div>
                  <div><div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase' }}>Clock In</div><div style={{ color: GREEN, fontSize: '12px', fontFamily: 'monospace' }}>{fmtTime(e?.clockIn)}</div></div>
                  <div><div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase' }}>Lunch Out</div><div style={{ color: AMBER, fontSize: '12px', fontFamily: 'monospace' }}>{fmtTime(e?.lunchOut)}</div></div>
                  <div><div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase' }}>Lunch In</div><div style={{ color: AMBER, fontSize: '12px', fontFamily: 'monospace' }}>{fmtTime(e?.lunchIn)}</div></div>
                  <div><div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase' }}>Clock Out</div><div style={{ color: '#8a9ab8', fontSize: '12px', fontFamily: 'monospace' }}>{fmtTime(e?.clockOut)}</div></div>
                  <div><div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase' }}>Hours</div><div style={{ color: BLUE, fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold' }}>{fmtDur(e?.totalSeconds || 0)}</div></div>
                  <div><div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase' }}>Transfers</div><div style={{ color: PURPLE, fontSize: '13px', fontWeight: 'bold' }}>{dayTransfers}</div></div>
                  <div><div style={{ color: '#6b7280', fontSize: '8px', textTransform: 'uppercase' }}>Deals</div><div style={{ color: GOLD, fontSize: '13px', fontWeight: 'bold' }}>{closedDealsByDate[d] || 0}</div></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── BONUSES ── */}
      {subtab === 'bonuses' && !loading && (
        <div>
          <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '14px' }}>💰 Closed Deals Bonus Tracker</div>

          {/* Transfer validation */}
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '6px', padding: '16px', marginBottom: '14px' }}>
            <div style={{ color: BLUE, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>🔍 Transfer Validation</div>
            <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '10px', lineHeight: 1.5 }}>A valid transfer = customer was transferred to a Sr. Debt Specialist AND spent at least 30 seconds on the phone with them.</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, padding: '12px', background: validTransfers.length > 0 ? `${GREEN}12` : 'rgba(255,255,255,0.03)', border: `1px solid ${validTransfers.length > 0 ? GREEN + '44' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ color: GREEN, fontSize: '22px', fontWeight: 'bold' }}>{validTransfers.length}</div>
                <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '3px' }}>✓ Valid Transfers</div>
              </div>
              <div style={{ flex: 1, padding: '12px', background: invalidTransfers.length > 0 ? `${RED}12` : 'rgba(255,255,255,0.03)', border: `1px solid ${invalidTransfers.length > 0 ? RED + '44' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ color: RED, fontSize: '22px', fontWeight: 'bold' }}>{invalidTransfers.length}</div>
                <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '3px' }}>⚠ Invalid Transfers</div>
              </div>
              <div style={{ flex: 1, padding: '12px', background: `${GOLD}12`, border: `1px solid ${GOLD}44`, borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ color: GOLD, fontSize: '22px', fontWeight: 'bold' }}>{closedDeals.length}</div>
                <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '3px' }}>💎 Closed Deals</div>
              </div>
            </div>
            {invalidTransfers.length > 0 && (
              <div style={{ marginTop: '10px', padding: '8px 12px', background: `${RED}08`, border: `1px solid ${RED}22`, borderRadius: '4px', color: RED, fontSize: '10px' }}>
                ⚠ {invalidTransfers.length} transfer(s) did not meet the 30-second minimum or have no Sr. Debt Specialist assigned — they won't count toward closed deals.
              </div>
            )}
          </div>

          {/* Daily bonus — Closed Deals */}
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '16px', marginBottom: '14px' }}>
            <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>📅 Today's Closed Deals: <span style={{ color: GOLD, fontSize: '18px' }}>{todayClosedDeals}</span></div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <BonusTier label="1 Deal" reward="$10" achieved={todayClosedDeals >= 1} progress={Math.min(todayClosedDeals, 1)} max={1} color={GOLD} />
              <BonusTier label="2 Deals" reward="$25" achieved={todayClosedDeals >= 2} progress={Math.min(Math.max(todayClosedDeals, 0), 2)} max={2} color={GREEN} />
              <BonusTier label="3+ Deals" reward="$50" achieved={todayClosedDeals >= 3} progress={Math.min(Math.max(todayClosedDeals, 0), 3)} max={3} color={PURPLE} />
            </div>
            <div style={{ padding: '10px 14px', background: dailyBonus > 0 ? `${GOLD}12` : 'rgba(255,255,255,0.03)', border: `1px solid ${dailyBonus > 0 ? GOLD + '44' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#8a9ab8', fontSize: '12px' }}>Today's Bonus Earned</span>
              <span style={{ color: dailyBonus > 0 ? GOLD : '#6b7280', fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace' }}>${dailyBonus}</span>
            </div>
          </div>

          {/* Weekly bonus — Closed Deals */}
          <div style={{ background: '#0d1b2a', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '6px', padding: '16px', marginBottom: '14px' }}>
            <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>📆 This Week's Closed Deals (Sun–Sat): <span style={{ color: BLUE, fontSize: '18px' }}>{weekClosedDeals}</span></div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <BonusTier label="4+ Deals" reward="$50" achieved={weekClosedDeals >= 4} progress={Math.min(weekClosedDeals, 4)} max={4} color={BLUE} />
              <BonusTier label="6+ Deals" reward="$80" achieved={weekClosedDeals >= 6} progress={Math.min(weekClosedDeals, 6)} max={6} color={GREEN} />
              <BonusTier label="9+ Deals" reward="$125" achieved={weekClosedDeals >= 9} progress={Math.min(weekClosedDeals, 9)} max={9} color={PURPLE} />
            </div>
            <div style={{ padding: '10px 14px', background: weeklyBonus > 0 ? `${BLUE}12` : 'rgba(255,255,255,0.03)', border: `1px solid ${weeklyBonus > 0 ? BLUE + '44' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#8a9ab8', fontSize: '12px' }}>Weekly Bonus Earned</span>
              <span style={{ color: weeklyBonus > 0 ? BLUE : '#6b7280', fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace' }}>${weeklyBonus}</span>
            </div>
          </div>

          {/* Total */}
          <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(96,165,250,0.12))', border: `1px solid ${GOLD}44`, borderRadius: '6px', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#e8e0d0', fontSize: '15px', fontWeight: 'bold' }}>🏆 Total Bonus (Today + Weekly)</span>
            <span style={{ color: GOLD, fontSize: '28px', fontWeight: 'bold', fontFamily: 'monospace' }}>${totalBonus}</span>
          </div>
        </div>
      )}

      {/* ── PAYMENT INFO ── */}
      {subtab === 'payment' && !loading && (
        <PaymentInfoSection username={username} />
      )}
    </div>
  );
}

function BonusTier({ label, reward, achieved, progress, max, color }) {
  const pct = max > 0 ? (progress / max) * 100 : 0;
  return (
    <div style={{ flex: 1, padding: '12px', background: achieved ? `${color}12` : 'rgba(255,255,255,0.03)', border: `1px solid ${achieved ? color + '44' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ color: achieved ? color : '#8a9ab8', fontSize: '11px', fontWeight: 'bold' }}>{achieved ? '✓ ' : ''}{label}</span>
        <span style={{ color: achieved ? color : '#6b7280', fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace' }}>{reward}</span>
      </div>
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
      <div style={{ color: '#6b7280', fontSize: '9px', marginTop: '3px' }}>{progress}/{max}</div>
    </div>
  );
}

function PaymentInfoSection({ username }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [customLabel, setCustomLabel] = useState('');

  const load = useCallback(async () => {
    try {
      const rows = await base44.entities.FronterPaymentInfo.filter({ username });
      setInfo(rows?.[0] || null);
      setCustomLabel(rows?.[0]?.customLabel || '');
    } catch {}
    setLoading(false);
  }, [username]);

  useEffect(() => { load(); }, [load]);

  const ensureInfo = async () => {
    if (!info) {
      const rec = await base44.entities.FronterPaymentInfo.create({ username, paymentMethod: 'cashapp' });
      setInfo(rec);
      return rec;
    }
    return info;
  };

  const update = async (patch) => {
    const rec = await ensureInfo();
    await base44.entities.FronterPaymentInfo.update(rec.id, patch);
    setInfo(prev => ({ ...prev, ...patch }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  // Auto-save for Cash App ID on blur
  const saveCashApp = async (val) => {
    if (!val?.trim()) return;
    const rec = await ensureInfo();
    await base44.entities.FronterPaymentInfo.update(rec.id, { cashappId: val.trim(), paymentMethod: 'cashapp' });
    setInfo(prev => ({ ...prev, cashappId: val.trim(), paymentMethod: 'cashapp' }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  if (loading) return <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px' }}>Loading…</div>;

  const method = info?.paymentMethod || 'cashapp';

  return (
    <div style={{ maxWidth: '500px' }}>
      <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '14px' }}>💳 Payment Information</div>
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '18px' }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={ls}>How do you want to be paid?</label>
          <select value={method} onChange={e => update({ paymentMethod: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
            <option value="cashapp">💵 Cash App</option>
            <option value="crypto">₿ Crypto</option>
            <option value="custom">✏️ Custom Add</option>
          </select>
        </div>

        {method === 'cashapp' && (
          <div>
            <label style={ls}>Cash App ID</label>
            <input
              key={info?.cashappId || 'new'}
              defaultValue={info?.cashappId || ''}
              placeholder="$yourtag or phone/email"
              onBlur={e => saveCashApp(e.target.value)}
              style={{ ...inp, borderColor: 'rgba(16,185,129,0.3)' }}
            />
            <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '6px' }}>Auto-saves when you click away from this field.</div>
            {info?.cashappId && <div style={{ marginTop: '8px', padding: '8px 12px', background: `${GOLD}12`, border: `1px solid ${GOLD}33`, borderRadius: '4px', color: GOLD, fontSize: '12px' }}>✓ Saved: {info.cashappId}</div>}
          </div>
        )}

        {method === 'crypto' && (
          <div>
            <div style={{ marginBottom: '14px' }}>
              <label style={ls}>Crypto Type</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['ETH', 'BTC', 'SOL'].map(c => (
                  <button key={c} onClick={() => update({ cryptoType: c })} style={{ flex: 1, padding: '12px', borderRadius: '4px', border: `1px solid ${info?.cryptoType === c ? GOLD + '66' : 'rgba(255,255,255,0.1)'}`, background: info?.cryptoType === c ? `${GOLD}12` : 'transparent', color: info?.cryptoType === c ? GOLD : '#8a9ab8', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', fontFamily: 'Georgia, serif' }}>
                    {c === 'ETH' ? 'Ξ' : c === 'BTC' ? '₿' : '◎'} {c}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={ls}>Wallet Address</label>
              <input
                key={info?.cryptoAddress || 'new'}
                defaultValue={info?.cryptoAddress || ''}
                placeholder={info?.cryptoType === 'BTC' ? 'bc1...' : info?.cryptoType === 'ETH' ? '0x...' : info?.cryptoType === 'SOL' ? '...' : 'Select crypto type first'}
                onBlur={e => { if (e.target.value.trim()) update({ cryptoAddress: e.target.value.trim() }); }}
                style={inp}
              />
            </div>
            <button onClick={() => { const addr = document.querySelector('input[placeholder*="..."]')?.value || info?.cryptoAddress; if (addr?.trim()) update({ cryptoAddress: addr.trim() }); }} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '9px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>💾 Save</button>
          </div>
        )}

        {method === 'custom' && (
          <div>
            <div style={{ marginBottom: '14px' }}>
              <label style={ls}>Payment Method Label (e.g. Venmo, PayPal, Zelle)</label>
              <input value={customLabel} onChange={e => setCustomLabel(e.target.value)} placeholder="Venmo" style={inp} />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={ls}>ID / Handle / Address</label>
              <input
                key={info?.customValue || 'new'}
                defaultValue={info?.customValue || ''}
                placeholder="@yourhandle or email"
                onBlur={e => { if (e.target.value.trim() || customLabel.trim()) update({ customValue: e.target.value.trim(), customLabel: customLabel.trim() }); }}
                style={inp}
              />
            </div>
            <button onClick={() => { const val = document.querySelector('input[placeholder*="@yourhandle"]')?.value || info?.customValue; if (val?.trim() || customLabel.trim()) update({ customValue: val?.trim() || '', customLabel: customLabel.trim() }); }} style={{ background: 'linear-gradient(135deg,#10b981,#22c55e)', color: DARK, border: 'none', borderRadius: '4px', padding: '9px 20px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>💾 Save</button>
          </div>
        )}

        {saved && <div style={{ marginTop: '14px', padding: '8px 14px', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '4px', color: '#4ade80', fontSize: '12px', fontWeight: 'bold' }}>✓ Payment info saved</div>}
      </div>
    </div>
  );
}