import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function UpcomingReminders({ onOpenLeadCard, onOpenUserCard, onOpenDialer }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [leads, appts] = await Promise.all([
        base44.entities.Lead.list('-created_date', 2000),
        base44.entities.Appointment.filter({ status: 'scheduled' }),
      ]);

      const now = new Date();
      const future = [];

      // Lead callbacks
      leads.forEach(l => {
        if (l.callbackAt && new Date(l.callbackAt) > now) {
          future.push({
            type: 'lead',
            id: l.id,
            name: `${l.firstName} ${l.lastName}`,
            phone: l.phone,
            dateTime: l.callbackAt,
            raw: l,
          });
        }
      });

      // CRM appointments
      appts.forEach(a => {
        if (a.scheduledAt && new Date(a.scheduledAt) > now) {
          future.push({
            type: 'crm',
            id: a.id,
            name: a.investorName,
            phone: null, // fetched from user if needed
            dateTime: a.scheduledAt,
            investorId: a.investorId,
            raw: a,
          });
        }
      });

      future.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
      setItems(future.slice(0, 30));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '4px',
      width: '230px',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: GOLD, fontSize: '10px', letterSpacing: '2px', textTransform: 'uppercase' }}>📅 Upcoming</span>
        <span style={{ color: '#6b7280', fontSize: '11px' }}>{items.length}</span>
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
        {loading && <div style={{ color: '#6b7280', fontSize: '12px', padding: '16px', textAlign: 'center' }}>Loading…</div>}
        {!loading && items.length === 0 && (
          <div style={{ color: '#4a5568', fontSize: '11px', padding: '20px', textAlign: 'center' }}>No upcoming reminders</div>
        )}
        {items.map((item, i) => (
          <ReminderRow
            key={`${item.type}-${item.id}-${i}`}
            item={item}
            onOpenCard={() => {
              if (item.type === 'lead') onOpenLeadCard(item.raw);
              else onOpenUserCard(item.investorId);
            }}
            onDial={() => {
              if (item.phone) onOpenDialer({ firstName: item.name, lastName: '', phone: item.phone, id: item.id });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ReminderRow({ item, onOpenCard, onDial }) {
  const isLead = item.type === 'lead';
  const typeColor = isLead ? '#a78bfa' : '#60a5fa';

  return (
    <div style={{
      padding: '7px 10px',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
    }}>
      {/* Name + type badge on one line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ background: `${typeColor}22`, color: typeColor, fontSize: '8px', padding: '1px 5px', borderRadius: '2px', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>
          {isLead ? 'Lead' : 'CRM'}
        </span>
        <span
          onClick={onOpenCard}
          style={{ color: '#e8e0d0', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
          onMouseEnter={e => e.currentTarget.style.color = GOLD}
          onMouseLeave={e => e.currentTarget.style.color = '#e8e0d0'}
        >
          {item.name}
        </span>
      </div>

      {/* Date/time */}
      <div style={{ color: '#f59e0b', fontSize: '10px' }}>{fmt(item.dateTime)}</div>

      {/* Phone */}
      {item.phone && (
        <div
          onClick={onDial}
          style={{ color: '#4ade80', fontSize: '10px', fontFamily: 'monospace', cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.color = '#86efac'}
          onMouseLeave={e => e.currentTarget.style.color = '#4ade80'}
        >
          📞 {item.phone}
        </div>
      )}
    </div>
  );
}