/**
 * ScoreCard.jsx
 *
 * Gamified scorecards for Yoda (admin) and Steph — displayed at the top of the Leads tab.
 * All data is persisted to the ScorecardEntry entity in Base44.
 *
 * Requires entity: ScorecardEntry
 *   username  (string)  "admin" | "steph"
 *   dateKey   (string)  "2026-05-18"
 *   weekKey   (string)  "2026-W21"
 *   calls     (number)  dials made on this date
 *   fronts    (number)  NB Tech toggles on this date
 *
 * Weekly totals = SUM of all rows for username + weekKey.
 * Steph bonus   = 100 + (weeklyFronts * 25)  — no separate storage needed.
 *
 * Exported helpers (used by dialers / contact card):
 *   fireScorecardCall(username)
 *   fireScorecardNBTechConvert(username)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ScorecardEntryDB } from '@/api/entities';

// ─── Public event helpers ─────────────────────────────────────────────────────

export function fireScorecardCall(username) {
  ScorecardEntryDB.incrementCalls(username);
  window.dispatchEvent(new CustomEvent('scorecard:call', { detail: { username } }));
}

export function fireScorecardNBTechConvert(username) {
  ScorecardEntryDB.incrementFronts(username);
  window.dispatchEvent(new CustomEvent('scorecard:nb_front', { detail: { username } }));
}

// ─── Individual card ──────────────────────────────────────────────────────────

function ScoreCard({ username, displayName }) {
  const isSteph = username === 'steph';

  const [scores, setScores] = useState({ calls24: 0, fronts24: 0, callsWeek: 0, frontsWeek: 0 });
  const [loading, setLoading] = useState(true);
  const mountedRef   = useRef(true);
  const debounceRef  = useRef(null); // prevents multiple rapid reloads when dialer fires events

  const loadScores = useCallback(async () => {
    try {
      const [todayRow, weekRows] = await Promise.all([
        ScorecardEntryDB.getTodayRow(username),
        ScorecardEntryDB.getWeekRows(username),
      ]);
      if (!mountedRef.current) return;
      setScores({
        calls24:    todayRow?.calls  || 0,
        fronts24:   todayRow?.fronts || 0,
        callsWeek:  weekRows.reduce((s, r) => s + (r.calls  || 0), 0),
        frontsWeek: weekRows.reduce((s, r) => s + (r.fronts || 0), 0),
      });
    } catch(e) {
      console.warn('[ScoreCard] load error:', e?.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [username]);

  // Initial load
  useEffect(() => {
    mountedRef.current = true;
    loadScores();
    return () => { mountedRef.current = false; };
  }, [loadScores]);

  // Listen for events — optimistic UI update + debounced DB re-fetch
  // Debounce prevents 3 simultaneous dialer lines each triggering a reload
  useEffect(() => {
    const debouncedLoad = () => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(loadScores, 3000);
    };
    const onCall = (e) => {
      if (e.detail?.username !== username) return;
      setScores(prev => ({ ...prev, calls24: prev.calls24 + 1, callsWeek: prev.callsWeek + 1 }));
      debouncedLoad();
    };
    const onFront = (e) => {
      if (e.detail?.username !== username) return;
      setScores(prev => ({ ...prev, fronts24: prev.fronts24 + 1, frontsWeek: prev.frontsWeek + 1 }));
      debouncedLoad();
    };
    window.addEventListener('scorecard:call', onCall);
    window.addEventListener('scorecard:nb_front', onFront);
    return () => {
      clearTimeout(debounceRef.current);
      window.removeEventListener('scorecard:call', onCall);
      window.removeEventListener('scorecard:nb_front', onFront);
    };
  }, [username, loadScores]);

  // Poll every 2 min — syncs updates made by the other user
  // Was 30s but caused rate limits during heavy dialing sessions
  useEffect(() => {
    const interval = setInterval(loadScores, 120_000);
    return () => clearInterval(interval);
  }, [loadScores]);

  // Re-load on tab focus — catches midnight / week boundary crossovers
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') loadScores(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadScores]);

  const bonus = 100 + (scores.frontsWeek * 25);

  const COLS = [
    { label: 'Calls -24hr',  value: scores.calls24    },
    { label: 'Fronts-24hr',  value: scores.fronts24   },
    { label: 'Calls -Week',  value: scores.callsWeek  },
    { label: 'Fronts -Week', value: scores.frontsWeek },
  ];

  const GRADIENT = 'linear-gradient(135deg, #ff6b6b 0%, #c850c0 55%, #8b5cf6 100%)';

  return (
    <div style={{
      background: GRADIENT,
      borderRadius: '10px',
      padding: '5px 10px 5px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      height: '48px',
      boxShadow: '0 3px 16px rgba(0,0,0,0.45)',
      position: 'relative',
      overflow: 'hidden',
      flexShrink: 0,
      opacity: loading ? 0.75 : 1,
      transition: 'opacity 0.3s',
    }}>

      {/* Shimmer */}
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.12) 50%, transparent 65%)', pointerEvents:'none' }} />

      {/* Name */}
      <span style={{
        fontFamily: '"Pacifico", "Dancing Script", cursive',
        fontSize: displayName === 'Yoda' ? '21px' : '19px',
        fontWeight: 900, color: '#1a1025',
        textShadow: '0 1px 0 rgba(255,255,255,0.2)',
        flexShrink: 0, lineHeight: 1, minWidth: '50px', zIndex: 1,
      }}>
        {displayName}
      </span>

      {/* 4-column grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 54px)',
        gridTemplateRows: '18px 18px',
        border: '2px solid rgba(0,0,0,0.55)',
        borderRadius: '4px',
        overflow: 'hidden',
        flexShrink: 0, zIndex: 1,
      }}>
        {COLS.map((c, i) => (
          <div key={`lbl-${i}`} style={{
            display:'flex', alignItems:'center', justifyContent:'center',
            background: 'rgba(175,55,175,0.55)',
            borderBottom: '1px solid rgba(0,0,0,0.4)',
            borderRight: i < 3 ? '1px solid rgba(0,0,0,0.4)' : 'none',
            fontSize: '8px', fontWeight: 800, color: '#1a1025',
            textAlign: 'center', padding: '0 2px', lineHeight: 1,
          }}>
            {c.label}
          </div>
        ))}
        {COLS.map((c, i) => (
          <div key={`val-${i}`} style={{
            display:'flex', alignItems:'center', justifyContent:'center',
            background: 'rgba(120,45,195,0.45)',
            borderRight: i < 3 ? '1px solid rgba(0,0,0,0.4)' : 'none',
            fontSize: '13px', fontWeight: 900, color: '#1a1025',
          }}>
            {loading ? '·' : c.value}
          </div>
        ))}
      </div>

      {/* Ring + Bonus — Steph only */}
      {isSteph && <>
        <span style={{ fontSize:'20px', filter:'drop-shadow(0 1px 3px rgba(0,0,0,0.5))', flexShrink:0, zIndex:1 }}>💍</span>
        <div style={{
          background: 'rgba(0,0,0,0.32)', border: '2.5px solid rgba(0,0,0,0.6)',
          borderRadius: '7px', padding: '3px 9px',
          display: 'flex', alignItems: 'center', gap: '1px', flexShrink: 0, zIndex: 1,
        }}>
          <span style={{ fontSize:'15px', fontWeight:900, background:'linear-gradient(135deg,#00cfff,#ff2dff)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>$</span>
          <span style={{ fontSize:'14px', fontWeight:900, color:'#fff', textShadow:'0 1px 4px rgba(0,0,0,0.7)' }}>{loading ? '···' : bonus}</span>
        </div>
      </>}
    </div>
  );
}

// ─── Both cards ───────────────────────────────────────────────────────────────

export default function ScoreCards() {
  return (
    <div style={{ display:'flex', gap:'10px', alignItems:'center', flexShrink:0 }}>
      <ScoreCard username="steph" displayName="Steph" />
      <ScoreCard username="admin" displayName="Yoda"  />
    </div>
  );
}