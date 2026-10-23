/**
 * Brabble.ai & Parse Live Events Integration Service
 * Connects SchemeNavigator to Brabble.ai API for real-time hackathons, competitions,
 * hiring challenges, student workshops, and innovation drives.
 */

export interface BrabblePrize {
  label?: string;
  inr?: number | null;
}

export interface BrabbleListing {
  id: string;
  title: string;
  organiser?: string;
  type?: string; // 'HACKATHON', 'COMPETITION', 'CASE STUDY', 'CODING', 'WORKSHOP', etc.
  kind?: string; // 'competition', 'workshop', etc.
  platform?: string; // 'Unstop', etc.
  url: string;
  shareUrl?: string;
  deadline?: string; // ISO date string e.g. "2026-10-04T18:29:00.000Z"
  mode?: string; // 'ONLINE' | 'OFFLINE' | 'HYBRID'
  city?: string; // e.g. "South Delhi", "Pune", "Remote", ""
  prize?: BrabblePrize;
  team?: string; // "1 to 2", "1-4"
  fee?: string; // "Free", "Paid entry"
  eligibility?: string[];
  registered?: number;
}

export interface BrabbleApiResponse {
  refreshedAt?: string;
  origin?: string;
  total?: number;
  count?: number;
  offset?: number;
  limit?: number;
  listings?: BrabbleListing[];
  attribution?: string;
}

export interface ParseBotEvent {
  title: string;
  event_code: string;
  genre?: string;
  language?: string;
  certification?: string | null;
  poster_url: string;
  cta_url: string;
  event_date: string;
  category: string;
  venue: string;
  price: string;
  citySlug?: string;
  // Enhanced Brabble metadata:
  organiser?: string;
  platform?: string;
  mode?: string;
  city?: string;
  prize?: BrabblePrize;
  team?: string;
  fee?: string;
  eligibility?: string[];
  registered?: number;
  shareUrl?: string;
  source?: 'brabble' | 'government';
  provider?: string;
}

export interface ParseCityInfo {
  slug: string;
  name: string;
  state: string;
  hindiName?: string;
  isPopular?: boolean;
}

export const BRABBLE_API_KEY =
  (import.meta.env.VITE_BRABBLE_API_KEY as string) ||
  (import.meta.env.VITE_PARSE_API_KEY as string) ||
  'brbl_fd539ee0c3caa637cf8b001c5435de89b619bd4926161f2872ec9260084d2e76';

export const PARSE_API_KEY = BRABBLE_API_KEY;

