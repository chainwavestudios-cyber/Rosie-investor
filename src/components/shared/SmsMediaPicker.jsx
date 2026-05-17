import { useState } from 'react';

const GOLD = '#b8933a';

// Stock market / financial animated GIFs from GIPHY (direct media URLs)
const STOCK_GIFS = [
  { label: '🚀 To The Moon', url: 'https://media.giphy.com/media/xT9IgG50Lg7russbfu/giphy.gif' },
  { label: '📈 Stock Rising', url: 'https://media.giphy.com/media/l0HlCFJanKNPn3dBe/giphy.gif' },
  { label: '💰 Money Rain', url: 'https://media.giphy.com/media/3oEjHFOscgNwdSRRDy/giphy.gif' },
  { label: '🔥 Hot IPO', url: 'https://media.giphy.com/media/xT9IgCaFW0ks8BAPOK/giphy.gif' },
  { label: '🐂 Bull Market', url: 'https://media.giphy.com/media/l41lVVABEPijT4N28/giphy.gif' },
  { label: '💎 Diamond Hands', url: 'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif' },
  { label: '🎯 Pre-IPO', url: 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif' },
  { label: '📊 Chart Up', url: 'https://media.giphy.com/media/xT9IgzoKnwFNmISR8I/giphy.gif' },
  { label: '💵 Cash Money', url: 'https://media.giphy.com/media/67ThRZlYBvibtdF9JH/giphy.gif' },
  { label: '🏆 Winner', url: 'https://media.giphy.com/media/26BRBKqUiq586bRVm/giphy.gif' },
  { label: '🚨 Market Alert', url: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif' },
  { label: '🌙 Moonshot', url: 'https://media.giphy.com/media/3o7btT1T9qpQZWhNlK/giphy.gif' },
  { label: '💥 Gains', url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif' },
  { label: '📉 Bear Watch', url: 'https://media.giphy.com/media/l0HlMldqpqoMmvs2A/giphy.gif' },
  { label: '🦁 Confident', url: 'https://media.giphy.com/media/3ornk57KwDXf81rjWM/giphy.gif' },
  { label: '💼 Investment', url: 'https://media.giphy.com/media/xT9IgDELgbURuoDFq8/giphy.gif' },
  { label: '🎰 Big Win', url: 'https://media.giphy.com/media/26tOZ42Mg6pbTUPHW/giphy.gif' },
  { label: '🔑 Opportunity', url: 'https://media.giphy.com/media/26ufnwz3wDUli7GU0/giphy.gif' },
  { label: '📡 Nasdaq', url: 'https://media.giphy.com/media/3oEdv08GBYB9MHtAKk/giphy.gif' },
  { label: '🏦 IPO Day', url: 'https://media.giphy.com/media/xT9IgBFCFmGDJ9OHpS/giphy.gif' },
  { label: '🤑 Payday', url: 'https://media.giphy.com/media/3oKIPavRPgJYaNI97O/giphy.gif' },
  { label: '⚡ Lightning Deal', url: 'https://media.giphy.com/media/3oEjI5VtIhHvK37WYo/giphy.gif' },
  { label: '🏅 Gold Medal', url: 'https://media.giphy.com/media/l3V0dy1zzyjbYTQQM/giphy.gif' },
  { label: '🌊 Whale Alert', url: 'https://media.giphy.com/media/xT9IgDELgbWMV9GV3q/giphy.gif' },
  { label: '🎆 Celebrating', url: 'https://media.giphy.com/media/26tknCqiJrBQG6bxC/giphy.gif' },
  { label: '💡 Smart Money', url: 'https://media.giphy.com/media/3oEjHWzZQaCrZW0CDO/giphy.gif' },
  { label: '🔥 On Fire', url: 'https://media.giphy.com/media/11sBLVxNs7v6WA/giphy.gif' },
  { label: '🏃 Fast Gains', url: 'https://media.giphy.com/media/26BRuo6sLetdllPAQ/giphy.gif' },
  { label: '🧲 Attract Wealth', url: 'https://media.giphy.com/media/3oKIPrc2ngFZ6BTyww/giphy.gif' },
  { label: '👑 King Investor', url: 'https://media.giphy.com/media/xT9IgBMECuSLCNlhCE/giphy.gif' },
  { label: '📣 Breaking News', url: 'https://media.giphy.com/media/3oEjHV0z8S7WM4MwnK/giphy.gif' },
  { label: '🎯 Target Hit', url: 'https://media.giphy.com/media/26BoEiQmzfg2rrkYg/giphy.gif' },
  { label: '🚀 Launch Day', url: 'https://media.giphy.com/media/xTiTnqUxyWbsAXq7Ju/giphy.gif' },
  { label: '💸 ROI', url: 'https://media.giphy.com/media/6MWahPArixa6I/giphy.gif' },
  { label: '🌟 Star Stock', url: 'https://media.giphy.com/media/26tPplGWjN0xLybiU/giphy.gif' },
];

// Financial + general emoji groups
const EMOJI_GROUPS = [
  {
    label: '📈 Finance',
    emojis: ['📈','📉','💹','💰','💵','💴','💶','💷','💳','💎','🏦','🏛','📊','💱','🪙','💲','🤑','💸','🏅','🥇','🎯','🔑','📡','🚀','⚡','🔥','💥','🌙','⭐','🌟']
  },
  {
    label: '😀 Faces',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😇','🥰','😍','🤩','😎','🧐','🤑','😤','🤯','🥳','😏','🫡','🤝','👊','✊','🤜','💪','🙌','👏']
  },
  {
    label: '👍 Gestures',
    emojis: ['👍','👎','👌','🤌','✌️','🤞','🤟','🤘','🤙','👋','🖐','✋','🤚','👆','👇','👉','👈','☝️','🫵','🤛','🤜','💪','🙏','🤲','🫶','❤️','🧡','💛','💚','💙']
  },
  {
    label: '🎉 Celebration',
    emojis: ['🎉','🎊','🎈','🎆','🎇','✨','💫','⭐','🌟','🔥','🏆','🥇','🎖','🏅','👑','💎','🎯','🎰','🎲','🎳','🃏','🎴','🀄','🎪','🎠','🎡','🎢','🎭','🎨','🖼']
  },
  {
    label: '💼 Business',
    emojis: ['💼','📋','📁','📂','🗂','📊','📈','📉','📝','✏️','🖊','📌','📍','🗓','📅','📆','📇','📒','📓','📔','📕','📗','📘','📙','📚','🔍','🔎','🔏','🔐','🔒']
  },
];

export default function SmsMediaPicker({ onSelectGif, onSelectEmoji, onClose }) {
  const [tab, setTab] = useState('gifs'); // 'gifs' | 'emojis'
  const [emojiGroup, setEmojiGroup] = useState(0);
  const [hoveredGif, setHoveredGif] = useState(null);

  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '6px',
      background: '#0d1b2a', border: '1px solid rgba(184,147,58,0.35)', borderRadius: '8px',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.8)', zIndex: 100, overflow: 'hidden',
      maxHeight: '340px', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        {[['gifs', '🎬 GIFs'], ['emojis', '😀 Emoji']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            background: 'none', border: 'none', borderBottom: tab === id ? `2px solid ${GOLD}` : '2px solid transparent',
            color: tab === id ? GOLD : '#6b7280', padding: '8px 16px', cursor: 'pointer', fontSize: '11px', fontWeight: tab === id ? 'bold' : 'normal',
          }}>{label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '16px', padding: '4px 12px' }}>×</button>
      </div>

      {/* GIFs tab */}
      {tab === 'gifs' && (
        <div style={{ overflowY: 'auto', padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {STOCK_GIFS.map((gif, i) => (
            <div key={i} onClick={() => { onSelectGif(gif.url, gif.label); onClose(); }}
              onMouseEnter={() => setHoveredGif(i)} onMouseLeave={() => setHoveredGif(null)}
              style={{
                cursor: 'pointer', borderRadius: '6px', overflow: 'hidden',
                border: `1px solid ${hoveredGif === i ? GOLD : 'rgba(255,255,255,0.08)'}`,
                background: 'rgba(0,0,0,0.3)', transition: 'border-color 0.15s',
                display: 'flex', flexDirection: 'column',
              }}>
              <img src={gif.url} alt={gif.label}
                style={{ width: '100%', height: '70px', objectFit: 'cover', display: 'block' }}
                onError={e => { e.target.style.display = 'none'; }} />
              <div style={{ padding: '3px 5px', color: '#8a9ab8', fontSize: '9px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {gif.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Emojis tab */}
      {tab === 'emojis' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Group selector */}
          <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(255,255,255,0.07)', overflowX: 'auto', flexShrink: 0 }}>
            {EMOJI_GROUPS.map((g, i) => (
              <button key={i} onClick={() => setEmojiGroup(i)} style={{
                background: 'none', border: 'none', borderBottom: emojiGroup === i ? `2px solid ${GOLD}` : '2px solid transparent',
                color: emojiGroup === i ? GOLD : '#6b7280', padding: '6px 12px', cursor: 'pointer', fontSize: '10px', whiteSpace: 'nowrap',
              }}>{g.label}</button>
            ))}
          </div>
          {/* Emoji grid */}
          <div style={{ overflowY: 'auto', padding: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {EMOJI_GROUPS[emojiGroup].emojis.map((emoji, i) => (
              <button key={i} onClick={() => onSelectEmoji(emoji)} style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '4px', padding: '5px', cursor: 'pointer', fontSize: '18px', lineHeight: 1,
                transition: 'background 0.1s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(184,147,58,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              >{emoji}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}