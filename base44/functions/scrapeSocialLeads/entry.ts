/**
 * scrapeSocialLeads — Institutional-grade social media lead scraper for debt
 * settlement intent mining.
 *
 * Uses Reddit's public JSON API with robust retry/backoff, rate-limit awareness,
 * and deduplication. A browser-like User-Agent and 1.5s request spacing keep
 * Reddit from throttling.
 *
 * Pipeline: fetch posts → regex debt amount extraction ($10k-$200k) → distress
 * phrase matching (Categories A/B/C) → deduplicate by post URL → bulk save.
 *
 * Profile enrichment is deferred to the resolveLeadIdentity function to keep
 * this scraper fast and within rate limits.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// ── Default config (used when no SmartLeadConfig entity exists yet) ────────
const DEFAULT_SUBREDDITS = ['Debt', 'povertyfinance', 'CreditCards', 'personalfinance'];
const DEFAULT_SEARCH_QUERIES = [
  'credit card debt',
  'drowning in debt',
  'maxed out credit card',
  "can't pay minimum",
  'debt settlement',
  'behind on credit card',
];
const DEFAULT_QUORA_TOPICS = ['Debt', 'Credit-Cards', 'Personal-Debt', 'Personal-Finance-Advice'];
const DEFAULT_STACKEXCHANGE_FEEDS = [
  'https://money.stackexchange.com/feeds',
  'https://money.stackexchange.com/feeds/tag/credit-card',
  'https://money.stackexchange.com/feeds/tag/debt',
];
const DEFAULT_CATEGORY_A = [
  '10k in credit card debt', '15k in credit card debt', '20k in credit card debt',
  '25k in credit card debt', '30k in credit card debt', '40k in credit card debt',
  '50k in credit card debt', '75k in credit card debt', '100k in credit card debt',
  '150k in credit card debt', '200k in credit card debt',
];
const DEFAULT_CATEGORY_B: any[] = [
  { phrase: 'maxed out', require: ['10k', '20k', '30k', '50k', '100k'], mode: 'any' },
  { phrase: 'drowning in', require: ['credit card debt', 'card debt', 'minimum payments'], mode: 'any' },
  { phrase: 'so screwed', require: ['credit card', 'debt', 'cards'], mode: 'any' },
  { phrase: "can't make my minimum", require: [], mode: 'any' },
  { phrase: 'behind on credit card', require: [], mode: 'any' },
  { phrase: 'interest is killing me', require: ['credit card', 'balance'], mode: 'any' },
  { phrase: 'how to get out of', require: ['30k debt', '40k debt', '50k debt', '100k debt'], mode: 'any' },
];
const DEFAULT_CATEGORY_C = [
  'paying $1000 a month in interest',
  'paying $500 a month in interest',
  '5 cards maxed', '4 cards maxed', '3 cards maxed',
  'credit card debt is ruin',
  'credit card debt is destroying',
];
const DEFAULT_DEBT_MIN = 10000;
const DEFAULT_DEBT_MAX = 200000;
const DEFAULT_MAX_POST_AGE_DAYS = 60;

// ── Loaded config (populated at runtime from SmartLeadConfig entity) ──────
let SUBREDDITS = DEFAULT_SUBREDDITS;
let SEARCH_QUERIES = DEFAULT_SEARCH_QUERIES;
let QUORA_TOPICS = DEFAULT_QUORA_TOPICS;
let STACKEXCHANGE_FEEDS = DEFAULT_STACKEXCHANGE_FEEDS;
let CATEGORY_A = DEFAULT_CATEGORY_A;
let CATEGORY_B: any[] = DEFAULT_CATEGORY_B;
let CATEGORY_C = DEFAULT_CATEGORY_C;
let DEBT_AMOUNT_MIN = DEFAULT_DEBT_MIN;
let DEBT_AMOUNT_MAX = DEFAULT_DEBT_MAX;
let MAX_POST_AGE_DAYS = DEFAULT_MAX_POST_AGE_DAYS;

// ── Debt amount regex ($10k - $200k range) ─────────────────────────────────
const DEBT_AMOUNT_REGEX = /\b(\$?(?:1[0-9]|[2-9][0-9]|1[0-9]{2}|200)\s?k|\$?(?:1[0-9]|[2-9][0-9]|1[0-9]{2}),?000|\b(?:10|15|20|25|30|40|50|75|100|150|200)\s?grand)\b.*?(credit card|debt|balances|cards)/i;

function safeParseJson<T>(str: string | undefined | null, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

// Load config from SmartLeadConfig entity (falls back to defaults)
async function loadConfig(base44: any): Promise<void> {
  try {
    const configs = await base44.asServiceRole.entities.SmartLeadConfig.list('-created_date', 1);
    if (!configs || configs.length === 0) return;
    const c = configs[0];
    SUBREDDITS = safeParseJson(c.subredditsJson, DEFAULT_SUBREDDITS);
    SEARCH_QUERIES = safeParseJson(c.searchQueriesJson, DEFAULT_SEARCH_QUERIES);
    QUORA_TOPICS = safeParseJson(c.quoraTopicsJson, DEFAULT_QUORA_TOPICS);
    STACKEXCHANGE_FEEDS = safeParseJson(c.stackExchangeFeedsJson, DEFAULT_STACKEXCHANGE_FEEDS);
    CATEGORY_A = safeParseJson(c.categoryAJson, DEFAULT_CATEGORY_A);
    CATEGORY_B = safeParseJson(c.categoryBJson, DEFAULT_CATEGORY_B);
    CATEGORY_C = safeParseJson(c.categoryCJson, DEFAULT_CATEGORY_C);
    DEBT_AMOUNT_MIN = c.debtAmountMin || DEFAULT_DEBT_MIN;
    DEBT_AMOUNT_MAX = c.debtAmountMax || DEFAULT_DEBT_MAX;
    MAX_POST_AGE_DAYS = c.maxPostAgeDays || DEFAULT_MAX_POST_AGE_DAYS;
  } catch { /* use defaults */ }
}

