/**
 * ScoreThresholds.jsx — where the lines sit: the score that makes a lead hot,
 * engaged or warming, what a migrated lead starts on, and the crawler filter.
 */
import FieldNumber from '@/components/automation/FieldNumber';

export default function ScoreThresholds({ thresholds, defaults, set }) {
  const changed = (key) => Number(thresholds[key]) !== Number(defaults[key]);
  const field = (key) => ({
    value: thresholds[key],
    changed: changed(key),
    onChange: (value) => set({ [key]: value }),
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(158px, 1fr))', gap: '10px' }}>
      <FieldNumber label="Hot at" max={100} hint="A lead scoring this or above is a hot lead" {...field('hotScore')} />
      <FieldNumber label="Engaged at" max={100} hint="Between warming and hot" {...field('engagedScore')} />
      <FieldNumber label="Warming at" max={100} hint="Below this a lead reads cold" {...field('warmingScore')} />
      <FieldNumber label="Migrated leads start at" max={100} hint="What a fronter prospect starts on in Debt Call Coach" {...field('migrationStartScore')} />
      <FieldNumber label="Ignore the first (seconds)" max={600} hint="Mail preview crawlers open instantly — activity inside this window is ignored" {...field('botFilterSeconds')} />
    </div>
  );
}