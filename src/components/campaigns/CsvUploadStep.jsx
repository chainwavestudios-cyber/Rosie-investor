/**
 * CsvUploadStep.jsx — step 1: take the file and read it.
 *
 * The file is parsed in the browser; nothing leaves the page until a mapping is
 * confirmed. A campaign never starts sending from this step, or any step, on
 * its own.
 */
import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Btn, Card, DIM, Field, GOLD, MUTED, SURFACE, BORDER, inputStyle } from './kit';
import { readCsv, importedListCsv, downloadCsv } from '@/lib/csvCampaign';
import ProspectPicker from './ProspectPicker';

const PROSPECT_HEADERS = ['Email', 'First name', 'Last name', 'Phone', 'City', 'State', 'Debt amount ($)', 'Lead source'];
const PROSPECT_MAPPING = {
  email: 'Email',
  firstName: 'First name',
  lastName: 'Last name',
  phone: 'Phone',
  city: 'City',
  state: 'State',
  debtAmount: 'Debt amount ($)',
  source: 'Lead source',
};

export default function CsvUploadStep({ campaign, csv, setCsv, setMapping, save, username }) {
  const inputRef = useRef(null);
  const [source, setSource] = useState('csv');
  const [listName, setListName] = useState(campaign?.listName || '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Prospects fill the same row shape a CSV produces, so every later step is unchanged.
  const useProspects = (leads) => {
    const rows = leads.map((lead) => ({
      'Email': lead.email || '',
      'First name': lead.firstName || '',
      'Last name': lead.lastName || '',
      'Phone': lead.phone || '',
      'City': lead.city || '',
      'State': lead.state || '',
      'Debt amount ($)': lead.debtAmount || '',
      'Lead source': 'Prospect pipeline',
    }));
    setCsv({ fileName: `Prospects · ${new Date().toLocaleDateString()}`, headers: PROSPECT_HEADERS, rows, fromProspects: true });
    setMapping?.(PROSPECT_MAPPING);
    if (!listName) setListName(`Prospects · ${new Date().toLocaleDateString()}`);
  };

  // The rows live on the campaign itself, so the list survives a cancel or a finished run.
  const importedRows = Number(campaign?.importedCount || 0);

  const downloadList = async () => {
    setDownloading(true);
    const rows = [];
    let cursor = null;
    for (let page = 0; page < 10; page += 1) {
      const result = await base44.entities.EmailCampaignRecipient
        .filter({ campaignId: campaign.id }, { sort: 'created_date', limit: 1000, ...(cursor ? { cursor } : {}) })
        .catch(() => null);
      rows.push(...(result?.items || []));
      cursor = result?.next_cursor || null;
      if (!result?.has_more || !cursor) break;
    }
    downloadCsv(`list-${(campaign.name || 'campaign').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`, importedListCsv(rows));
    setDownloading(false);
  };

  const pick = async (file) => {
    setError('');
    setSaved('');
    if (!file) return;
    try {
      const text = await file.text();
      const { headers, rows } = readCsv(text);
      if (!headers.length || !rows.length) {
        setError('That file has no rows under its header line — export it again and check the first line holds the column names.');
        return;
      }
      setCsv({ fileName: file.name, headers, rows });
      if (!listName) setListName(file.name.replace(/\.csv$/i, ''));
    } catch (e) {
      setError(e?.message || 'That file could not be read.');
    }
  };

  const saveDraft = async () => {
    await save({
      listName: listName || csv?.fileName || 'Uploaded list',
      sourceFile: csv?.fileName || campaign?.sourceFile || '',
    });
    setSaved('Saved to this draft.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {importedRows > 0 && (
        <Card
          title="📄 This campaign already has its list"
          hint="Every imported row is held on the campaign, so cancelling or finishing it never takes the list away. Download it again, or upload a different file below."
          actions={<Btn tone="ghost" onClick={downloadList} disabled={downloading}>{downloading ? 'Building…' : '⬇ Download the list'}</Btn>}
        >
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', color: MUTED, fontSize: '12px' }}>
            <span style={{ color: GOLD, fontWeight: 'bold' }}>{campaign.sourceFile || 'Imported list'}</span>
            <span>{importedRows.toLocaleString()} rows imported</span>
            <span>{Number(campaign.eligibleCount || 0).toLocaleString()} eligible</span>
            {Number(campaign.excludedCount || 0) ? <span>{Number(campaign.excludedCount).toLocaleString()} excluded</span> : null}
            {campaign.listName ? <span>· {campaign.listName}</span> : null}
          </div>
        </Card>
      )}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Btn tone={source === 'csv' ? 'gold' : 'ghost'} onClick={() => setSource('csv')}>📁 Upload a CSV</Btn>
        <Btn tone={source === 'prospects' ? 'gold' : 'ghost'} onClick={() => setSource('prospects')}>👥 Pick from prospects</Btn>
      </div>

      {source === 'prospects' ? (
        <ProspectPicker onUse={useProspects} />
      ) : (
        <Card
          title="Step 1 — Upload the contacts file"
          hint="CSV exported from Excel, Google Sheets, a CRM or a lead vendor. Quoted commas, blank cells and a UTF-8 BOM are all handled."
        >
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
            style={{ border: `1px dashed ${csv ? `${GOLD}66` : BORDER}`, borderRadius: '6px', padding: '22px', textAlign: 'center', background: SURFACE }}
          >
            <div style={{ color: csv ? GOLD : MUTED, fontSize: '13px', fontWeight: 'bold' }}>
              {csv ? `✓ ${csv.fileName}` : 'Drop the CSV here, or choose it'}
            </div>
            <div style={{ color: DIM, fontSize: '11px', marginTop: '6px' }}>
              {csv
                ? `${csv.rows.length.toLocaleString()} rows · ${csv.headers.length} columns detected`
                : 'The file is read in the browser — nothing is imported until you confirm the mapping.'}
            </div>
            <input ref={inputRef} type="file" accept=".csv,.txt,text/csv" style={{ display: 'none' }} onChange={(e) => pick(e.target.files?.[0])} />
            <div style={{ marginTop: '14px' }}>
              <Btn tone={csv ? 'ghost' : 'gold'} onClick={() => inputRef.current?.click()}>{csv ? 'Choose a different file' : '📁 Choose CSV file'}</Btn>
            </div>
          </div>
          {error && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '10px' }}>{error}</div>}
        </Card>
      )}

      {csv && (
        <Card
          title={csv.fromProspects ? 'The prospects you picked' : 'What was found'}
          hint={csv.fromProspects
            ? 'These exact rows go through the mailbox check and the import next. People who already have a contact card keep it — only their empty fields are filled in.'
            : 'The first rows exactly as they were read — check that the header line landed in the header row, not as data.'}
          actions={<Btn tone="ghost" onClick={saveDraft}>💾 Save draft</Btn>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '10px', marginBottom: '12px' }}>
            <Field label="List / batch label" hint="Named on the campaign and in the contact card notes.">
              <input style={inputStyle} value={listName} onChange={(e) => setListName(e.target.value)} placeholder="March Facebook leads" />
            </Field>
            <Field label="Imported by">
              <input style={{ ...inputStyle, color: MUTED }} value={username || 'admin'} readOnly />
            </Field>
          </div>
          <div style={{ overflowX: 'auto', border: `1px solid ${BORDER}`, borderRadius: '5px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  {csv.headers.map((header) => (
                    <th key={header} style={{ textAlign: 'left', padding: '7px 9px', color: GOLD, borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csv.rows.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {csv.headers.map((header) => (
                      <td key={header} style={{ padding: '6px 9px', color: '#c4cdd8', borderBottom: `1px solid rgba(255,255,255,0.04)`, whiteSpace: 'nowrap' }}>{row[header] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ color: DIM, fontSize: '10px', marginTop: '8px' }}>Showing the first {Math.min(5, csv.rows.length)} of {csv.rows.length.toLocaleString()} rows.</div>
          {saved && <div style={{ color: GOLD, fontSize: '11px', marginTop: '8px' }}>{saved}</div>}
        </Card>
      )}
    </div>
  );
}