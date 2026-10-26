/**
 * unsendEmail — the Unsend button on an Email Activity entry.
 *
 * A send that just went out can be pulled back out of the sending Gmail account:
 * the message is moved to Trash there and its own record is stamped as unsent, so
 * the activity list stops showing it as a live send. The window is the first few
 * minutes after the send, which is what makes it an undo rather than a cleanup.
 *
 * Every handled refusal comes back as { error } so the card can show the reason
 * in plain words.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.53';
import { trashViaGmail } from '../../shared/gmailSend.ts';

// How long after a send the Unsend window stays open.
const UNSEND_WINDOW_MS = 5 * 60 * 1000;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const { messageId, unsentBy } = await req.json();
    if (!messageId) return Response.json({ error: 'Which email should be unsent?' });

    const record = await base44.asServiceRole.entities.EmailMessage.get(messageId).catch(() => null);
    if (!record) return Response.json({ error: 'That email is no longer on file.' });
    if (record.unsentAt) return Response.json({ error: 'That email was already unsent.', unsentAt: record.unsentAt });
    if (record.status !== 'sent') {
      return Response.json({ error: `Only a sent email can be unsent (this one is ${record.status}).` });
    }

    const sentAt = new Date(record.sentAt || record.created_date).getTime();
    if (Number.isNaN(sentAt) || Date.now() - sentAt > UNSEND_WINDOW_MS) {
      return Response.json({ error: 'Too late to unsend. It works for the first few minutes after a send.' });
    }

    try {
      await trashViaGmail(base44, record.messageId);
    } catch (e: any) {
      return Response.json({ error: String(e?.message || e) });
    }

    const unsentAt = new Date().toISOString();
    await base44.asServiceRole.entities.EmailMessage.update(record.id, { unsentAt, unsentBy: unsentBy || '' });
    return Response.json({ success: true, unsentAt });
  } catch (error: any) {
    console.error('[unsendEmail] Error:', error);
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
});