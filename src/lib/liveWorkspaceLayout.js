/**
 * Independent, named screen-size profiles for Debt Call Coach Live Call.
 *
 * Geometry uses browser CSS pixels, not physical panel pixels, so zoom and
 * operating-system display scaling cannot push windows off screen.
 * Never read or modify microphone, USB multitrack, Deepgram or dialer data.
 */
export const LIVE_LAYOUT_KEY='live_workspace_default_v1';
export const LIVE_PROFILE_STORE='live_workspace_display_profiles_v2';
export const LIVE_MODE_KEY='live_workspace_display_mode_v2';
export const LIVE_PANEL_KEYS=['live_transcript','live_scripts','live_ai_panel','live_contact_profile'];
export const DISPLAY_CHOICES=[
  {id:'auto',name:'Auto-detect browser size'},
  {id:'ultrawide1080',name:'3840 × 1080 · Ultra-wide'},
  {id:'ultrawide1440',name:'3440 × 1440 · Ultra-wide'},
  {id:'wide2560',name:'2560 × 1440 · QHD'},
  {id:'fullhd',name:'1920 × 1080 · Full HD'},
  {id:'laptop',name:'1440 × 900 · Laptop'},
  {id:'compact',name:'1366 × 768 · Compact'},
  {id:'custom',name:'Custom · Current browser size'},
];

export function getWorkspaceViewport() {
  if(typeof window==='undefined')return {width:1440,height:900,displayWidth:1440,displayHeight:900,dpr:1};
  return {
    width:Math.max(360,window.innerWidth),
    height:Math.max(380,window.innerHeight),
    displayWidth:window.screen?.width||window.innerWidth,
    displayHeight:window.screen?.height||window.innerHeight,
    dpr:window.devicePixelRatio||1,
  };
}

export function detectDisplayProfile(viewport={}) {
  const width=Number(viewport.width)||1440;
  const height=Number(viewport.height)||900;
  if(width>=3050 && width/height>=2.75 && height<=1320)return 'ultrawide1080';
  if(width>=2900 && width/height>=2.1)return 'ultrawide1440';
  if(width>=2400)return 'wide2560';
  if(width>=1700)return 'fullhd';
  if(width>=1150)return 'laptop';
  return 'compact';
}

export function resolveDisplayProfile(mode,viewport) {
  if(!mode||mode==='auto')return detectDisplayProfile(viewport);
  if(mode==='custom'){
    const width=Math.round((Number(viewport?.width)||1440)/50)*50;
    const height=Math.round((Number(viewport?.height)||900)/50)*50;
    return `custom_${width}x${height}`;
  }
  return mode;
}

export function displayProfileName(id) {
  if(String(id||'').startsWith('custom_'))return `Custom ${String(id).slice(7).replace('x',' × ')}`;
  return DISPLAY_CHOICES.find(x=>x.id===id)?.name||'Custom display';
}

function bounded(value,low,high){return Math.max(low,Math.min(high,value));}

export function liveWindowGeometry(key, viewport, requestedProfile='auto') {
  const view=viewport||getWorkspaceViewport();
  const vw=Math.max(360,Number(view.width)||1440);
  const vh=Math.max(380,Number(view.height)||900);
  const profile=resolveDisplayProfile(requestedProfile,view);
  const keys=LIVE_PANEL_KEYS;
  const idx=Math.max(0,keys.indexOf(key));
  const pad=14,gap=12;
  const top=bounded(Math.round(vh*0.15),105,185);
  const usableWidth=vw-pad*2;
  const usableHeight=Math.max(250,vh-top-20);
  const forceGrid=profile==='laptop'||profile==='compact';
  const fourAcross=vw>=1700 && !forceGrid;
  if (fourAcross) {
    const content=usableWidth-gap*3;
    // At 3840 × 1080 give Q&A/Coach more horizontal space, and keep
    // transcript narrower. The contact card remains large enough for edits.
    const weight=profile==='ultrawide1080'||(vw>=3200&&vh<=1320)
      ? [0.19,0.245,0.295,0.27]
      : [0.23,0.25,0.28,0.24];
    const widths=weight.map(x=>Math.floor(content*x));
    const x=pad+widths.slice(0,idx).reduce((a,b)=>a+b,0)+idx*gap;
    const width=idx===3?vw-pad-x:widths[idx];
    return {position:{x,y:top},size:{width:Math.max(300,width),height:usableHeight}};
  }
  if(vw>=850){
    // When manually requesting a smaller-screen profile on a large monitor,
    // use a centered 2x2 grid sized for the requested desktop, not huge panes.
    const gridWidth=forceGrid?Math.min(vw-2*pad,profile==='compact'?1280:1450):vw-2*pad;
    const width=Math.floor((gridWidth-gap)/2);
    const left=pad+Math.floor((vw-2*pad-gridWidth)/2);
    const height=Math.max(240,Math.floor((vh-top-28-gap)/2));
    return {
      position:{x:left+(idx%2)*(width+gap),y:top+Math.floor(idx/2)*(height+gap)},
      size:{width,height}
    };
  }
  return {
    position:{x:10+idx*8,y:Math.min(top+idx*29,vh-145)},
    size:{width:Math.max(280,vw-20-idx*4),height:Math.max(260,vh-top-60)}
  };
}

export function createDisplayLayout(profile,viewport){
  return {
    version:2,
    profileId:profile,
    updatedAt:null,
    profileVisible:true,
    ...Object.fromEntries(LIVE_PANEL_KEYS.map(key=>[
      'popout_'+key,{...liveWindowGeometry(key,viewport,profile),poppedOut:true}
    ])),
  };
}
export function clampWindowGeometry(data,viewport){
  const vw=Math.max(360,Number(viewport?.width)||1440);
  const vh=Math.max(380,Number(viewport?.height)||900);
  const size=data?.size||{};
  const position=data?.position||{};
  const width=bounded(Number(size.width)||480,Math.min(280,vw-12),vw-12);
  const height=bounded(Number(size.height)||560,Math.min(250,vh-12),vh-12);
  return {
    poppedOut:data?.poppedOut!==false,
    size:{width,height},
    position:{
      x:bounded(Number(position.x)||0,0,vw-width),
      y:bounded(Number(position.y)||0,0,vh-height)
    }
  };
}

export function clampDisplayLayout(layout,viewport){
  const id=layout?.profileId||'custom';
  const fallback=createDisplayLayout(id,viewport);
  return {
    version:2,profileId:id,profileVisible:layout?.profileVisible!==false,
    ...Object.fromEntries(LIVE_PANEL_KEYS.map(key=>[
      'popout_'+key,
      clampWindowGeometry(layout?.['popout_'+key]||fallback['popout_'+key],viewport)
    ]))
  };
}
