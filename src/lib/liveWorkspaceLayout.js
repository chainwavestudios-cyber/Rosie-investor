/**
 * Live Call desktop presets: first-run positions, not rewritten script/tool data.
 * Each operator's saved layout takes precedence over these geometry presets.
 */
export function liveWindowGeometry(key, viewport) {
  const vw = Math.max(360, Number(viewport?.width) || (typeof window !== 'undefined' ? window.innerWidth : 1440));
  const vh = Math.max(380, Number(viewport?.height) || (typeof window !== 'undefined' ? window.innerHeight : 900));
  const pad = 14;
  const top = Math.min(105, Math.max(36, Math.round(vh * 0.08)));
  const keys = ['live_transcript', 'live_scripts', 'live_ai_panel', 'live_contact_profile'];
  const idx = Math.max(0, keys.indexOf(key));
  if (vw >= 1720) {
    const gap = 12;
    const content = vw - pad * 2 - gap * 3;
    const widths = [.235, .24, .255, .27].map(n => Math.floor(content * n));
    const x = pad + widths.slice(0, idx).reduce((a,b)=>a+b,0) + idx * gap;
    const width = idx === 3 ? vw - pad - x : widths[idx];
    return {
      position: { x, y: top },
      size: { width: Math.max(320,width), height: Math.max(340, vh-top-20) }
    };
  }
  if (vw >= 850) {
    const gap = 12;
    const width = Math.floor((vw-pad*2-gap)/2);
    const height = Math.max(280, Math.floor((vh-top-28-gap)/2));
    const x = pad + (idx%2)*(width+gap);
    const y = top + Math.floor(idx/2)*(height+gap);
    return { position: {x,y}, size: {width,height} };
  }
  return {
    position:{x:10+idx*8,y:Math.min(top+idx*30,vh-140)},
    size:{width:Math.max(280,vw-20-idx*4),height:Math.max(260,vh-top-60)}
  };
}
export const LIVE_LAYOUT_KEY='live_workspace_default_v1';
export const LIVE_PANEL_KEYS=['live_transcript','live_scripts','live_ai_panel','live_contact_profile'];
