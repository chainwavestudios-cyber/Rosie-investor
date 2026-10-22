import React from 'react';

const HERO_BANNER = 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/2551a3672_AdobeStock_507310715.jpeg';

// Only the right-hand artwork of the uploaded banner is shown (the headline, button
// and label printed on the banner sit in its left third), so the live text below is
// the real, editable copy on the page.
const ART_POSITION = { backgroundSize: '176% auto', backgroundPosition: '100% 50%' };

export default function HomeHero() {
  const goToChat = () => {
    document.getElementById('chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section style={{ background: 'linear-gradient(120deg, #ffffff 0%, #f2f7f6 100%)', borderBottom: '1px solid #e6edf3' }}>
      <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '52px 24px', display: 'flex', alignItems: 'center', gap: '40px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 340px', minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ display: 'inline-block', width: '36px', height: '3px', background: '#f4b424' }} />
            <span style={{ color: '#f4b424', fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
              Special
            </span>
          </div>

          <h1 style={{ margin: '20px 0 0', color: '#0b2b4a', fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(46px, 7vw, 78px)', fontWeight: 800, lineHeight: 0.92, letterSpacing: '-0.02em' }}>
            New
          </h1>
          <p style={{ margin: '8px 0 0', color: '#0b2b4a', fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(17px, 2.3vw, 25px)', fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Landing Design
          </p>

          <button
            type="button"
            onClick={goToChat}
            style={{ marginTop: '30px', background: '#f4b424', color: '#0b2b4a', border: 'none', borderRadius: '6px', padding: '17px 36px', fontSize: '14px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", boxShadow: '0 12px 26px rgba(244,180,36,0.35)' }}
          >
            Get Started
          </button>
        </div>

        <div
          role="img"
          aria-label="A person cutting the chain attached to heavy credit card debt"
          style={{
            ...ART_POSITION,
            flex: '1 1 420px',
            minWidth: '280px',
            maxWidth: '620px',
            aspectRatio: '1.13 / 1',
            backgroundImage: `url(${HERO_BANNER})`,
            backgroundRepeat: 'no-repeat',
            maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,1) 14%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,1) 14%)',
          }}
        />
      </div>
    </section>
  );
}