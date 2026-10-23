import re
import logging
import xml.etree.ElementTree as ET
from datetime import datetime
import requests
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response

logger = logging.getLogger(__name__)

# Cache time in seconds (10 minutes)
GOVT_EVENTS_CACHE_TTL = 60 * 10

# State slug mapping for MyGov portals
MYGOV_STATE_SUBDOMAINS = {
    "uttar pradesh": "up",
    "madhya pradesh": "mp",
    "assam": "assam",
    "gujarat": "gujarat",
    "haryana": "haryana",
    "rajasthan": "rajasthan",
    "jharkhand": "jharkhand",
    "tripura": "tripura",
    "maharashtra": "maharashtra",
}

CATEGORY_MAP = {
    "hackathon": "Education & Scholarships",
    "coding": "Education & Scholarships",
    "technology": "Education & Scholarships",
    "quiz": "Competitions & Melas",
    "contest": "Competitions & Melas",
    "challenge": "Competitions & Melas",
    "photo": "Competitions & Melas",
    "video": "Competitions & Melas",
    "swachhata": "Healthcare & Ayushman",
    "health": "Healthcare & Ayushman",
    "ayushman": "Healthcare & Ayushman",
    "kisan": "Agriculture & Kisan Melas",
    "farm": "Agriculture & Kisan Melas",
    "job": "Jobs & Rojgar Melas",
    "rojgar": "Jobs & Rojgar Melas",
    "internship": "Jobs & Rojgar Melas",
    "workshop": "Jobs & Rojgar Melas",
    "skill": "Jobs & Rojgar Melas",
}


def _detect_category(title: str, desc: str) -> str:
    combined = f"{title} {desc}".lower()
    for keyword, cat in CATEGORY_MAP.items():
        if keyword in combined:
            return cat
    return "Competitions & Melas"


def _clean_html(raw_html: str) -> str:
    if not raw_html:
        return ""
    clean = re.sub(r"<[^>]+>", " ", raw_html)
    clean = re.sub(r"&[a-z]+;", " ", clean)
    return " ".join(clean.split()).strip()


def _extract_image_url(desc: str) -> str:
    if not desc:
        return ""
    match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', desc)
    if match:
        url = match.group(1)
        if url.startswith("//"):
            return "https:" + url
        return url
    return ""


def _extract_ministry(desc: str, default_state: str = "All India") -> str:
    if not desc:
        return f"Government of {default_state}" if default_state != "All India" else "Government of India"

    # Match "Activity owner Ministries: Department / Ministry of ..."
    owner_match = re.search(r"Activity owner Ministries\s*([A-Za-z0-9\s,\(\)&-]+?)(?:As part|Ministry|Department|The |http|<)", desc)
    if owner_match:
        ministry = owner_match.group(1).strip(" :.,")
        if len(ministry) > 3:
            return ministry

    # Match Ministry or Department pattern
    ministry_match = re.search(r"(Ministry of [A-Za-z &,\(\)-]+|Department of [A-Za-z &,\(\)-]+)", desc)
    if ministry_match:
        return ministry_match.group(1).strip(" :.,")

    if default_state != "All India":
        return f"Government of {default_state} (MyGov)"
    return "Government of India (MyGov)"


def _extract_rewards(desc: str) -> str:
    if not desc:
        return "E-Certificate & Official Recognition"
    rew_match = re.search(r"Rewards\s*([A-Za-z0-9\s,-]+?)(?:Audio|User|Skills|Comment|<)", desc)
    if rew_match:
        rewards = rew_match.group(1).strip(" :.,")
        if len(rewards) > 2:
            return rewards
    if "prize" in desc.lower() or "cash" in desc.lower():
        return "Cash Prizes & Certificate"
    return "E-Certificate & Official Recognition"


def _format_date(pub_date_str: str) -> str:
    if not pub_date_str:
        return "Ongoing / Open"
    try:
        # e.g. "Thu, 01 Oct 2026 18:14:30 +0000"
        dt = datetime.strptime(pub_date_str[:25].strip(), "%a, %d %b %Y %H:%M:%S")
        return dt.strftime("%d %b %Y")
    except Exception:
        return pub_date_str[:16] if len(pub_date_str) >= 16 else pub_date_str


def _fetch_rss_feed(url: str, timeout: int = 6) -> str:
    cache_key = f"govt_rss:{url}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SchemeNavigator/1.0",
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
        }
        resp = requests.get(url, headers=headers, timeout=timeout)
        if resp.status_code == 200 and resp.text:
            cache.set(cache_key, resp.text, GOVT_EVENTS_CACHE_TTL)
            return resp.text
    except Exception as e:
        logger.warning(f"Failed to fetch govt feed {url}: {e}")
    return ""