// Check if a post is older than MAX_POST_AGE_DAYS
function isPostTooOld(postCreatedAt: string | null): boolean {
  if (!postCreatedAt) return false; // if no date, allow it (might be from RSS without date)
  try {
    const postDate = new Date(postCreatedAt);
    const ageMs = Date.now() - postDate.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays > MAX_POST_AGE_DAYS;
  } catch { return false; }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractDebtAmount(text: string): { amount: number | null; raw: string } {
  const match = text.match(DEBT_AMOUNT_REGEX);
  if (!match) return { amount: null, raw: '' };
  const raw = match[0];
  const numMatch = raw.match(/\$?([\d,]+)\s?(k|grand)?/i);
  if (!numMatch) return { amount: null, raw };
  let num = parseInt(numMatch[1].replace(/,/g, ''), 10);
  const suffix = (numMatch[2] || '').toLowerCase();
  if (suffix === 'k') num *= 1000;
  if (suffix === 'grand') num *= 1000;
  if (num < DEBT_AMOUNT_MIN || num > DEBT_AMOUNT_MAX) return { amount: null, raw };
  return { amount: num, raw };
}

function matchDistress(text: string): { category: string; tag: string; keywords: string[] } {
  const lower = text.toLowerCase();
  for (const phrase of CATEGORY_A) {
    if (lower.includes(phrase)) return { category: 'A_screwed_drowning', tag: phrase, keywords: [phrase] };
  }
  for (const rule of CATEGORY_B) {
    if (lower.includes(rule.phrase)) {
      if (rule.require.length === 0) return { category: 'B_emotional_panic', tag: rule.phrase, keywords: [rule.phrase] };
      const hasContext = rule.mode === 'any'
        ? rule.require.some((w: string) => lower.includes(w))
        : rule.require.every((w: string) => lower.includes(w));
      if (hasContext) return { category: 'B_emotional_panic', tag: rule.phrase, keywords: [rule.phrase, ...rule.require.filter((w: string) => lower.includes(w))] };
    }
  }
  for (const phrase of CATEGORY_C) {
    if (lower.includes(phrase)) return { category: 'C_multicard_interest', tag: phrase, keywords: [phrase] };
  }
  return { category: 'none', tag: '', keywords: [] };
}

function isHighIntent(text: string): boolean {
  const { amount } = extractDebtAmount(text);
  const distress = matchDistress(text);
  return (amount !== null) || (distress.category !== 'none');
}

// ── Robust fetch with retry + exponential backoff ──────────────────────────
// Reddit requires a descriptive User-Agent: platform:app:version (by /u/username)
// Browser-like UAs get blocked. See: https://github.com/reddit-archive/reddit/wiki/API
const USER_AGENT = 'settlementiq:leadgen:1.0 (by /u/settlementiq_leadgen)';

interface FetchResult { posts: any[]; status: number; error: string; }

async function fetchWithRetry(url: string, maxRetries = 2): Promise<Response | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (res.ok) return res;
      // 429 = rate limited — back off
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') || '3', 10);
        await new Promise(r => setTimeout(r, Math.min(retryAfter, 5) * 1000));
        continue;
      }
      // 403 = blocked — one retry with delay
      if (res.status === 403 && attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      return res;
    } catch {
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      return null;
    }
  }
  return null;
}

