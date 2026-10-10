/**
 * FronterNoteAttachment.jsx — Renders a private file or audio recording
 * attached to a contact-card note (fetches a short-lived signed URL on demand).
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function FronterNoteAttachment({ attachment }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const getUrl = async () => {
    setLoading(true);
    const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: attachment.fileUri, expires_in: 3600 });
    setLoading(false);
    return res?.signed_url;
  };

  if (attachment.kind === 'audio') {
    if (url) return <audio controls autoPlay src={url} style={{ width: '100%', height: '32px', marginTop: '4px' }} />;
    return (
      <button onClick={async () => setUrl(await getUrl())} style={linkBtn}>{loading ? '⏳ Loading…' : '▶ Play recording'}</button>
    );
  }
  return (
    <button onClick={async () => { const u = await getUrl(); if (u) window.open(u, '_blank'); }} style={linkBtn}>
      {loading ? '⏳ Opening…' : `📎 ${attachment.fileName || 'Attachment'}`}
    </button>
  );
}

const linkBtn = { marginTop: '4px', background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '3px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px' };