/**
 * AiAgentLiveCard.jsx — Fronter system: live status of the AI agent answering the line,
 * its telephony targets, voice pipeline and knowledge bases, with an activate/deactivate switch.
 */
import FronterMonitorAIAgent from '@/components/fronter/FronterMonitorAIAgent';

export default function AiAgentLiveCard({ username }) {
  return (
    <div style={{ maxHeight: '560px', overflowY: 'auto' }}>
      <FronterMonitorAIAgent adminUsername={username} />
    </div>
  );
}