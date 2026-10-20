/**
 * CoachBoard.jsx — the Debt Call Coach system board for the Super Admin Command Center.
 * Shows the coach auth system only: AI agent, AI call activity, AI + Base44 credit usage,
 * the coach notification feed, coach clients with point-and-click Twilio dialing, coach
 * email engagement, and the editable contact card the assistant portal reads.
 */
import { useState } from 'react';
import DockBoard from '@/components/superadmin/DockBoard';
import SystemStrip from '@/components/superadmin/SystemStrip';
import AiAgentLiveCard from '@/components/superadmin/cards/AiAgentLiveCard';
import AiActivityCard from '@/components/superadmin/cards/AiActivityCard';
import AiCreditsCard from '@/components/superadmin/cards/AiCreditsCard';
import ClientDialCard from '@/components/superadmin/cards/ClientDialCard';
import EmailEngagementCard from '@/components/superadmin/cards/EmailEngagementCard';
import LiveFeedCard from '@/components/superadmin/cards/LiveFeedCard';
import ContactCardEditorCard from '@/components/superadmin/cards/ContactCardEditorCard';
import { C } from '@/components/superadmin/kit';

export default function CoachBoard({ username, columns = 3, splitHint }) {
  const [dialTarget, setDialTarget] = useState(null);

  const cards = [
    { id: 'coach-agent', title: 'AI Agent Live', subtitle: 'answering · voice pipeline', icon: '🤖', span: 1, render: () => <AiAgentLiveCard username={username} /> },
    { id: 'coach-activity', title: 'AI Call Activity', subtitle: 'inbound + outbound · live', icon: '📞', span: 1, render: () => <AiActivityCard /> },
    { id: 'coach-feed', title: 'Live Notifications', subtitle: 'Debt Call Coach system', icon: '🔔', span: 1, render: () => <LiveFeedCard system="coach" /> },
    { id: 'coach-credits', title: 'AI & Credit Usage', subtitle: 'app AI · base44 workspace', icon: '⚡', span: 1, render: () => <AiCreditsCard username={username} /> },
    { id: 'coach-email', title: 'Email Engagement', subtitle: 'opens · clicks · welcome views', icon: '✉️', span: 1, render: () => <EmailEngagementCard system="coach" /> },
    { id: 'coach-dial', title: 'Point & Click Dialer', subtitle: 'coach clients · twilio softphone', icon: '☎️', span: 2, render: () => <ClientDialCard system="coach" username={username} dialTarget={dialTarget} setDialTarget={setDialTarget} /> },
    { id: 'coach-contact', title: 'Calendar Contact Card — Master', subtitle: 'editable · pushes live to the assistant portal', icon: '🗂️', span: 3, render: () => <ContactCardEditorCard username={username} /> },
  ];

  return (
    <div>
      <SystemStrip
        accent={C.coach}
        title="Debt Call Coach System"
        loginPath="/debt-call-coach-login"
        blurb="Coach clients, appointments, AI agent pipeline, credit usage and the assistant portal contact card."
      />
      <DockBoard boardKey="coach" cards={cards} accent={C.coach} columns={columns} username={username} splitHint={splitHint} />
    </div>
  );
}