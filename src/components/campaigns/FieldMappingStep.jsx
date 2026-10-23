/**
 * FieldMappingStep.jsx — step 2: match the CSV's columns to Settlement IQ fields,
 * then look at exactly who would be emailed and who would not.
 *
 * The check runs on the server, in chunks, without writing anything. Committing
 * is a second, explicit action — it creates the contact cards and the recipient
 * rows, and still sends nothing.
 */
import { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Btn, Card, DIM, Field, GOLD, MUTED, Stat, SURFACE, BORDER, inputStyle } from './kit';
import { CAMPAIGN_FIELDS, applyMapping, downloadCsv, looksLikeEmail, rejectionCsv } from '@/lib/csvCampaign';

const CHUNK = 400;
const CHUNK_FIELDS = ['email', 'firstName', 'lastName', 'phone', 'company', 'address', 'city', 'state', 'zip', 'source', 'status'];

/** The rows the server will be asked about, in chunks, with file-level duplicates removed first. */
function chunksFor(rows, mapping) {
  const seen = new Set();
  const duplicates = [];
  const prepared = [];
  for (const row of rows) {
    const mapped = applyMapping(row, mapping);
    const email = String(mapped.email || '').trim().toLowerCase();
    if (email && seen.has(email)) {
      duplicates.push({ email, firstName: mapped.firstName || '', lastName: mapped.lastName || '', reason: 'Duplicate inside this file' });
      continue;
    }
    if (email) seen.add(email);
    const payload = {};
    for (const key of CHUNK_FIELDS) payload[key] = mapped[key] || '';
    payload.custom = mapped.custom || {};
    prepared.push(payload);
  }
  const chunks = [];
  for (let i = 0; i < prepared.length; i += CHUNK) chunks.push(prepared.slice(i, i + CHUNK));
  return { chunks, duplicates, prepared: prepared.length };
}

