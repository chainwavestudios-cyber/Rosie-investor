/**
 * WebChatBoard.jsx — the Website Chat board for the Super Admin Command Center.
 * Every visitor talking to the homepage assistant, live, with human takeover.
 */
import DockBoard from '@/components/superadmin/DockBoard';
import SystemStrip from '@/components/superadmin/SystemStrip';
import WebChatCard from '@/components/superadmin/cards/WebChatCard';
import { C } from '@/components/superadmin/kit';

export default function WebChatBoard({ username, adminUserId, adminToken, columns = 3, splitHint }) {
  const cards = [
    {
      id: 'webchat-live',
      title: 'Live Website Chat',
      subtitle: 'one tab per visitor · takeover',
      icon: '💬',
      span: 3,
      render: () => <WebChatCard adminUserId={adminUserId} adminToken={adminToken} />,
    },
  ];

  return (
    <div>
      <SystemStrip
        accent={C.fronter}
        title="Website Chat"
        loginPath="homepage • /"
        blurb="Every visitor talking to the homepage assistant. Watch the bot qualify them, take the chat over yourself, and hand it back when you are done."
      />
      <DockBoard boardKey="webchat" cards={cards} accent={C.fronter} columns={columns} username={username} splitHint={splitHint} />
    </div>
  );
}