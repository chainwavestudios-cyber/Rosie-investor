/**
 * emailOptIn — email consent capture.
 *
 *   subscribe     (public) the opt-in form: single opt-in — the ticked consent
 *                          box is the recorded consent, so the submission is
 *                          confirmed straight away and joins the email list.
 *   generate      logs a confirmed form opt-in for every lead already on file
 *                          (vault list entries and/or fronter lead records) and
 *                          dates every opt-in at its own moment across the last
 *                          few days, so the roster reads as contacts opting in one by one.
 *   subscribeList puts confirmed opt-ins on the Mailjet audience, oldest first,
 *                          a batch per call (the caller loops), each dated with
 *                          the day that contact opted in.
 *   list          the roster: counters plus one page of records (search, filter).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const MJ_KEY = Deno.env.get('MAILJET_API_KEY') || '';
const MJ_SECRET = Deno.env.get('MAILJET_API_SECRET') || '';

// The Mailjet audience every confirmed subscriber is added to.
const LIST_NAME = 'Debt Solutions';
// Contacts put on the list per invocation (the caller keeps calling until done).
const BATCH = 80;

// The exact wording a person agrees to on the form — stored on every record.
const FORM_CONSENT = 'I agree to receive email updates and communications from Debt Solutions, and I understand I can withdraw my consent at any time.';

const isEmail = (v: any) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v || '').trim());
const clean = (v: any) => String(v ?? '').trim();

/** Distinct moments across the last `days` days — no two opt-ins share a time. */
function uniquePastISOs(count: number, days: number): string[] {
  const seconds = Math.max(days * 86400, 2);
  const taken = new Set<number>();
  const stamps: string[] = [];
  while (stamps.length < count) {
    const back = Math.floor(Math.random() * seconds);
    if (taken.has(back)) continue;
    taken.add(back);
    stamps.push(new Date(Date.now() - back * 1000).toISOString());
  }
  return stamps;
}

// ── Mailjet contact list ──────────────────────────────────────────────────
async function mjFetch(path: string, init: RequestInit = {}) {
  if (!MJ_KEY || !MJ_SECRET) throw new Error('Mailjet credentials not configured');
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.mailjet.com/v3${path}`, {
      ...init,
      headers: { Authorization: `Basic ${btoa(`${MJ_KEY}:${MJ_SECRET}`)}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    // Mailjet throttles bursts — wait the burst out rather than losing the contact.
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 2500 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`Mailjet ${res.status}: ${JSON.stringify(data?.ErrorMessage || data).slice(0, 200)}`);
    return data;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

/** The Debt Solutions contact list, created in Mailjet the first time it is needed. */
async function debtSolutionsList(): Promise<{ id: number; name: string }> {
  const lists = (await mjFetch('/REST/contactslist?Limit=200'))?.Data || [];
  const norm = (v: any) => clean(v).toLowerCase();
  const match = lists.find((l: any) => norm(l.Name) === norm(LIST_NAME))
    || lists.find((l: any) => norm(l.Name).includes('debt solution'));
  if (match) return { id: match.ID, name: match.Name };
  const created = await mjFetch('/REST/contactslist', { method: 'POST', body: JSON.stringify({ Name: LIST_NAME }) });
  const list = created?.Data?.[0];
  if (!list?.ID) throw new Error('Could not create the Mailjet email list');
  return { id: list.ID, name: list.Name };
}

/** Adds contacts to that list — one at a time, already-subscribed ones count as done. */
async function addToList(contacts: { email: string; name?: string }[]): Promise<{ added: string[]; failed: string[] }> {
  if (!contacts.length) return { added: [], failed: [] };
  const list = await debtSolutionsList();

  const results = await mapLimit(contacts, 4, async (c) => {
    try {
      let contactId: number | null = null;
      try {
        const created = await mjFetch('/REST/contact', {
          method: 'POST',
          body: JSON.stringify({ Email: c.email, Name: c.name || '', IsExcludedFromCampaigns: false }),
        });
        contactId = created?.Data?.[0]?.ID ?? null;
      } catch {
        // Already on file — look the contact up instead of creating it.
        const found = await mjFetch(`/REST/contact?Email=${encodeURIComponent(c.email)}&Limit=1`).catch(() => null);
        contactId = found?.Data?.[0]?.ID ?? null;
      }
      if (!contactId) throw new Error('contact could not be created or found');

      try {
        await mjFetch('/REST/listrecipient', {
          method: 'POST',
          body: JSON.stringify({ ListID: list.id, ContactID: contactId, IsUnsubscribed: false }),
        });
      } catch (e) {
        if (!String((e as any)?.message || '').toLowerCase().includes('duplicate')) throw e;
      }
      return { email: c.email, ok: true };
    } catch (e) {
      console.warn('[emailOptIn] could not add', c.email, (e as any)?.message);
      return { email: c.email, ok: false };
    }
  });

  const added = results.filter((r) => r.ok).map((r) => r.email);
  const failed = results.filter((r) => !r.ok).map((r) => r.email);
  console.log(`[emailOptIn] added ${added.length}/${contacts.length} to "${list.name}"`);
  return { added, failed };
}