// Try multiple Reddit domains — old.reddit.com is sometimes less aggressive
// with blocking datacenter IPs than www.reddit.com
const REDDIT_DOMAINS = ['https://old.reddit.com', 'https://www.reddit.com'];

// Parse RSS/XML feed into post objects (fallback when JSON API is blocked)
function parseRssPosts(xml: string, subreddit: string): any[] {
  const posts: any[] = [];
  // RSS items: <entry> (Atom) or <item> (RSS 2.0)
  const items = xml.match(/<(?:entry|item)[\s\S]*?<\/(?:entry|item)>/g) || [];
  for (const item of items) {
    const title = item.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim() || '';
    const link = item.match(/<link[^>]*href="([^"]+)"/)?.[1] || item.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1]?.trim() || '';
    const content = item.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] || item.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] || item.match(/<description[^>]*>([\s\S]*?)<\/description>/)?.[1] || '';
    const author = item.match(/<name[^>]*>([\s\S]*?)<\/name>/)?.[1]?.trim() || item.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/)?.[1]?.trim() || 'unknown';
    const published = item.match(/<published[^>]*>([\s\S]*?)<\/published>/)?.[1] || item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/)?.[1] || '';
    // Strip HTML from content
    const textContent = content.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
    const fullText = `${title} ${textContent}`.trim();
    if (fullText.length < 20) continue;
    posts.push({
      title,
      selftext: textContent,
      author: author.replace(/^\/u\//, ''),
      permalink: link, // keep full URL for non-Reddit sources
      created_utc: published ? new Date(published).getTime() / 1000 : null,
    });
  }
  return posts;
}

async function fetchRedditJson(path: string, rssPath: string): Promise<FetchResult> {
  // Strategy 1: Try JSON API on multiple domains
  for (const domain of REDDIT_DOMAINS) {
    const url = `${domain}${path}`;
    const res = await fetchWithRetry(url);
    if (!res || !res.ok) continue;
    try {
      const data: any = await res.json();
      const children = data?.data?.children || [];
      if (children.length > 0) {
        return { posts: children.map((c: any) => c?.data).filter(Boolean), status: 200, error: '' };
      }
    } catch { /* try next */ }
  }

  // Strategy 2: Fall back to RSS feed
  for (const domain of REDDIT_DOMAINS) {
    const url = `${domain}${rssPath}`;
    const res = await fetchWithRetry(url);
    if (!res || !res.ok) continue;
    try {
      const xml = await res.text();
      const posts = parseRssPosts(xml, '');
      if (posts.length > 0) return { posts, status: 200, error: '' };
    } catch { /* try next */ }
  }

  return { posts: [], status: 403, error: 'All Reddit endpoints returned 403 (JSON + RSS)' };
}

