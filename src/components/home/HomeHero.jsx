import React from 'react';

const HERO_ART = 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/4ceb9469d_generated_image.png';

export default function HomeHero() {
  const goToChat = () => {
    document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section style={{ background: '#ffffff' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '44px 20px', display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', minWidth: '260px' }}>
          <p style={{ margin: 0, color: '#f4b424', fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Special
          </p>
          <h1 style={{ margin: '12px 0 0', color: '#003366', fontFamily: "'Playfair Display', serif", fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 700, lineHeight: 1.05, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
            New Landing Design
          </h1>
          <button
            type="button"
            onClick={goToChat}
            style={{ marginTop: '24px', background: '#f4b424', color: '#003366', border: 'none', borderRadius: '6px', padding: '15px 30px', fontSize: '15px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            Get Started
          </button>
        </div>

        <img
          src={HERO_ART}
          alt="Cutting the chain on credit card debt"
          style={{ flex: '1 1 300px', width: '100%', maxWidth: '420px', height: 'auto', margin: '0 auto' }}
        />
      </div>
    </section>
  );
}