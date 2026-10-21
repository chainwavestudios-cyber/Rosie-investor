/**
 * intentReport.js — renders the intent engine's post-call result into the
 * report the agent reads before the next call (analysis + playbook).
 *
 * The engine returns one JSON object; this turns it into plain text so it can
 * be stored on the transcript record and shown word-for-word in the UI.
 */

const bullets = (items, prefix = '• ') =>
  (Array.isArray(items) ? items.filter(Boolean) : []).map(i => `${prefix}${i}`);

const pct = (v) => (typeof v === 'number' ? `${v}%` : '—');

export function buildIntentReport(intent) {
  if (!intent) return '';
  const p = intent.playbook || {};
  const out = [];

  out.push(`🎯 INTENT REPORT — ${intent.intentScore ?? '—'}/100`);
  const interest = intent.interestLevel ? `${intent.interestLevel} interest` : '';
  const animal = intent.animalType === 'duck' ? '🦆 Duck (skeptical)' : intent.animalType === 'cow' ? '🐄 Cow (curious/buying)' : 'Unknown personality';
  out.push([animal, interest].filter(Boolean).join(' · '));
  out.push('');
  out.push(intent.report || intent.interestReason || intent.tonalityNotes || '');

  out.push('', '━━━ HOW THEY SOUNDED ━━━');
  out.push(`Tonality: ${intent.tonality || '—'} — ${intent.tonalityNotes || '—'}`);
  out.push(`Engagement: ${pct(intent.engagementScore)} — ${intent.engagementNotes || '—'}`);
  out.push(`Excitement: ${intent.excitementLevel || '—'} — ${intent.excitementNotes || '—'}`);
  out.push(`Emotional state: ${intent.emotionalState || '—'} — ${intent.emotionalNotes || '—'}`);
  out.push(`Sentiment arc: ${intent.sentimentArc || '—'} — ${intent.sentimentArcNotes || '—'}`);
  out.push(`Rapport: ${pct(intent.rapportLevel)} — ${intent.rapportNotes || '—'}`);
  out.push(`Pace: ${intent.pace || '—'} — ${intent.paceNotes || '—'}`);
  out.push(`Commitment: ${intent.commitmentLevel || 'none'}${intent.commitmentDetails ? ` — ${intent.commitmentDetails}` : ''}`);
  out.push(`Talk ratio (their share): ${pct(intent.talkRatioProspect)} · Questions asked: ${intent.questionCount ?? '—'} · Hesitations: ${intent.hesitationCount ?? '—'} · Objections: ${intent.objectionCount ?? '—'} · Buying signals: ${intent.buyingSignalCount ?? '—'}`);

  out.push('', '━━━ WHAT THEY ACTUALLY SAID ━━━');
  if (intent.buyingSignals?.length) {
    out.push('Buying signals:');
    out.push(...bullets(intent.buyingSignals, '  ✅ '));
  }
  if (intent.objections?.length) {
    out.push('Objections raised:');
    out.push(...bullets(intent.objections, '  ⚠️ '));
  }
  if (intent.keyMoments?.length) {
    out.push('Key moments:');
    out.push(...bullets(intent.keyMoments, '  ▸ '));
  }

  out.push('', '━━━ PERSONALITY & ENGAGEMENT READ ━━━');
  out.push(intent.personalityProfile || '—');
  out.push(intent.engagementReadOut || '');

  out.push('', '━━━ NEXT CALL PLAN ━━━');
  if (p.nextCallObjective) out.push(`Objective: ${p.nextCallObjective}`);
  out.push(...bullets(p.nextCallPlan, '  1) '));
  if (p.pointers?.length) {
    out.push('Pointers:');
    out.push(...bullets(p.pointers, '  → '));
  }

  const objections = Array.isArray(p.objectionsExpected) ? p.objectionsExpected.filter(o => o?.objection || o?.sayThisVerbatim) : [];
  if (objections.length) {
    out.push('', '━━━ OBJECTIONS COMING — AND WHAT TO SAY ━━━');
    objections.forEach((o, i) => {
      out.push(`${i + 1}. “${o.objection || ''}”`);
      if (o.whyItIsComing) out.push(`   Why it's coming: ${o.whyItIsComing}`);
      if (o.sayThisVerbatim) out.push(`   👉 SAY THIS: “${o.sayThisVerbatim}”`);
      if (o.kbTopic) out.push(`   KB back-up: ${o.kbTopic}`);
    });
  }

  if (p.openingLinesToRead?.length || p.closingLinesToRead?.length) {
    out.push('', '━━━ READ THIS WORD FOR WORD ━━━');
    if (p.openingLinesToRead?.length) {
      out.push('To open the call:');
      p.openingLinesToRead.filter(Boolean).forEach(l => out.push(`   “${l}”`));
    }
    if (p.closingLinesToRead?.length) {
      out.push('To close it:');
      p.closingLinesToRead.filter(Boolean).forEach(l => out.push(`   “${l}”`));
    }
  }

  if (p.kbTopicsToLoad?.length) {
    out.push('', '━━━ PULL UP BEFORE DIALING ━━━');
    out.push(...bullets(p.kbTopicsToLoad, '  📚 '));
  }

  const facts = Array.isArray(intent.keyFacts) ? intent.keyFacts.filter(f => f?.fact) : [];
  if (facts.length) {
    out.push('', '━━━ KEY FACTS TO REMEMBER ━━━');
    out.push(...facts.map(f => `  ★ ${f.fact}${f.context ? ` (${f.context})` : ''}`));
  }

  return out.filter(l => l !== undefined && l !== null && l !== '').join('\n');
}