// Fetch posts from a subreddit using the "new" listing (more reliable than search)
async function fetchRedditListing(subreddit: string): Promise<FetchResult> {
  return fetchRedditJson(`/r/${subreddit}/new.json?limit=100&t=month`, `/r/${subreddit}/new/.rss?limit=100`);
}

// Search within a subreddit (fallback for targeted queries)
async function fetchRedditSearch(subreddit: string, query: string): Promise<FetchResult> {
  return fetchRedditJson(`/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=on&sort=new&t=month&limit=25`, `/r/${subreddit}/search.rss?q=${encodeURIComponent(query)}&restrict_sr=on&sort=new&t=month&limit=25`);
}

// ── Quora RSS fetching ─────────────────────────────────────────────────────
async function fetchQuoraTopic(topic: string): Promise<FetchResult> {
  const url = `https://www.quora.com/topic/${topic}.rss`;
  const res = await fetchWithRetry(url);
  if (!res || !res.ok) return { posts: [], status: res?.status || 403, error: `Quora ${topic}: HTTP ${res?.status || 'fetch failed'}` };
  try {
    const xml = await res.text();
    const posts = parseRssPosts(xml, '');
    return { posts, status: 200, error: '' };
  } catch {
    return { posts: [], status: 403, error: `Quora ${topic}: parse failed` };
  }
}

// ── Stack Exchange RSS fetching ────────────────────────────────────────────
async function fetchStackExchangeFeed(feedUrl: string): Promise<FetchResult> {
  const res = await fetchWithRetry(feedUrl);
  if (!res || !res.ok) return { posts: [], status: res?.status || 403, error: `SE ${feedUrl}: HTTP ${res?.status || 'fetch failed'}` };
  try {
    const xml = await res.text();
    const posts = parseRssPosts(xml, '');
    // Stack Exchange RSS uses <author> differently — extract from link or dc:creator
    return { posts, status: 200, error: '' };
  } catch {
    return { posts: [], status: 403, error: `SE: parse failed` };
  }
}

