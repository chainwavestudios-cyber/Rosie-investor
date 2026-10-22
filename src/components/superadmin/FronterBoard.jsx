/**
 * FronterBoard.jsx — the Fronter system board for the Super Admin Command Center.
 * Shows the fronter auth system only: who is on the phones, the transfer queue and
 * holds, the AI agent answering, fronter-side notifications, lead vault distribution,
 * fronter leads with point-and-click Twilio dialing, and fronter email engagement.
 */
import { useState } from 'react';
import DockBoard from '@/components/superadmin/DockBoard';
import SystemStrip from '@/components/superadmin/SystemStrip';
import FrontersCard from '@/components/superadmin/cards/FrontersCard';
import PopupMessageCard from '@/components/superadmin/cards/PopupMessageCard';
import QueueCard from '@/components/superadmin/cards/QueueCard';
import AiAgentLiveCard from '@/components/superadmin/cards/AiAgentLiveCard';
import LiveFeedCard from '@/components/superadmin/cards/LiveFeedCard';
import DistributionCard from '@/components/superadmin/cards/DistributionCard';
import ClientDialCard from '@/components/superadmin/cards/ClientDialCard';
import EmailEngagementCard from '@/components/superadmin/cards/EmailEngagementCard';
import { C } from '@/components/superadmin/kit';

export default function FronterBoard({ username, columns = 3, splitHint }) {
  const [dialTarget, setDialTarget] = useState(null);

  const cards = [
    { id: 'fronter-team', title: 'Fronters Live', subtitle: 'status · calls · timers', icon: '👥', span: 1, render: () => <FrontersCard onDial={(number, name) => setDialTarget({ number, name })} /> },
    { id: 'fronter-queue', title: 'Transfer Queue', subtitle: 'holds · pipeline · recent', icon: '⏳', span: 1, render: () => <QueueCard onDial={(number, name) => setDialTarget({ number, name })} /> },
    { id: 'fronter-agent', title: 'AI Agent Live', subtitle: 'answering inbound', icon: '🤖', span: 1, render: () => <AiAgentLiveCard username={username} /> },
    { id: 'fronter-feed', title: 'Live Notifications', subtitle: 'Fronter system', icon: '🔔', span: 1, render: () => <LiveFeedCard system="fronter" /> },
    { id: 'fronter-popup', title: 'Popup Message', subtitle: 'one-time message to one fronter', icon: '💬', span: 1, render: () => <PopupMessageCard username={username} /> },
    { id: 'fronter-vault', title: 'Vault & Distribution', subtitle: 'pipeline · destinations', icon: '📦', span: 1, render: () => <DistributionCard /> },
    { id: 'fronter-email', title: 'Email Engagement', subtitle: 'opens · clicks · welcome views', icon: '✉️', span: 1, render: () => <EmailEngagementCard system="fronter" /> },
    { id: 'fronter-dial', title: 'Point & Click Dialer', subtitle: 'fronter leads · twilio softphone', icon: '☎️', span: 2, render: () => <ClientDialCard system="fronter" username={username} dialTarget={dialTarget} setDialTarget={setDialTarget} /> },
  ];

  return (
    <div>
      <SystemStrip
        accent={C.fronter}
        title="Fronter System"
        loginPath="/fronter"
        blurb="Fronters on the phones, the transfer queue, AI agent answering, lead vault distribution and email engagement."
      />
      <DockBoard boardKey="fronter" cards={cards} accent={C.fronter} columns={columns} username={username} splitHint={splitHint} />
    </div>
  );
}