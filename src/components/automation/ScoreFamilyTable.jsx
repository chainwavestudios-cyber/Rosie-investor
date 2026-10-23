/**
 * ScoreFamilyTable.jsx — what each email family's behaviour is worth. One row per
 * family; the last column is the most a lead can earn from that family alone.
 */
import { C, chip } from '@/components/superadmin/kit';
import FieldNumber from '@/components/automation/FieldNumber';

const COLS = [
  { key: 'open', label: 'Open' },
  { key: 'repeat', label: 'Repeat open' },
  { key: 'click', label: 'Each link' },
  { key: 'depth', label: '2+ vetted' },
  { key: 'welcome', label: 'Welcome msg' },
  { key: 'qualify', label: 'Qualify page' },
  { key: 'site', label: 'Our site' },
];

const maxOf = (weights) =>
  Math.round(weights.open + weights.repeat * 3 + weights.click * 3 + weights.depth + weights.welcome + weights.qualify + weights.site);

const head = { color: C.dim, fontSize: '9px', letterSpacing: '0.8px', textTransform: 'uppercase', textAlign: 'left', padding: '0 6px 6px 0', whiteSpace: 'nowrap' };

export default function ScoreFamilyTable({ families, defaults, onWeight }) {
  const defaultsFor = (key) => defaults.find((row) => row.key === key)?.weights || {};
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: '6px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '880px' }}>
        <thead>
          <tr>
            <th style={{ ...head, paddingLeft: '10px' }}>Email family</th>
            {COLS.map((col) => <th key={col.key} style={head}>{col.label}</th>)}
            <th style={{ ...head, textAlign: 'right', paddingRight: '10px' }}>Most it can score</th>
          </tr>
        </thead>
        <tbody>
          {families.map((family) => {
            const base = defaultsFor(family.key);
            return (
              <tr key={family.key} style={{ borderTop: `1px solid ${C.border}` }}>
                <td style={{ padding: '8px 10px', minWidth: '210px' }}>
                  <div style={{ color: C.ink, fontSize: '11px', fontWeight: 'bold' }}>{family.label}</div>
                  <div style={{ marginTop: '3px' }}><span style={chip(family.system === 'coach' ? C.coach : C.fronter)}>{family.system}</span></div>
                </td>
                {COLS.map((col) => (
                  <td key={col.key} style={{ padding: '8px 6px 8px 0', width: '78px' }}>
                    <FieldNumber
                      value={family.weights[col.key]}
                      width="70px"
                      changed={Number(family.weights[col.key]) !== Number(base[col.key])}
                      onChange={(value) => onWeight(family.key, col.key, value)}
                    />
                  </td>
                ))}
                <td style={{ padding: '8px 10px 8px 0', textAlign: 'right', color: C.ink, fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                  {maxOf(family.weights)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}