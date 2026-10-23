/**
 * Official Indian Government Events & Contests Service
 * 
 * Sources live, verified government challenges, hackathons, workshops,
 * competitions, and student opportunities from MyGov India (NIC & Central Ministries)
 * and State Government MyGov portals.
 */

export interface GovtEvent {
  id: string;
  title: string;
  category: string;
  organizer: string;
  state: string;
  district: string;
  startDate: string;
  endDate: string;
  timing?: string;
  venue?: string;
  description: string;
  eligibility: string;
  registrationUrl: string;
  officialSourceUrl: string;
  source: 'government';
  provider: string;
  mode?: 'ONLINE' | 'OFFLINE' | 'HYBRID';
  poster_url?: string;
  price?: string;
  rewards?: string;
  fee?: string;
}

// In-memory cache for government events (10 min TTL)
const govtEventsCache = new Map<string, { data: GovtEvent[]; expiry: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

const STATE_SUBDOMAINS: Record<string, string> = {
  'uttar pradesh': 'up',
  'madhya pradesh': 'mp',
  'assam': 'assam',
  'gujarat': 'gujarat',
  'haryana': 'haryana',
  'rajasthan': 'rajasthan',
  'jharkhand': 'jharkhand',
  'tripura': 'tripura',
  'maharashtra': 'maharashtra',
};

function cleanHtmlTags(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractImageFromHtml(html: string): string {
  if (!html) return '';
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match && match[1]) {
    const url = match[1];
    return url.startsWith('//') ? 'https:' + url : url;
  }
  return '';
}

function extractMinistryFromHtml(html: string, stateName: string): string {
  if (!html) return stateName !== 'All India' ? `Government of ${stateName}` : 'Government of India';
  
  const ownerMatch = html.match(/Activity owner Ministries\s*([A-Za-z0-9\s,\(\)&-]+?)(?:As part|Ministry|Department|The |http|<)/i);
  if (ownerMatch && ownerMatch[1] && ownerMatch[1].trim().length > 3) {
    return ownerMatch[1].trim();
  }

  const ministryMatch = html.match(/(Ministry of [A-Za-z &,\(\)-]+|Department of [A-Za-z &,\(\)-]+)/i);
  if (ministryMatch && ministryMatch[1]) {
    return ministryMatch[1].trim();
  }

  return stateName !== 'All India' ? `Government of ${stateName} (MyGov)` : 'Government of India (MyGov)';
}

function extractRewardsFromHtml(html: string): string {
  if (!html) return 'E-Certificate & Recognition';
  const rewMatch = html.match(/Rewards\s*([A-Za-z0-9\s,-]+?)(?:Audio|User|Skills|Comment|<)/i);
  if (rewMatch && rewMatch[1] && rewMatch[1].trim().length > 2) {
    return rewMatch[1].trim();
  }
  if (/prize|cash|cash prize/i.test(html)) {
    return 'Cash Prizes & Certificate';
  }
  return 'E-Certificate & Recognition';
}

function detectCategoryFromText(title: string, desc: string): string {
  const combined = `${title} ${desc}`.toLowerCase();
  if (/hackathon|coding|developer|software|innovation|technology|ai|tech/i.test(combined)) {
    return 'Education & Scholarships';
  }
  if (/job|rojgar|career|internship|hiring|skill|employment|workshop/i.test(combined)) {
    return 'Jobs & Rojgar Melas';
  }
  if (/health|ayushman|medical|wellness|swachhata|yoga/i.test(combined)) {
    return 'Healthcare & Ayushman';
  }
  if (/kisan|agri|farmer|krishi|crop|mela/i.test(combined)) {
    return 'Agriculture & Kisan Melas';
  }
  return 'Competitions & Melas';
}

function formatPubDate(dateStr: string): string {
  if (!dateStr) return 'Ongoing / Open';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
    return dateStr.slice(0, 16);
  } catch {
    return dateStr;
  }
}

/**
 * Fallback parser in the browser using native DOMParser if Django API is not reached
 */
