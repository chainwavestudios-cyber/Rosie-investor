// No authenticated APIs, network write operations, local storage or secrets.
export const STAGING_GATES = Object.freeze([
  'Secure primary administrator provisioning and native Probo membership verification',
  'Authorized SSO and role-bound organization tests',
  'Private bucket upload, download, integrity and deletion round-trip',
  'Backup restoration drill and supported recurring recovery schedule',
  'Signed, idempotent and redacted Core evidence adapter acceptance',
  'Negative cross-tenant tests and authorized control review',
  'Telemetry collector, alert routing and retention verification',
]);
export function summarizeCatalog(catalog) {
  if (!catalog || catalog.status !== 'draft_not_audited' || !Array.isArray(catalog.controls)) throw Error('Invalid draft catalog');
  const ids = new Set();
  for (const c of catalog.controls) {
    if (!/^(BOB|CORE)-SEC-\d{3}$/.test(c.id) || ids.has(c.id)) throw Error('Duplicate or invalid control');
    ids.add(c.id);
  }
  return {total:catalog.controls.length,bob:catalog.controls.filter(c=>c.id.startsWith('BOB-')).length,core:catalog.controls.filter(c=>c.id.startsWith('CORE-')).length,verifiedEvidence:0,openGates:STAGING_GATES.length};
}
export function filterControls(controls, app, text) {
  const query=String(text??'').toLowerCase().trim();
  return controls.filter(c=>(app==='all'||c.id.toLowerCase().startsWith(app+'-'))&&[c.id,c.title,c.evidence_kind,...(c.framework_hints||[])].join(' ').toLowerCase().includes(query));
}
const doc=typeof document==='undefined'?null:document;
if (doc) {
  const body=doc.querySelector('#controlRows');
  const addText=(parent,tag,value,cls)=>{const e=doc.createElement(tag);if(cls)e.className=cls;e.textContent=value;parent.append(e);return e;};
  const gates=doc.querySelector('#gates');
  for(const gate of STAGING_GATES)addText(gates,'li',gate);
  doc.querySelector('#gatesCount').textContent=String(STAGING_GATES.length);
  // This fetch is same-origin and reads only the static JSON catalog; never customer endpoints.
  fetch('../controls/catalog.v1.json').then(res=>{if(!res.ok)throw Error('Catalog unavailable');return res.json()}).then(catalog=>{
    const counts=summarizeCatalog(catalog);
    doc.querySelector('#controlsCount').textContent=String(counts.total);
    const render=()=>{
      body.replaceChildren();
      const result=filterControls(catalog.controls,doc.querySelector('#app').value,doc.querySelector('#search').value);
      if(!result.length){const tr=doc.createElement('tr');const td=addText(tr,'td','No matching draft controls');td.colSpan=4;body.append(tr);return;}
      for(const c of result){
        const tr=doc.createElement('tr');
        const td=doc.createElement('td');addText(td,'strong',c.id);addText(td,'small',c.title);tr.append(td);
        addText(tr,'td',c.id.startsWith('BOB-')?'BOB':'Rosie Core');
        addText(tr,'td',c.evidence_kind.replaceAll('-',' '));
        const status=doc.createElement('td');addText(status,'span','DRAFT · no evidence','tag draft');tr.append(status);body.append(tr);
      }
    };
    for(const id of ['app','search'])doc.querySelector('#'+id).addEventListener('input',render);
    render();
  }).catch(()=>{body.replaceChildren();const tr=doc.createElement('tr');const td=addText(tr,'td','Draft catalog unavailable. Serve the services/probo-grc directory from a local static HTTP server.','muted');td.colSpan=4;body.append(tr);});
}