/**
 * Commercial BOB training workflows. Every action is a SIMULATION:
 * no actual credit pull, email, SMS, CRM update, real phone transfer or billing.
 */
export const BOB_ACTIONS=[
  {id:'qualify',label:'Mark qualification complete',cue:'@@BOB:QUALIFY@@'},
  {id:'mock_credit',label:'Run simulated credit check',cue:'@@BOB:MOCK_CREDIT@@'},
  {id:'send_email',label:'Simulate sending credentials email',cue:'@@SEND_EMAIL@@'},
  {id:'send_text',label:'Simulate SMS',cue:'@@SEND_TEXT@@'},
  {id:'capture_data',label:'Collect or update mock customer info',cue:'@@AI_INPUT@@'},
  {id:'confirm_debt',label:'Confirm simulated debt',cue:'@@DEBT_CONFIRM@@'},
  {id:'transfer',label:'Transfer to simulated closer',cue:'@@BOB:TRANSFER@@'},
  {id:'callback',label:'Schedule a simulated follow-up',cue:'@@BOB:FOLLOW_UP@@'},
  {id:'completed',label:'Mark stage complete',cue:'@@COMPLETED_STEPS@@'},
];
export const BOB_VARIABLES=[
 '{{first name}}','{{last name}}','{{phone}}','{{email}}',
 '{{debt amount}}','{{city}}','{{state}}','{{agent name}}','{{company}}',
 '{{credit score}}','{{credit utilization}}','{{interest rate}}',
 '{{appointment date}}'
];
export const BOB_FLOW_STAGES=['incoming_queue','transfer_agent','discovery','objection','mock_credit','closer_handoff','closing','follow_up','completed'];
export const STAGE_LABELS={
 incoming_queue:'Incoming call queue',transfer_agent:'AI transfer / handoff',
 discovery:'Needs discovery',objection:'Objections & rebuttals',mock_credit:'Mock credit report',
 closer_handoff:'AI closer handoff',closing:'Closing conversation',
 follow_up:'Follow-up / callback',completed:'Training complete'
};
const id=()=>Math.random().toString(36).slice(2,12);
export const newStage=(type='discovery')=>({
 id:id(),type,label:STAGE_LABELS[type]||'Custom stage',
 goal:'',instructions:'',scriptId:'',introMessage:'',
 voice:'flux-drew-en',actions:type==='mock_credit'?['mock_credit']:type==='closer_handoff'?['transfer']:type==='follow_up'?['callback']:['completed'],
});
export function createFlow(type='inbound'){
 const path=type==='inbound'?['incoming_queue','transfer_agent','discovery','objection','mock_credit','closer_handoff','closing','follow_up','completed']:
  type==='outbound'?['discovery','objection','closing','follow_up','completed']:
  type==='queue'?['incoming_queue','discovery','mock_credit','closing','follow_up','completed']:
  ['follow_up','discovery','objection','closing','completed'];
 return {title:type==='inbound'?'Inbound · transferred sales call':type==='outbound'?'Outbound · prospecting simulation':type==='queue'?'Inbound · assigned queue':'Follow-up · second conversation',
   description:'Full sales role-play with configurable AI customer, stage actions and outcome tracking.',
   type,stages:path.map(newStage),active:true};
}
export function validateFlow(raw){
 if(!raw || typeof raw!=='object')throw new Error('A flow object is required.');
 const stages=Array.isArray(raw.stages)?raw.stages.slice(0,18):[];
 if(!stages.length)throw new Error('Add at least one stage.');
 return {
  title:String(raw.title||'New training flow').slice(0,120),
  description:String(raw.description||'').slice(0,2000),
  type:['inbound','outbound','queue','follow_up'].includes(raw.type)?raw.type:'inbound',
  active:raw.active!==false,
  stages:stages.map((s,i)=>({
   id:String(s.id||id()).slice(0,40),
   type:BOB_FLOW_STAGES.includes(s.type)?s.type:'discovery',
   label:String(s.label||STAGE_LABELS[s.type]||'Stage '+(i+1)).slice(0,100),
   goal:String(s.goal||'').slice(0,1000),
   instructions:String(s.instructions||'').slice(0,3500),
   scriptId:String(s.scriptId||'').slice(0,80),
   introMessage:String(s.introMessage||'').slice(0,700),
   voice:/^(flux|aura)-[a-z]+-en$/.test(s.voice||'')?s.voice:'flux-drew-en',
   actions:[...new Set((Array.isArray(s.actions)?s.actions:[]).filter(x=>BOB_ACTIONS.some(a=>a.id===x)))].slice(0,12),
  }))
 };
}
const hash=(text)=>[...String(text)].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,17);
const first=['Jordan','Morgan','Taylor','Alex','Sam','Jamie','Casey','Drew'];
export function mockCustomer(seed='training', context={}){
 const n=hash(seed+String(context.createdAt||'')),
  debt=Number(context.debtAmount)||12500+(n%21)*950,
  score=510+(n%220);
 return {
  firstName:context.firstName||first[n%first.length],
  lastName:context.lastName||'Demo',
  debtAmount:debt,creditScore:score,creditUtilization:40+(n%55),
  openAccounts:3+(n%6),monthlyIncome:2400+(n%50)*110,
  interestRate:16+(n%15),
  reportId:'SIM-'+n.toString(36).toUpperCase(),
  mock:true,generatedAt:new Date().toISOString()
 };
}
export function applyTokens(text='', customer={},extra={}){
 const vars={
  'first name':customer.firstName||'Customer','last name':customer.lastName||'Demo',
  'phone':'(555) 010-2020','email':'training@example.invalid',
  'debt amount':customer.debtAmount?'$'+Number(customer.debtAmount).toLocaleString():'$35,000',
  city:'Sample City',state:'CA','agent name':extra.agentName||'Training Agent',
  company:extra.company||'Example Sales Company',
  'credit score':customer.creditScore||'Not checked',
  'credit utilization':customer.creditUtilization?customer.creditUtilization+'%':'Not checked',
  'interest rate':customer.interestRate?customer.interestRate+'%':'Unconfirmed',
  'appointment date':extra.appointmentDate||'Not scheduled'
 };
 return String(text).replace(/\{\{([^{}]+)\}\}/g,(_,key)=>String(vars[key.toLowerCase().trim()]??'['+key+']'));
}
export function actionFromCue(text=''){
 const cues=BOB_ACTIONS.filter(a=>String(text).includes(a.cue)).map(a=>a.id);
 return [...new Set(cues)];
}
export function clearCues(text=''){
 return String(text).replace(/@@(?:BOB:[A-Z_]+|SEND_EMAIL|SEND_TEXT|AI_INPUT|DEBT_CONFIRM|COMPLETED_STEPS)@@/g,'');
}