// Major Indian regional hubs mapped to event city slugs
export const POPULAR_EVENT_CITIES: ParseCityInfo[] = [
  { slug: 'national-capital-region-ncr', name: 'Delhi-NCR', state: 'Delhi', hindiName: 'दिल्ली-एनसीआर', isPopular: true },
  { slug: 'mumbai', name: 'Mumbai', state: 'Maharashtra', hindiName: 'मुंबई', isPopular: true },
  { slug: 'bengaluru', name: 'Bengaluru', state: 'Karnataka', hindiName: 'बेंगलुरु', isPopular: true },
  { slug: 'hyderabad', name: 'Hyderabad', state: 'Telangana', hindiName: 'हैदराबाद', isPopular: true },
  { slug: 'pune', name: 'Pune', state: 'Maharashtra', hindiName: 'पुणे', isPopular: true },
  { slug: 'chandigarh', name: 'Chandigarh', state: 'Punjab', hindiName: 'चंडीगढ़', isPopular: true },
  { slug: 'jaipur', name: 'Jaipur', state: 'Rajasthan', hindiName: 'जयपुर', isPopular: true },
  { slug: 'lucknow', name: 'Lucknow', state: 'Uttar Pradesh', hindiName: 'लखनऊ', isPopular: true },
  { slug: 'kolkata', name: 'Kolkata', state: 'West Bengal', hindiName: 'कोलकाता', isPopular: true },
  { slug: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', hindiName: 'अहमदाबाद', isPopular: true },
  { slug: 'chennai', name: 'Chennai', state: 'Tamil Nadu', hindiName: 'चेन्नई', isPopular: true },
  { slug: 'patna', name: 'Patna', state: 'Bihar', hindiName: 'पटना' },
  { slug: 'bhopal', name: 'Bhopal', state: 'Madhya Pradesh', hindiName: 'भोपाल' },
  { slug: 'indore', name: 'Indore', state: 'Madhya Pradesh', hindiName: 'इंदौर' },
  { slug: 'bhubaneswar', name: 'Bhubaneswar', state: 'Odisha', hindiName: 'भुवनेश्वर' },
  { slug: 'guwahati', name: 'Guwahati', state: 'Assam', hindiName: 'गुवाहाटी' },
  { slug: 'kochi', name: 'Kochi', state: 'Kerala', hindiName: 'कोच्चि' },
  { slug: 'goa', name: 'Goa', state: 'Goa', hindiName: 'गोवा' },
  { slug: 'dehradun', name: 'Dehradun', state: 'Uttarakhand', hindiName: 'देहरादून' },
  { slug: 'varanasi', name: 'Varanasi', state: 'Uttar Pradesh', hindiName: 'वाराणसी' },
  { slug: 'amritsar', name: 'Amritsar', state: 'Punjab', hindiName: 'अमृतसर' },
  { slug: 'surat', name: 'Surat', state: 'Gujarat', hindiName: 'सूरत' },
  { slug: 'nagpur', name: 'Nagpur', state: 'Maharashtra', hindiName: 'नागपुर' },
  { slug: 'ranchi', name: 'Ranchi', state: 'Jharkhand', hindiName: 'राँची' },
  { slug: 'raipur', name: 'Raipur', state: 'Chhattisgarh', hindiName: 'रायपुर' },
  { slug: 'jammu', name: 'Jammu', state: 'Jammu and Kashmir', hindiName: 'जम्मू' },
  { slug: 'visakhapatnam', name: 'Visakhapatnam', state: 'Andhra Pradesh', hindiName: 'विशाखापट्टनम' },
];

// In-memory cache for API responses (10 min TTL)
const cityCache = new Map<string, { data: ParseBotEvent[]; expiry: number }>();
let cachedAllListings: BrabbleListing[] | null = null;
let cachedAllExpiry: number = 0;
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Resolves the closest event city slug based on state, district, or query
 */
export function resolveCitySlug(state?: string, district?: string, query?: string): string {
  const qLower = (query || '').toLowerCase().trim();
  const dLower = (district || '').toLowerCase().trim();
  const sLower = (state || '').toLowerCase().trim();

  // 1. Direct query matching
  if (qLower) {
    for (const city of POPULAR_EVENT_CITIES) {
      if (
        qLower.includes(city.slug) ||
        qLower.includes(city.name.toLowerCase()) ||
        city.name.toLowerCase().includes(qLower)
      ) {
        return city.slug;
      }
    }
  }

  // 2. District matching
  if (dLower && dLower !== 'all') {
    for (const city of POPULAR_EVENT_CITIES) {
      if (
        dLower.includes(city.name.toLowerCase()) ||
        city.name.toLowerCase().includes(dLower) ||
        dLower.includes(city.slug)
      ) {
        return city.slug;
      }
    }
  }

  // 3. State matching to regional capital / hub
  if (sLower && sLower !== 'all' && sLower !== 'all india') {
    if (sLower.includes('delhi') || sLower.includes('ncr')) return 'national-capital-region-ncr';
    if (sLower.includes('maharashtra')) return dLower.includes('pune') ? 'pune' : 'mumbai';
    if (sLower.includes('karnataka')) return 'bengaluru';
    if (sLower.includes('telangana')) return 'hyderabad';
    if (sLower.includes('punjab') || sLower.includes('haryana')) return 'chandigarh';
    if (sLower.includes('rajasthan')) return 'jaipur';
    if (sLower.includes('uttar pradesh')) return 'lucknow';
    if (sLower.includes('west bengal')) return 'kolkata';
    if (sLower.includes('gujarat')) return 'ahmedabad';
    if (sLower.includes('tamil nadu')) return 'chennai';
    if (sLower.includes('bihar')) return 'patna';
    if (sLower.includes('madhya pradesh')) return 'bhopal';
    if (sLower.includes('odisha')) return 'bhubaneswar';
    if (sLower.includes('kerala')) return 'kochi';
    if (sLower.includes('assam')) return 'guwahati';
    if (sLower.includes('uttarakhand')) return 'dehradun';
    if (sLower.includes('jharkhand')) return 'ranchi';
    if (sLower.includes('chhattisgarh')) return 'raipur';
    if (sLower.includes('goa')) return 'goa';
    if (sLower.includes('jammu')) return 'jammu';
    if (sLower.includes('andhra')) return 'visakhapatnam';
  }

  return 'national-capital-region-ncr';
}

function formatDeadlineDate(dateStr?: string): string {
  if (!dateStr) return 'Ongoing / Open';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const formatted = d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    if (diffDays > 0 && diffDays <= 7) {
      return `${formatted} (${diffDays} days left!)`;
    }
    return `Deadline: ${formatted}`;
  } catch {
    return dateStr;
  }
}

