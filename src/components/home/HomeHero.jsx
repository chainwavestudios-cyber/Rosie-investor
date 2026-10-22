import React from 'react';

const HERO_BANNER = 'https://media.base44.com/images/public/69cd2741578c9b5ce655395b/2551a3672_AdobeStock_507310715.jpeg';

// Only the right-hand artwork of the uploaded banner is shown — the headline, button
// and label printed on the banner sit in its left third and are cropped away.
const ART_POSITION = { backgroundSize: '176% auto', backgroundPosition: '100% 50%' };

export default function HomeHero() {
  return (
    <section style={{ background: 'linear-gradient(120deg, #ffffff 0%, #f2f7f6 100%)', borderBottom: '1px solid #e6edf3' }}>
      <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '52px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '40px', flexWrap: 'wrap' }}>
        <div
          role="img"
          aria-label="A person cutting the chain attached to heavy credit card debt"
          style={{
            ...ART_POSITION,
            flex: '1 1 420px',
            minWidth: '280px',
            maxWidth: '620px',
            aspectRatio: '4.5 / 1',
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