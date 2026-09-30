/**
 * scrapeSocialLeads — Native social media lead scraper for debt settlement intent mining.
 *
 * Currently scrapes Reddit's public JSON API (no auth required for read-only public data).
 * Reddit subreddits: r/Debt, r/povertyfinance, r/CreditCards, r/personalfinance, r/financialplanning
 *
 * X/Twitter, Facebook, TikTok require official API keys (set as secrets) — the function
 * is structured to support them but only Reddit is functionally active.
 *
 * Pipeline: fetch posts → regex debt amount extraction ($10k-$200k) → distress phrase
 * matching (Categories A/B/C) → deduplicate by post URL → save new ScrapedLead records.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// ── Target subreddits & search queries ─────────────────────────────────────
const SUBREDDITS = ['Debt', 'povertyfinance', 'CreditCards', 'personalfinance', 'financialplanning'];
const SEARCH_QUERIES = [
  'credit card debt',
  'drowning in debt',
  'maxed out credit card',
  "can't pay minimum",
  'interest killing me',
  'how to get out of debt',
  'debt relief',
  'debt settlement',
  'behind on credit card',
  'credit card interest rate',
];

// ── Debt amount regex ($10k - $200k range) ─────────────────────────────────
// Matches: $10k, 15k, $50,000, 100000, 200k, 50 grand, etc. followed by debt keywords
const DEBT_AMOUNT_REGEX = /\b(\$?(?:1[0-9]|[2-9][0-9]|1[0-9]{2}|200)\s?k|\$?(?:1[0-9]|[2-9][0-9]|1[0-9]{2}),?000|\b(?:10|15|20|25|30|40|50|75|100|150|200)\s?grand)\b.*?(credit card|debt|balances|cards)/i;

// ── Category A: "Screwed / Drowning" trigger phrases ───────────────────────
const CATEGORY_A = [
  '10k in credit card debt', '15k in credit card debt', '20k in credit card debt',
  '25k in credit card debt', '30k in credit card debt', '40k in credit card debt',
  '50k in credit card debt', '75k in credit card debt', '100k in credit card debt',
  '150k in credit card debt', '200k in credit card debt',
];

// ── Category B: Emotional distress & panic expressions ─────────────────────
// Each entry: [phrase, requiredContextWords[]] — all context words must appear nearby
const CATEGORY_B = [
  { phrase: 'maxed out', require: ['10k', '20k', '30k', '50k', '100k'], mode: 'any' },
  { phrase: 'drowning in', require: ['credit card debt', 'card debt', 'minimum payments'], mode: 'any' },
  { phrase: 'so screwed', require: ['credit card', 'debt', 'cards'], mode: 'any' },
  { phrase: "can't make my minimum", require: [], mode: 'any' },
  { phrase: 'behind on credit card', require: [], mode: 'any' },
  { phrase: 'interest is killing me', require: ['credit card', 'balance'], mode: 'any' },
  { phrase: 'how to get out of', require: ['30k debt', '40k debt', '50k debt', '100k debt'], mode: 'any' },
];

// ── Category C: Multi-card & interest rate overwhelm ───────────────────────
const CATEGORY_C = [
  'paying $1000 a month in interest',
  'paying $500 a month in interest',
  '5 cards maxed', '4 cards maxed', '3 cards maxed',
  'credit card debt is ruin',
  'credit card debt is destroying',
];

// ── Helpers ────────────────────────────────────────────────────────────────

function extractDebtAmount(text: string): { amount: number | null; raw: string } {
  const match = text.match(DEBT_AMOUNT_REGEX);
  if (!match) return { amount: null, raw: '' };
  const raw = match[0];
  // Extract the numeric portion and normalize to a dollar amount
  const numMatch = raw.match(/\$?([\d,]+)\s?(k|grand)?/i);
  if (!numMatch) return { amount: null, raw };
  let num = parseInt(numMatch[1].replace(/,/g, ''), 10);
  const suffix = (numMatch[2] || '').toLowerCase();
  if (suffix === 'k') num *= 1000;
  if (suffix === 'grand') num *= 1000;
  // Only accept $10k - $200k range
  if (num < 10000 || num > 200000) return { amount: null, raw };
  return { amount: num, raw };
}

function matchDistress(text: string): { category: string; tag: string; keywords: string[] } {
  const lower = text.toLowerCase();

  // Category A — exact dollar+debt phrases
  for (const phrase of CATEGORY_A) {
    if (lower.includes(phrase)) {
      return { category: 'A_screwed_drowning', tag: phrase, keywords: [phrase] };
    }
  }

  // Category B — emotional distress with context
  for (const rule of CATEGORY_B) {
    if (lower.includes(rule.phrase)) {
      if (rule.require.length === 0) {
        return { category: 'B_emotional_panic', tag: rule.phrase, keywords: [rule.phrase] };
      }
      const hasContext = rule.mode === 'any'
        ? rule.require.some((w: string) => lower.includes(w))
        : rule.require.every((w: string) => lower.includes(w));
      if (hasContext) {
        return { category: 'B_emotional_panic', tag: rule.phrase, keywords: [rule.phrase, ...rule.require.filter((w: string) => lower.includes(w))] };
      }
    }
  }

  // Category C — multi-card / interest overwhelm
  for (const phrase of CATEGORY_C) {
    if (lower.includes(phrase)) {
      return { category: 'C_multicard_interest', tag: phrase, keywords: [phrase] };
    }
  }

  return { category: 'none', tag: '', keywords: [] };
}

function isHighIntent(text: string): boolean {
  const { amount } = extractDebtAmount(text);
  const distress = matchDistress(text);
  return (amount !== null) || (distress.category !== 'none');
}

async function fetchRedditPosts(subreddit: string, query: string): Promise<any[]> {
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=on&sort=new&t=month&limit=50`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'SettlementIQ-LeadGen/1.0 (debt settlement lead intelligence bot)',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const children = data?.data?.children || [];
    return children.map((c: any) => c?.data).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchRedditUserProfile(username: string): Promise<any | null> {
  try {
    const res = await fetch(`https://www.reddit.com/user/${username}/about.json`, {
      headers: {
        'User-Agent': 'SettlementIQ-LeadGen/1.0 (debt settlement lead intelligence bot)',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data || null;
  } catch {
    return null;
  }
}

// ── Main handler ───────────────────────────────────────────────────────────

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body?.action || 'scrape';
    const platforms = body?.platforms || ['reddit'];
    const maxPerSubreddit = body?.maxPerSubreddit || 50;

    if (action === 'test_match') {
      const text = body?.text || '';
      const amount = extractDebtAmount(text);
      const distress = matchDistress(text);
      return Response.json({ text, extractedAmount: amount, distress, isHighIntent: isHighIntent(text) });
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
      for (const subreddit of SUBREDDITS) {
        for (const query of SEARCH_QUERIES) {
          const posts = await fetchRedditPosts(subreddit, query);
          totalScanned += posts.length;

          for (const post of posts) {
            if (!post) continue;
            const postUrl = `https://www.reddit.com${post.permalink || ''}`;
            if (seenUrls.has(postUrl)) continue;
            seenUrls.add(postUrl);

            const fullText = `${post.title || ''} ${post.selftext || ''}`.trim();
            if (fullText.length < 20) continue;

            const debtAmount = extractDebtAmount(fullText);
            const distress = matchDistress(fullText);

            // Only save if high-intent (debt amount in range OR distress phrase matched)
            if (debtAmount.amount === null && distress.category === 'none') continue;
            totalMatched++;

            // Fetch the user's public profile for bio/location data
            const profile = await fetchRedditUserProfile(post.author);
            const bioText = profile?.subreddit?.public_description || profile?.subreddit?.title || '';
            const displayName = profile?.subreddit?.display_name_prefixed || post.author;
            const location = profile?.subreddit?.title || '';

            const lead = {
              platform: 'reddit',
              userHandle: post.author || 'unknown',
              displayName: displayName,
              bioText: bioText || '',
              location: location || '',
              postTitle: post.title || '',
              postText: fullText.substring(0, 5000),
              postUrl,
              subreddit: `r/${subreddit}`,
              extractedDebtAmount: debtAmount.amount,
              debtAmountRaw: debtAmount.raw,
              distressCategory: distress.category,
              distressTag: distress.tag,
              matchedKeywords: JSON.stringify(distress.keywords),
              matchTimestamp: new Date().toISOString(),
              postCreatedAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null,
              status: 'raw',
              enrichmentStatus: 'pending',
              profileDataJson: profile ? JSON.stringify({ karma: profile.total_karma || 0, created_utc: profile.created_utc, verified: profile.verified || false }) : '',
            };

            newLeads.push(lead);
          }

          // Rate limit: small delay between requests
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    }

    // ── X/Twitter placeholder (requires API key — not yet active) ─────────
    if (platforms.includes('x_twitter')) {
      errors.push('X/Twitter scraping requires API credentials — not yet configured. Set TWITTER_BEARER_TOKEN secret to enable.');
    }
    if (platforms.includes('facebook')) {
      errors.push('Facebook scraping requires Graph API credentials — not yet configured.');
    }
    if (platforms.includes('tiktok')) {
      errors.push('TikTok scraping requires official API access — not yet configured.');
    }

    // ── Deduplicate against existing records ──────────────────────────────
    let duplicatesSkipped = 0;
    const toCreate: any[] = [];
    if (newLeads.length > 0) {
      const existingUrls = new Set<string>();
      // Check existing records by postUrl in batches
      const existing = await base44.asServiceRole.entities.ScrapedLead.list('-created_date', 500);
      for (const e of existing || []) {
        if (e.postUrl) existingUrls.add(e.postUrl);
      }
      for (const lead of newLeads) {
        if (existingUrls.has(lead.postUrl)) {
          duplicatesSkipped++;
          continue;
        }
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
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}