function mapListingCategory(type?: string, kind?: string): string {
  const t = (type || '').toUpperCase();
  const k = (kind || '').toLowerCase();
  if (t.includes('HACKATHON') || t.includes('CODING') || t.includes('TECH') || t.includes('INNOVATION')) {
    return 'Education & Scholarships';
  }
  if (t.includes('HIRING') || t.includes('JOB') || t.includes('INTERNSHIP')) {
    return 'Jobs & Rojgar Melas';
  }
  if (t.includes('WORKSHOP') || k.includes('workshop')) {
    return 'Jobs & Rojgar Melas';
  }
  if (t.includes('CASE') || t.includes('COMPETITION') || t.includes('CONFERENCE')) {
    return 'Education & Scholarships';
  }
  return 'Competitions & Melas';
}

function mapBrabbleListingToEvent(listing: BrabbleListing, citySlug: string): ParseBotEvent {
  const prizeLabel = listing.prize?.label && listing.prize.label !== 'See listing'
    ? `Prize: ${listing.prize.label}`
    : '';
  const feeLabel = listing.fee || 'Free Entry';
  const priceDisplay = prizeLabel ? `${prizeLabel} • ${feeLabel}` : feeLabel;

  let venueDisplay = 'Online / Remote';
  if (listing.mode === 'OFFLINE' || listing.mode === 'HYBRID') {
    if (listing.city && listing.organiser) {
      venueDisplay = `${listing.city} • ${listing.organiser}`;
    } else if (listing.city) {
      venueDisplay = `${listing.city} (${listing.mode})`;
    } else if (listing.organiser) {
      venueDisplay = `${listing.organiser} (${listing.mode})`;
    } else {
      venueDisplay = `In-Person (${listing.mode})`;
    }
  } else if (listing.organiser) {
    venueDisplay = `Online • ${listing.organiser}`;
  }

  const genreDisplay = [listing.type, listing.platform].filter(Boolean).join(' • ');

  const eligibilityDisplay = Array.isArray(listing.eligibility) && listing.eligibility.length > 0
    ? listing.eligibility.slice(0, 2).join(', ')
    : 'Open to All';

  return {
    title: listing.title,
    event_code: listing.id,
    genre: genreDisplay || 'Competition',
    language: eligibilityDisplay,
    certification: listing.team ? `Team: ${listing.team}` : null,
    poster_url: '',
    cta_url: listing.url || listing.shareUrl || 'https://brabble.ai',
    event_date: formatDeadlineDate(listing.deadline),
    category: mapListingCategory(listing.type, listing.kind),
    venue: venueDisplay,
    price: priceDisplay,
    citySlug,
    organiser: listing.organiser,
    platform: listing.platform,
    mode: listing.mode,
    city: listing.city,
    prize: listing.prize,
    team: listing.team,
    fee: listing.fee,
    eligibility: listing.eligibility,
    registered: listing.registered,
    shareUrl: listing.shareUrl,
    source: 'brabble',
    provider: 'Brabble.ai',
  };
}

function matchesCity(listing: BrabbleListing, citySlug: string): boolean {
  if (!listing.city || listing.city.toLowerCase() === 'remote' || listing.mode === 'ONLINE') {
    return true; // Online & remote listings apply universally across all cities
  }
  const cLower = listing.city.toLowerCase();
  const slugLower = citySlug.toLowerCase();

  if (slugLower.includes('ncr') || slugLower.includes('delhi')) {
    return (
      cLower.includes('delhi') ||
      cLower.includes('noida') ||
      cLower.includes('gurugram') ||
      cLower.includes('gurgaon') ||
      cLower.includes('faridabad') ||
      cLower.includes('gautam buddha nagar')
    );
  }

  if (slugLower.includes('mumbai')) {
    return cLower.includes('mumbai') || cLower.includes('navi mumbai') || cLower.includes('thane');
  }

  if (slugLower.includes('chandigarh')) {
    return (
      cLower.includes('chandigarh') ||
      cLower.includes('mohali') ||
      cLower.includes('panchkula') ||
      cLower.includes('dera bassi')
    );
  }

  const cityName = slugLower.replace(/-/g, ' ');
  return cLower.includes(cityName) || cityName.includes(cLower);
}

