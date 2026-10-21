/**
 * FronterBonusTracker.jsx — Bonus board for the Fronter HR tab.
 *
 * TEAM GATE (calendar month):
 *   The team must collectively hit $300,000 in enrolled debt this month before ANY
 *   bonus pays. Enrolled debt is measured from the team's closed deals for the month
 *   (each closed deal's deal amount). While the gate is unmet, every payout shows $0.
 *
 * DAILY DEAL BONUS — paid per deal closed today:
 *   1–2 deals = $10 per deal · 3+ deals = $12 per deal
 * DAILY VOLUME BONUS — paid from your own valid transfers today:
 *   10 transfers = $5 · 15 transfers = $10 · 20+ transfers = $15
 * WEEKLY DEAL BONUS — paid per deal closed this week (Sun–Sat):
 *   1–4 deals = $5 per deal · 5–9 deals = $10 per deal · 10+ deals = $15 per deal
 *
 * Valid transfer = transferred to a Sr. Debt Specialist AND 30+ seconds on the phone.
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#10b981';
const BLUE = '#60a5fa';
const GREEN = '#4ade80';
const AMBER = '#f59e0b';
const PURPLE = '#a78bfa';
const RED = '#ef4444';
const TEAM_GATE = 300000;

function getETDate() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); }
function etDay(iso) { return iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) : null; }
const money = (n) => `$${Math.round(n || 0).toLocaleString('en-US')}`;

function getWeekDates(refDateStr) {
  const ref = new Date(refDateStr + 'T00:00:00');
  const sunday = new Date(ref);
  sunday.setDate(ref.getDate() - ref.getDay());
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    dates.push(d.toLocaleDateString('en-CA'));
  }
  return dates;
}

export default function FronterBonusTracker({ username }) {
  const [deals, setDeals] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [teamMonthDebt, setTeamMonthDebt] = useState(0);
  const [teamMonthDeals, setTeamMonthDeals] = useState(0);
  const [loading, setLoading] = useState(true);

  const today = getETDate();
  const monthKey = today.slice(0, 7);
  const monthName = new Date(today + 'T12:00:00').toLocaleDateString('en-US', { month: 'long' });
  const weekDates = getWeekDates(today);

  const load = useCallback(async () => {
    try {
      const [myLeads, teamClosed] = await Promise.all([
        base44.entities.FronterLead.filter({ assignedTo: username }, '-created_date', 500),
        base44.entities.FronterLead.filter({ status: 'closed_deal' }, '-created_date', 1000),
      ]);
      const leads = myLeads.items || myLeads || [];
      setDeals(leads.filter(l => l.status === 'closed_deal' && l.closedDealAt));
      setTransfers(leads.filter(l => (l.status === 'transferred' || l.status === 'closed_deal') && l.transferredAt));

      const closed = teamClosed.items || teamClosed || [];
      const monthDeals = closed.filter(l => l.closedDealAt && etDay(l.closedDealAt)?.slice(0, 7) === monthKey);
      setTeamMonthDeals(monthDeals.length);
      setTeamMonthDebt(monthDeals.reduce((sum, l) => sum + (Number(l.debtAmount) || 0), 0));
    } catch { /* leave the board empty rather than break the HR tab */ }
    setLoading(false);
  }, [username, monthKey]);

  useEffect(() => { load(); const iv = setInterval(load, 60000); return () => clearInterval(iv); }, [load]);

  if (loading) return <div style={{ color: '#4a5568', textAlign: 'center', padding: '40px' }}>Loading…</div>;

  const todayDeals = deals.filter(l => etDay(l.closedDealAt) === today).length;
  const weekDeals = deals.filter(l => weekDates.includes(etDay(l.closedDealAt))).length;

  const validTransfers = transfers.filter(l => l.transferredTo && (l.lastCallDurationSeconds || 0) >= 30);
  const invalidTransfers = transfers.filter(l => !l.transferredTo || (l.lastCallDurationSeconds || 0) < 30);
  const todayTransfers = validTransfers.filter(l => etDay(l.transferredAt) === today).length;

  // ── Team gate (calendar month) ──
  const gateMet = teamMonthDebt >= TEAM_GATE;
  const gatePct = Math.min(100, (teamMonthDebt / TEAM_GATE) * 100);
  const gateRemaining = Math.max(0, TEAM_GATE - teamMonthDebt);

  // ── Payouts (all locked until the team gate is met) ──
  const dailyRate = todayDeals >= 3 ? 12 : 10;
  const dailyDealBonus = gateMet && todayDeals > 0 ? todayDeals * dailyRate : 0;

  const volumeBonus = gateMet ? (todayTransfers >= 20 ? 15 : todayTransfers >= 15 ? 10 : todayTransfers >= 10 ? 5 : 0) : 0;

  const weeklyRate = weekDeals >= 10 ? 15 : weekDeals >= 5 ? 10 : weekDeals >= 1 ? 5 : 0;
  const weeklyDealBonus = gateMet ? weekDeals * weeklyRate : 0;

  const totalBonus = dailyDealBonus + volumeBonus + weeklyDealBonus;

  return (
    <div>
      <div style={{ color: GOLD, fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '14px' }}>💰 Bonus Tracker</div>

      {/* ── TEAM GATE ── */}
      <div style={{ background: '#0d1b2a', border: `1px solid ${gateMet ? GREEN + '55' : AMBER + '55'}`, borderRadius: '6px', padding: '16px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold' }}>🏁 Team Enrolled Debt — {monthName}</div>
          <div style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', background: gateMet ? `${GREEN}18` : `${AMBER}18`, border: `1px solid ${gateMet ? GREEN : AMBER}55`, color: gateMet ? GREEN : AMBER }}>
            {gateMet ? '✓ Bonuses unlocked' : '🔒 Bonuses locked'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '10px 0 8px' }}>
          <span style={{ color: gateMet ? GREEN : AMBER, fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace' }}>{money(teamMonthDebt)}</span>
          <span style={{ color: '#6b7280', fontSize: '12px' }}>of {money(TEAM_GATE)} · {teamMonthDeals} closed deal{teamMonthDeals === 1 ? '' : 's'} this month</span>
        </div>
        <div style={{ height: '10px', background: 'rgba(255,255,255,0.06)', borderRadius: '5px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${gatePct}%`, background: gateMet ? GREEN : AMBER, borderRadius: '5px', transition: 'width 0.3s' }} />
        </div>
        <div style={{ color: gateMet ? '#8a9ab8' : AMBER, fontSize: '11px', marginTop: '8px' }}>
          {gateMet
            ? 'The team has cleared the $300k monthly gate — every bonus below is live.'
            : `The team is ${money(gateRemaining)} away from $300,000 enrolled this month. No bonus pays until the gate is cleared.`}
        </div>
      </div>

      {/* ── TRANSFER VALIDATION ── */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '6px', padding: '16px', marginBottom: '14px' }}>
        <div style={{ color: BLUE, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '10px' }}>🔍 Transfer Validation</div>
        <div style={{ color: '#8a9ab8', fontSize: '11px', marginBottom: '10px', lineHeight: 1.5 }}>A valid transfer = customer was transferred to a Sr. Debt Specialist AND spent at least 30 seconds on the phone with them. Only valid transfers count toward the daily volume bonus.</div>
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
            <div style={{ color: GOLD, fontSize: '22px', fontWeight: 'bold' }}>{deals.length}</div>
            <div style={{ color: '#6b7280', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '3px' }}>💎 Closed Deals</div>
          </div>
        </div>
        {invalidTransfers.length > 0 && (
          <div style={{ marginTop: '10px', padding: '8px 12px', background: `${RED}08`, border: `1px solid ${RED}22`, borderRadius: '4px', color: RED, fontSize: '10px' }}>
            ⚠ {invalidTransfers.length} transfer(s) did not meet the 30-second minimum or have no Sr. Debt Specialist assigned — they don't count toward your volume tiers.
          </div>
        )}
      </div>

      {/* ── DAILY DEAL BONUS ── */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', padding: '16px', marginBottom: '14px' }}>
        <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>📅 Daily Deal Bonus <span style={{ color: GOLD, fontSize: '18px' }}>{todayDeals}</span> <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: 'normal' }}>closed today</span></div>
        <div style={{ color: '#6b7280', fontSize: '10px', marginBottom: '10px' }}>Paid per deal · 1–2 deals = $10 each · 3+ deals = $12 each</div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <BonusTier label="1 Deal" reward="$10/ea" achieved={todayDeals >= 1} progress={Math.min(todayDeals, 1)} max={1} color={GOLD} />
          <BonusTier label="2 Deals" reward="$10/ea" achieved={todayDeals >= 2} progress={Math.min(todayDeals, 2)} max={2} color={GREEN} />
          <BonusTier label="3+ Deals" reward="$12/ea" achieved={todayDeals >= 3} progress={Math.min(todayDeals, 3)} max={3} color={PURPLE} />
        </div>
        <PayoutRow label={`Today's deal bonus (${todayDeals} × $${todayDeals ? dailyRate : 0})`} amount={dailyDealBonus} locked={!gateMet} color={GOLD} />
      </div>

      {/* ── DAILY VOLUME BONUS ── */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '6px', padding: '16px', marginBottom: '14px' }}>
        <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>📞 Daily Volume Bonus <span style={{ color: PURPLE, fontSize: '18px' }}>{todayTransfers}</span> <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: 'normal' }}>valid transfers today</span></div>
        <div style={{ color: '#6b7280', fontSize: '10px', marginBottom: '10px' }}>Flat daily bonus from your own transfer volume</div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <BonusTier label="10 Transfers" reward="$5" achieved={todayTransfers >= 10} progress={Math.min(todayTransfers, 10)} max={10} color={BLUE} />
          <BonusTier label="15 Transfers" reward="$10" achieved={todayTransfers >= 15} progress={Math.min(todayTransfers, 15)} max={15} color={GREEN} />
          <BonusTier label="20+ Transfers" reward="$15" achieved={todayTransfers >= 20} progress={Math.min(todayTransfers, 20)} max={20} color={PURPLE} />
        </div>
        <PayoutRow label="Today's volume bonus" amount={volumeBonus} locked={!gateMet} color={PURPLE} />
      </div>

      {/* ── WEEKLY DEAL BONUS ── */}
      <div style={{ background: '#0d1b2a', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '6px', padding: '16px', marginBottom: '14px' }}>
        <div style={{ color: '#e8e0d0', fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>📆 Weekly Deal Bonus <span style={{ color: BLUE, fontSize: '18px' }}>{weekDeals}</span> <span style={{ color: '#6b7280', fontSize: '12px', fontWeight: 'normal' }}>closed this week (Sun–Sat)</span></div>
        <div style={{ color: '#6b7280', fontSize: '10px', marginBottom: '10px' }}>Paid per deal · 1–4 deals = $5 each · 5–9 deals = $10 each · 10+ deals = $15 each</div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <BonusTier label="1–4 Deals" reward="$5/ea" achieved={weekDeals >= 1} progress={Math.min(weekDeals, 4)} max={4} color={BLUE} />
          <BonusTier label="5–9 Deals" reward="$10/ea" achieved={weekDeals >= 5} progress={Math.min(weekDeals, 9)} max={9} color={GREEN} />
          <BonusTier label="10+ Deals" reward="$15/ea" achieved={weekDeals >= 10} progress={Math.min(weekDeals, 10)} max={10} color={PURPLE} />
        </div>
        <PayoutRow label={`This week's deal bonus (${weekDeals} × $${weeklyRate})`} amount={weeklyDealBonus} locked={!gateMet} color={BLUE} />
      </div>

      {/* ── TOTAL ── */}
      <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(96,165,250,0.12))', border: `1px solid ${gateMet ? GOLD + '44' : AMBER + '44'}`, borderRadius: '6px', padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#e8e0d0', fontSize: '15px', fontWeight: 'bold' }}>{gateMet ? '🏆 Total Bonus (Today + Weekly)' : '🔒 Total Bonus — locked'}</span>
          <span style={{ color: gateMet && totalBonus > 0 ? GOLD : '#6b7280', fontSize: '28px', fontWeight: 'bold', fontFamily: 'monospace' }}>{money(totalBonus)}</span>
        </div>
        {!gateMet && (
          <div style={{ color: AMBER, fontSize: '11px', marginTop: '8px' }}>
            Unlocks the moment the team passes {money(TEAM_GATE)} enrolled this month — {money(gateRemaining)} to go.
          </div>
        )}
      </div>
    </div>
  );
}

function PayoutRow({ label, amount, locked, color }) {
  const paid = !locked && amount > 0;
  return (
    <div style={{ padding: '10px 14px', background: paid ? `${color}12` : 'rgba(255,255,255,0.03)', border: `1px solid ${paid ? color + '44' : 'rgba(255,255,255,0.07)'}`, borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: locked ? AMBER : '#8a9ab8', fontSize: '12px' }}>{locked ? `🔒 ${label} — team gate not met` : label}</span>
      <span style={{ color: paid ? color : '#6b7280', fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace' }}>{money(amount)}</span>
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