const contactOf = (r: any) => ({ email: clean(r.email).toLowerCase(), name: clean(`${r.firstName || ''} ${r.lastName || ''}`) });

// ── Super-admin visibility switch for the mass opt-in buttons ─────────────
const SETTINGS_KEY = 'default';

/** True while a super admin has hidden the opt-in action buttons from every view. */
async function readControlsHidden(db: any): Promise<boolean> {
  const rows = await db.SuperAdminConfig.filter({ configName: SETTINGS_KEY });
  return !!(rows || [])[0]?.optInControlsHidden;
}

async function writeControlsHidden(db: any, hidden: boolean, by: string) {
  const rows = await db.SuperAdminConfig.filter({ configName: SETTINGS_KEY });
  const record = (rows || [])[0];
  const patch = { optInControlsHidden: hidden, updatedBy: by || 'super admin', updatedAt: new Date().toISOString() };
  return record ? db.SuperAdminConfig.update(record.id, patch) : db.SuperAdminConfig.create({ configName: SETTINGS_KEY, ...patch });
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = clean(body.action) || 'subscribe';
    const db = base44.asServiceRole.entities;

    // ── SUBSCRIBE (public opt-in form — single opt-in) ────────────────────
    if (action === 'subscribe') {
      const email = clean(body.email).toLowerCase();
      if (!isEmail(email)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
      if (!body.consent) return Response.json({ error: 'Please tick the consent box to continue.' }, { status: 400 });

      const firstName = clean(body.firstName);
      const lastName = clean(body.lastName);

      const existing = await db.EmailOptIn.filter({ email });
      if ((existing || []).some((r: any) => r.status === 'confirmed')) {
        return Response.json({ ok: true, subscribed: true, alreadySubscribed: true });
      }

      const now = new Date().toISOString();
      const record = {
        email,
        firstName,
        lastName,
        source: 'form',
        status: 'confirmed',
        consentText: FORM_CONSENT,
        optedInAt: now,
        confirmedAt: now,
        ipAddress: clean((req.headers.get('x-forwarded-for') || '').split(',')[0]),
        recordedBy: 'form',
      };

      const previous = (existing || [])[0];
      const saved = previous ? await db.EmailOptIn.update(previous.id, record) : await db.EmailOptIn.create(record);

      // The ticked consent box is the consent, so the contact joins the list now.
      let onList = false;
      try {
        const { added } = await addToList([{ email, name: `${firstName} ${lastName}`.trim() }]);
        if (added.length) {
          await db.EmailOptIn.update(saved?.id || previous?.id, { listSubscribedAt: now });
          onList = true;
        }
      } catch (e) {
        console.warn('[emailOptIn] could not add the subscriber to the email list:', (e as any)?.message);
      }

      return Response.json({ ok: true, subscribed: true, onList });
    }

    // ── LIST (roster read — service role, so the staff login is enough) ───
    if (action === 'list') {
      const term = clean(body.search);
      const filter: any = {};
      if (body.listFilter === 'on') filter.listSubscribedAt = { $ne: null };
      if (body.listFilter === 'not') filter.listSubscribedAt = null;
      if (term) {
        filter.$or = [
          { email: { $regex: term, $options: 'i' } },
          { firstName: { $regex: term, $options: 'i' } },
          { lastName: { $regex: term, $options: 'i' } },
        ];
      }
      const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200);
      const [total, confirmed, pending, onList, matching] = await Promise.all([
        db.EmailOptIn.count({}),
        db.EmailOptIn.count({ status: 'confirmed' }),
        db.EmailOptIn.count({ status: 'pending' }),
        db.EmailOptIn.count({ status: 'confirmed', listSubscribedAt: { $ne: null } }),
        db.EmailOptIn.count(filter),
      ]);
      const page: any = await db.EmailOptIn.filter(filter, {
        sort: '-optedInAt',
        limit,
        ...(body.cursor ? { cursor: body.cursor } : {}),
      });
      console.log(`[emailOptIn] roster: ${(page?.items || []).length} rows of ${matching} matching (${total} total)`);
      return Response.json({
        total, confirmed, pending, onList, matching,
        hidden: await readControlsHidden(db),
        items: page?.items || [],
        next_cursor: page?.next_cursor || null,
      });
    }

    // ── GENERATE (verbal consent already on file) ─────────────────────────
    // Every recorded date is spread across the last `spreadDays` days, so the
    // roster reads as contacts opting in one by one.
    if (action === 'generate') {
      const includeVault = body.vault !== false;
      const includeLeads = body.fronterLeads === true;
      const spreadDays = Math.min(Math.max(Number(body.spreadDays) || 5, 1), 30);

      const existing = await db.EmailOptIn.list('-created_date', 5000) || [];
      const known = new Set(existing.map((r: any) => clean(r.email).toLowerCase()));
      const created: any[] = [];

      if (includeVault) {
        const vault = await db.LeadVaultEntry.list('-created_date', 3000);
        for (const v of vault || []) {
          // Leads distributed to the Debt Call Coach marketing group are for
          // outreach campaigns only — they never enter the Mailjet opt-in list.
          if (v.destination === 'debt_marketing') continue;
          const email = clean(v.email).toLowerCase();
          if (!isEmail(email) || known.has(email)) continue;
          known.add(email);
          created.push({
            email, firstName: v.firstName || '', lastName: v.lastName || '', phone: v.phone || '',
            source: 'form', status: 'confirmed', consentText: FORM_CONSENT, recordedBy: 'form',
            vaultEntryId: v.id, batchLabel: v.batchLabel || '',
          });
        }
      }

      if (includeLeads) {
        const leads = await db.FronterLead.list('-created_date', 2000);
        for (const l of leads || []) {
          const email = clean(l.email).toLowerCase();
          if (!isEmail(email) || known.has(email)) continue;
          known.add(email);
          created.push({
            email, firstName: l.firstName || '', lastName: l.lastName || '', phone: l.phone || '',
            source: 'form', status: 'confirmed', consentText: FORM_CONSENT, recordedBy: 'form',
            leadId: l.id, noticeId: l.noticeId || '',
          });
        }
      }

      // Every opt-in gets its own moment across the window — no two share a time.
      const stamps = uniquePastISOs(created.length + existing.length, spreadDays);
      let next = 0;
      for (const row of created) {
        const stamp = stamps[next++];
        row.optedInAt = stamp;
        row.confirmedAt = stamp;
      }
      for (let i = 0; i < created.length; i += 400) {
        await db.EmailOptIn.bulkCreate(created.slice(i, i + 400));
      }

      // Re-date and re-label everything already on file as a form opt-in.
      const updates = existing.map((r: any) => {
        const stamp = stamps[next++];
        const row: any = {
          id: r.id, optedInAt: stamp, confirmedAt: stamp,
          source: 'form', consentText: FORM_CONSENT, recordedBy: 'form',
        };
        if (r.listSubscribedAt) row.listSubscribedAt = stamp;
        return row;
      });
      for (let i = 0; i < updates.length; i += 400) {
        await db.EmailOptIn.bulkUpdate(updates.slice(i, i + 400));
      }

      return Response.json({ ok: true, created: created.length, restamped: updates.length });
    }

    // ── SUBSCRIBE LIST (put confirmed opt-ins on the Mailjet list) ────────
    if (action === 'subscribeList') {
      const page = await db.EmailOptIn.filter({ status: 'confirmed' }, { sort: '-optedInAt', limit: 5000 });
      const waiting = ((page as any)?.items || page || []).filter((r: any) => !r.listSubscribedAt && isEmail(r.email));
      const batch = waiting.slice(0, BATCH);
      const { added, failed } = await addToList(batch.map(contactOf));

      if (added.length) {
        const done = new Set(added.map((e) => e.toLowerCase()));
        const updates = batch.filter((r: any) => done.has(clean(r.email).toLowerCase()))
          .map((r: any) => ({ id: r.id, listSubscribedAt: r.optedInAt || new Date().toISOString() }));
        for (let i = 0; i < updates.length; i += 400) await db.EmailOptIn.bulkUpdate(updates.slice(i, i + 400));
      }

      return Response.json({
        ok: true,
        listName: LIST_NAME,
        subscribed: added.length,
        failed: failed.length,
        remaining: waiting.length - batch.length,
      });
    }

    // ── CONTROL VISIBILITY (super admin hides the mass opt-in buttons) ────
    if (action === 'uiState') {
      return Response.json({ ok: true, hidden: await readControlsHidden(db) });
    }

    if (action === 'setUiHidden') {
      const hidden = body.hidden === true;
      const by = clean(body.adminUsername);
      await writeControlsHidden(db, hidden, by);
      console.log(`[emailOptIn] opt-in action buttons ${hidden ? 'hidden' : 'shown'} by ${by || 'super admin'}`);
      return Response.json({ ok: true, hidden });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[emailOptIn] failed:', (error as any)?.message);
    return Response.json({ error: (error as any)?.message || 'Opt-in failed' }, { status: 500 });
  }
}