function parseMyGovXmlInBrowser(xmlText: string, stateName: string = 'All India'): GovtEvent[] {
  if (!xmlText) return [];
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const items = xmlDoc.querySelectorAll('item');
    const parsed: GovtEvent[] = [];

    items.forEach((item, index) => {
      const title = item.querySelector('title')?.textContent?.trim() || '';
      const link = item.querySelector('link')?.textContent?.trim() || '';
      const pubDate = item.querySelector('pubDate')?.textContent?.trim() || '';
      const descRaw = item.querySelector('description')?.textContent || '';

      if (!title || !link) return;

      const cleanDesc = cleanHtmlTags(descRaw);
      const imgUrl = extractImageFromHtml(descRaw);
      const ministry = extractMinistryFromHtml(descRaw, stateName);
      const rewards = extractRewardsFromHtml(descRaw);
      const category = detectCategoryFromText(title, cleanDesc);

      const mode = /offline|in-person|venue/i.test(cleanDesc) ? 'OFFLINE' : 'ONLINE';

      parsed.push({
        id: `govt-${title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40)}-${index}`,
        title,
        category,
        organizer: ministry,
        state: stateName,
        district: stateName !== 'All India' ? 'All Districts' : 'Pan-India',
        startDate: formatPubDate(pubDate),
        endDate: 'Ongoing / Check Portal',
        timing: '24x7 Portal Submissions',
        venue: mode === 'ONLINE' ? `Online / ${ministry}` : `${stateName} Official Venue`,
        description: cleanDesc.length > 280 ? cleanDesc.slice(0, 280) + '...' : cleanDesc,
        eligibility: 'Open to all Indian Citizens / Students & Youth',
        registrationUrl: link,
        officialSourceUrl: link,
        source: 'government',
        provider: 'MyGov / Government of India',
        mode,
        poster_url: imgUrl,
        price: `Rewards: ${rewards} • Free Entry`,
        rewards,
        fee: 'Free',
      });
    });

    return parsed;
  } catch (err) {
    console.warn('Failed to parse MyGov XML in browser:', err);
    return [];
  }
}

/**
 * Fetches verified government events from MyGov & Ministries
 * 1. Queries backend endpoint /api/events/government/
 * 2. Falls back to Vite proxy /mygov-rss if backend is unavailable
 */
export async function fetchGovtEvents(
  state: string = 'All India',
  category: string = 'All',
  query: string = ''
): Promise<GovtEvent[]> {
  const cacheKey = `${state.toLowerCase()}|${category.toLowerCase()}|${query.toLowerCase()}`;
  const cached = govtEventsCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  // 1. Try backend API endpoint first
  try {
    const params = new URLSearchParams();
    if (state && state !== 'All India') params.set('state', state);
    if (category && category !== 'All') params.set('category', category);
    if (query) params.set('query', query);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const resp = await fetch(`/api/events/government/?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (resp.ok) {
      const data = await resp.json();
      if (data && Array.isArray(data.events) && data.events.length > 0) {
        govtEventsCache.set(cacheKey, { data: data.events, expiry: Date.now() + CACHE_TTL_MS });
        return data.events;
      }
    }
  } catch (err) {
    console.warn('[GovtEventsService] Backend API not reached, falling back to direct RSS proxy:', err);
  }

  // 2. Direct browser fallback via Vite RSS proxy (/mygov-rss)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch('/mygov-rss/rss.xml', {
      headers: { Accept: 'application/rss+xml, text/xml' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (resp.ok) {
      const xmlText = await resp.text();
      let events = parseMyGovXmlInBrowser(xmlText, state);

      if (category && category !== 'All') {
        events = events.filter((e) => e.category.toLowerCase().includes(category.toLowerCase()));
      }
      if (query) {
        const q = query.toLowerCase();
        events = events.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q) ||
            e.organizer.toLowerCase().includes(q)
        );
      }

      if (events.length > 0) {
        govtEventsCache.set(cacheKey, { data: events, expiry: Date.now() + CACHE_TTL_MS });
        return events;
      }
    }
  } catch (err) {
    console.warn('[GovtEventsService] RSS Proxy fetch failed:', err);
  }

  return [];
}

/**
 * Calendar link for Government Events
 */
export function generateGovtEventCalendarUrl(event: GovtEvent): string {
  const title = encodeURIComponent(`Govt Challenge: ${event.title}`);
  const details = encodeURIComponent(
    `${event.description}\n\nOrganizer: ${event.organizer}\nRewards: ${event.rewards || 'E-Certificate'}\nRegister: ${event.registrationUrl}\nOfficial Government Source: MyGov India`
  );
  const location = encodeURIComponent(event.venue || 'Online / MyGov Portal');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
}

/**
 * WhatsApp share link for Government Events
 */
export function generateGovtEventWhatsAppUrl(event: GovtEvent): string {
  const text = encodeURIComponent(
    `🏛️ *Official Government Challenge / Event*\n\n*${event.title}*\n🏢 *Organized by:* ${event.organizer}\n🏆 *Rewards:* ${event.rewards || 'E-Certificate'}\n📍 *Eligibility:* ${event.eligibility}\n🔗 *Direct Register:* ${event.registrationUrl}\n\nDiscovered via SchemeNavigator Events`
  );
  return `https://wa.me/?text=${text}`;
}
