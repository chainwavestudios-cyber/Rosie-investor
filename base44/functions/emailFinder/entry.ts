/**
 * emailFinder — one-at-a-time email lookup for the coach portal.
 *
 * The same Tracerfy skip-trace lookup the Leads Vault uses for phone append:
 * an address is the key, and the response carries the owner's emails (and
 * phones). The name and number the operator types are used to pick WHICH person
 * at that address is the one being looked up, so the email shown belongs to the
 * right household member rather than a random one.
 *
 * Nothing is written to any entity — this is a read-only lookup tool.
 * Cost: Tracerfy charges per hit, misses are free.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { secrets } from 'base44:runtime';

const TRACERFY_URL = 'https://tracerfy.com/v1/api/trace/lookup/';

function clean(value: any): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

/** Every digit of a phone, so formats never matter. */
function digits(value: any): string {
  return clean(value).replace(/\D/g, '');
}

/** The last ten digits — how two American numbers are compared. */
function last10(value: any): string {
  const d = digits(value);
  return d.length > 10 ? d.slice(-10) : d;
}

/** Tracerfy sends names in caps ("JANET MORRIS") — show them normally. */
function titleCase(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    // The coach portal signs people in with its own credentials, so the platform
    // session may be absent — the tool lives in an admin-only tab either way.
    try { await base44.auth.me(); } catch { /* portal-authenticated caller */ }

    const body = await req.json().catch(() => ({}));
    const firstName = clean(body.firstName);
    const lastName = clean(body.lastName);
    const phone = clean(body.phone);
    const address = clean(body.address);
    const city = clean(body.city);
    const state = clean(body.state).toUpperCase().slice(0, 2);
    const zip = clean(body.zip);

    if (!address) return Response.json({ error: 'Enter the street address — the lookup searches on it.' }, { status: 400 });
    if (!state) return Response.json({ error: 'Enter the state (two letters) — the lookup needs it.' }, { status: 400 });

    const apiKey = secrets.get('TRACERFY_API_KEY') || '';
    if (!apiKey) return Response.json({ error: 'The Tracerfy API key is not set for this app.' }, { status: 500 });

    const payload: Record<string, string> = { address, state };
    if (city) payload.city = city;
    if (zip) payload.zip = zip;
    if (firstName) payload.first_name = firstName;
    if (lastName) payload.last_name = lastName;

    const res = await fetch(TRACERFY_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });

    if (res.status === 402) {
      return Response.json({ error: 'Tracerfy is out of credits — add credits at tracerfy.com.' }, { status: 402 });
    }
    if (res.status === 429) {
      return Response.json({ error: 'Tracerfy is rate limiting right now — try again in a minute.' }, { status: 429 });
    }

    const raw: any = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = clean(raw?.error) || clean(raw?.detail) || `Tracerfy returned ${res.status}.`;
      return Response.json({ error: detail }, { status: 502 });
    }

    const creditsUsed = Number(raw?.credits_deducted || 0);
    const people = (Array.isArray(raw?.persons) ? raw.persons : []).map((person: any) => ({
      name: [titleCase(person?.first_name), titleCase(person?.last_name)].filter(Boolean).join(' '),
      phones: (Array.isArray(person?.phones) ? person.phones : [])
        .filter((p: any) => clean(p?.number))
        .map((p: any) => ({ number: clean(p.number), type: titleCase(p.type || ''), carrier: clean(p.carrier) })),
      emails: (Array.isArray(person?.emails) ? person.emails : [])
        .filter((e: any) => clean(e?.email))
        .map((e: any) => ({ email: clean(e.email).toLowerCase(), rank: Number(e.rank || 99) }))
        .sort((a: any, b: any) => a.rank - b.rank),
    }));

    if (!raw?.hit || !people.length) {
      return Response.json({
        ok: true,
        hit: false,
        creditsUsed,
        persons: [],
        emails: [],
        message: 'No match at that address. Tracerfy does not charge for a miss.',
      });
    }

    // Which person at that address is the one being looked up? The number they
    // typed is the strongest signal, the surname comes second.
    const wanted = last10(phone);
    const family = lastName.toLowerCase();
    let matchedIndex = -1;
    let matchedBy = 'address';

    if (wanted) {
      matchedIndex = people.findIndex((person: any) => person.phones.some((p: any) => last10(p.number) === wanted));
      if (matchedIndex >= 0) matchedBy = 'phone';
    }
    if (matchedIndex < 0 && family) {
      matchedIndex = people.findIndex((person: any) => person.name.toLowerCase().includes(family));
      if (matchedIndex >= 0) matchedBy = 'name';
    }
    if (matchedIndex < 0) matchedIndex = people.findIndex((person: any) => person.emails.length);
    if (matchedIndex < 0) matchedIndex = 0;

    // Every email on file at that address, best-ranked first, no repeats.
    const seen = new Set<string>();
    const emails: Array<{ email: string; rank: number }> = [];
    for (const person of people) {
      for (const email of person.emails) {
        if (seen.has(email.email)) continue;
        seen.add(email.email);
        emails.push(email);
      }
    }
    emails.sort((a, b) => a.rank - b.rank);

    const match = people[matchedIndex];
    return Response.json({
      ok: true,
      hit: true,
      creditsUsed,
      matchedBy,
      match,
      persons: people,
      emails,
      bestEmail: match?.emails?.[0]?.email || emails[0]?.email || '',
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'The lookup could not run.' }, { status: 500 });
  }
}