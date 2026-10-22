import React from 'react';
import { PhoneCall } from 'lucide-react';

export default function HomeHeader() {
  const goToQuestion = () => {
    document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    </header>
  );
}