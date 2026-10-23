/**
 * ScorePatterns.jsx — the combinations that mean more than the sum of their opens,
 * and the one pattern that outranks the number entirely.
 */
import { C } from '@/components/superadmin/kit';
import FieldNumber from '@/components/automation/FieldNumber';

export default function ScorePatterns({ patterns, defaults, set }) {
  const changed = (key) => Number(patterns[key]) !== Number(defaults[key]);
  const field = (key, label, hint, max) => (
    <FieldNumber label={label} hint={hint} max={max || 100} value={patterns[key]} changed={changed(key)} onChange={(value) => set({ [key]: value })} />
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
      {field('bothReminders', 'Both reminders opened', 'Night-before and the reminder email both opened')}
      {field('followUpTwoLinks', 'Follow-up 2+ links', 'Clicked 2+ links in the follow-up introduction')}
      {field('credsRepeatPattern', 'Credentials repeat pattern', 'Opened the credentials email again and again')}
      {field('credsRepeatOpens', 'Repeat opens that count', 'How many opens make that a pattern', 20)}
      {field('credsOpensWithSite', 'Opens + our site', 'Opens that count when they also visited our own site', 20)}
      {field('goldenAvatar', 'Golden Boy + avatar', 'Opened the Golden Boy mail and watched the avatar')}
      {field('fronterClick', 'Fronter — a click', 'Clicked a link in the fronter cold outreach')}
      {field('fronterRepeatOpens', 'Fronter — repeat opens', 'Opened the cold outreach more than once')}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: C.ink, fontSize: '11px', lineHeight: '1.5', gridColumn: '1 / -1' }}>
        <input
          type="checkbox"
          checked={patterns.credsQualifyIsHot !== false}
          onChange={(event) => set({ credsQualifyIsHot: event.target.checked })}
          style={{ marginTop: '2px' }}
        />
        Reaching the qualification page from the credentials email makes the lead hot, whatever the score says
      </label>
    </div>
  );
}