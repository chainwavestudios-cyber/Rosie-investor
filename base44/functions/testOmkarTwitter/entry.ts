/**
 * testOmkarTwitter — quick test of the Omkar Twitter Scraper API
 * using our existing omkar.cloud API key (PHONE_LOOKUP_API_KEY).
 *
 * Tests: /users/tweets (fetch a known user's recent tweets)
 */
const OMKAR_KEY = process.env.PHONE_LOOKUP_API_KEY || '';
const BASE = 'https://twitter-scraper.omkar.cloud';

export default async function (req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const username = body?.username || 'nasa';
    const count = body?.count || 5;

    if (!OMKAR_KEY) {
      return Response.json({ error: 'PHONE_LOOKUP_API_KEY not set' }, { status: 500 });
    }

    const url = `${BASE}/users/tweets?user=${encodeURIComponent(username)}&count=${count}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(url, {
      headers: { 'API-Key': OMKAR_KEY },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const status = res.status;
    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = text.substring(0, 500); }

    return Response.json({
      url,
      httpStatus: status,
      keyPrefix: OMKAR_KEY.substring(0, 6) + '...',
      success: status === 200,
      tweetCount: data?.tweets?.length ?? 0,
      firstTweet: data?.tweets?.[0]
        ? {
            id: data.tweets[0].id,
            text: (data.tweets[0].text || '').substring(0, 200),
            created_at: data.tweets[0].created_at,
            likes: data.tweets[0].stats?.likes,
            author: data.tweets[0].author?.username,
          }
        : null,
      rawError: status !== 200 ? (typeof data === 'string' ? data : data?.message || data) : null,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}