/**
 * postScheduledQuotes — Posts scheduled quotes to the fronter chatroom.
 *
 * 1. Ensures twice-daily AI quotes (9am and 3pm ET) exist for today.
 * 2. Posts any due quotes (sentAt is null, scheduledTime <= now) to the chatroom
 *    as a FronterChatMessage with recipientUsername = '__chatroom__'.
 * Called by a scheduled workflow every 15 minutes.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const CHATROOM_RECIPIENT = '__chatroom__';
const CHRIS_USERNAME = 'chris';
const ET_TZ = 'America/New_York';

function getTzParts(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '0';
  return {
    year: parseInt(get('year')),
    month: parseInt(get('month')),
    day: parseInt(get('day')),
    hour: parseInt(get('hour')) % 24,
    minute: parseInt(get('minute')),
  };
}

function getETTimestamp(hour: number): string {
  const now = new Date();
  const p = getTzParts(now, ET_TZ);
  // Construct a Date at the given ET hour, then convert to UTC
  // ET is UTC-5 (EST) or UTC-4 (EDT). Use Intl to get the offset.
  const etString = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`;
  // Get the timezone offset for ET at this time
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: ET_TZ,
    timeZoneName: 'longOffset',
  });
  const offsetParts = dtf.formatToParts(new Date(etString + '-04:00'));
  const offset = offsetParts.find(p => p.type === 'timeZoneName')?.value || '-04:00';
  return `${etString}${offset}`;
}

async function ensureAiQuotesExist(base44: any): Promise<void> {
  const now = new Date();
  const p = getTzParts(now, ET_TZ);
  const todayStart = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}T00:00:00`;
  const todayEnd = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}T23:59:59`;

  // Get the ET offset for today
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: ET_TZ, timeZoneName: 'longOffset' });
  const offset = dtf.formatToParts(now).find(pt => pt.type === 'timeZoneName')?.value || '-04:00';

  const existing = await base44.asServiceRole.entities.FronterQuote.filter({
    sourceType: 'ai_scheduled',
    scheduledTime: { $gte: `${todayStart}${offset}`, $lte: `${todayEnd}${offset}` },
  });

  const quotes = existing || [];
  const has9am = quotes.some(q => {
    const qp = getTzParts(new Date(q.scheduledTime), ET_TZ);
    return qp.hour === 9;
  });
  const has3pm = quotes.some(q => {
    const qp = getTzParts(new Date(q.scheduledTime), ET_TZ);
    return qp.hour === 15;
  });

  const toCreate = [];
  if (!has9am) {
    const quote9am = await generateAiQuote(base44);
    toCreate.push({
      quoteText: quote9am,
      authorName: 'Chris - Sr. Debt Advisor',
      scheduledTime: getETTimestamp(9),
      sourceType: 'ai_scheduled',
      isActive: true,
    });
  }
  if (!has3pm) {
    const quote3pm = await generateAiQuote(base44);
    toCreate.push({
      quoteText: quote3pm,
      authorName: 'Chris - Sr. Debt Advisor',
      scheduledTime: getETTimestamp(15),
      sourceType: 'ai_scheduled',
      isActive: true,
    });
  }

  if (toCreate.length > 0) {
    await base44.asServiceRole.entities.FronterQuote.bulkCreate(toCreate);
  }
}

async function generateAiQuote(base44: any): Promise<string> {
  const themes = ['greatness', 'perseverance', 'hard work', 'dedication', 'resilience', 'overcoming obstacles', 'chasing your potential', 'refusing to quit', 'building something bigger than yourself'];
  const theme = themes[Math.floor(Math.random() * themes.length)];
  const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Write a short, powerful motivational quote about ${theme}. It should be 1-3 sentences, punchy, and inspiring. Think of something a sales leader would send to their team to fire them up. Do not include quotation marks around the whole thing. Do not attribute it to anyone. Just the quote itself.`,
  });
  return (res || '').trim();
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date().toISOString();

    // 1. Ensure today's AI quotes exist
    try {
      await ensureAiQuotesExist(base44);
    } catch (e) {
      console.warn('AI quote generation failed:', e);
    }

    // 2. Find all due quotes (not yet sent, scheduled time has passed, active)
    const dueQuotes = await base44.asServiceRole.entities.FronterQuote.filter({
      sentAt: { $exists: false },
      isActive: true,
      scheduledTime: { $lte: now },
    });

    let postedCount = 0;
    for (const quote of (dueQuotes || [])) {
      try {
        // Post to chatroom
        await base44.asServiceRole.entities.FronterChatMessage.create({
          senderUsername: CHRIS_USERNAME,
          senderRole: 'admin',
          message: `💬 "${quote.quoteText}"\n— ${quote.authorName || 'Chris - Sr. Debt Advisor'}`,
          recipientUsername: CHATROOM_RECIPIENT,
          readByAdmin: true,
          readByFronter: false,
        });

        // Mark as sent
        await base44.asServiceRole.entities.FronterQuote.update(quote.id, { sentAt: now });
        postedCount++;
      } catch (e) {
        console.warn('Failed to post quote:', quote.id, e);
      }
    }

    return Response.json({
      success: true,
      postedCount,
      checkedCount: (dueQuotes || []).length,
    });
  } catch (e) {
    return Response.json({ success: false, error: String(e) }, { status: 500 });
  }
}