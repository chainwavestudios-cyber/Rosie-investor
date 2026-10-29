/**
 * Live Call's complete AI Assistant, hosted in the same coordinated window
 * geometry as Transcript, Scripts and Contact. Reuses the EXISTING Q&A /
 * Coach / Intent UI and the live call's established Deepgram/AI data.
 * No second transcription stream or shadow Q&A engine is created.
 */
import { useMemo, useRef } from 'react';
import { BrainCircuit } from 'lucide-react';
import AIAssistantPopup from '@/components/leads/AIAssistantPopup';
import LiveWindowChrome from './LiveWindowChrome';

export default function LiveQAWindow({
  panel, qaItems=[], coachTips=[], transcript=[], kbEntries=[], lead,
  qaActive, coachActive, intentActive,
  onToggleQA, onToggleCoach, onToggleIntent,
  pendingQuestion, username
}) {
  const normalized = useMemo(() => transcript.map(line => ({
    ...line,
    speaker: line.speaker === 0 ? 1 : line.speaker === 1 ? 0 : line.speaker === 2 ? 1 : 0,
  })), [transcript]);
  const transcriptRef = useRef(normalized);
  transcriptRef.current = normalized;
  return (
    <LiveWindowChrome panel={panel} title="AI Assistant" subtitle="Live Q&A · Call Coach · Intent Engine" icon={BrainCircuit} onDock={panel.toggle}>
      <AIAssistantPopup
        embedded
        lead={lead}
        transcript={normalized}
        transcriptRef={transcriptRef}
        kbEntries={kbEntries}
        portalCfg={{}}
        engagementScore={0}
        qaActive={qaActive}
        coachActive={coachActive}
        intentActive={intentActive}
        onToggleQA={onToggleQA}
        onToggleCoach={onToggleCoach}
        onToggleIntent={onToggleIntent}
        onClose={panel.toggle}
        onIntentResult={()=>{}}
        onQALog={()=>{}}
        onCoachTip={()=>{}}
        allKbEntries={kbEntries}
        kbNames={[]}
        selectedKbName=""
        onKbChange={()=>{}}
        activeScript={null}
        scripts={[]}
        callAttemptNumber={lead?.callCount ? Number(lead.callCount)+1 : 1}
        previousCallSummary={null}
        memories={[]}
        pendingQuestion={pendingQuestion}
        liveQAItems={qaItems}
        liveCoachTips={coachTips}
        username={username}
      />
    </LiveWindowChrome>
  );
}
