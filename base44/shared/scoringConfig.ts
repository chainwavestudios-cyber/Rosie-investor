/**
 * scoringConfig.ts — reading the editable rule set.
 *
 * The numbers live in the single ScoringConfig record the Automations & Scoring
 * screen edits; the model they feed lives in engagement.ts. Every reader goes
 * through here, so one saved change moves every score in the app at once.
 */
import { resolveScoring } from './engagement.ts';

/** How many vetted links have to be clicked before the follow-up email sends. */
export const DEFAULT_FOLLOW_UP_LINKS = 2;

const positive = (value: any, fallback: number, min = 1) =>
  Math.max(min, Math.round(Number(value ?? fallback) || fallback));

/** The one ScoringConfig record, or null when the screen has never been saved. */
export async function readScoringRecord(base44: any) {
  const raw = await base44.asServiceRole.entities.ScoringConfig.filter({ configName: 'engagement' }, { limit: 5 });
  return (Array.isArray(raw) ? raw[0] : (raw?.items || [])[0]) || null;
}

/** The rules in force right now: the stored values merged over the built-in defaults. */
export function rulesFromRecord(record: any) {
  const rules: any = resolveScoring(record);
  return { ...rules, followUpLinksRequired: positive(record?.followUpLinksRequired, DEFAULT_FOLLOW_UP_LINKS) };
}

/** A missing record, or a read that fails, means the built-in rules — never an error. */
export async function readScoringRules(base44: any) {
  return rulesFromRecord(await readScoringRecord(base44).catch(() => null));
}