import React from 'react';
import { PhoneCall } from 'lucide-react';

export default function HomeHeader() {
  const goToQuestion = () => {
    document.getElementById('debt-amount')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header style={{ background: '#003366', padding: '18px 20px 28px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <span style={{ color: '#ffffff', fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: 700 }}>
          Debt Solutions
        </span>
        <button
          type="button"
          onClick={goToQuestion}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.6)', color: '#ffffff', borderRadius: '999px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
        >
          <PhoneCall size={15} />
          Talk to a Specialist
        </button>
      </div>

      <div style={{ maxWidth: '960px', margin: '20px auto 0', textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.88)', fontSize: '14px', margin: '0 0 14px' }}>
          Hi! I&apos;m Stephani, your Consolidation Specialist.
        </p>
        <div style={{ width: '76px', height: '76px', margin: '0 auto', borderRadius: '999px', background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)', border: '3px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#002a52', fontSize: '30px', fontWeight: 700 }}>
          S
        </div>
      </div>
    </header>
  );
}