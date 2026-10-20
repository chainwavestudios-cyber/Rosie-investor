/**
 * ClientDialCard.jsx — point-and-click dialing for either system.
 * Search a client, click the row, the softphone fills in and dials through Twilio.
 * The merge/transfer and fast-dial numbers come from the shared super-admin config,
 * so a change here changes what the assistant and fronters dial.
 */
import { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import AssistantDialer from '@/components/assistant/AssistantDialer';
import useSuperAdminConfig from '@/hooks/useSuperAdminConfig';
import { C, rowStyle, emptyStyle, chip, inputStyle, asArray } from '@/components/superadmin/kit';

const SYSTEMS = {
  coach: {
    label: 'Debt Call Coach clients',
    entity: () => base44.entities.DebtLead,
    name: (l) => `${l.firstName || ''} ${l.lastName || ''}`.trim(),
    meta: (l) => [l.leadNumber, l.status, l.city, l.state].filter(Boolean).join(' · '),
  },
  fronter: {
    label: 'Fronter leads',
    entity: () => base44.entities.FronterLead,
    name: (l) => `${l.firstName || ''} ${l.lastName || ''}`.trim(),
    meta: (l) => [l.leadNumber, l.status, l.city, l.state].filter(Boolean).join(' · '),
  },
};

export default function ClientDialCard({ system, username, dialTarget, setDialTarget }) {
  const cfgSys = SYSTEMS[system] || SYSTEMS.coach;
  const { config } = useSuperAdminConfig();
  const [query, setQuery] = useState('');
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const search = useCallback(async (q) => {
    setLoading(true);
    try {
      const E = cfgSys.entity();
      const term = q.trim();
      const res = term
        ? await E.filter({ $or: [
            { firstName: { $regex: term, $options: 'i' } },
            { lastName: { $regex: term, $options: 'i' } },
            { phone: { $regex: term } },
          ] }, '-updated_date', 25)
        : await E.list('-updated_date', 25);
      setClients(asArray(res));
    } catch { setClients([]); }
    setLoading(false);
  }, [cfgSys]);

  useEffect(() => { search(''); }, [search]);

  const fast = [
    { label: 'Transfer · 1', number: config?.transferPhoneNumber, show: config?.transferLabel, color: C.fronter },
    { label: 'Transfer · 2', number: config?.transferPhoneNumber2, show: config?.transferLabel2, color: C.coach },
    { label: 'Office', number: config?.chrisOfficePhone, color: C.warn },
    { label: 'Cell', number: config?.chrisCellPhone, color: C.purple },
  ].filter((f) => f.number);

  const pick = (client) => {
    const name = cfgSys.name(client);
    setDialTarget({ number: client.phone || '', name });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') search(query); }}
          placeholder={`Search ${cfgSys.label} — name or phone`}
          style={inputStyle}
        />
        <button onClick={() => search(query)} style={{ background: `${C.coach}1a`, color: C.coach, border: `1px solid ${C.coach}55`, borderRadius: '4px', padding: '0 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Search</button>
      </div>

      {fast.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', margin: '10px 0' }}>
          {fast.map((f) => (
            <button key={f.label} title={f.number} onClick={() => setDialTarget({ number: f.number, name: f.label })} style={{ background: `${f.color}14`, color: f.color, border: `1px solid ${f.color}44`, borderRadius: '4px', padding: '4px 9px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
              📞 {f.label} · {f.show || f.number}
            </button>
          ))}
        </div>
      )}

      {loading && <div style={emptyStyle}>Loading {cfgSys.label}…</div>}
      {!loading && clients.length === 0 && <div style={emptyStyle}>No clients matched.</div>}

      <div style={{ maxHeight: '260px', overflowY: 'auto', marginBottom: '12px' }}>
        {clients.map((client) => {
          const active = dialTarget?.number === client.phone;
          return (
            <button
              key={client.id}
              onClick={() => pick(client)}
              style={{ ...rowStyle, width: '100%', textAlign: 'left', cursor: 'pointer', borderColor: active ? C.coach : 'rgba(255,255,255,0.06)' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.ink, fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cfgSys.name(client) || 'Unnamed'}</div>
                <div style={{ color: C.dim, fontSize: '10px' }}>{client.phone || 'no phone'} · {cfgSys.meta(client)}</div>
              </div>
              {active && <span style={chip(C.coach)}>selected</span>}
            </button>
          );
        })}
      </div>

      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: '10px' }}>
        <AssistantDialer
          username={username}
          prefilledNumber={dialTarget?.number}
          prefilledName={dialTarget?.name}
        />
      </div>
    </div>
  );
}