def _parse_feed_items(xml_str: str, state_name: str = "All India") -> list:
    if not xml_str:
        return []

    items = []
    try:
        root = ET.fromstring(xml_str)
        channel = root.find("channel")
        if channel is None:
            return []

        raw_items = channel.findall("item")
        for idx, it in enumerate(raw_items):
            title = (it.findtext("title") or "").strip()
            link = (it.findtext("link") or "").strip()
            pub_date = (it.findtext("pubDate") or "").strip()
            desc = it.findtext("description") or ""

            if not title or not link:
                continue

            clean_desc = _clean_html(desc)
            image_url = _extract_image_url(desc)
            ministry = _extract_ministry(desc, state_name)
            rewards = _extract_rewards(desc)
            category = _detect_category(title, clean_desc)
            formatted_date = _format_date(pub_date)

            event_id = f"govt-{re.sub(r'[^a-zA-Z0-9]', '-', title).lower()[:40]}-{idx}"

            # Detect mode (most online contests/tasks are online/pan-India)
            mode = "ONLINE"
            if "offline" in clean_desc.lower() or "in-person" in clean_desc.lower():
                mode = "OFFLINE"
            elif "hybrid" in clean_desc.lower():
                mode = "HYBRID"

            items.append({
                "id": event_id,
                "title": title,
                "category": category,
                "organizer": ministry,
                "state": state_name,
                "district": "All Districts" if state_name != "All India" else "Pan-India",
                "startDate": formatted_date,
                "endDate": "Ongoing / Check Portal",
                "timing": "24x7 Portal Submissions",
                "venue": f"Online / {ministry}" if mode == "ONLINE" else f"{state_name} Event Venue",
                "description": clean_desc[:280] + ("..." if len(clean_desc) > 280 else ""),
                "eligibility": "Open to all Indian Citizens / Students & Youth",
                "registrationUrl": link,
                "officialSourceUrl": link,
                "source": "government",
                "provider": "MyGov / Government of India",
                "mode": mode,
                "poster_url": image_url,
                "price": f"Rewards: {rewards} • Free Entry",
                "rewards": rewards,
                "fee": "Free",
            })
    except Exception as e:
        logger.error(f"Error parsing govt RSS feed: {e}")

    return items


class GovernmentEventsView(APIView):
    """
    Public API returning real, verified upcoming Government of India events,
    competitions, hackathons, workshops, and challenges from MyGov India and
    state government portals.
    """

    def get(self, request):
        state_param = request.query_params.get("state", "All India").strip()
        category_param = request.query_params.get("category", "All").strip()
        search_param = request.query_params.get("query", "").strip().lower()

        all_events = []
        seen_links = set()

        # 1. Fetch Central MyGov RSS feed (National contests & challenges)
        central_xml = _fetch_rss_feed("https://www.mygov.in/rss.xml")
        central_items = _parse_feed_items(central_xml, "All India")
        for item in central_items:
            if item["registrationUrl"] not in seen_links:
                seen_links.add(item["registrationUrl"])
                all_events.append(item)

        # 2. Fetch State-specific MyGov RSS feed if a specific state is requested
        state_lower = state_param.lower()
        matched_state_slug = None
        for s_name, s_slug in MYGOV_STATE_SUBDOMAINS.items():
            if s_name in state_lower or state_lower in s_name:
                matched_state_slug = s_slug
                break

        if matched_state_slug and state_param.lower() != "all india":
            state_url = f"https://{matched_state_slug}.mygov.in/rss.xml"
            state_xml = _fetch_rss_feed(state_url)
            state_items = _parse_feed_items(state_xml, state_param)
            # Prepend state-specific items so they show at the top
            for item in reversed(state_items):
                if item["registrationUrl"] not in seen_links:
                    seen_links.add(item["registrationUrl"])
                    all_events.insert(0, item)

        # 3. Apply Category & Search filtering
        filtered = all_events
        if category_param and category_param != "All":
            filtered = [
                e for e in filtered
                if category_param.lower() in e["category"].lower() or e["category"].lower() in category_param.lower()
            ]

        if search_param:
            filtered = [
                e for e in filtered
                if search_param in e["title"].lower()
                or search_param in e["description"].lower()
                or search_param in e["organizer"].lower()
                or search_param in e["state"].lower()
            ]

        return Response({
            "status": "success",
            "total": len(filtered),
            "state": state_param,
            "category": category_param,
            "source": "government",
            "provider": "MyGov India (National Informatics Centre & Central Ministries)",
            "events": filtered,
        })
