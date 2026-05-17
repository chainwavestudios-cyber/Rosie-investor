import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const GOLD = '#b8933a';
const DARK = '#0a0f1e';
const ls = { display:'block', color:'#8a9ab8', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'6px' };

const DEFAULT_KB = '__default__';

export default function KnowledgeBaseManager({ IntentEngineTuner, CoachRulesTuner }) {
  const [entries, setEntries]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [section, setSection]       = useState('entries');
  const [search, setSearch]         = useState('');
  const [filterCat, setFilterCat]   = useState('all');

  const [kbNames, setKbNames]       = useState([]);
  const [selectedKb, setSelectedKb] = useState(DEFAULT_KB);
  const [newKbName, setNewKbName]   = useState('');
  const [creatingKb, setCreatingKb] = useState(false);

  const [q, setQ]       = useState('');
  const [a, setA]       = useState('');
  const [cat, setCat]   = useState('faq');
  const [tags, setTags] = useState('');
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState('');
  const [uploading, setUploading]   = useState(false);
  const [uploadMsg, setUploadMsg]   = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  const fileRef = useRef(null);
  const [scrapeUrl, setScrapeUrl]   = useState('');
  const [scraping, setScraping]     = useState(false);
  const [scrapeMsg, setScrapeMsg]   = useState('');
  const [deleting, setDeleting]     = useState(null);
  const [editingId, setEditingId]   = useState(null);
  const [editQ, setEditQ]           = useState('');
  const [editA, setEditA]           = useState('');
  const [editCat, setEditCat]       = useState('faq');
  const [editTags, setEditTags]     = useState('');
  const [editKb, setEditKb]         = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // ── Rebuttals state ────────────────────────────────────────────────
  const [rebuttals, setRebuttals]         = useState([]);
  const [rebSearch, setRebSearch]         = useState('');
  const [rebCategory, setRebCategory]     = useState('all');
  const [editingRebId, setEditingRebId]   = useState(null);
  const [newReb, setNewReb]               = useState({ keyword:'', aliases:'', category:'', rebuttal:'', followUp:'', tags:'' });
  const [showNewReb, setShowNewReb]       = useState(false);
  const [rebSaving, setRebSaving]         = useState(false);
  const [rebMsg, setRebMsg]               = useState('');

  // ── Learning state ─────────────────────────────────────────────────
  const [callTranscripts, setCallTranscripts]   = useState([]);
  const [archivedTranscripts, setArchivedTranscripts] = useState([]);
  const [learnedInsights, setLearnedInsights]   = useState([]);
  const [learningStatus, setLearningStatus]     = useState('idle');
  const [viewingTranscript, setViewingTranscript] = useState(null);
  const [transcriptTab, setTranscriptTab]       = useState('pending');

  // ── NB Tech Rebuttals (pre-seeded) ───────────────────────────────────
  const NB_TECH_REBUTTALS = [
    { id:'rb1', keyword:'too risky', aliases:'high risk,risky investment,lose money,speculative', category:'Risk', rebuttal:"We understand risk is a top concern. NightOwl brings $49M in proven annual revenue across 20+ years and distribution through Best Buy, Walmart, Amazon, and Home Depot. This isn't a startup bet — it's a technology modernization play on an already cash-flowing business. The 21:1 share conversion gives you NewCo equity at ~$3.36/share against a $7.00 target IPO price. Upside with a revenue-generating floor beneath it.", followUp:'Would it help to walk through the downside protection built into the structure?', tags:'risk,revenue,structure', kbName:'NB Tech' },
    { id:'rb2', keyword:'not accredited', aliases:"don't qualify,not an accredited investor,can't invest", category:'Qualification', rebuttal:"This offering is limited to verified accredited investors per Rule 506(c) — meaning a net worth over $1M (excluding primary residence) or annual income over $200K individual / $300K joint. If you're close to qualifying, we'd encourage a conversation with your financial advisor. We want the right investors at the table.", followUp:'Are you working with a financial advisor we could connect with?', tags:'qualification,accredited,eligibility', kbName:'NB Tech' },
    { id:'rb3', keyword:'why not wait for IPO', aliases:'wait for listing,buy after IPO,wait until public,why now,why not just buy it after', category:'Timing', rebuttal:"Pre-IPO access is the entire advantage. At $0.16/share today with a 21:1 conversion, your effective NewCo cost basis is ~$3.36. The target IPO price is $7.00 — that's a 2x+ return built into the entry point before the stock ever trades. After listing, the public pays $7.00+. This window closes when the S-1 is filed.", followUp:'Do you want me to walk through the timeline to the Nasdaq listing?', tags:'timing,pre-IPO,upside,entry price', kbName:'NB Tech' },
    { id:'rb4', keyword:'what is nightowl', aliases:"never heard of nightowl,who is nightowl,what do they sell,nightowl cameras", category:'Company Knowledge', rebuttal:"NightOwl is a 20-year-old American home security brand — cameras, NVR systems, doorbells — sold in Best Buy, Walmart, Amazon, and Home Depot. They do $49M in annual revenue with 300+ active SKUs. The brand is established; what's missing is the cloud, AI, and software layer. That's exactly what NB Tech's Magnus AI platform provides.", followUp:'Want me to send over the product overview and retail channel breakdown?', tags:'nightowl,product,brand,retail', kbName:'NB Tech' },
    { id:'rb5', keyword:'what does NB Tech do', aliases:"who is NB Tech,what's newport beach tech,what does your company do,tell me about NB Tech", category:'Company Knowledge', rebuttal:"NB Tech Acquisitions is a technology holding company that identifies undermodernized businesses with strong revenue and transforms them through AI and cloud integration. Our core IP is the Magnus AI platform — full-stack cloud engineering, AI model training, SaaS infrastructure. We acquire the business, inject the tech, and take it public. NightOwl is our flagship merger.", followUp:'Would you like a breakdown of how Magnus AI integrates with NightOwl?', tags:'NB Tech,Magnus AI,acquisition,strategy', kbName:'NB Tech' },
    { id:'rb6', keyword:'siebert', aliases:"who is the broker,underwriter,broker dealer,who is backing this,institutional backing", category:'Credibility', rebuttal:"Siebert Williams Shank & Co. — member NYSE, FINRA, SIPC, established 1967. They've issued a non-binding LOI to act as lead broker-dealer and placement agent, targeting a capital raise of $15M minimum up to $100M. They manage approximately $18B in client assets. This isn't a self-funded deal — it has institutional validation.", followUp:'Do you want to see the Letter of Intent?', tags:'siebert,credibility,broker,institutional', kbName:'NB Tech' },
    { id:'rb7', keyword:'SEC approval', aliases:"is this SEC approved,registered with SEC,is this legal,regulatory,is this registered", category:'Regulatory', rebuttal:"The current private placement is conducted under Regulation D Rule 506(c) — a legal exemption for accredited investor offerings. The Company has engaged TroyGould Attorneys as SEC counsel and Astra Audit & Advisory (PCAOB-registered) to complete the audits required for a full Form S-1 registration. The S-1 is targeted for filing concurrent with audit completion in approximately 4 months.", followUp:'Would you like to review the regulatory timeline?', tags:'SEC,regulatory,compliance,S-1', kbName:'NB Tech' },
    { id:'rb8', keyword:'minimum investment', aliases:"how much do I need,minimum,smallest investment,can I invest less,what is the minimum", category:'Investment Terms', rebuttal:"The minimum investment in this offering is $25,000 for 156,250 shares at $0.16/share. The maximum per investor is $500,000 (3,125,000 shares). You can invest by check, wire, ACH, credit card, or self-directed IRA. All investments require a completed Subscription Agreement and Accredited Investor Questionnaire.", followUp:'Would you like me to send over the subscription documents?', tags:'minimum,investment amount,terms,process', kbName:'NB Tech' },
    { id:'rb9', keyword:'conversion ratio', aliases:"21 to 1,share conversion,how does the conversion work,newco shares,what is 21 to 1", category:'Deal Structure', rebuttal:"Every 21 shares of NB Tech common stock converts into 1 share of NewCo upon merger completion. At today's price of $0.16/share, that means your effective cost basis in NewCo shares is $3.36 (21 × $0.16). The target IPO price is $7.00/share — representing approximately 2x on entry before any post-IPO appreciation.", followUp:'Should I walk you through a sample investment scenario with specific dollar amounts?', tags:'conversion,shares,deal structure,math', kbName:'NB Tech' },
    { id:'rb10', keyword:'competition', aliases:"what about ring,arlo cameras,ADT,competitors,google nest,similar products,why not just buy ring", category:'Market', rebuttal:"NightOwl's differentiation is privacy-first, American-made security. Ring sends your footage to Amazon servers. Nest sends it to Google. NightOwl's free local storage model keeps data on-device. With Magnus AI integration, we're adding AI detection, smart alerts, and subscription services while maintaining data sovereignty — targeting 50M–75M Americans who actively reject foreign-cloud surveillance products.", followUp:'Would you like to see our comparable company analysis against Arlo, ADT, and Alarm.com?', tags:'competition,Ring,Arlo,privacy,market', kbName:'NB Tech' },
    { id:'rb11', keyword:'revenue projections', aliases:"how do you get to those numbers,projections seem aggressive,prove the revenue,how is that revenue possible", category:'Financials', rebuttal:"2025 baseline is $49M in actual NightOwl revenue — this is real, existing business, not projected. The 2026 target of $64M assumes modest 31% growth. By 2027, the Magnus AI subscription layer and commercial market expansion drives $110M. The DCF analysis implies an enterprise value of $605M — supported by comparable security/AI companies trading at 2.7x revenue and 11.6x EBITDA.", followUp:'Would you like me to email you the full financial model breakdown?', tags:'financials,projections,revenue,DCF', kbName:'NB Tech' },
    { id:'rb12', keyword:'illiquid', aliases:"can't sell shares,no market,locked up,when can I sell,how do I get out,liquidity", category:'Liquidity', rebuttal:"Pre-IPO shares are restricted — this is a long-term investment for accredited investors who can bear illiquidity. The projected path to Nasdaq listing is September 2026 per the roadmap: acquisition close March → audit April → S-1 filing May/June → SEC clearance August → trading begins September. Upon listing, shares become publicly tradable. This is a pre-public positioning play, not a day-trade.", followUp:'Are you comfortable with a 6–12 month horizon to potential liquidity?', tags:'liquidity,lock-up,timeline,Nasdaq', kbName:'NB Tech' },
    { id:'rb13', keyword:'founder control', aliases:"voting rights,class B shares,who controls the company,eric liboiron shares,voting structure", category:'Deal Structure', rebuttal:"Eric Liboiron holds a $400,000 convertible note that converts into 400 million Class B shares at 10 votes per share. New investors receive standard common stock at 1 vote per share. This is standard founder-control structure for pre-IPO companies — identical to how Google, Meta, and Snap were structured at IPO. It's fully disclosed in the PPM. Investors participate in the economic upside while the founder steers execution.", followUp:'Would you like to see the full cap table breakdown?', tags:'voting,control,founder,class B', kbName:'NB Tech' },
    { id:'rb14', keyword:'why now', aliases:"why is now a good time,is the market bad,timing is off,recession,market conditions", category:'Timing', rebuttal:"The privacy-first security market is growing 25-40% annually regardless of broader market conditions — because it's driven by regulatory tailwinds, not consumer discretionary spending. Chinese-made surveillance cameras are being federally banned. The NDAA exclusions are expanding. NightOwl is the only scaled American-owned alternative with major retail distribution. The window to enter at pre-IPO pricing before the S-1 files is closing.", followUp:'Would you like to hear the legislative tailwinds driving this category?', tags:'timing,market,regulation,macro', kbName:'NB Tech' },
    { id:'rb15', keyword:'nightowl revenue unaudited', aliases:"revenue not verified,no audit,how do we know revenue is real,prove the revenue,financial statements", category:'Financials', rebuttal:"That's a fair due diligence question. NightOwl's $49M revenue is currently unaudited. That's exactly WHY we retained Astra Audit & Advisory, a PCAOB-registered firm, to complete the formal audit. The audit findings will be included in the S-1 registration statement. Investors who participate now are pricing in that audit risk — which is reflected in the pre-IPO discount vs. the $7.00 target price.", followUp:'Would you like to see the auditor engagement confirmation?', tags:'audit,revenue,financials,due diligence', kbName:'NB Tech' },
    { id:'rb16', keyword:'how do I invest', aliases:"what are the next steps,how do I get in,process,how does it work,how do I wire,subscribe", category:'Process', rebuttal:"The process is straightforward: 1) Complete the Investor Suitability Questionnaire confirming accredited status. 2) Sign the Subscription Agreement (we send this digitally). 3) Send your investment by wire, ACH, check, credit card, or self-directed IRA. Minimum $25,000. Once funds clear and documents are signed, Colonial Stock Transfer issues your shares. I can send you the package today.", followUp:'What is the best email to send the subscription documents to?', tags:'process,next steps,how to invest,wire', kbName:'NB Tech' },
    { id:'rb17', keyword:'send me more information', aliases:"send me the deck,email me,send documents,I want to review it,can you send", category:'Process', rebuttal:"Absolutely. I'll send you the full Investor Package today — that includes the Private Placement Memorandum, the Investor Deck, the Siebert LOI, and the financial projections. The PPM is the legal offering document with all the risk disclosures. Once you've reviewed, I'm happy to schedule a follow-up call to answer any questions. What email should I send this to?", followUp:'Is there a specific section of the PPM you want me to walk you through on our next call?', tags:'information,PPM,deck,email,documents', kbName:'NB Tech' },
    { id:'rb18', keyword:'need to talk to spouse', aliases:"ask my wife,ask my husband,check with my partner,run it by someone", category:'Objection', rebuttal:"Absolutely — this is a significant decision and it makes complete sense to involve your spouse. I'd actually love to include them on our next call, because the questions they'll have — returns, risk, timeline, liquidity — are exactly what I'm here to answer. Would it be easier to schedule a joint call, or would you prefer I send the materials to both of you?", followUp:'When would be a good time to do a brief call that includes both of you?', tags:'spouse,partner,objection,delay', kbName:'NB Tech' },
    { id:'rb19', keyword:'need to talk to my advisor', aliases:"financial advisor,my CPA,accountant,attorney,let me check with my advisor", category:'Objection', rebuttal:"That's exactly the right instinct — this is a Regulation D offering and your advisor should review it. I'll send you the PPM formatted specifically for advisor review. I can also schedule a call directly with your advisor if they have questions about the structure, the audit status, or the Siebert engagement. Their involvement actually accelerates the process. What's the best email for your advisor?", followUp:"I'll send the PPM to you and CC your advisor. What's their contact information?", tags:'advisor,CPA,attorney,due diligence,delay', kbName:'NB Tech' },
    { id:'rb20', keyword:'sounds too good to be true', aliases:"seems too good,is this legit,what's the catch,this seems off,red flags,scam", category:'Trust', rebuttal:"I completely understand that reaction — it's healthy skepticism. Here's what makes this verifiable: NightOwl is a real brand on the shelves of Best Buy and Walmart right now. You can search them. Siebert Williams Shank is a 57-year-old FINRA member you can look up on FINRA BrokerCheck. TroyGould Attorneys is a real SEC law firm in Los Angeles. The PPM is a legal document with real risk disclosures. We're not hiding the risks — they're all in writing. Would you like me to send you the Siebert LOI and the PPM so you can verify each piece independently?", followUp:'What would be most helpful for you to verify first?', tags:'trust,legitimacy,scam,skepticism,verify', kbName:'NB Tech' },
    { id:'rb21', keyword:'I already invest in real estate', aliases:"I do real estate,prefer real estate,already invested in property,real estate investor,I do rentals", category:'Objection', rebuttal:"Real estate and this offering actually complement each other well — real estate gives you tangible asset backing, while this is a growth equity play in a company with existing revenue. The difference is the upside: real estate appreciation is typically 3-7% annually. A pre-IPO position structured with a 2x built-in cost basis to IPO target — plus the AI growth potential on top — represents a different category of return. Sophisticated real estate investors often allocate 5-10% of their portfolio to high-upside alternatives. Is this something you'd consider in that bucket?", followUp:'What percentage of your portfolio are you currently allocating to alternatives?', tags:'real estate,alternatives,portfolio,comparison', kbName:'NB Tech' },
    { id:'rb22', keyword:'already invested in stocks', aliases:"I have stocks,market investor,stock portfolio,already in equities,ETFs", category:'Objection', rebuttal:"Public stocks give you liquidity but no pre-IPO discount. The difference here is that you're accessing the same company before institutional investors pay $7.00 at the IPO — at an effective equivalent cost of $3.36. Once it lists, it becomes a public stock like any other. Pre-IPO access is the return-generating mechanism that public markets don't offer. You're essentially getting the venture capital entry point without the 10-year VC lockup.", followUp:'Have you previously invested in any pre-IPO or Regulation D offerings?', tags:'stocks,equities,comparison,pre-IPO,liquidity', kbName:'NB Tech' },
    { id:'rb23', keyword:'what happens if company fails', aliases:"what if it fails,company goes under,lose everything,worst case,bankruptcy", category:'Risk', rebuttal:"Worst case is fully disclosed in the PPM: if the merger doesn't complete and no public offering occurs, shares remain illiquid private stock. There's no guaranteed liquidity. That's why this is structured for accredited investors who can sustain the loss of their entire investment — and why the minimum is $25,000, not $250,000. The $49M NightOwl revenue base is the floor — they're an operating business, not a pre-revenue startup. Even in a delayed scenario, the company continues operating while pursuing alternative paths.", followUp:'Would you like to walk through the specific risk disclosures in the PPM?', tags:'risk,failure,worst case,bankruptcy,loss', kbName:'NB Tech' },
    { id:'rb24', keyword:'not a good time financially', aliases:"short on cash,not liquid right now,financial situation,tied up,wrong time for me", category:'Timing', rebuttal:"Completely understood — and this offering absolutely requires financial comfort. The window does remain open for a period. If timing is the issue rather than the investment itself, it's worth understanding that the S-1 filing closes this window. Once that's filed, pre-IPO pricing goes away. Is there a timeframe where your liquidity situation improves, or would it be helpful to look at the minimum threshold and what that actually means for your overall portfolio?", followUp:'When would be a better time for me to follow up with you?', tags:'timing,liquidity,financial,delay,callback', kbName:'NB Tech' },
    { id:'rb25', keyword:'Nasdaq requirements', aliases:"will it qualify for nasdaq,can it actually list,nasdaq listing requirements,does it qualify", category:'Regulatory', rebuttal:"NewCo needs to satisfy three things for the Nasdaq Capital Market under Rule 5505: bid price minimum $4/share (target IPO is $7), market value of public float minimum $15M (Siebert is targeting $15M–$100M raise), and minimum 300 round-lot shareholders. NightOwl's 20+ year operating history qualifies under the Equity Standard. The Siebert raise at $7/share satisfies the market value standard. The path is clearly mapped.", followUp:"Want me to send you the specific Nasdaq qualification checklist we're tracking against?", tags:'Nasdaq,listing,qualification,regulatory', kbName:'NB Tech' },
    { id:'rb26', keyword:'Magnus AI', aliases:"what is magnus,magnus ai platform,tell me about the AI,the technology,AI platform", category:'Technology', rebuttal:"Magnus AI is NB Tech's full cloud and software platform — already built and funded. It delivers: AI-powered smart detection that identifies humans, vehicles, and real threats while eliminating false alerts; privacy dashboards with granular data controls; subscription-based storage and monitoring (recurring revenue); edge AI processing that keeps data local rather than cloud-dependent; and a rebuilt mobile app ecosystem. It's not a roadmap — it's operational.", followUp:'Would you like to see the AI detection capabilities demo we have in the investor deck?', tags:'Magnus AI,technology,AI,cloud,features', kbName:'NB Tech' },
    { id:'rb27', keyword:'privacy market', aliases:"privacy-first market,who is the market,american made,why privacy,privacy regulation", category:'Market', rebuttal:"50-75 million American adults actively prioritize privacy, sovereignty, and non-surveillance technology. 20-30 million households represent an $8B-$40B consumer TAM. Separately, the commercial security TAM is $13.5B nationally. Hikvision and Dahua — the two largest Chinese security camera brands — are now federally banned under the NDAA for government procurement. That's a massive market vacuum NightOwl is positioned to fill as the only scaled American-owned alternative.", followUp:"Would you like to hear the specific sectors we're targeting for commercial expansion first?", tags:'market,privacy,TAM,regulation,American', kbName:'NB Tech' },
    { id:'rb28', keyword:'call me back later', aliases:"not a good time,bad time,busy,call me tomorrow,maybe later,follow up", category:'Callback', rebuttal:"Of course — I don't want to catch you at a bad time. I'll pencil you in. Before I let you go, can I ask: is the timing the main barrier, or are there specific questions about the offering I should be ready to address when we reconnect? I want to make our next conversation as valuable as possible for you.", followUp:'What day and time works best for me to call you back?', tags:'callback,timing,follow up,objection', kbName:'NB Tech' },
    { id:'rb29', keyword:'I need to think about it', aliases:"let me think,need time to decide,have to consider,not ready,thinking about it", category:'Objection', rebuttal:"Absolutely — this is a meaningful decision and we're not looking for impulse investments. What I'd ask is: what specific information would help you feel more confident making a decision? Is it the audit timeline, the Siebert credentials, the financial projections, or something else? I'd rather give you exactly what you need to decide clearly than have you decide based on incomplete information.", followUp:'If I can get you those specific answers, what would your timeline look like for making a decision?', tags:'decision,think,objection,delay,information', kbName:'NB Tech' },
    { id:'rb30', keyword:'I lost money on investments before', aliases:"been burned before,bad investment history,previous losses,not trusting investments,investments went bad", category:'Trust', rebuttal:"I hear you — and that experience matters. What I can tell you is this is structured differently: NightOwl is an existing revenue-generating business, not a pre-revenue startup. The investment structure gives you a 2x+ implied return at the IPO price before the stock ever trades. The risks are fully disclosed in a legal PPM with a PCAOB auditor and an SEC attorney. This isn't a promise — it's a transparent structure. What type of investment caused the loss before? It might help me explain how this compares.", followUp:'What would have needed to be different about that investment for you to feel more confident?', tags:'trust,past loss,burned,skepticism,history', kbName:'NB Tech' },
    { id:'rb31', keyword:'who else is investing', aliases:"who are the other investors,social proof,is anyone else in,how many investors,who else committed", category:'Social Proof', rebuttal:"I can't disclose individual investor information — but I can tell you we have accredited investors from across the country participating in this offering. The Siebert LOI itself is the most meaningful social proof: a 57-year-old institutional broker-dealer with $18B in client assets chose to stake their underwriting reputation on this deal. They don't issue LOIs on speculative deals — they did the diligence and signed. That's the institutional validation that matters.", followUp:'Would it help to get you on a call with our CEO Eric Liboiron directly?', tags:'social proof,other investors,credibility,validation', kbName:'NB Tech' },
    { id:'rb32', keyword:'drone and defense', aliases:"drones,defense contracts,government contracts,military,autonomous drones,water drones", category:'Technology', rebuttal:"NightOwl is actively developing next-generation defense hardware at the intersection of R&D, autonomous drones, and intelligent security. Their patented vacuum propulsion system delivers up to 47% greater fuel efficiency and is designed for fully autonomous unmanned water drones. They're also developing aerial drone systems and robotic security platforms. This is an additional growth vector beyond the core security camera business — with government contract potential as the combined entity builds relationships.", followUp:'Are you interested in the defense and government contract angle specifically?', tags:'drone,defense,military,government,patents', kbName:'NB Tech' },
  ];

  const handleKbSelect = (kb) => {
    setSelectedKb(kb);
    setSection('entries');
    setSearch('');
    setFilterCat('all');
    const kbN = kb === DEFAULT_KB ? '' : kb;
    loadRebuttals(kbN);
    loadCallTranscripts(kbN);
  };

  const startEdit = (e) => {
    setEditingId(e.id);
    setEditQ(e.question || '');
    setEditA(e.answer || '');
    setEditCat(e.category || 'faq');
    setEditTags(e.tags || '');
    setEditKb(e.kbName || DEFAULT_KB);
  };

  const saveEdit = async () => {
    if (!editQ.trim() || !editA.trim()) return;
    setEditSaving(true);
    try {
      await base44.entities.KnowledgeBase.update(editingId, {
        question: editQ.trim(), answer: editA.trim(),
        category: editCat, tags: editTags.trim(),
        kbName: editKb === DEFAULT_KB ? '' : editKb,
      });
      setEditingId(null);
      await load();
    } catch (e) { alert('Save failed: ' + e.message); }
    setEditSaving(false);
  };

  const loadRebuttals = async (kbName) => {
    // Load from entity if possible, else seed from NB_TECH_REBUTTALS for NB Tech KB
    try {
      if (kbName === 'NB Tech' || kbName === 'NB Tech Acquisitions') {
        setRebuttals(NB_TECH_REBUTTALS);
      } else {
        setRebuttals([]);
      }
    } catch { setRebuttals([]); }
  };

  const saveRebuttal = async (reb) => {
    setRebSaving(true);
    // Save to rebuttals state (in a real implementation this would persist to backend)
    if (reb.id.startsWith('new_')) {
      const entry = { ...reb, id: 'rb_' + Date.now(), kbName: activeKbName };
      setRebuttals(prev => [...prev, entry]);
    } else {
      setRebuttals(prev => prev.map(r => r.id === reb.id ? { ...reb, kbName: activeKbName } : r));
    }
    setEditingRebId(null);
    setShowNewReb(false);
    setRebMsg('✓ Saved');
    setTimeout(() => setRebMsg(''), 2000);
    setRebSaving(false);
  };

  const deleteRebuttal = (id) => {
    if (!window.confirm('Delete this rebuttal?')) return;
    setRebuttals(prev => prev.filter(r => r.id !== id));
  };

  const loadCallTranscripts = async (kbName) => {
    // Load call transcripts tagged to this KB from LeadHistory
    try {
      // We'd filter by kbName in metadata — for now load all transcript type
      // In a full implementation: filter by kbName field
      setCallTranscripts([]);
    } catch {}
  };

  const runLearning = async () => {
    const pending = callTranscripts.filter(t => t.status !== 'evaluated');
    if (!pending.length) { setLearningStatus('no_pending'); return; }
    setLearningStatus('running');
    try {
      const fullText = pending.map(t => t.content || t.transcript || '').join(' ').toLowerCase();
      const objWords = ['concern','worried','not sure','risky','never heard','advisor','skeptical','prove','guarantee','too much','sounds too'];
      const qWords = ['what is','how much','when','who is','minimum','what does','how do'];
      const themes = ['privacy','american','nasdaq','ipo','nightowl','ai','minimum','broker','sec','conversion','siebert','magnus'];
      const insights = [];
      const topObj = objWords.filter(w => fullText.includes(w));
      const topQ = qWords.filter(w => fullText.includes(w));
      const topTheme = themes.filter(w => fullText.includes(w));
      if (topObj.length) insights.push({ type:'objection', title:'Objection Signals Found', items: topObj.map(w => `"${w}"`), suggestion: `Add rebuttals for: ${topObj.slice(0,3).join(', ')}` });
      if (topQ.length) insights.push({ type:'question', title:'Question Patterns Detected', items: topQ.map(w => `"${w}..."`), suggestion: `Add Q&A entries for these patterns` });
      if (topTheme.length) insights.push({ type:'theme', title:'Top Themes in Calls', items: topTheme.map(w => w), suggestion: 'Ensure KB has comprehensive coverage of these topics' });
      setLearnedInsights(prev => [...insights, ...prev]);
      const now = new Date().toISOString().slice(0,16).replace('T',' ');
      setArchivedTranscripts(prev => [...pending.map(t => ({...t, status:'evaluated', evaluatedAt: now})), ...prev]);
      setCallTranscripts(prev => prev.filter(t => t.status === 'evaluated'));
      setLearningStatus('done');
    } catch { setLearningStatus('error'); }
  };

  const load = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.KnowledgeBase.list('-created_date', 1000);
      setEntries(all || []);
      const names = [...new Set((all || []).map(e => e.kbName || '').filter(Boolean))];
      setKbNames(names);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createKb = () => {
    const name = newKbName.trim();
    if (!name || kbNames.includes(name)) return;
    setKbNames(prev => [...prev, name]);
    handleKbSelect(name);
    setNewKbName('');
    setCreatingKb(false);
  };

  const deleteKb = async (name) => {
    if (!window.confirm(`Delete knowledge base "${name}" and ALL its entries and settings? This cannot be undone.`)) return;
    setLoading(true);
    const toDelete = entries.filter(e => (e.kbName || DEFAULT_KB) === name);
    for (const e of toDelete) { try { await base44.entities.KnowledgeBase.delete(e.id); } catch {} }
    try {
      const cfgs = await base44.entities.KnowledgeBaseConfig.filter({ kbName: name });
      for (const c of cfgs) { try { await base44.entities.KnowledgeBaseConfig.delete(c.id); } catch {} }
    } catch {}
    setKbNames(prev => prev.filter(n => n !== name));
    if (selectedKb === name) handleKbSelect(DEFAULT_KB);
    await load();
  };

  const activeKbName = selectedKb === DEFAULT_KB ? '' : selectedKb;

  const addManual = async () => {
    if (!q.trim() || !a.trim()) return;
    setSaving(true); setSaveMsg('');
    try {
      await base44.entities.KnowledgeBase.create({
        question: q.trim(), answer: a.trim(),
        category: cat, tags: tags.trim(),
        source: 'manual', kbName: activeKbName,
      });
      setQ(''); setA(''); setTags('');
      setSaveMsg('✓ Entry added');
      await load();
    } catch (e) { setSaveMsg('Error: ' + e.message); }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return; e.target.value = '';
    setUploading(true); setUploadMsg(''); setUploadProgress('Reading file…');
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = () => rej(new Error('Read failed'));
        r.readAsDataURL(file);
      });
      setUploadProgress(`Processing "${file.name}" with AI — this may take 30-60s for large documents…`);
      const result = await base44.functions.invoke('kbExtractFile', { fileName: file.name, fileType: file.type, base64 });
      const extracted = result?.data?.entries || [];
      setUploadProgress(`Saving ${extracted.length} entries…`);
      let saved = 0;
      for (const entry of extracted) {
        try {
          await base44.entities.KnowledgeBase.create({
            question: entry.question, answer: entry.answer,
            category: entry.category || 'faq',
            source: file.name, tags: entry.tags || '',
            kbName: activeKbName,
          });
          saved++;
        } catch {}
      }
      const qaCount    = extracted.filter(e => e.category !== 'raw_chunk' && e.category !== 'raw_document').length;
      const chunkCount = extracted.filter(e => e.category === 'raw_chunk' || e.category === 'raw_document').length;
      setUploadMsg(`✓ Saved ${saved} entries from "${file.name}" — ${qaCount} Q&A pairs + ${chunkCount} searchable chunks`);
      await load();
    } catch (e) { setUploadMsg('Error: ' + e.message); }
    setUploading(false); setUploadProgress('');
    setTimeout(() => setUploadMsg(''), 6000);
  };

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return;
    setScraping(true); setScrapeMsg('Fetching and analyzing page…');
    try {
      const result = await base44.functions.invoke('kbScrapeUrl', { url: scrapeUrl.trim() });
      const extracted = result?.data?.entries || [];
      let saved = 0;
      for (const entry of extracted) {
        try {
          await base44.entities.KnowledgeBase.create({
            question: entry.question, answer: entry.answer,
            category: entry.category || 'faq',
            source: scrapeUrl.trim(), tags: entry.tags || '',
            kbName: activeKbName,
          });
          saved++;
        } catch {}
      }
      setScrapeMsg(`✓ Scraped and saved ${saved} entries from ${scrapeUrl}`);
      setScrapeUrl('');
      await load();
    } catch (e) { setScrapeMsg('Error: ' + e.message); }
    setScraping(false);
    setTimeout(() => setScrapeMsg(''), 6000);
  };

  const deleteEntry = async (id) => {
    setDeleting(id);
    try { await base44.entities.KnowledgeBase.delete(id); await load(); } catch {}
    setDeleting(null);
  };

  const deleteAll = async () => {
    if (!window.confirm(`Delete ALL entries in ${selectedKb === DEFAULT_KB ? 'Default KB' : selectedKb}? This cannot be undone.`)) return;
    setLoading(true);
    const toDelete = kbFiltered;
    for (const e of toDelete) { try { await base44.entities.KnowledgeBase.delete(e.id); } catch {} }
    await load();
  };

  const CATEGORIES = ['all','faq','financials','product','team','market','legal','process','risk','company','pricing','manual','raw_document'];
  const CAT_COLORS = { faq:'#60a5fa', financials:'#4ade80', product:'#a78bfa', team:'#f59e0b', market:'#f59e0b', legal:'#ef4444', process:'#8a9ab8', risk:'#ef4444', company:'#60a5fa', pricing:'#4ade80', manual:GOLD, raw_document:'#4a5568' };

  const kbFiltered = entries.filter(e =>
    selectedKb === DEFAULT_KB ? !e.kbName || e.kbName === '' : (e.kbName || '') === selectedKb
  );
  const filtered = kbFiltered
    .filter(e => filterCat === 'all' || e.category === filterCat)
    .filter(e => !search || `${e.question} ${e.answer} ${e.tags || ''}`.toLowerCase().includes(search.toLowerCase()));

  const sources = [...new Set(kbFiltered.filter(e => e.source).map(e => e.source))];
  const inp2 = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'10px 14px', color:'#e8e0d0', fontSize:'13px', outline:'none', fontFamily:'Georgia, serif', boxSizing:'border-box' };
  const ta2  = { ...inp2, resize:'vertical', minHeight:'80px' };

  const allKbs = [{ id: DEFAULT_KB, label: 'Default KB' }, ...kbNames.map(n => ({ id: n, label: n }))];
  const tunerKbName = selectedKb === DEFAULT_KB ? '' : selectedKb;

  return (
    <div style={{ fontFamily:'Georgia, serif' }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' }}>
        <div>
          <h2 style={{ color:'#e8e0d0', margin:'0 0 6px', fontSize:'22px', fontWeight:'normal' }}>🧠 Knowledge Base</h2>
          <p style={{ color:'#6b7280', fontSize:'13px', margin:0 }}>
            {entries.filter(e => e.category !== 'raw_document').length} total entries across {allKbs.length} knowledge base{allKbs.length !== 1 ? 's' : ''} · Used by <strong style={{ color:GOLD }}>Rosie AI</strong> and the <strong style={{ color:'#a78bfa' }}>Live Call Assistant</strong>
          </p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button onClick={load} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'8px 14px', cursor:'pointer', fontSize:'12px' }}>↻ Refresh</button>
          <button onClick={deleteAll} style={{ background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'4px', padding:'8px 14px', cursor:'pointer', fontSize:'12px' }}>🗑 Clear KB</button>
        </div>
      </div>

      {/* ── KB Selector Bar ── */}
      <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', padding:'14px 16px', marginBottom:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
          <span style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', flexShrink:0 }}>Knowledge Base:</span>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', flex:1 }}>
            {allKbs.map(kb => {
              const count = entries.filter(e => kb.id === DEFAULT_KB ? !e.kbName || e.kbName === '' : (e.kbName || '') === kb.id).length;
              const isActive = selectedKb === kb.id;
              return (
                <div key={kb.id} style={{ display:'flex', alignItems:'center' }}>
                  <button onClick={() => handleKbSelect(kb.id)} style={{
                    background: isActive ? 'linear-gradient(135deg,rgba(184,147,58,0.25),rgba(184,147,58,0.15))' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isActive ? GOLD : 'rgba(255,255,255,0.1)'}`,
                    borderRight: kb.id !== DEFAULT_KB ? 'none' : undefined,
                    borderRadius: kb.id !== DEFAULT_KB ? '4px 0 0 4px' : '4px',
                    color: isActive ? GOLD : '#6b7280',
                    padding:'5px 12px', cursor:'pointer', fontSize:'11px',
                    fontWeight: isActive ? 'bold' : 'normal',
                  }}>
                    {kb.label} <span style={{ color: isActive ? GOLD : '#4a5568', marginLeft:'4px', fontSize:'10px' }}>({count})</span>
                  </button>
                  {kb.id !== DEFAULT_KB && (
                    <button onClick={() => deleteKb(kb.id)} title={`Delete "${kb.label}"`} style={{
                      background: isActive ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isActive ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius:'0 4px 4px 0',
                      color:'#ef444466', cursor:'pointer', padding:'5px 7px', fontSize:'12px', lineHeight:1,
                    }}>×</button>
                  )}
                </div>
              );
            })}
          </div>

          {creatingKb ? (
            <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
              <input value={newKbName} onChange={e => setNewKbName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createKb(); if (e.key === 'Escape') setCreatingKb(false); }}
                placeholder="KB name…" autoFocus
                style={{ background:'rgba(255,255,255,0.07)', border:`1px solid ${GOLD}`, borderRadius:'4px', padding:'5px 10px', color:'#e8e0d0', fontSize:'12px', outline:'none', width:'140px' }} />
              <button onClick={createKb} disabled={!newKbName.trim()} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'5px 12px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>Create</button>
              <button onClick={() => setCreatingKb(false)} style={{ background:'none', border:'1px solid rgba(255,255,255,0.1)', color:'#6b7280', borderRadius:'4px', padding:'5px 10px', cursor:'pointer', fontSize:'11px' }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setCreatingKb(true)} style={{ background:'rgba(184,147,58,0.08)', color:GOLD, border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'4px', padding:'5px 12px', cursor:'pointer', fontSize:'11px', whiteSpace:'nowrap' }}>
              + New KB
            </button>
          )}
        </div>

        <div style={{ marginTop:'10px', color:'#4a5568', fontSize:'11px' }}>
          Viewing: <strong style={{ color:'#8a9ab8' }}>{selectedKb === DEFAULT_KB ? 'Default KB' : selectedKb}</strong> — {kbFiltered.length} entries
          {selectedKb !== DEFAULT_KB && <span style={{ marginLeft:'6px' }}>· Intent Engine, Coach Rules, and Q&A all scoped to this KB</span>}
        </div>
      </div>

      {/* ── Section Tabs ── */}
      <div style={{ display:'flex', gap:'0', borderBottom:'1px solid rgba(255,255,255,0.08)', marginBottom:'28px' }}>
        {[['entries','📋 Entries'],['add','✏️ Add Q&A'],['upload','📄 Upload Document'],['scrape','🌐 Scrape Website'],['rebuttals','🛡 Rebuttals'],['selling','⭐ Selling Points'],['learning','🧠 Learning'],['calllog','📞 Call Log'],['intent','🦆 Intent Engine'],['coach','🎯 Coach Rules']].map(([id, label]) => (
          <button key={id} onClick={() => setSection(id)}
            style={{ background:'none', border:'none', borderBottom:section===id?`2px solid ${GOLD}`:'2px solid transparent', color:section===id?GOLD:'#6b7280', padding:'10px 20px', cursor:'pointer', fontSize:'12px', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Entries ── */}
      {section === 'entries' && (
        <div>
          <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries…" style={{ ...inp2, width:'260px', padding:'8px 12px', fontSize:'12px' }} />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...inp2, width:'160px', padding:'8px 12px', fontSize:'12px', cursor:'pointer' }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c === 'all' ? `All Categories (${kbFiltered.length})` : `${c} (${kbFiltered.filter(e => e.category === c).length})`}</option>)}
            </select>
          </div>
          {loading && <p style={{ color:'#6b7280', textAlign:'center', padding:'40px' }}>Loading…</p>}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'60px', color:'#4a5568' }}>
              <div style={{ fontSize:'48px', marginBottom:'12px' }}>🧠</div>
              <p>No entries in <strong>{selectedKb === DEFAULT_KB ? 'Default KB' : selectedKb}</strong> yet.<br />Upload a document, scrape a URL, or add Q&A manually.</p>
            </div>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {filtered.slice(0, 100).map(e => (
              <div key={e.id} style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${editingId===e.id?'rgba(184,147,58,0.4)':'rgba(255,255,255,0.07)'}`, borderRadius:'4px', padding:'12px 16px' }}>
                {editingId === e.id ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    <input value={editQ} onChange={ev => setEditQ(ev.target.value)} placeholder="Question" style={{ ...inp2, fontSize:'13px', fontWeight:'bold' }} />
                    <textarea value={editA} onChange={ev => setEditA(ev.target.value)} placeholder="Answer" rows={4} style={{ ...ta2, fontSize:'13px' }} />
                    <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                      <select value={editCat} onChange={ev => setEditCat(ev.target.value)} style={{ ...inp2, width:'140px', padding:'6px 10px', fontSize:'12px', cursor:'pointer' }}>
                        {CATEGORIES.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input value={editTags} onChange={ev => setEditTags(ev.target.value)} placeholder="Tags" style={{ ...inp2, flex:1, padding:'6px 10px', fontSize:'12px' }} />
                      <select value={editKb} onChange={ev => setEditKb(ev.target.value)} style={{ ...inp2, width:'160px', padding:'6px 10px', fontSize:'12px', cursor:'pointer' }}>
                        <option value={DEFAULT_KB}>Default KB</option>
                        {kbNames.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <button onClick={saveEdit} disabled={editSaving} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'6px 16px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', whiteSpace:'nowrap' }}>{editSaving ? '⏳' : '✓ Save'}</button>
                      <button onClick={() => setEditingId(null)} style={{ background:'rgba(255,255,255,0.05)', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'6px 12px', cursor:'pointer', fontSize:'12px' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', gap:'14px', alignItems:'flex-start' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'4px', flexWrap:'wrap' }}>
                        {e.category && <span style={{ background:`${CAT_COLORS[e.category]||'#6b7280'}18`, color:CAT_COLORS[e.category]||'#6b7280', border:`1px solid ${CAT_COLORS[e.category]||'#6b7280'}44`, borderRadius:'10px', padding:'1px 8px', fontSize:'10px', letterSpacing:'0.5px', textTransform:'uppercase', flexShrink:0 }}>{e.category}</span>}
                        {e.kbName && <span style={{ background:'rgba(184,147,58,0.1)', color:GOLD, border:'1px solid rgba(184,147,58,0.3)', borderRadius:'10px', padding:'1px 8px', fontSize:'10px', flexShrink:0 }}>📚 {e.kbName}</span>}
                        {e.source && <span style={{ color:'#4a5568', fontSize:'10px', fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'200px' }}>{e.source}</span>}
                        {e.tags && <span style={{ color:'#6b7280', fontSize:'10px' }}>#{e.tags}</span>}
                      </div>
                      <div style={{ color:'#e8e0d0', fontSize:'13px', fontWeight:'bold', marginBottom:'4px', lineHeight:1.4 }}>{e.question?.startsWith('[') ? <span style={{ color:'#4a5568' }}>{e.question}</span> : `Q: ${e.question}`}</div>
                      {e.category !== 'raw_document' && <div style={{ color:'#8a9ab8', fontSize:'12px', lineHeight:1.5 }}>A: {e.answer}</div>}
                    </div>
                    <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
                      <button onClick={() => startEdit(e)} style={{ background:'rgba(184,147,58,0.1)', border:'1px solid rgba(184,147,58,0.25)', color:'#b8933a', cursor:'pointer', fontSize:'11px', padding:'3px 10px', borderRadius:'4px', whiteSpace:'nowrap' }}>✏️ Edit</button>
                      <button onClick={() => deleteEntry(e.id)} disabled={deleting===e.id} style={{ background:'none', border:'none', color:deleting===e.id?'#4a5568':'#ef444466', cursor:'pointer', fontSize:'16px', padding:'2px 4px' }}>{deleting===e.id ? '…' : '×'}</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filtered.length > 100 && <p style={{ color:'#4a5568', fontSize:'12px', textAlign:'center', padding:'8px' }}>Showing 100 of {filtered.length} — refine search to see more</p>}
          </div>
        </div>
      )}

      {/* ── Add Q&A ── */}
      {section === 'add' && (
        <div style={{ maxWidth:'640px' }}>
          <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 6px', fontSize:'16px' }}>✏️ Add Manual Q&A Entry</h3>
          <div style={{ background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'6px', padding:'10px 14px', marginBottom:'20px', fontSize:'11px', color:GOLD }}>
            Adding to: <strong>{selectedKb === DEFAULT_KB ? 'Default KB' : selectedKb}</strong>
          </div>
          <div style={{ marginBottom:'16px' }}><label style={ls}>Question / Keyword / Topic</label><input value={q} onChange={e => setQ(e.target.value)} placeholder="What is the minimum investment?" style={inp2} /></div>
          <div style={{ marginBottom:'16px' }}><label style={ls}>Answer</label><textarea value={a} onChange={e => setA(e.target.value)} placeholder="The minimum investment is $25,000…" rows={5} style={ta2} /></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'20px' }}>
            <div><label style={ls}>Category</label><select value={cat} onChange={e => setCat(e.target.value)} style={{ ...inp2, cursor:'pointer' }}>{['faq','financials','product','team','market','legal','process','risk','company','pricing','manual'].map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}</select></div>
            <div><label style={ls}>Tags (optional)</label><input value={tags} onChange={e => setTags(e.target.value)} placeholder="minimum, investment, amount" style={inp2} /></div>
          </div>
          {saveMsg && <div style={{ background:saveMsg.startsWith('✓')?'rgba(74,222,128,0.1)':'rgba(239,68,68,0.1)', border:`1px solid ${saveMsg.startsWith('✓')?'rgba(74,222,128,0.3)':'rgba(239,68,68,0.3)'}`, borderRadius:'4px', padding:'10px 14px', color:saveMsg.startsWith('✓')?'#4ade80':'#ef4444', fontSize:'13px', marginBottom:'16px' }}>{saveMsg}</div>}
          <button onClick={addManual} disabled={saving||!q.trim()||!a.trim()} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'12px 32px', cursor:'pointer', fontWeight:'700', fontSize:'12px', letterSpacing:'2px', textTransform:'uppercase' }}>{saving ? 'Saving…' : '+ Add Entry'}</button>
        </div>
      )}

      {/* ── Upload Document ── */}
      {section === 'upload' && (
        <div style={{ maxWidth:'640px' }}>
          <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 8px', fontSize:'16px' }}>📄 Upload Document</h3>
          <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 16px', lineHeight:1.7 }}>Upload a PDF, Word doc, or text file. The AI will extract every useful Q&A pair automatically.</p>
          <div style={{ background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'6px', padding:'10px 14px', marginBottom:'16px', fontSize:'11px', color:GOLD }}>
            Extracting into: <strong>{selectedKb === DEFAULT_KB ? 'Default KB' : selectedKb}</strong>
          </div>
          <div onClick={() => !uploading && fileRef.current?.click()}
            style={{ border:`2px dashed ${uploading?'rgba(184,147,58,0.5)':'rgba(255,255,255,0.15)'}`, borderRadius:'8px', padding:'48px', textAlign:'center', cursor:uploading?'default':'pointer', background:'rgba(255,255,255,0.02)', transition:'all 0.2s' }}
            onMouseEnter={e => { if(!uploading){ e.currentTarget.style.borderColor=GOLD; e.currentTarget.style.background='rgba(184,147,58,0.04)'; } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.15)'; e.currentTarget.style.background='rgba(255,255,255,0.02)'; }}>
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.md,.csv" onChange={handleFileUpload} style={{ display:'none' }} />
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>{uploading ? '⏳' : '📄'}</div>
            <div style={{ color:uploading?GOLD:'#e8e0d0', fontSize:'15px', marginBottom:'6px', fontWeight:'bold' }}>{uploading ? uploadProgress||'Processing…' : 'Click to select a file'}</div>
            <div style={{ color:'#4a5568', fontSize:'12px' }}>PDF, Word (.docx), TXT, Markdown, CSV — max 10MB</div>
          </div>
          {uploadMsg && <div style={{ marginTop:'16px', background:uploadMsg.startsWith('✓')?'rgba(74,222,128,0.1)':'rgba(239,68,68,0.1)', border:`1px solid ${uploadMsg.startsWith('✓')?'rgba(74,222,128,0.3)':'rgba(239,68,68,0.3)'}`, borderRadius:'4px', padding:'12px 16px', color:uploadMsg.startsWith('✓')?'#4ade80':'#ef4444', fontSize:'13px' }}>{uploadMsg}</div>}
          {sources.length > 0 && (
            <div style={{ marginTop:'28px' }}>
              <div style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>
                Uploaded Documents in {selectedKb === DEFAULT_KB ? 'Default KB' : selectedKb} ({sources.length})
                <span style={{ color:'#4a5568', fontWeight:'normal', marginLeft:'8px' }}>— Remove a file to re-upload it</span>
              </div>
              {sources.map(src => {
                const allSrcEntries = kbFiltered.filter(e => e.source === src);
                const qaCount    = allSrcEntries.filter(e => e.category !== 'raw_document' && e.category !== 'raw_chunk').length;
                const chunkCount = allSrcEntries.filter(e => e.category === 'raw_chunk' || e.category === 'raw_document').length;
                const [removing, setRemoving] = [false, () => {}]; // local state via key trick
                return (
                  <div key={src} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'6px', marginBottom:'6px' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:'#c4cdd8', fontSize:'13px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📄 {src}</div>
                      <div style={{ color:'#4a5568', fontSize:'10px', marginTop:'2px' }}>
                        {qaCount} Q&amp;A entries · {chunkCount} searchable chunks
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                      <button
                        onClick={() => fileRef.current?.click()}
                        title={`Replace "${src}" with a new upload`}
                        style={{ background:'rgba(184,147,58,0.1)', color:'#b8933a', border:'1px solid rgba(184,147,58,0.3)', borderRadius:'4px', padding:'5px 12px', cursor:'pointer', fontSize:'11px' }}
                      >↑ Re-upload</button>
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Remove all ${allSrcEntries.length} entries from "${src}"? You can re-upload the file after.`)) return;
                          for (const e of allSrcEntries) { try { await base44.entities.KnowledgeBase.delete(e.id); } catch {} }
                          await load();
                        }}
                        title={`Remove all entries from "${src}"`}
                        style={{ background:'rgba(239,68,68,0.08)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.25)', borderRadius:'4px', padding:'5px 12px', cursor:'pointer', fontSize:'11px' }}
                      >🗑 Remove</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Scrape Website ── */}
      {section === 'scrape' && (
        <div style={{ maxWidth:'640px' }}>
          <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 8px', fontSize:'16px' }}>🌐 Scrape Website</h3>
          <p style={{ color:'#6b7280', fontSize:'13px', margin:'0 0 16px', lineHeight:1.7 }}>Enter a URL and the AI will fetch the page and extract every useful Q&A pair.</p>
          <div style={{ background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'6px', padding:'10px 14px', marginBottom:'16px', fontSize:'11px', color:GOLD }}>
            Scraping into: <strong>{selectedKb === DEFAULT_KB ? 'Default KB' : selectedKb}</strong>
          </div>
          <div style={{ display:'flex', gap:'10px', marginBottom:'16px' }}>
            <input value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)} placeholder="https://www.rosieai.tech/about" onKeyDown={e => { if (e.key === 'Enter' && !scraping) handleScrape(); }} style={{ ...inp2, flex:1 }} />
            <button onClick={handleScrape} disabled={scraping||!scrapeUrl.trim()} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'10px 20px', cursor:'pointer', fontWeight:'700', fontSize:'12px', whiteSpace:'nowrap' }}>{scraping ? '⏳ Scraping…' : '🌐 Scrape'}</button>
          </div>
          {scrapeMsg && <div style={{ background:scrapeMsg.startsWith('✓')?'rgba(74,222,128,0.1)':'rgba(239,68,68,0.1)', border:`1px solid ${scrapeMsg.startsWith('✓')?'rgba(74,222,128,0.3)':'rgba(239,68,68,0.3)'}`, borderRadius:'4px', padding:'12px 16px', color:scrapeMsg.startsWith('✓')?'#4ade80':'#ef4444', fontSize:'13px', marginBottom:'16px' }}>{scrapeMsg}</div>}
          <div style={{ background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)', borderRadius:'4px', padding:'14px 16px', fontSize:'12px', color:'#8a9ab8', lineHeight:1.8 }}><strong style={{ color:'#60a5fa' }}>Tip:</strong> Scrape multiple pages — home, features, pricing, FAQ, about.</div>
        </div>
      )}

      {/* ── Rebuttals ── */}
      {section === 'rebuttals' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'8px' }}>
            <div>
              <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 4px', fontSize:'16px' }}>🛡 Rebuttals — {selectedKb === DEFAULT_KB ? 'Default KB' : selectedKb}</h3>
              <p style={{ color:'#6b7280', fontSize:'12px', margin:0 }}>{rebuttals.length} rebuttals · Used by AI Coach and Q&A popup during live calls</p>
            </div>
            <button onClick={() => setShowNewReb(p => !p)} style={{ background:'rgba(184,147,58,0.12)', color:GOLD, border:`1px solid rgba(184,147,58,0.35)`, borderRadius:'4px', padding:'7px 16px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>+ Add Rebuttal</button>
          </div>

          {rebMsg && <div style={{ background:rebMsg.startsWith('✓')?'rgba(74,222,128,0.1)':'rgba(239,68,68,0.1)', border:`1px solid ${rebMsg.startsWith('✓')?'rgba(74,222,128,0.3)':'rgba(239,68,68,0.3)'}`, borderRadius:'4px', padding:'8px 14px', color:rebMsg.startsWith('✓')?'#4ade80':'#ef4444', fontSize:'12px', marginBottom:'12px' }}>{rebMsg}</div>}

          {showNewReb && (
            <div style={{ background:'rgba(184,147,58,0.06)', border:`1px solid rgba(184,147,58,0.25)`, borderRadius:'8px', padding:'16px', marginBottom:'16px' }}>
              <p style={{ color:GOLD, fontSize:'12px', fontWeight:'bold', margin:'0 0 10px', textTransform:'uppercase', letterSpacing:'1px' }}>New Rebuttal</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                <div><label style={{ ...ls }}>Trigger Keyword *</label><input value={newReb.keyword} onChange={e=>setNewReb(p=>({...p,keyword:e.target.value}))} placeholder="e.g. too risky" style={{ ...inp2, fontSize:'12px' }} /></div>
                <div><label style={{ ...ls }}>Category</label><input value={newReb.category} onChange={e=>setNewReb(p=>({...p,category:e.target.value}))} placeholder="Risk" style={{ ...inp2, fontSize:'12px' }} /></div>
              </div>
              <div style={{ marginBottom:'10px' }}><label style={{ ...ls }}>Aliases (comma-separated)</label><input value={newReb.aliases} onChange={e=>setNewReb(p=>({...p,aliases:e.target.value}))} placeholder="high risk, risky investment, lose money" style={{ ...inp2, fontSize:'12px' }} /></div>
              <div style={{ marginBottom:'10px' }}><label style={{ ...ls }}>Rebuttal Script *</label><textarea value={newReb.rebuttal} onChange={e=>setNewReb(p=>({...p,rebuttal:e.target.value}))} rows={4} style={{ ...ta2, fontSize:'12px' }} /></div>
              <div style={{ marginBottom:'10px' }}><label style={{ ...ls }}>Follow-up Question</label><input value={newReb.followUp} onChange={e=>setNewReb(p=>({...p,followUp:e.target.value}))} placeholder="Optional closing question" style={{ ...inp2, fontSize:'12px' }} /></div>
              <div style={{ marginBottom:'14px' }}><label style={{ ...ls }}>Tags (comma-separated)</label><input value={newReb.tags} onChange={e=>setNewReb(p=>({...p,tags:e.target.value}))} placeholder="risk, revenue, structure" style={{ ...inp2, fontSize:'12px' }} /></div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={() => saveRebuttal({...newReb, id:'new_'+Date.now(), aliases:newReb.aliases, tags:newReb.tags})} disabled={rebSaving||!newReb.keyword||!newReb.rebuttal} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'8px 20px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }}>{rebSaving?'Saving…':'Save Rebuttal'}</button>
                <button onClick={() => {setShowNewReb(false);setNewReb({keyword:'',aliases:'',category:'',rebuttal:'',followUp:'',tags:''}); }} style={{ background:'rgba(255,255,255,0.05)', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'8px 14px', cursor:'pointer', fontSize:'12px' }}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
            <input value={rebSearch} onChange={e=>setRebSearch(e.target.value)} placeholder="Search rebuttals…" style={{ ...inp2, flex:1, padding:'8px 12px', fontSize:'12px' }} />
            <select value={rebCategory} onChange={e=>setRebCategory(e.target.value)} style={{ ...inp2, width:'160px', padding:'8px 12px', fontSize:'12px', cursor:'pointer' }}>
              <option value="all">All Categories ({rebuttals.length})</option>
              {[...new Set(rebuttals.map(r=>r.category).filter(Boolean))].map(c=><option key={c} value={c}>{c} ({rebuttals.filter(r=>r.category===c).length})</option>)}
            </select>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {rebuttals
              .filter(r => rebCategory==='all' || r.category===rebCategory)
              .filter(r => !rebSearch || `${r.keyword} ${r.aliases} ${r.category} ${r.rebuttal}`.toLowerCase().includes(rebSearch.toLowerCase()))
              .map(r => (
              editingRebId === r.id ? (
                <div key={r.id} style={{ background:'rgba(184,147,58,0.06)', border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'6px', padding:'14px' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
                    <div><label style={{ ...ls }}>Trigger Keyword</label><input defaultValue={r.keyword} id={`rkw_${r.id}`} style={{ ...inp2, fontSize:'12px' }} /></div>
                    <div><label style={{ ...ls }}>Category</label><input defaultValue={r.category} id={`rcat_${r.id}`} style={{ ...inp2, fontSize:'12px' }} /></div>
                  </div>
                  <div style={{ marginBottom:'8px' }}><label style={{ ...ls }}>Aliases</label><input defaultValue={r.aliases} id={`ral_${r.id}`} style={{ ...inp2, fontSize:'12px' }} /></div>
                  <div style={{ marginBottom:'8px' }}><label style={{ ...ls }}>Rebuttal Script</label><textarea defaultValue={r.rebuttal} id={`rrb_${r.id}`} rows={4} style={{ ...ta2, fontSize:'12px' }} /></div>
                  <div style={{ marginBottom:'8px' }}><label style={{ ...ls }}>Follow-up</label><input defaultValue={r.followUp||''} id={`rfu_${r.id}`} style={{ ...inp2, fontSize:'12px' }} /></div>
                  <div style={{ marginBottom:'12px' }}><label style={{ ...ls }}>Tags</label><input defaultValue={r.tags||''} id={`rtags_${r.id}`} style={{ ...inp2, fontSize:'12px' }} /></div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <button onClick={() => {
                      const get = (id) => document.getElementById(id)?.value||'';
                      saveRebuttal({...r, keyword:get(`rkw_${r.id}`), category:get(`rcat_${r.id}`), aliases:get(`ral_${r.id}`), rebuttal:get(`rrb_${r.id}`), followUp:get(`rfu_${r.id}`), tags:get(`rtags_${r.id}`)});
                    }} disabled={rebSaving} style={{ background:'linear-gradient(135deg,#b8933a,#d4aa50)', color:DARK, border:'none', borderRadius:'4px', padding:'6px 16px', cursor:'pointer', fontWeight:'bold', fontSize:'11px' }}>{rebSaving?'…':'✓ Save'}</button>
                    <button onClick={()=>setEditingRebId(null)} style={{ background:'rgba(255,255,255,0.05)', color:'#6b7280', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'6px 12px', cursor:'pointer', fontSize:'11px' }}>Cancel</button>
                    <button onClick={()=>deleteRebuttal(r.id)} style={{ background:'rgba(239,68,68,0.08)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'4px', padding:'6px 12px', cursor:'pointer', fontSize:'11px' }}>🗑 Delete</button>
                  </div>
                </div>
              ) : (
                <div key={r.id} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'6px', padding:'12px 14px' }}>
                  <div style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', gap:'6px', alignItems:'center', marginBottom:'5px', flexWrap:'wrap' }}>
                        <span style={{ color:'#e8e0d0', fontSize:'13px', fontWeight:'bold' }}>"{r.keyword}"</span>
                        {r.category && <span style={{ background:'rgba(184,147,58,0.12)', color:GOLD, border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'10px', padding:'1px 8px', fontSize:'10px' }}>{r.category}</span>}
                      </div>
                      {r.aliases && <p style={{ color:'#4a5568', fontSize:'11px', margin:'0 0 5px' }}>Also: {r.aliases}</p>}
                      <p style={{ color:'#8a9ab8', fontSize:'12px', lineHeight:1.6, margin:'0 0 4px' }}>{r.rebuttal.slice(0,180)}{r.rebuttal.length>180?'…':''}</p>
                      {r.followUp && <p style={{ color:'#6b7280', fontSize:'11px', margin:'4px 0 0', fontStyle:'italic' }}>↳ {r.followUp}</p>}
                      {r.tags && <div style={{ marginTop:'5px' }}>{r.tags.split(',').map(t=><span key={t} style={{ fontSize:'10px', background:'rgba(255,255,255,0.05)', color:'#4a5568', borderRadius:'3px', padding:'1px 6px', margin:'2px 2px 0 0', display:'inline-block' }}>{t.trim()}</span>)}</div>}
                    </div>
                    <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
                      <button onClick={()=>setEditingRebId(r.id)} style={{ background:'rgba(184,147,58,0.1)', color:'#b8933a', border:'1px solid rgba(184,147,58,0.25)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'11px' }}>✏️ Edit</button>
                      <button onClick={()=>deleteRebuttal(r.id)} style={{ background:'none', border:'none', color:'#ef444466', cursor:'pointer', fontSize:'16px', padding:'2px 4px' }}>×</button>
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* ── Selling Points ── */}
      {section === 'selling' && (
        <div>
          <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 8px', fontSize:'16px' }}>⭐ Selling Points — {selectedKb === DEFAULT_KB ? 'Default KB' : selectedKb}</h3>
          <p style={{ color:'#6b7280', fontSize:'12px', margin:'0 0 20px' }}>Key differentiators referenced by the AI Coach and Q&A popup during live calls.</p>
          <div style={{ background:'rgba(184,147,58,0.06)', border:`1px solid rgba(184,147,58,0.2)`, borderRadius:'6px', padding:'14px 16px', marginBottom:'16px' }}>
            <p style={{ color:GOLD, fontSize:'12px', fontWeight:'bold', margin:'0 0 8px' }}>NB Tech — Top Selling Points</p>
            {[
              ['💰','$49M Existing Revenue','NightOwl generates $49M annually — NOT a startup. A proven business being modernized.'],
              ['📅','20+ Year Operating History','Best Buy, Walmart, Amazon, Home Depot distribution. Two decades of brand equity.'],
              ['📈','Pre-IPO at $3.36 vs $7.00 target','21:1 conversion: $0.16 today = $3.36 NewCo basis. Target IPO $7.00. 2x+ built in.'],
              ['🏦','Siebert Williams Shank LOI','NYSE/FINRA/SIPC since 1967, $18B client assets. Institutional validation.'],
              ['🤖','Magnus AI Platform','Fully built AI/cloud platform ready to integrate. AI detection, subscriptions, privacy.'],
              ['🔒','Privacy-First TAM','50M–75M Americans reject foreign surveillance. $8B–$40B consumer TAM. $13.5B commercial.'],
              ['🗺️','Nasdaq Roadmap','Clear path: Audit → S-1 → SEC clearance → Nasdaq listing. Target: September 2026.'],
              ['⚡','$3.3M Immediate EBITDA','Post-merger synergies: no revenue growth required to generate $3.3M new EBITDA.'],
              ['✅','PCAOB Audit Engaged','Astra Audit & Advisory retained. TroyGould SEC counsel. MicroCap Advisory IR/PR.'],
              ['🤝','Founder Stays as CRO','Ron Ferris stays as CRO with equity — full incentive alignment post-acquisition.'],
            ].map(([icon,title,detail]) => (
              <div key={title} style={{ display:'flex', gap:'12px', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize:'18px', flexShrink:0 }}>{icon}</span>
                <div>
                  <p style={{ color:'#e8e0d0', fontSize:'13px', fontWeight:'bold', margin:'0 0 2px' }}>{title}</p>
                  <p style={{ color:'#8a9ab8', fontSize:'12px', margin:0, lineHeight:1.5 }}>{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Learning ── */}
      {section === 'learning' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' }}>
            <div>
              <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 4px', fontSize:'16px' }}>🧠 Learning Engine — {selectedKb === DEFAULT_KB ? 'Default KB' : selectedKb}</h3>
              <p style={{ color:'#6b7280', fontSize:'12px', margin:0 }}>Analyze call transcripts to discover new rebuttals, Q&A, and themes</p>
            </div>
            <button onClick={runLearning} disabled={learningStatus==='running'} style={{ background:'rgba(74,222,128,0.1)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.3)', borderRadius:'4px', padding:'7px 16px', cursor:'pointer', fontSize:'12px', fontWeight:'bold', opacity:learningStatus==='running'?0.5:1 }}>
              {learningStatus==='running'?'⏳ Analyzing…':'🧠 Learn Now ↗'}
            </button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'20px' }}>
            {[['Pending',callTranscripts.length,'#f59e0b'],['Archived',archivedTranscripts.length,'#4ade80'],['Insights',learnedInsights.length,'#60a5fa']].map(([lbl,val,color])=>(
              <div key={lbl} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'8px', padding:'16px', textAlign:'center' }}>
                <div style={{ fontSize:'26px', fontWeight:'bold', color, marginBottom:'4px' }}>{val}</div>
                <div style={{ fontSize:'11px', color:'#6b7280' }}>{lbl} Transcripts</div>
              </div>
            ))}
          </div>
          {learnedInsights.length===0&&callTranscripts.length===0&&<div style={{ textAlign:'center', padding:'40px', color:'#4a5568', fontSize:'13px' }}>No transcripts yet. Call transcripts from the Twilio stream will appear here when tagged to this KB.</div>}
          {learnedInsights.map((ins,i)=>(
            <div key={i} style={{ background:'rgba(255,255,255,0.02)', border:`1px solid ${ins.type==='objection'?'rgba(245,158,11,0.3)':ins.type==='question'?'rgba(96,165,250,0.3)':'rgba(74,222,128,0.3)'}`, borderLeft:`3px solid ${ins.type==='objection'?'#f59e0b':ins.type==='question'?'#60a5fa':'#4ade80'}`, borderRadius:'6px', padding:'12px 16px', marginBottom:'8px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1 }}>
                  <p style={{ color:'#e8e0d0', fontSize:'13px', fontWeight:'bold', margin:'0 0 6px' }}>{ins.title}</p>
                  {ins.items.map((item,j)=><p key={j} style={{ color:'#6b7280', fontSize:'12px', margin:'2px 0 2px 10px' }}>• {item}</p>)}
                  <p style={{ color:'#4a5568', fontSize:'11px', marginTop:'8px', fontStyle:'italic' }}>💡 {ins.suggestion}</p>
                </div>
                <div style={{ display:'flex', gap:'6px', marginLeft:'12px' }}>
                  <button onClick={()=>setSection('rebuttals')} style={{ background:'rgba(184,147,58,0.1)', color:GOLD, border:`1px solid rgba(184,147,58,0.3)`, borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'10px' }}>+ Rebuttal</button>
                  <button onClick={()=>setSection('add')} style={{ background:'rgba(74,222,128,0.08)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.25)', borderRadius:'4px', padding:'4px 10px', cursor:'pointer', fontSize:'10px' }}>+ Q&A</button>
                </div>
              </div>
            </div>
          ))}
          {archivedTranscripts.length>0&&(
            <div style={{ marginTop:'24px' }}>
              <p style={{ color:'#6b7280', fontSize:'10px', letterSpacing:'2px', textTransform:'uppercase', marginBottom:'10px' }}>Archived / Evaluated Transcripts ({archivedTranscripts.length})</p>
              {archivedTranscripts.map((t,i)=>(
                <div key={i} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:'4px', padding:'10px 14px', marginBottom:'6px', opacity:0.7, display:'flex', justifyContent:'space-between' }}>
                  <div>
                    <p style={{ color:'#8a9ab8', fontSize:'12px', margin:0 }}>{t.customer||t.leadName||'Call Transcript'} — {t.date||t.evaluatedAt?.slice(0,10)}</p>
                    <p style={{ color:'#4a5568', fontSize:'10px', margin:'2px 0 0' }}>Evaluated: {t.evaluatedAt} · KB: {selectedKb===DEFAULT_KB?'Default':selectedKb}</p>
                  </div>
                  <span style={{ fontSize:'10px', background:'rgba(74,222,128,0.1)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.2)', borderRadius:'10px', padding:'2px 10px', height:'fit-content' }}>archived</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Call Log ── */}
      {section === 'calllog' && (
        <div>
          <h3 style={{ color:'#e8e0d0', fontWeight:'normal', margin:'0 0 4px', fontSize:'16px' }}>📞 Call Log — {selectedKb === DEFAULT_KB ? 'Default KB' : selectedKb}</h3>
          <p style={{ color:'#6b7280', fontSize:'12px', margin:'0 0 16px' }}>Call transcripts saved to this KB via Twilio stream</p>
          <div style={{ display:'flex', gap:'6px', marginBottom:'16px' }}>
            {['pending','archived'].map(t=><button key={t} onClick={()=>setTranscriptTab(t)} style={{ background:transcriptTab===t?'rgba(184,147,58,0.2)':'rgba(255,255,255,0.04)', color:transcriptTab===t?GOLD:'#6b7280', border:`1px solid ${transcriptTab===t?'rgba(184,147,58,0.4)':'rgba(255,255,255,0.1)'}`, borderRadius:'4px', padding:'5px 14px', cursor:'pointer', fontSize:'11px', fontWeight:transcriptTab===t?'bold':'normal' }}>{t.charAt(0).toUpperCase()+t.slice(1)} ({t==='pending'?callTranscripts.length:archivedTranscripts.length})</button>)}
          </div>
          {viewingTranscript ? (
            <div>
              <button onClick={()=>setViewingTranscript(null)} style={{ background:'rgba(255,255,255,0.05)', color:'#8a9ab8', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'4px', padding:'6px 12px', cursor:'pointer', fontSize:'11px', marginBottom:'12px' }}>← Back</button>
              <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'8px', padding:'14px' }}>
                <p style={{ color:GOLD, fontSize:'12px', fontWeight:'bold', margin:'0 0 2px' }}>{viewingTranscript.customer||viewingTranscript.leadName||'Call'}</p>
                <p style={{ color:'#4a5568', fontSize:'11px', margin:'0 0 12px' }}>{viewingTranscript.date} · {viewingTranscript.duration||''}</p>
                <pre style={{ color:'#c4cdd8', fontSize:'11px', lineHeight:1.7, whiteSpace:'pre-wrap', fontFamily:'monospace', maxHeight:'400px', overflowY:'auto' }}>{viewingTranscript.content||viewingTranscript.transcript||'No transcript content.'}</pre>
              </div>
            </div>
          ) : (
            <div>
              {transcriptTab==='pending'&&callTranscripts.length===0&&<div style={{ textAlign:'center', padding:'40px', color:'#4a5568', fontSize:'12px' }}>No pending transcripts. When Twilio stream is connected and a KB is selected, transcripts save here automatically.</div>}
              {(transcriptTab==='pending'?callTranscripts:archivedTranscripts).map((t,i)=>(
                <div key={i} onClick={()=>setViewingTranscript(t)} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'6px', padding:'10px 14px', marginBottom:'6px', cursor:'pointer' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <p style={{ color:'#e8e0d0', fontSize:'13px', fontWeight:'bold', margin:'0 0 2px' }}>{t.customer||t.leadName||'Call Transcript'}</p>
                      <p style={{ color:'#4a5568', fontSize:'11px', margin:0 }}>{t.date} · {t.duration||''} · <span style={{ color:GOLD }}>{selectedKb===DEFAULT_KB?'Default KB':selectedKb}</span></p>
                    </div>
                    <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                      <span style={{ fontSize:'10px', background:transcriptTab==='pending'?'rgba(245,158,11,0.1)':'rgba(74,222,128,0.1)', color:transcriptTab==='pending'?'#f59e0b':'#4ade80', border:`1px solid ${transcriptTab==='pending'?'rgba(245,158,11,0.3)':'rgba(74,222,128,0.3)'}`, borderRadius:'10px', padding:'2px 10px' }}>{transcriptTab}</span>
                      <span style={{ color:'#4a5568' }}>›</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Intent Engine — scoped to selected KB ── */}
      {section === 'intent' && IntentEngineTuner && (
        <div>
          {selectedKb !== DEFAULT_KB && (
            <div style={{ background:'rgba(184,147,58,0.06)', border:'1px solid rgba(184,147,58,0.2)', borderRadius:'6px', padding:'10px 14px', marginBottom:'20px', fontSize:'11px', color:GOLD }}>
              🦆 Intent Engine rules for: <strong>{selectedKb}</strong> — these are used when this KB is active during a call.
            </div>
          )}
          <IntentEngineTuner kbName={tunerKbName} />
        </div>
      )}

      {/* ── Coach Rules — scoped to selected KB ── */}
      {section === 'coach' && CoachRulesTuner && (
        <div>
          {selectedKb !== DEFAULT_KB && (
            <div style={{ background:'rgba(167,139,250,0.06)', border:'1px solid rgba(167,139,250,0.2)', borderRadius:'6px', padding:'10px 14px', marginBottom:'20px', fontSize:'11px', color:'#a78bfa' }}>
              🎯 Coach Rules for: <strong>{selectedKb}</strong> — these are used when this KB is active during a call.
            </div>
          )}
          <CoachRulesTuner kbName={tunerKbName} />
        </div>
      )}
    </div>
  );
}