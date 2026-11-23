import fs from 'node:fs';
import { jsPDF } from 'jspdf';
const slides=JSON.parse(fs.readFileSync('src/data/pitchDeck.json','utf8'));
const pdf=new jsPDF({orientation:'landscape',unit:'pt',format:[960,540],compress:true});
const GOLD=[211,174,109],WHITE=[247,239,228],SUB=[199,194,187],BG=[11,13,19];
function color(arr){pdf.setTextColor(...arr)}
function fill(arr){pdf.setFillColor(...arr)}
function heading(s,x,y,maxW,fontSize){
 pdf.setFont('times','normal');pdf.setFontSize(fontSize);color(WHITE);
 let lines=s.split('\n');let out=[];
 for(let line of lines){out.push(...pdf.splitTextToSize(line,maxW))}
 pdf.text(out,x,y,{lineHeightFactor:1.09});return y+out.length*fontSize*1.12;
}
slides.forEach((s,i)=>{
 if(i)pdf.addPage([960,540],'landscape');
 fill(BG);pdf.rect(0,0,960,540,'F');
 fill([30,26,22]);pdf.circle(925,55,220,'F');
 fill([14,15,21]);pdf.rect(0,0,800,540,'F');
 fill(GOLD);pdf.rect(0,0,125,4,'F');
 pdf.setFont('helvetica','bold');pdf.setFontSize(11);color(GOLD);pdf.text(s.kicker,65,66);
 const titleSize=s.type==='cover'?49:42;
 const titleBottom=heading(s.title,65,132,835,titleSize);
 pdf.setFont('helvetica','normal');pdf.setFontSize(18);color(SUB);
 const sub=pdf.splitTextToSize(s.subtitle||'',815);
 pdf.text(sub,65,titleBottom+18,{lineHeightFactor:1.35});
 let y=titleBottom+18+sub.length*24+15;
 if(s.items){
  const count=s.items.length;
  const cols=count>6?2:count>3?2:3;
  const boxW=cols===3?260:390, gap=18, start=65;
  const rows=Math.ceil(count/cols);
  const available=Math.max(42,460-y);const rowH=Math.min(70,available/rows);
  s.items.forEach((item,j)=>{
   const col=j%cols,row=Math.floor(j/cols),x=start+col*(boxW+gap),yy=y+row*rowH;
   fill([27,28,32]);pdf.roundedRect(x,yy,boxW,rowH-8,5,5,'F');fill(GOLD);pdf.rect(x,yy,3,rowH-8,'F');
   pdf.setFont('helvetica','normal');pdf.setFontSize(count>6?12.7:14.2);color(WHITE);
   pdf.text(pdf.splitTextToSize(item,boxW-24).slice(0,2),x+14,yy+20,{lineHeightFactor:1.25});
  });
 }
 pdf.setDrawColor(...GOLD);pdf.setLineWidth(.4);pdf.line(65,506,895,506);
 pdf.setFont('helvetica','normal');pdf.setFontSize(9);color([160,144,118]);
 pdf.text('ROSIE AI  /  INVESTOR OVERVIEW',65,522);
 pdf.text(String(i+1).padStart(2,'0')+' / '+slides.length,870,522);
});
pdf.setProperties({title:'Rosie AI Investor Pitch Deck',subject:'Investor overview, November 2026',author:'Rosie AI'});
fs.mkdirSync('public',{recursive:true});
fs.writeFileSync('public/Rosie_AI_Investor_Pitch_Deck.pdf',Buffer.from(pdf.output('arraybuffer')));
console.log('Created',fs.statSync('public/Rosie_AI_Investor_Pitch_Deck.pdf').size,'bytes');