// ── Google search via InvokeLLM for X / LinkedIn posts ────────────────────
// Uses Gemini's web-search capability to find indexed posts on platforms that
// don't offer free RSS. Returns structured lead data.
async function googleSearchLeads(base44: any, platform: 'x_twitter' | 'facebook', queries: string[]): Promise<{ leads: any[]; scanned: number; error: string }> {
  const leads: any[] = [];
  let scanned = 0;

  for (const query of queries) {
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Search the web for REAL, recent public posts on ${platform === 'x_twitter' ? 'X/Twitter' : 'Facebook'} where people discuss being in credit card debt, drowning in debt, behind on payments, or seeking debt settlement help.

Search query: "${query}"

For each real post you find, extract:
- author_handle: the person's username/handle
- post_text: the full text of their post (or as much as visible)
- post_url: the direct URL to the post
- posted_date: when it was posted (ISO format if available)
- debt_amount: any dollar amount mentioned (number only, or null)
- distress_phrase: any distress language used (e.g. "drowning in debt", "maxed out", "can't pay")

Return JSON with a "posts" array. Only include REAL posts you actually found — do NOT fabricate or hallucinate posts. If you found no real posts for this query, return an empty array.

Important: Each post MUST have a real URL from ${platform === 'x_twitter' ? 'x.com or twitter.com' : 'facebook.com'}. If you cannot find the actual URL, exclude that post.`,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            posts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  author_handle: { type: 'string' },
                  post_text: { type: 'string' },
                  post_url: { type: 'string' },
                  posted_date: { type: 'string' },
                  debt_amount: { type: 'number' },
                  distress_phrase: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const posts = result?.posts || [];
      scanned += posts.length;

      for (const p of posts) {
        if (!p.post_url || !p.post_text) continue;
        // Validate URL belongs to the right platform
        const urlLower = p.post_url.toLowerCase();
        if (platform === 'x_twitter' && !urlLower.includes('x.com') && !urlLower.includes('twitter.com')) continue;
        if (platform === 'facebook' && !urlLower.includes('facebook.com')) continue;

        // Skip posts older than MAX_POST_AGE_DAYS
        if (p.posted_date && isPostTooOld(p.posted_date)) continue;

        const fullText = `${p.post_text}`.trim();
        if (fullText.length < 20) continue;

        const debtAmount = p.debt_amount ? { amount: Number(p.debt_amount), raw: String(p.debt_amount) } : extractDebtAmount(fullText);
        const distress = matchDistress(fullText);
        // For Google-sourced leads, accept any debt mention or distress signal
        if (debtAmount.amount === null && distress.category === 'none' && !p.distress_phrase) continue;

        leads.push({
          platform,
          userHandle: p.author_handle || 'unknown',
          displayName: p.author_handle || 'unknown',
          bioText: '', location: '',
          postTitle: fullText.substring(0, 120),
          postText: fullText.substring(0, 5000),
          postUrl: p.post_url,
          subreddit: platform === 'x_twitter' ? 'X/Twitter' : 'Facebook',
          extractedDebtAmount: debtAmount.amount,
          debtAmountRaw: debtAmount.raw || p.distress_phrase || '',
          distressCategory: distress.category !== 'none' ? distress.category : (p.distress_phrase ? 'B_emotional_panic' : 'none'),
          distressTag: distress.tag || p.distress_phrase || '',
          matchedKeywords: JSON.stringify(distress.keywords.length > 0 ? distress.keywords : [p.distress_phrase].filter(Boolean)),
          matchTimestamp: new Date().toISOString(),
          postCreatedAt: p.posted_date || null,
          status: 'raw', enrichmentStatus: 'pending', profileDataJson: '',
        });
      }
    } catch (e: any) {
      // Continue to next query on error
      console.error(`[scrapeSocialLeads] Google search error for "${query}":`, e?.message || String(e));
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  return { leads, scanned, error: leads.length === 0 ? `No real ${platform} posts found via Google search` : '' };
}

// ── Main handler ───────────────────────────────────────────────────────────

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: non-fatal — if me() throws, we still allow the scrape but log it.
    // The frontend already gates this behind admin role, so the function call
    // itself is authenticated by the Base44 function invocation token.
    let username = 'system';
    try {
      const user = await base44.auth.me();
      if (user?.full_name) username = user.full_name;
    } catch { /* non-fatal */ }

    const body = await req.json().catch(() => ({}));
    const action = body?.action || 'scrape';
    const platforms = body?.platforms || ['reddit'];
    const maxPerSubreddit = body?.maxPerSubreddit || 25;

    // Load config from SmartLeadConfig entity (falls back to defaults)
    await loadConfig(base44);

    if (action === 'test_match') {
      const text = body?.text || '';
      const amount = extractDebtAmount(text);
      const distress = matchDistress(text);
      return Response.json({ text, extractedAmount: amount, distress, isHighIntent: isHighIntent(text) });
    }

    if (action === 'status') {
      const existing = await base44.asServiceRole.entities.ScrapedLead.list('-created_date', 1);
      return Response.json({
        redditAuth: 'public_json',
        existingLeads: existing?.length || 0,
        sources: {
          reddit: SUBREDDITS,
          quora: QUORA_TOPICS,
          stackexchange: STACKEXCHANGE_FEEDS,
          x_twitter: 'google_search',
          facebook: 'google_search',
        },
        queries: SEARCH_QUERIES,
        config: {
          subreddits: SUBREDDITS,
          searchQueries: SEARCH_QUERIES,
          quoraTopics: QUORA_TOPICS,
          stackExchangeFeeds: STACKEXCHANGE_FEEDS,
          categoryA: CATEGORY_A,
          categoryB: CATEGORY_B,
          categoryC: CATEGORY_C,
          debtAmountMin: DEBT_AMOUNT_MIN,
          debtAmountMax: DEBT_AMOUNT_MAX,
          maxPostAgeDays: MAX_POST_AGE_DAYS,
        },
      });
    }

    if (action !== 'scrape') {
      return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
    }

    const newLeads: any[] = [];
    const seenUrls = new Set<string>();
    let totalScanned = 0;
    let totalMatched = 0;
    const errors: string[] = [];

    // ── Reddit scraping ────────────────────────────────────────────────────
    if (platforms.includes('reddit')) {
      const subredditErrors: string[] = [];
      for (const subreddit of SUBREDDITS) {
        // Strategy 1: Fetch the "new" listing (most reliable endpoint)
        const listing = await fetchRedditListing(subreddit);
        if (listing.status !== 200) {
          subredditErrors.push(`r/${subreddit}: ${listing.error}`);
        }
        totalScanned += listing.posts.length;

        for (const post of listing.posts) {
          if (!post) continue;
          const rawPermalink = post.permalink || '';
          const postUrl = rawPermalink.startsWith('http') ? rawPermalink : `https://www.reddit.com${rawPermalink}`;
          if (seenUrls.has(postUrl)) continue;
          seenUrls.add(postUrl);

          const fullText = `${post.title || ''} ${post.selftext || ''}`.trim();
          if (fullText.length < 20) continue;

          const debtAmount = extractDebtAmount(fullText);
          const distress = matchDistress(fullText);
          if (debtAmount.amount === null && distress.category === 'none') continue;
          const postCreatedAtIso = post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null;
          if (isPostTooOld(postCreatedAtIso)) continue;
          totalMatched++;

          newLeads.push({
            platform: 'reddit',
            userHandle: post.author || 'unknown',
            displayName: post.author || 'unknown',
            bioText: '', location: '',
            postTitle: post.title || '',
            postText: fullText.substring(0, 5000),
            postUrl, subreddit: `r/${subreddit}`,
            extractedDebtAmount: debtAmount.amount,
            debtAmountRaw: debtAmount.raw,
            distressCategory: distress.category,
            distressTag: distress.tag,
            matchedKeywords: JSON.stringify(distress.keywords),
            matchTimestamp: new Date().toISOString(),
            postCreatedAt: postCreatedAtIso,
            status: 'raw', enrichmentStatus: 'pending', profileDataJson: '',
          });
        }

        // Rate limit between subreddits
        await new Promise(r => setTimeout(r, 2000));

        // Strategy 2: Targeted search queries (only if listing worked or as fallback)
        if (listing.posts.length > 0) {
          for (const query of SEARCH_QUERIES) {
            const searchResult = await fetchRedditSearch(subreddit, query);
            if (searchResult.status !== 200) continue;
            totalScanned += searchResult.posts.length;

            for (const post of searchResult.posts) {
              if (!post) continue;
              const rawPermalink = post.permalink || '';
              const postUrl = rawPermalink.startsWith('http') ? rawPermalink : `https://www.reddit.com${rawPermalink}`;
              if (seenUrls.has(postUrl)) continue;
              seenUrls.add(postUrl);

              const fullText = `${post.title || ''} ${post.selftext || ''}`.trim();
              if (fullText.length < 20) continue;

              const debtAmount = extractDebtAmount(fullText);
              const distress = matchDistress(fullText);
              if (debtAmount.amount === null && distress.category === 'none') continue;
              const searchPostCreatedAtIso = post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null;
              if (isPostTooOld(searchPostCreatedAtIso)) continue;
              totalMatched++;

              newLeads.push({
                platform: 'reddit',
                userHandle: post.author || 'unknown',
                displayName: post.author || 'unknown',
                bioText: '', location: '',
                postTitle: post.title || '',
                postText: fullText.substring(0, 5000),
                postUrl, subreddit: `r/${subreddit}`,
                extractedDebtAmount: debtAmount.amount,
                debtAmountRaw: debtAmount.raw,
                distressCategory: distress.category,
                distressTag: distress.tag,
                matchedKeywords: JSON.stringify(distress.keywords),
                matchTimestamp: new Date().toISOString(),
                postCreatedAt: searchPostCreatedAtIso,
                status: 'raw', enrichmentStatus: 'pending', profileDataJson: '',
              });
            }
            await new Promise(r => setTimeout(r, 1200));
          }
        }
      }

      if (subredditErrors.length === SUBREDDITS.length) {
        errors.push(`All subreddits failed: ${subredditErrors.join('; ')}. Reddit may be rate-limiting this server — try again in a few minutes or set REDDIT_CLIENT_ID/SECRET for OAuth2 access.`);
      } else if (subredditErrors.length > 0) {
        errors.push(`Partial failures: ${subredditErrors.join('; ')}`);
      }
    }

    // ── Quora scraping (RSS feeds) ─────────────────────────────────────────
    if (platforms.includes('quora')) {
      const quoraErrors: string[] = [];
      for (const topic of QUORA_TOPICS) {
        const result = await fetchQuoraTopic(topic);
        if (result.status !== 200) {
          quoraErrors.push(result.error);
        }
        totalScanned += result.posts.length;

        for (const post of result.posts) {
          if (!post) continue;
          const postUrl = post.permalink || '';
          if (!postUrl || seenUrls.has(postUrl)) continue;
          seenUrls.add(postUrl);

          const fullText = `${post.title || ''} ${post.selftext || ''}`.trim();
          if (fullText.length < 20) continue;

          const debtAmount = extractDebtAmount(fullText);
          const distress = matchDistress(fullText);
          if (debtAmount.amount === null && distress.category === 'none') continue;
          const quoraPostCreatedAt = post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null;
          if (isPostTooOld(quoraPostCreatedAt)) continue;
          totalMatched++;

          newLeads.push({
            platform: 'quora',
            userHandle: post.author || 'unknown',
            displayName: post.author || 'unknown',
            bioText: '', location: '',
            postTitle: post.title || '',
            postText: fullText.substring(0, 5000),
            postUrl, subreddit: `Quora/${topic}`,
            extractedDebtAmount: debtAmount.amount,
            debtAmountRaw: debtAmount.raw,
            distressCategory: distress.category,
            distressTag: distress.tag,
            matchedKeywords: JSON.stringify(distress.keywords),
            matchTimestamp: new Date().toISOString(),
            postCreatedAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null,
            status: 'raw', enrichmentStatus: 'pending', profileDataJson: '',
          });
        }
        await new Promise(r => setTimeout(r, 1500));
      }
      if (quoraErrors.length === QUORA_TOPICS.length) {
        errors.push(`All Quora topics failed: ${quoraErrors.join('; ')}`);
      } else if (quoraErrors.length > 0) {
        errors.push(`Quora partial: ${quoraErrors.join('; ')}`);
      }
    }

    // ── Stack Exchange scraping (RSS feeds) ────────────────────────────────
    if (platforms.includes('stackexchange')) {
      const seErrors: string[] = [];
      for (const feedUrl of STACKEXCHANGE_FEEDS) {
        const result = await fetchStackExchangeFeed(feedUrl);
        if (result.status !== 200) {
          seErrors.push(result.error);
        }
        totalScanned += result.posts.length;

        for (const post of result.posts) {
          if (!post) continue;
          const postUrl = post.permalink || '';
          if (!postUrl || seenUrls.has(postUrl)) continue;
          seenUrls.add(postUrl);

          const fullText = `${post.title || ''} ${post.selftext || ''}`.trim();
          if (fullText.length < 20) continue;

          const debtAmount = extractDebtAmount(fullText);
          const distress = matchDistress(fullText);
          if (debtAmount.amount === null && distress.category === 'none') continue;
          const sePostCreatedAt = post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null;
          if (isPostTooOld(sePostCreatedAt)) continue;
          totalMatched++;

          newLeads.push({
            platform: 'stackexchange',
            userHandle: post.author || 'unknown',
            displayName: post.author || 'unknown',
            bioText: '', location: '',
            postTitle: post.title || '',
            postText: fullText.substring(0, 5000),
            postUrl, subreddit: 'money.stackexchange.com',
            extractedDebtAmount: debtAmount.amount,
            debtAmountRaw: debtAmount.raw,
            distressCategory: distress.category,
            distressTag: distress.tag,
            matchedKeywords: JSON.stringify(distress.keywords),
            matchTimestamp: new Date().toISOString(),
            postCreatedAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null,
            status: 'raw', enrichmentStatus: 'pending', profileDataJson: '',
          });
        }
        await new Promise(r => setTimeout(r, 1000));
      }
      if (seErrors.length === STACKEXCHANGE_FEEDS.length) {
        errors.push(`All Stack Exchange feeds failed: ${seErrors.join('; ')}`);
      } else if (seErrors.length > 0) {
        errors.push(`Stack Exchange partial: ${seErrors.join('; ')}`);
      }
    }

    // ── X/Twitter via Google search ───────────────────────────────────────
    if (platforms.includes('x_twitter')) {
      const gsResult = await googleSearchLeads(base44, 'x_twitter', SEARCH_QUERIES);
      totalScanned += gsResult.scanned;
      for (const lead of gsResult.leads) {
        if (seenUrls.has(lead.postUrl)) continue;
        seenUrls.add(lead.postUrl);
        totalMatched++;
        newLeads.push(lead);
      }
      if (gsResult.error) errors.push(`X/Twitter: ${gsResult.error}`);
    }

    // ── Facebook via Google search ────────────────────────────────────────
    if (platforms.includes('facebook')) {
      const gsResult = await googleSearchLeads(base44, 'facebook', SEARCH_QUERIES);
      totalScanned += gsResult.scanned;
      for (const lead of gsResult.leads) {
        if (seenUrls.has(lead.postUrl)) continue;
        seenUrls.add(lead.postUrl);
        totalMatched++;
        newLeads.push(lead);
      }
      if (gsResult.error) errors.push(`Facebook: ${gsResult.error}`);
    }

    if (platforms.includes('tiktok')) {
      errors.push('TikTok scraping requires official API access — not yet configured.');
    }

    // ── Deduplicate against existing records ──────────────────────────────
    let duplicatesSkipped = 0;
    const toCreate: any[] = [];
    if (newLeads.length > 0) {
      const existingUrls = new Set<string>();
      const existing = await base44.asServiceRole.entities.ScrapedLead.list('-created_date', 500);
      for (const e of existing || []) {
        if (e.postUrl) existingUrls.add(e.postUrl);
      }
      for (const lead of newLeads) {
        if (existingUrls.has(lead.postUrl)) { duplicatesSkipped++; continue; }
        toCreate.push(lead);
      }
    }

    // ── Bulk create new leads ─────────────────────────────────────────────
    let createdCount = 0;
    if (toCreate.length > 0) {
      try {
        await base44.asServiceRole.entities.ScrapedLead.bulkCreate(toCreate);
        createdCount = toCreate.length;
      } catch (e) {
        errors.push('Bulk create failed: ' + (e as Error).message);
      }
    }

    return Response.json({
      status: 'success',
      platformsScraped: platforms,
      totalPostsScanned: totalScanned,
      totalMatched: totalMatched,
      newLeadsCreated: createdCount,
      duplicatesSkipped,
      errors: errors.length > 0 ? errors : undefined,
      triggeredBy: username,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message, stack: (error as Error).stack }, { status: 500 });
  }
}