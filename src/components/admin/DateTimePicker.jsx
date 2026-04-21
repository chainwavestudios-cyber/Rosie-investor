import { useState, useRef, useEffect } from 'react';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const HOURS = Array.from({length:12},(_,i)=>i===0?12:i); // 12,1..11
const MINUTES = ['00','15','30','45'];
const AMPM = ['AM','PM'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

// value: ISO datetime string or ''
// onChange: (isoString) => void
export default function DateTimePicker({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Parse value
  const parsed = value ? new Date(value) : null;
  const today = new Date();

  const [calYear, setCalYear] = useState(parsed ? parsed.getFullYear() : today.getFullYear());
  const [calMonth, setCalMonth] = useState(parsed ? parsed.getMonth() : today.getMonth());

  // Separate date + time state
  const [selDate, setSelDate] = useState(parsed ? new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()) : null);
  const [hour, setHour] = useState(parsed ? (parsed.getHours() % 12 || 12) : 10);
  const [minute, setMinute] = useState(parsed ? Math.round(parsed.getMinutes()/15)*15 % 60 : 0);
  const [ampm, setAmpm] = useState(parsed ? (parsed.getHours() >= 12 ? 'PM' : 'AM') : 'AM');

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const buildISO = (date, h, m, ap) => {
    if (!date) return '';
    let hours24 = h % 12;
    if (ap === 'PM') hours24 += 12;
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours24, m);
    return d.toISOString();
  };

  const handleDayClick = (day) => {
    const d = new Date(calYear, calMonth, day);
    setSelDate(d);
    onChange(buildISO(d, hour, minute, ampm));
  };

  const handleHourChange = (h) => {
    setHour(h);
    if (selDate) onChange(buildISO(selDate, h, minute, ampm));
  };
  const handleMinuteChange = (m) => {
    setMinute(m);
    if (selDate) onChange(buildISO(selDate, hour, m, ampm));
  };
  const handleAmpmChange = (ap) => {
    setAmpm(ap);
    if (selDate) onChange(buildISO(selDate, hour, minute, ap));
  };

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y=>y-1); }
    else setCalMonth(m=>m-1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y=>y+1); }
    else setCalMonth(m=>m+1);
  };

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);

  const displayValue = selDate
    ? `${MONTHS[selDate.getMonth()].slice(0,3)} ${selDate.getDate()}, ${selDate.getFullYear()}  ${hour}:${String(minute).padStart(2,'0')} ${ampm}`
    : 'Select date & time…';

  const inp = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:'2px', padding:'10px 14px', color: selDate ? '#e8e0d0' : '#4a5568', fontSize:'13px', outline:'none', boxSizing:'border-box', fontFamily:'Georgia, serif', cursor:'pointer', textAlign:'left' };
  const ls = { display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' };
  const sel = { background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'2px', padding:'7px 10px', color:'#e8e0d0', fontSize:'13px', outline:'none', cursor:'pointer', fontFamily:'Georgia,serif' };

  return (
    <div style={{ position:'relative', marginBottom:'16px' }} ref={ref}>
      {label && <label style={ls}>{label}</label>}
      <button type="button" onClick={() => setOpen(o=>!o)} style={inp}>
        📅 {displayValue}
      </button>

      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:9999, background:'#0d1b2a', border:'1px solid rgba(184,147,58,0.35)', borderRadius:'6px', boxShadow:'0 20px 60px rgba(0,0,0,0.8)', padding:'20px', width:'320px', fontFamily:'Georgia,serif' }}>

          {/* Month nav */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
            <button onClick={prevMonth} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#e8e0d0', borderRadius:'2px', padding:'4px 10px', cursor:'pointer', fontSize:'14px' }}>‹</button>
            <span style={{ color:GOLD, fontSize:'13px', letterSpacing:'1px' }}>{MONTHS[calMonth]} {calYear}</span>
            <button onClick={nextMonth} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#e8e0d0', borderRadius:'2px', padding:'4px 10px', cursor:'pointer', fontSize:'14px' }}>›</button>
          </div>

          {/* Day headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px', marginBottom:'4px' }}>
            {DAYS.map(d => <div key={d} style={{ textAlign:'center', color:'#4a5568', fontSize:'10px', letterSpacing:'1px', padding:'4px 0' }}>{d}</div>)}
          </div>

          {/* Days grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px', marginBottom:'16px' }}>
            {Array(firstDay).fill(null).map((_,i) => <div key={'e'+i} />)}
            {Array.from({length:daysInMonth},(_,i)=>i+1).map(day => {
              const isSelected = selDate && selDate.getDate()===day && selDate.getMonth()===calMonth && selDate.getFullYear()===calYear;
              const isToday = day===today.getDate() && calMonth===today.getMonth() && calYear===today.getFullYear();
              return (
                <button key={day} onClick={() => handleDayClick(day)}
                  style={{ textAlign:'center', padding:'6px 2px', borderRadius:'3px', border:'none', cursor:'pointer', fontSize:'12px',
                    background: isSelected ? `linear-gradient(135deg,${GOLD},#d4aa50)` : isToday ? 'rgba(184,147,58,0.15)' : 'transparent',
                    color: isSelected ? DARK : isToday ? GOLD : '#c4cdd8',
                    fontWeight: isSelected || isToday ? 'bold' : 'normal',
                  }}>
                  {day}
                </button>
              );
            })}
          </div>

          {/* Time selectors */}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', paddingTop:'14px' }}>
            <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>Time</div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <select value={hour} onChange={e=>handleHourChange(Number(e.target.value))} style={sel}>
                {HOURS.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
              <span style={{ color:'#6b7280', fontSize:'16px' }}>:</span>
              <select value={minute} onChange={e=>handleMinuteChange(Number(e.target.value))} style={sel}>
                {MINUTES.map(m=><option key={m} value={Number(m)}>{m}</option>)}
              </select>
              <select value={ampm} onChange={e=>handleAmpmChange(e.target.value)} style={sel}>
                {AMPM.map(a=><option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <button onClick={() => setOpen(false)} style={{ marginTop:'14px', width:'100%', background:`linear-gradient(135deg,${GOLD},#d4aa50)`, color:DARK, border:'none', borderRadius:'2px', padding:'9px', cursor:'pointer', fontWeight:'bold', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase' }}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}