/**
 * Fetches live events from Brabble.ai API with dual-transport fallback and caching
 */
export async function fetchLiveParseEvents(citySlug: string): Promise<ParseBotEvent[]> {
  const cleanSlug = (citySlug || 'national-capital-region-ncr').trim().toLowerCase();

  // Check city cache first
  const cachedCity = cityCache.get(cleanSlug);
  if (cachedCity && cachedCity.expiry > Date.now()) {
    return cachedCity.data;
  }

  let rawListings: BrabbleListing[] = [];

  // Check global listings cache
  if (cachedAllListings && cachedAllExpiry > Date.now()) {
    rawListings = cachedAllListings;
  } else {
    // Endpoints: Local Vite proxy followed by direct Brabble API
    const endpoints = [
      `/brabble-api/api/listings?limit=100`,
      `https://brabble.ai/api/listings?limit=100`,
    ];

    let lastError: Error | null = null;

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${BRABBLE_API_KEY}`,
            'x-api-key': BRABBLE_API_KEY,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }).finally(() => clearTimeout(timeout));

        if (response.ok) {
          const json: BrabbleApiResponse = await response.json();
          if (json && Array.isArray(json.listings) && json.listings.length > 0) {
            rawListings = json.listings;
            cachedAllListings = json.listings;
            cachedAllExpiry = Date.now() + CACHE_TTL_MS;
            break;
          }
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Brabble API] fetch failed for ${url}:`, err?.message || err);
      }
    }

    if (rawListings.length === 0 && lastError) {
      console.warn('Could not fetch live listings from Brabble API:', lastError.message);
    }
  }

  if (rawListings.length > 0) {
    // Filter and prioritize: local in-person events first, then online/hybrid hackathons & competitions
    const inPersonMatches = rawListings.filter(
      (item) => item.mode !== 'ONLINE' && matchesCity(item, cleanSlug)
    );
    const onlineMatches = rawListings.filter(
      (item) => item.mode === 'ONLINE' || !item.city || item.city.toLowerCase() === 'remote'
    );
    const otherInPerson = rawListings.filter(
      (item) => item.mode !== 'ONLINE' && !matchesCity(item, cleanSlug)
    );

    // Combine prioritized order
    const prioritized = [...inPersonMatches, ...onlineMatches, ...otherInPerson];
    const enrichedEvents = prioritized.map((item) => mapBrabbleListingToEvent(item, cleanSlug));

    cityCache.set(cleanSlug, {
      data: enrichedEvents,
      expiry: Date.now() + CACHE_TTL_MS,
    });

    return enrichedEvents;
  }

  // Fallback to cached data if available
  return cachedCity?.data || [];
}

/**
 * Generates Google Calendar link for a Brabble / live event
 */
export function generateParseEventCalendarUrl(event: ParseBotEvent): string {
  const title = encodeURIComponent(event.title);
  const location = encodeURIComponent(event.venue);
  const details = encodeURIComponent(
    `Event: ${event.title}\nOrganiser: ${event.organiser || 'Verified Authority'}\nCategory: ${event.category}\nVenue: ${event.venue}\nPrice/Fee: ${event.price}\nBook / Details: ${event.cta_url}\nDiscovered via SchemeNavigator Events Hub (Powered by Brabble.ai)`
  );

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
}

/**
 * Generates Google Maps Directions link for an event venue
 */
export function generateParseEventMapsUrl(event: ParseBotEvent, cityName: string): string {
  const query = encodeURIComponent(`${event.venue}, ${cityName}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * Generates WhatsApp Share text for an event
 */
export function generateParseEventWhatsAppUrl(event: ParseBotEvent): string {
  const text = encodeURIComponent(
    `✨ *${event.title}*\n🏢 *Organiser:* ${event.organiser || 'Verified Platform'}\n📅 *${event.event_date}*\n📍 *Venue:* ${event.venue}\n🏷️ *${event.price}*\n🔗 *Apply / View Details:* ${event.cta_url}\n\nShared via SchemeNavigator Nearby Events Portal`
  );
  return `https://api.whatsapp.com/send?text=${text}`;
}