export default function FieldMappingStep({ campaign, csv, mapping, setMapping, report, setReport, onCommitted }) {
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const setField = (key, column) => setMapping((prev) => ({ ...prev, [key]: column }));

  const run = async (mode) => {
    if (!csv?.rows?.length) return;
    if (!mapping.email) { setError('Choose which column holds the email address — email campaigns need one.'); return; }
    setError('');
    setBusy(mode);
    setProgress('');
    try {
      const { chunks, duplicates, prepared } = chunksFor(csv.rows, mapping);
      const tally = { imported: 0, eligible: 0, excluded: [...duplicates], createdCards: 0, updatedCards: 0, matchedCards: 0, tokenReused: 0 };
      for (let i = 0; i < chunks.length; i += 1) {
        setProgress(`Checking rows ${i * CHUNK + 1}–${Math.min(prepared, (i + 1) * CHUNK)} of ${prepared.toLocaleString()}…`);
        const res = await base44.functions.invoke('emailCampaignImport', {
          campaignId: campaign.id,
          mode,
          listName: campaign.listName || csv.fileName || '',
          rows: chunks[i],
        });
        const data = res?.data || res;
        if (data?.error) throw new Error(data.error);
        tally.imported += Number(data?.processed || 0);
        tally.eligible += Number(data?.eligible || 0);
        tally.createdCards += Number(data?.createdCards || 0);
        tally.updatedCards += Number(data?.updatedCards || 0);
        tally.matchedCards += Number(data?.matchedCards || 0);
        tally.tokenReused += Number(data?.tokenReused || 0);
        if (Array.isArray(data?.excluded)) tally.excluded.push(...data.excluded);
      }
      // The rows this file sent were counted by the server; add the file-level duplicates it never saw.
      tally.imported += duplicates.length;
      setReport({ ...tally, mode });
      setProgress('');
      if (mode === 'commit') onCommitted();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'The list could not be checked.');
      setProgress('');
    }
    setBusy('');
  };

  // The first row as it will actually be saved, so the split is visible before anything is written.
  const preview = useMemo(() => {
    const row = csv?.rows?.[0];
    if (!row || !(mapping.fullName || mapping.fullAddress || mapping.address)) return null;
    const mapped = applyMapping(row, mapping);
    const parts = [
      mapped.firstName && `first name “${mapped.firstName}”`,
      mapped.lastName && `last name “${mapped.lastName}”`,
      mapped.address && `street “${mapped.address}”`,
      mapped.city && `city “${mapped.city}”`,
      mapped.state && `state “${mapped.state}”`,
      mapped.zip && `ZIP “${mapped.zip}”`,
    ].filter(Boolean);
    return parts.join(' · ');
  }, [csv, mapping]);

  const reasons = report?.excluded?.reduce((acc, row) => {
    const key = row.reason || 'Excluded';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}) || {};

  const invalidCount = (report?.excluded || []).filter((row) => !looksLikeEmail(row.email)).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Card
        title="Step 2 — Map the columns"
        hint="Suggested from the header line. A single Full name or Full address column is split for you — first and last, street, city, state and ZIP — and anything mapped nowhere is still kept on the recipient as an extra column."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '10px' }}>
          {CAMPAIGN_FIELDS.map((field) => (
            <Field key={field.key} label={`${field.label}${field.required ? ' *' : ''}`}>
              <select style={inputStyle} value={mapping[field.key] || ''} onChange={(e) => setField(field.key, e.target.value)}>
                <option value="">— not mapped —</option>
                {(csv?.headers || []).map((header) => <option key={header} value={header}>{header}</option>)}
              </select>
            </Field>
          ))}
        </div>
        {preview && (
          <div style={{ marginTop: '12px', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '5px', padding: '9px 11px', fontSize: '11px', color: '#c4cdd8' }}>
            <span style={{ color: GOLD, fontWeight: 'bold' }}>First row splits into — </span>
            {preview || 'nothing yet — check the columns above'}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Btn tone="blue" onClick={() => run('dry_run')} disabled={!!busy}>{busy === 'dry_run' ? 'Checking…' : '🔍 Check the list (no changes)'}</Btn>
          <Btn tone="gold" onClick={() => run('commit')} disabled={!!busy || !report}>{busy === 'commit' ? 'Importing…' : '✅ Commit import'}</Btn>
          {progress && <span style={{ color: MUTED, fontSize: '11px' }}>{progress}</span>}
          {busy === 'commit' && !report && <span style={{ color: DIM, fontSize: '11px' }}>Run the check first — committing writes contact cards and recipient rows.</span>}
        </div>
        {error && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '10px' }}>{error}</div>}
      </Card>

      {report && (
        <>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Stat label="Rows in the file" value={report.imported.toLocaleString()} color={MUTED} />
            <Stat label="Eligible" value={report.eligible.toLocaleString()} color={GOLD} hint="email present, valid, not opted out" />
            <Stat label="Excluded" value={report.excluded.length.toLocaleString()} color={report.excluded.length ? '#f59e0b' : MUTED} hint="see the reasons below" />
            <Stat label="Contact cards created" value={report.createdCards} color="#60a5fa" />
            <Stat label="Cards updated" value={report.updatedCards} color="#60a5fa" hint="empty fields filled only" />
            <Stat label="Existing cards matched" value={report.matchedCards} color="#60a5fa" hint={`${report.tokenReused} already had an invitation token`} />
          </div>

          <Card
            title="Row-level report"
            hint={report.mode === 'commit' ? 'This import is committed — the eligible recipients are ready for step 3.' : 'Nothing has been written yet. Commit the import once these numbers look right.'}
            actions={
              <Btn tone="ghost" onClick={() => downloadCsv(`excluded-${campaign.name || 'campaign'}.csv`, rejectionCsv(report.excluded))} disabled={!report.excluded.length}>
                ⬇ Download rejected rows
              </Btn>
            }
          >
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {Object.entries(reasons).map(([reason, count]) => (
                <span key={reason} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: '3px', padding: '3px 9px', fontSize: '11px', color: '#c4cdd8' }}>
                  {reason}: <strong style={{ color: GOLD }}>{count}</strong>
                </span>
              ))}
              {!report.excluded.length && <span style={{ color: GOLD, fontSize: '11px' }}>Every row is eligible.</span>}
            </div>
            {invalidCount > 0 && (
              <div style={{ color: MUTED, fontSize: '11px', marginBottom: '10px' }}>
                {invalidCount} row{invalidCount === 1 ? '' : 's'} had no usable email address. Nothing is sent to those — they only appear in the download.
              </div>
            )}
            <div style={{ maxHeight: '320px', overflowY: 'auto', border: `1px solid ${BORDER}`, borderRadius: '5px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 9px', color: GOLD, borderBottom: `1px solid ${BORDER}` }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '6px 9px', color: GOLD, borderBottom: `1px solid ${BORDER}` }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '6px 9px', color: GOLD, borderBottom: `1px solid ${BORDER}` }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {report.excluded.slice(0, 200).map((row, i) => (
                    <tr key={i}>
                      <td style={{ padding: '5px 9px', color: '#c4cdd8', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{row.email || '—'}</td>
                      <td style={{ padding: '5px 9px', color: MUTED, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{`${row.firstName || ''} ${row.lastName || ''}`.trim() || '—'}</td>
                      <td style={{ padding: '5px 9px', color: '#f59e0b', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.excluded.length > 200 && <div style={{ color: DIM, fontSize: '10px', marginTop: '6px' }}>Showing the first 200 — the download holds all {report.excluded.length}.</div>}
          </Card>
        </>
      )}
    </div>
  );
}