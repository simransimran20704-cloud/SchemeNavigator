import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Clock,
  Search,
  Navigation,
  Share2,
  CalendarPlus,
  ExternalLink,
  CheckCircle2,
  FileText,
  Building2,
  Sparkles,
  HeartPulse,
  Wheat,
  Briefcase,
  BadgeIndianRupee,
  GraduationCap,
  Fingerprint,
  Phone,
  Crosshair,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Store,
  Ticket,
  Tag,
  Compass,
  RefreshCw,
  Code,
  Trophy,
  Users,
  Heart,
  Printer,
  PlusCircle,
  Flame,
  Mic,
  MicOff,
  Check,
  X,
  Bookmark,
} from 'lucide-react';
import {
  WELFARE_EVENTS_DATA,
  WelfareEvent,
  EVENT_CATEGORIES,
  INDIAN_STATES_FOR_EVENTS,
  EventCategory,
  filterWelfareEvents,
  generateGoogleCalendarUrl,
  generateGoogleMapsDirectionsUrl,
  generateWhatsAppShareUrl,
} from '../data/eventsData';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore } from '../store/appStore';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { getUserCurrentGpsLocation, UserLocation, lookupPincodeFromApimitra } from '../services/kendraLocationService';
import {
  fetchLiveParseEvents,
  ParseBotEvent,
  POPULAR_EVENT_CITIES,
  resolveCitySlug,
  generateParseEventCalendarUrl,
  generateParseEventMapsUrl,
  generateParseEventWhatsAppUrl,
} from '../services/parseEventsService';
import {
  fetchGovtEvents,
  GovtEvent,
  generateGovtEventCalendarUrl,
  generateGovtEventWhatsAppUrl,
} from '../services/govtEventsService';
import {
  translateEventPhrase,
  translateGovtEvent,
  translateParseEvent,
  translateWelfareEvent,
} from '../utils/eventTranslator';

export type FeedTabType = 'all' | 'government' | 'live_parse' | 'welfare_camps' | 'saved' | 'recommended';

export const EventsPage: React.FC = () => {
  const { t, tp, langCode } = useTranslation();
  const [translationVersion, setTranslationVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setTranslationVersion((v) => v + 1);
    window.addEventListener('sn_translations_updated', handleUpdate);
    return () => {
      window.removeEventListener('sn_translations_updated', handleUpdate);
    };
  }, []);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedState, setSelectedState] = useState('All India');
  const [selectedDistrict, setSelectedDistrict] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'all' | 'today' | 'this_week' | 'upcoming'>('all');
  const [expandedDocsEventId, setExpandedDocsEventId] = useState<string | null>(null);

  // Feed Filter Tab State (Unified, Official Government, Brabble.ai, Welfare Camps)
  const [feedTab, setFeedTab] = useState<FeedTabType>('all');
  const [selectedCitySlug, setSelectedCitySlug] = useState('national-capital-region-ncr');

  // Brabble.ai Live Events Feed State
  const [parseEvents, setParseEvents] = useState<ParseBotEvent[]>([]);
  const [parseLoading, setParseLoading] = useState(true);
  const [parseError, setParseError] = useState<string | null>(null);

  // Official Government Events Feed State (MyGov India & State Portals)
  const [govtEvents, setGovtEvents] = useState<GovtEvent[]>([]);
  const [govtLoading, setGovtLoading] = useState(true);
  const [govtError, setGovtError] = useState<string | null>(null);

  // GPS & Location Detection
  const [detectingGps, setDetectingGps] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState<UserLocation | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  // User profile from global app store for recommended matching
  const { profile } = useAppStore();

  // Saved Events state
  const [savedEventIds, setSavedEventIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('sn_saved_event_ids');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const toggleSaveEvent = (id: string) => {
    setSavedEventIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem('sn_saved_event_ids', JSON.stringify(next));
      return next;
    });
  };

  // Community Submitted Events state
  const [communityEvents, setCommunityEvents] = useState<WelfareEvent[]>(() => {
    try {
      const raw = localStorage.getItem('sn_community_events');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [newCampTitle, setNewCampTitle] = useState('');
  const [newCampCategory, setNewCampCategory] = useState<EventCategory>('Healthcare & Ayushman');
  const [newCampOrganizer, setNewCampOrganizer] = useState('');
  const [newCampVenue, setNewCampVenue] = useState('');
  const [newCampState, setNewCampState] = useState('Delhi');
  const [newCampDistrict, setNewCampDistrict] = useState('');
  const [newCampStartDate, setNewCampStartDate] = useState('');
  const [newCampEndDate, setNewCampEndDate] = useState('');
  const [newCampContact, setNewCampContact] = useState('');
  const [newCampDocs, setNewCampDocs] = useState('');
  const [newCampBenefits, setNewCampBenefits] = useState('');

  // Voice Search (Mic)
  const { isListening, isSupported: isVoiceSupported, startListening, stopListening } = useVoiceRecognition({
    language: langCode === 'hi-IN' ? 'hi-IN' : langCode.startsWith('en') ? 'en-IN' : langCode,
    continuous: false,
    onResult: (finalTranscript) => {
      if (finalTranscript.trim()) {
        setSearchQuery(finalTranscript.trim());
        handlePincodeSearch(finalTranscript.trim());
      }
    },
  });

  // Haversine distance in km
  const getDistanceInKm = (lat1?: number, lon1?: number, lat2?: number, lon2?: number): number | null => {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  // Deadline countdown info
  const getDeadlineBadge = (dateStr?: string) => {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return null;
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: 'Closed / Expired', isUrgent: false, isClosed: true };
    if (diffDays === 0) return { label: 'Closes Today!', isUrgent: true, isClosed: false };
    if (diffDays === 1) return { label: '1 Day Left', isUrgent: true, isClosed: false };
    if (diffDays <= 4) return { label: `${diffDays} Days Left`, isUrgent: true, isClosed: false };
    return { label: `${diffDays} Days Left`, isUrgent: false, isClosed: false };
  };

  // Check if event is recommended based on user profile
  const isEventRecommended = (title: string, category: string, state?: string) => {
    if (!profile) return false;
    const occ = (profile.occupation || profile.employmentType || '').toLowerCase();
    const userState = (profile.state || '').toLowerCase();
    const text = `${title} ${category}`.toLowerCase();

    const matchesState = !state || state.toLowerCase() === 'all india' || (userState && (state.toLowerCase().includes(userState) || userState.includes(state.toLowerCase())));

    if (occ.includes('student') || occ.includes('unemployed') || occ.includes('graduate')) {
      if (/hackathon|coding|competition|contest|quiz|workshop|scholarship|rojgar|job|internship|tech|youth/i.test(text)) {
        return matchesState;
      }
    }
    if (occ.includes('farmer') || occ.includes('kisan') || occ.includes('krishi') || occ.includes('agri')) {
      if (/kisan|krishi|agriculture|pm-kisan|fertilizer|seed|mela|farmer/i.test(text)) {
        return matchesState;
      }
    }
    if (occ.includes('business') || occ.includes('self-employed') || occ.includes('vendor')) {
      if (/msme|mudra|loan|credit|business|startup|svanidhi/i.test(text)) {
        return matchesState;
      }
    }
    return false;
  };

  // Community Camp Submit handler
  const handleAddCommunityCamp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampTitle.trim() || !newCampVenue.trim()) return;

    const newEvt: WelfareEvent = {
      id: `comm_${Date.now()}`,
      title: newCampTitle.trim(),
      category: newCampCategory,
      state: newCampState,
      district: newCampDistrict.trim() || 'All Districts',
      venue: newCampVenue.trim(),
      startDate: newCampStartDate || new Date().toISOString().split('T')[0],
      endDate: newCampEndDate || new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      timing: '9:30 AM - 5:00 PM',
      organizer: newCampOrganizer.trim() || 'Local Community / Gram Panchayat',
      departmentOrMinistry: 'District Administration & Community Initiative',
      badge: 'Community Verified',
      description: `Community submitted welfare camp in ${newCampDistrict || newCampState}. Verified local assistance drive.`,
      keyBenefits: newCampBenefits
        ? newCampBenefits.split(',').map((s) => s.trim()).filter(Boolean)
        : ['Free On-spot Registration', 'Document Assistance', 'Citizen Grievance Help'],
      requiredDocuments: newCampDocs
        ? newCampDocs.split(',').map((s) => s.trim()).filter(Boolean)
        : ['Aadhaar Card', '2 Passport Photos', 'Bank Passbook / Ration Card'],
      targetBeneficiaries: ['All Local Citizens', 'Senior Citizens', 'Eligible Families'],
      contactNumber: newCampContact.trim() || '1800-180-1104',
      isFreeEntry: true,
    };

    const updated = [newEvt, ...communityEvents];
    setCommunityEvents(updated);
    localStorage.setItem('sn_community_events', JSON.stringify(updated));
    setIsAddEventModalOpen(false);
    setNewCampTitle('');
    setNewCampOrganizer('');
    setNewCampVenue('');
    setNewCampDistrict('');
    setNewCampContact('');
    setNewCampDocs('');
    setNewCampBenefits('');
  };

  // Printable Camp Pass / Document Slip
  const handlePrintCampSlip = (evt: WelfareEvent) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      window.print();
      return;
    }
    const title = evt.title;
    const organizer = evt.organizer || evt.departmentOrMinistry;
    const venue = evt.venue;
    const districtState = `${evt.district}, ${evt.state}`;
    const dates = `${evt.startDate} to ${evt.endDate}`;
    const timing = evt.timing;
    const helpline = evt.contactNumber || '1800-180-1104 / 14555';
    const docs = evt.requiredDocuments || [];
    const benefits = evt.keyBenefits || [];

    const html = `<!DOCTYPE html>
<html>
  <head>
    <title>SchemeNavigator - Citizen Welfare Camp Pass</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; }
      .header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 16px; margin-bottom: 20px; }
      .title { font-size: 20px; font-weight: 800; color: #0f766e; margin-bottom: 4px; }
      .subtitle { font-size: 13px; color: #64748b; font-weight: 600; }
      .badge { display: inline-block; background: #ccfbf1; color: #0f766e; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 9999px; margin-top: 6px; }
      .section { margin-bottom: 16px; }
      .section-title { font-size: 14px; font-weight: bold; color: #0f766e; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; text-transform: uppercase; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; }
      .info-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; }
      .info-label { font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; }
      .info-val { font-size: 13px; font-weight: bold; color: #0f172a; margin-top: 2px; }
      .checklist { list-style: none; padding-left: 0; }
      .checklist li { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 6px; }
      .checkbox { width: 14px; height: 14px; border: 1.5px solid #0f766e; border-radius: 3px; display: inline-block; }
      .footer { text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 24px; }
      @media print {
        .no-print { display: none; }
        body { padding: 0; }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="title">🏛️ SchemeNavigator - Citizen Welfare Camp Pass</div>
      <div class="subtitle">Official Citizen Guidance & Offline Document Checklist</div>
      <div class="badge">Verified Government Welfare Drive</div>
    </div>

    <div class="section">
      <div class="section-title">Camp Details</div>
      <div class="info-grid">
        <div class="info-box">
          <div class="info-label">Event / Camp</div>
          <div class="info-val">${title}</div>
        </div>
        <div class="info-box">
          <div class="info-label">Ministry / Department</div>
          <div class="info-val">${organizer}</div>
        </div>
        <div class="info-box">
          <div class="info-label">Date & Timing</div>
          <div class="info-val">${dates} (${timing})</div>
        </div>
        <div class="info-box">
          <div class="info-label">Venue & Location</div>
          <div class="info-val">${venue}, ${districtState}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Documents to Bring (Zaroori Dastavez Checklist)</div>
      <ul class="checklist">
        ${docs.map((d: string) => `<li><span class="checkbox"></span><span>${d}</span></li>`).join('')}
      </ul>
    </div>

    <div class="section">
      <div class="section-title">Key Camp Benefits</div>
      <ul style="font-size: 12px; padding-left: 18px; margin-top: 4px;">
        ${benefits.map((b: string) => `<li>${b}</li>`).join('')}
      </ul>
    </div>

    <div class="section" style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px; border-radius: 8px;">
      <div style="font-size: 12px; font-weight: bold; color: #166534;">Helpline & Official Support: ${helpline}</div>
      <div style="font-size: 11px; color: #15803d; margin-top: 2px;">
        Tip: Carry original Aadhaar Card and 2 recent passport-size photographs along with photocopies.
      </div>
    </div>

    <div class="footer">
      Generated via SchemeNavigator Portal • Free Citizen Service
    </div>

    <script>
      window.onload = function() { window.print(); }
    </script>
  </body>
</html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Current City Object
  const currentCityObj = useMemo(() => {
    return (
      POPULAR_EVENT_CITIES.find((c) => c.slug === selectedCitySlug) || {
        slug: selectedCitySlug,
        name: selectedCitySlug.replace(/-/g, ' ').toUpperCase(),
        state: selectedState,
        hindiName: selectedCitySlug,
      }
    );
  }, [selectedCitySlug, selectedState]);

  // Fetch Live Parse.bot Events on City change
  useEffect(() => {
    let isMounted = true;
    setParseLoading(true);
    setParseError(null);

    fetchLiveParseEvents(selectedCitySlug)
      .then((data) => {
        if (isMounted) {
          setParseEvents(data);
          setParseLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('Failed to load Parse.bot live events:', err);
          setParseError('Live events feed updating. Please try again in a moment.');
          setParseLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCitySlug]);

  // Fetch Official Government Events (MyGov India & State Portals) on state/category/search changes
  useEffect(() => {
    let isMounted = true;
    setGovtLoading(true);
    setGovtError(null);

    fetchGovtEvents(selectedState, selectedCategory, searchQuery)
      .then((data) => {
        if (isMounted) {
          setGovtEvents(data);
          setGovtLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('Failed to load Government live events:', err);
          setGovtError('Government events feed updating. Please try again.');
          setGovtLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedState, selectedCategory, searchQuery]);

  // Deduplicate events across Brabble and Government sources
  const normalizedParseTitles = useMemo(() => {
    return new Set(parseEvents.map((e) => e.title.toLowerCase().trim()));
  }, [parseEvents]);

  const uniqueGovtEvents = useMemo(() => {
    return govtEvents.filter((g) => !normalizedParseTitles.has(g.title.toLowerCase().trim()));
  }, [govtEvents, normalizedParseTitles]);

  // Derive filtered Government events
  const filteredGovtEvents = useMemo(() => {
    let list = uniqueGovtEvents;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.organizer.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.state.toLowerCase().includes(q)
      );
    }
    if (selectedCategory !== 'All') {
      list = list.filter((e) =>
        e.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        selectedCategory.toLowerCase().includes(e.category.toLowerCase())
      );
    }
    return list;
  }, [uniqueGovtEvents, searchQuery, selectedCategory]);

  // Combine official data with community submitted camps
  const allWelfareEvents = useMemo(() => {
    return [...communityEvents, ...WELFARE_EVENTS_DATA];
  }, [communityEvents]);

  // Derive filtered welfare events
  const filteredEvents = useMemo(() => {
    let list = filterWelfareEvents(allWelfareEvents, {
      state: selectedState,
      district: selectedDistrict,
      category: selectedCategory,
      searchQuery: searchQuery,
      timeframe: selectedTimeframe,
    });
    if (feedTab === 'saved') {
      list = list.filter((e) => savedEventIds.includes(e.id));
    } else if (feedTab === 'recommended') {
      list = list.filter((e) => isEventRecommended(e.title, e.category, e.state));
    }
    return list;
  }, [allWelfareEvents, selectedState, selectedDistrict, selectedCategory, searchQuery, selectedTimeframe, feedTab, savedEventIds, profile]);

  // Derive filtered live Parse.bot events
  const filteredParseEvents = useMemo(() => {
    let list = parseEvents;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.category && e.category.toLowerCase().includes(q)) ||
          (e.genre && e.genre.toLowerCase().includes(q)) ||
          (e.venue && e.venue.toLowerCase().includes(q))
      );
    }
    if (selectedCategory !== 'All') {
      if (selectedCategory === 'Agriculture & Kisan Melas') {
        list = list.filter((e) =>
          /mela|kisan|farm|agri|fair|exhibition/i.test(`${e.title} ${e.category} ${e.genre || ''}`)
        );
      } else if (selectedCategory === 'Jobs & Rojgar Melas') {
        list = list.filter((e) =>
          /job|rojgar|career|work|tech|meetup|summit/i.test(`${e.title} ${e.category} ${e.genre || ''}`)
        );
      } else if (selectedCategory === 'Healthcare & Ayushman') {
        list = list.filter((e) =>
          /health|wellness|yoga|medical|fitness|care/i.test(`${e.title} ${e.category} ${e.genre || ''}`)
        );
      } else if (selectedCategory === 'Education & Scholarships') {
        list = list.filter((e) =>
          /workshop|education|school|learn|art|theatre|class|seminar/i.test(
            `${e.title} ${e.category} ${e.genre || ''}`
          )
        );
      }
    }
    return list;
  }, [parseEvents, searchQuery, selectedCategory]);

  // Filter for saved or recommended feedTab
  const finalFilteredGovtEvents = useMemo(() => {
    let list = filteredGovtEvents;
    if (feedTab === 'saved') {
      list = list.filter((e) => savedEventIds.includes(e.id || e.title));
    } else if (feedTab === 'recommended') {
      list = list.filter((e) => isEventRecommended(e.title, e.category, e.state));
    }
    return list;
  }, [filteredGovtEvents, feedTab, savedEventIds, profile]);

  const finalFilteredParseEvents = useMemo(() => {
    let list = filteredParseEvents;
    if (feedTab === 'saved') {
      list = list.filter((e) => savedEventIds.includes(e.event_code || e.title));
    } else if (feedTab === 'recommended') {
      list = list.filter((e) => isEventRecommended(e.title, `${e.category} ${e.genre || ''}`));
    }
    return list;
  }, [filteredParseEvents, feedTab, savedEventIds, profile]);

  // Multilingual dynamic translation for event models
  const translatedGovtEvents = useMemo(() => {
    return finalFilteredGovtEvents.map((evt) => translateGovtEvent(evt, langCode));
  }, [finalFilteredGovtEvents, langCode, translationVersion]);

  const translatedParseEvents = useMemo(() => {
    return finalFilteredParseEvents.map((evt) => translateParseEvent(evt, langCode));
  }, [finalFilteredParseEvents, langCode, translationVersion]);

  const translatedWelfareEvents = useMemo(() => {
    return filteredEvents.map((evt) => translateWelfareEvent(evt, langCode));
  }, [filteredEvents, langCode, translationVersion]);

  // Quick count for recommended opportunities
  const recommendedCount = useMemo(() => {
    const govtMatches = filteredGovtEvents.filter((e) => isEventRecommended(e.title, e.category, e.state)).length;
    const parseMatches = filteredParseEvents.filter((e) => isEventRecommended(e.title, `${e.category} ${e.genre || ''}`)).length;
    const campMatches = allWelfareEvents.filter((e) => isEventRecommended(e.title, e.category, e.state)).length;
    return govtMatches + parseMatches + campMatches;
  }, [filteredGovtEvents, filteredParseEvents, allWelfareEvents, profile]);

  // Handle City Select
  const handleCitySelect = (slug: string) => {
    setSelectedCitySlug(slug);
    const cityInfo = POPULAR_EVENT_CITIES.find((c) => c.slug === slug);
    if (cityInfo) {
      const matchedState = INDIAN_STATES_FOR_EVENTS.find(
        (s) => s.toLowerCase() === cityInfo.state.toLowerCase()
      );
      if (matchedState) {
        setSelectedState(matchedState);
        setSelectedDistrict('All');
      }
    }
  };

  // Handle GPS detection
  const handleDetectLocation = async () => {
    setDetectingGps(true);
    setLocationMessage(null);
    try {
      const loc = await getUserCurrentGpsLocation();
      if (loc) {
        setDetectedLocation(loc);
        if (loc.state) {
          const matchedState = INDIAN_STATES_FOR_EVENTS.find(
            (s) => s.toLowerCase() === loc.state.toLowerCase()
          );
          if (matchedState) {
            setSelectedState(matchedState);
          }
        }
        if (loc.district) {
          setSelectedDistrict(loc.district);
        }
        const autoCity = resolveCitySlug(loc.state, loc.district || loc.city);
        setSelectedCitySlug(autoCity);
        setLocationMessage(`📍 Detected: ${loc.district || loc.city}, ${loc.state} (${loc.pincode})`);
      } else {
        setLocationMessage('Could not detect GPS coordinates. You can select your State & City manually.');
      }
    } catch (err) {
      console.warn('GPS location detection error:', err);
      setLocationMessage('Could not detect GPS coordinates. Please select your State & City manually.');
    } finally {
      setDetectingGps(false);
    }
  };

  // Quick PIN code search
  const handlePincodeSearch = async (pin: string) => {
    if (/^\d{6}$/.test(pin)) {
      setDetectingGps(true);
      try {
        const res = await lookupPincodeFromApimitra(pin);
        if (res) {
          const matchedState = INDIAN_STATES_FOR_EVENTS.find(
            (s) => s.toLowerCase() === res.state.toLowerCase()
          );
          if (matchedState) setSelectedState(matchedState);
          if (res.district) setSelectedDistrict(res.district);
          const autoCity = resolveCitySlug(res.state, res.district);
          setSelectedCitySlug(autoCity);
          setLocationMessage(`📍 PIN code mapped to: ${res.district}, ${res.state}`);
        }
      } catch (err) {
        console.warn('PIN lookup failed', err);
      } finally {
        setDetectingGps(false);
      }
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedState('All India');
    setSelectedDistrict('All');
    setSelectedCategory('All');
    setSelectedTimeframe('all');
    setDetectedLocation(null);
    setLocationMessage(null);
    setSelectedCitySlug('national-capital-region-ncr');
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Healthcare & Ayushman':
        return <HeartPulse className="w-4 h-4 text-rose-500" />;
      case 'Agriculture & Kisan Melas':
        return <Wheat className="w-4 h-4 text-amber-500" />;
      case 'Jobs & Rojgar Melas':
        return <Briefcase className="w-4 h-4 text-blue-500" />;
      case 'Loans, MSME & Credit':
        return <BadgeIndianRupee className="w-4 h-4 text-emerald-500" />;
      case 'Education & Scholarships':
        return <GraduationCap className="w-4 h-4 text-purple-500" />;
      case 'Aadhaar, e-KYC & Welfare':
        return <Fingerprint className="w-4 h-4 text-teal-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-teal-600" />;
    }
  };

  // Render Parse.bot Live Event Card
  const renderParseEventCard = (evt: ParseBotEvent, index: number) => {
    const gCalUrl = generateParseEventCalendarUrl(evt);
    const gMapsUrl = generateParseEventMapsUrl(evt, currentCityObj.name);
    const waUrl = generateParseEventWhatsAppUrl(evt);

    return (
      <article
        key={`${evt.event_code || evt.title}-${index}`}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group hover:border-emerald-500/50"
      >
        <div className="p-4 sm:p-5 pb-3 space-y-3">
          {/* Top Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block mr-0.5" />
                {translateEventPhrase('Brabble.ai (Tech & Hackathons)', langCode)}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-slate-800 border border-teal-200 dark:border-slate-700 text-teal-800 dark:text-teal-300 text-[11px] font-bold">
                {translateEventPhrase(evt.category || 'Event', langCode)}
              </span>
              {evt.genre && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  • {translateEventPhrase(evt.genre, langCode)}
                </span>
              )}
            </div>

            {/* Top Badges Right: Deadline, Price & Heart Save */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Deadline countdown badge */}
              {evt.event_date && (() => {
                const dl = getDeadlineBadge(evt.event_date);
                if (!dl || dl.isClosed) return null;
                return (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      dl.isUrgent
                        ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse'
                        : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                    }`}
                  >
                    <Flame className="w-3 h-3 text-rose-500" />
                    <span>{translateEventPhrase(dl.label, langCode)}</span>
                  </span>
                );
              })()}

              {/* Price Pill */}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-[11px] font-black text-amber-800 dark:text-amber-300">
                <Tag className="w-3 h-3 text-amber-500" />
                <span>{translateEventPhrase(evt.price || 'Free / Check Portal', langCode)}</span>
              </span>

              {/* Heart Save / Bookmark Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  toggleSaveEvent(evt.event_code || evt.title);
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={
                  savedEventIds.includes(evt.event_code || evt.title)
                    ? translateEventPhrase('Saved Events', langCode)
                    : 'Save Event'
                }
              >
                <Heart
                  className={`w-4 h-4 transition-transform active:scale-125 ${
                    savedEventIds.includes(evt.event_code || evt.title)
                      ? 'fill-rose-500 text-rose-500'
                      : 'text-slate-400 hover:text-rose-500'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Poster & Title Row */}
          <div className="flex gap-3 items-start">
            {evt.poster_url ? (
              <div className="w-20 h-24 sm:w-24 sm:h-28 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700 relative shadow-xs">
                <img
                  src={evt.poster_url}
                  alt={evt.title}
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            ) : (
              <div className="w-20 h-24 sm:w-24 sm:h-28 rounded-xl bg-gradient-to-br from-teal-800 via-emerald-800 to-slate-900 shrink-0 flex flex-col items-center justify-center text-white p-2 text-center shadow-xs border border-teal-700/50">
                {evt.genre?.toUpperCase().includes('HACKATHON') || evt.category?.includes('Hackathon') ? (
                  <Code className="w-6 h-6 text-emerald-300 mx-auto mb-1" />
                ) : evt.genre?.toUpperCase().includes('COMPETITION') ? (
                  <Trophy className="w-6 h-6 text-amber-300 mx-auto mb-1" />
                ) : (
                  <Sparkles className="w-6 h-6 text-teal-300 mx-auto mb-1" />
                )}
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-200 line-clamp-1">
                  {evt.platform || 'BRABBLE'}
                </span>
              </div>
            )}

            <div className="space-y-1.5 flex-1 min-w-0">
              {/* Profile Recommended Badge */}
              {isEventRecommended(evt.title, `${evt.category} ${evt.genre || ''}`) && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/80 border border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-300 text-[10px] font-black uppercase tracking-wider">
                  <span>🎯 {translateEventPhrase('Recommended for You', langCode)}</span>
                </div>
              )}
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
                {evt.title}
              </h3>
              {evt.organiser && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-teal-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">{translateEventPhrase(evt.organiser, langCode)}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                {evt.mode && (
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                    evt.mode === 'ONLINE'
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  }`}>
                    {translateEventPhrase(evt.mode, langCode)}
                  </span>
                )}
                {evt.registered ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
                    <Users className="w-3 h-3 text-slate-400" />
                    <span>{evt.registered} {translateEventPhrase('registered', langCode)}</span>
                  </span>
                ) : null}
                {evt.language && <span className="truncate max-w-[150px]">• {evt.language}</span>}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 pt-0.5">
                <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold">{evt.event_date}</span>
              </div>
            </div>
          </div>

          {/* Venue Row */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 flex items-start gap-2 text-xs">
            <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white truncate">
                {translateEventPhrase(evt.venue || 'Online Event', langCode)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {currentCityObj.name} ({currentCityObj.state})
              </div>
            </div>
          </div>
        </div>

        {/* Card Actions Footer */}
        <div className="p-3 sm:p-4 bg-slate-50/80 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Direct CTA / Book Button */}
            {evt.cta_url && (
              <a
                href={evt.cta_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                title={translateEventPhrase('Register on Portal', langCode)}
              >
                <Ticket className="w-3.5 h-3.5 text-white" />
                <span>{translateEventPhrase('Register on Portal', langCode)}</span>
                <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
              </a>
            )}

            {/* Google Maps Directions */}
            <a
              href={gMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all active:scale-95"
              title={translateEventPhrase('Get Directions', langCode)}
            >
              <Navigation className="w-3.5 h-3.5 text-rose-500" />
              <span className="hidden sm:inline">{translateEventPhrase('Get Directions', langCode)}</span>
            </a>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Add to Google Calendar */}
            <a
              href={gCalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 transition-all active:scale-95"
              title={translateEventPhrase('Add to Calendar', langCode)}
            >
              <CalendarPlus className="w-4 h-4" />
            </a>

            {/* Share on WhatsApp */}
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all active:scale-95"
              title={translateEventPhrase('Share', langCode)}
            >
              <Share2 className="w-4 h-4" />
            </a>
          </div>
        </div>
      </article>
    );
  };

  // Render Official Government Event Card (MyGov India & Central Ministries)
  const renderGovtEventCard = (evt: GovtEvent, index: number) => {
    const gCalUrl = generateGovtEventCalendarUrl(evt);
    const waUrl = generateGovtEventWhatsAppUrl(evt);

    return (
      <article
        key={`${evt.id || evt.title}-${index}`}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group hover:border-amber-500/50"
      >
        <div className="p-4 sm:p-5 pb-3 space-y-3">
          {/* Top Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-orange-100 via-amber-100 to-emerald-100 dark:from-orange-950/80 dark:via-amber-950/80 dark:to-emerald-950/80 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 text-[10px] font-black uppercase tracking-wider">
                <Building2 className="w-3 h-3 text-amber-600 dark:text-amber-400 mr-0.5" />
                {translateEventPhrase('Official Govt Initiative', langCode)}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-slate-800 border border-teal-200 dark:border-slate-700 text-teal-800 dark:text-teal-300 text-[11px] font-bold">
                {translateEventPhrase(evt.category || 'Government Contest', langCode)}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                • {evt.state === 'All India' ? translateEventPhrase('Pan-India', langCode) : tp(evt.state)}
              </span>
            </div>

            {/* Price / Rewards Pill & Heart Save */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Deadline countdown badge */}
              {evt.endDate && (() => {
                const dl = getDeadlineBadge(evt.endDate);
                if (!dl || dl.isClosed) return null;
                return (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      dl.isUrgent
                        ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse'
                        : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                    }`}
                  >
                    <Flame className="w-3 h-3 text-rose-500" />
                    <span>{translateEventPhrase(dl.label, langCode)}</span>
                  </span>
                );
              })()}

              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-[11px] font-black text-emerald-800 dark:text-emerald-300">
                <Trophy className="w-3 h-3 text-amber-500" />
                <span>{translateEventPhrase(evt.price || 'Free / Govt Verified', langCode)}</span>
              </span>

              {/* Heart Save / Bookmark Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  toggleSaveEvent(evt.id || evt.title);
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={
                  savedEventIds.includes(evt.id || evt.title)
                    ? translateEventPhrase('Saved Events', langCode)
                    : 'Save Event'
                }
              >
                <Heart
                  className={`w-4 h-4 transition-transform active:scale-125 ${
                    savedEventIds.includes(evt.id || evt.title)
                      ? 'fill-rose-500 text-rose-500'
                      : 'text-slate-400 hover:text-rose-500'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Poster & Title Row */}
          <div className="flex gap-3 items-start">
            {evt.poster_url ? (
              <div className="w-20 h-24 sm:w-24 sm:h-28 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700 relative shadow-xs">
                <img
                  src={evt.poster_url}
                  alt={evt.title}
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            ) : (
              <div className="w-20 h-24 sm:w-24 sm:h-28 rounded-xl bg-gradient-to-br from-amber-700 via-orange-800 to-teal-900 shrink-0 flex flex-col items-center justify-center text-white p-2 text-center shadow-xs border border-amber-600/50">
                <Building2 className="w-6 h-6 text-amber-300 mx-auto mb-1" />
                <span className="text-[9px] font-black uppercase tracking-wider text-amber-200 line-clamp-1">
                  MYGOV
                </span>
              </div>
            )}

            <div className="space-y-1.5 flex-1 min-w-0">
              {/* Profile Recommended Badge */}
              {isEventRecommended(evt.title, evt.category, evt.state) && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/80 border border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-300 text-[10px] font-black uppercase tracking-wider">
                  <span>🎯 {translateEventPhrase('Recommended for You', langCode)}</span>
                </div>
              )}
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-2">
                {evt.title}
              </h3>
              {evt.organizer && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                  <Building2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="truncate">{translateEventPhrase(evt.organizer, langCode)}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {translateEventPhrase(evt.mode || 'ONLINE', langCode)}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-300">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  <span>{translateEventPhrase('Verified NIC / MeitY', langCode)}</span>
                </span>
                {evt.eligibility && (
                  <span className="truncate max-w-[150px]">
                    • {translateEventPhrase(evt.eligibility, langCode)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 pt-0.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="font-semibold">{evt.startDate} • {evt.endDate}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          {evt.description && (
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
              {translateEventPhrase(evt.description, langCode)}
            </p>
          )}

          {/* Venue Row */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 flex items-start gap-2 text-xs">
            <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-bold text-slate-900 dark:text-white truncate">
                {translateEventPhrase(evt.venue || 'Online / Citizen Portal', langCode)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {tp(evt.state)} • {tp(evt.district)}
              </div>
            </div>
          </div>
        </div>

        {/* Card Actions Footer */}
        <div className="p-3 sm:p-4 bg-slate-50/80 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Direct Official Submission Link */}
            {evt.registrationUrl && (
              <a
                href={evt.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                title={translateEventPhrase('Participate on MyGov', langCode)}
              >
                <Building2 className="w-3.5 h-3.5 text-white" />
                <span>{translateEventPhrase('Participate on MyGov', langCode)}</span>
                <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
              </a>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Add to Google Calendar */}
            <a
              href={gCalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 transition-all active:scale-95"
              title={translateEventPhrase('Add to Calendar', langCode)}
            >
              <CalendarPlus className="w-4 h-4" />
            </a>

            {/* Share on WhatsApp */}
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all active:scale-95"
              title={translateEventPhrase('Share', langCode)}
            >
              <Share2 className="w-4 h-4" />
            </a>
          </div>
        </div>
      </article>
    );
  };

  // Render Welfare Event Card
  const renderWelfareEventCard = (evt: WelfareEvent) => {
    const isDocsExpanded = expandedDocsEventId === evt.id;
    const gCalUrl = generateGoogleCalendarUrl(evt);
    const gMapsUrl = generateGoogleMapsDirectionsUrl(evt);
    const waUrl = generateWhatsAppShareUrl(evt);

    const distanceKm =
      detectedLocation && evt.latitude && evt.longitude
        ? getDistanceInKm(detectedLocation.latitude, detectedLocation.longitude, evt.latitude, evt.longitude)
        : null;
    const isSaved = savedEventIds.includes(evt.id);
    const isRec = isEventRecommended(evt.title, evt.category, evt.state);
    const dl = evt.endDate ? getDeadlineBadge(evt.endDate) : null;

    return (
      <article
        key={evt.id}
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group hover:border-teal-500/50"
      >
        {/* Card Header Strip */}
        <div className="p-4 sm:p-5 pb-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="p-1 rounded-lg bg-teal-50 dark:bg-slate-800 border border-teal-200/50 dark:border-slate-700">
                {getCategoryIcon(evt.category)}
              </span>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {translateEventPhrase(evt.category, langCode)}
              </span>
              {/* Profile Recommended Badge */}
              {isRec && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/80 border border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-300 text-[10px] font-black uppercase tracking-wider">
                  <span>🎯 {translateEventPhrase('Recommended for You', langCode)}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Distance Badge */}
              {distanceKm !== null && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-[10px] font-extrabold text-sky-800 dark:text-sky-300">
                  <MapPin className="w-3 h-3 text-sky-500" />
                  <span>{distanceKm} km {translateEventPhrase('away', langCode)}</span>
                </span>
              )}

              {/* Deadline countdown badge */}
              {dl && !dl.isClosed && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    dl.isUrgent
                      ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse'
                      : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  }`}
                >
                  <Flame className="w-3 h-3 text-rose-500" />
                  <span>{translateEventPhrase(dl.label, langCode)}</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{translateEventPhrase('Active Drive', langCode)}</span>
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                {translateEventPhrase(evt.badge, langCode)}
              </span>

              {/* Heart Save / Bookmark Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  toggleSaveEvent(evt.id);
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title={isSaved ? translateEventPhrase('Saved Events', langCode) : 'Save Event'}
              >
                <Heart
                  className={`w-4 h-4 transition-transform active:scale-125 ${
                    isSaved ? 'fill-rose-500 text-rose-500' : 'text-slate-400 hover:text-rose-500'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Titles */}
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug group-hover:text-teal-700 dark:group-hover:text-emerald-400 transition-colors">
              {evt.title}
            </h3>
            {evt.hindiTitle && langCode === 'en-IN' && (
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {evt.hindiTitle}
              </p>
            )}
          </div>

          {/* Organizer & Ministry */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
            <Building2 className="w-3.5 h-3.5 text-teal-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">{translateEventPhrase(evt.organizer, langCode)}</span>
          </div>

          {/* Date & Location Pills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 flex items-start gap-2">
              <Calendar className="w-4 h-4 text-teal-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-slate-900 dark:text-white">
                  {evt.startDate} to {evt.endDate}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>{translateEventPhrase(evt.timing, langCode)}</span>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-800 flex items-start gap-2">
              <MapPin className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="font-bold text-slate-900 dark:text-white truncate">
                  {tp(evt.district)}, {tp(evt.state)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {translateEventPhrase(evt.venue, langCode)}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {evt.description}
          </p>

          {/* Key Benefits Spotlight */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-500" />
              <span>{translateEventPhrase('Camp Benefits (कल्याणकारी लाभ):', langCode)}</span>
            </div>
            <ul className="space-y-1">
              {evt.keyBenefits.map((benefit, bIdx) => (
                <li
                  key={bIdx}
                  className="flex items-start gap-1.5 text-xs text-slate-700 dark:text-slate-300"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{translateEventPhrase(benefit, langCode)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Expandable Documents to Bring Checklist */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() =>
                setExpandedDocsEventId(isDocsExpanded ? null : evt.id)
              }
              className="w-full flex items-center justify-between p-2 rounded-xl bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200/50 dark:border-teal-800/50 text-xs font-bold text-teal-900 dark:text-emerald-300 cursor-pointer hover:bg-teal-100/70 dark:hover:bg-teal-950/70 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-emerald-400" />
                <span>{translateEventPhrase('What to Bring', langCode)} ({evt.requiredDocuments.length})</span>
              </div>
              {isDocsExpanded ? (
                <ChevronUp className="w-4 h-4 text-teal-700 dark:text-emerald-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-teal-700 dark:text-emerald-400" />
              )}
            </button>

            {isDocsExpanded && (
              <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in duration-150">
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {translateEventPhrase('Required Document Checklist:', langCode)}
                </div>
                <ul className="space-y-1.5">
                  {evt.requiredDocuments.map((doc, dIdx) => (
                    <li
                      key={dIdx}
                      className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-emerald-400 shrink-0 mt-1.5" />
                      <span>{translateEventPhrase(doc, langCode)}</span>
                    </li>
                  ))}
                </ul>
                {evt.contactNumber && (
                  <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <Phone className="w-3 h-3 text-teal-600" />
                    <span>{translateEventPhrase('Helpline:', langCode)} {evt.contactNumber}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card Actions Footer */}
        <div className="p-3 sm:p-4 bg-slate-50/80 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Get Directions */}
            <a
              href={gMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold shadow-2xs transition-all active:scale-95"
              title={translateEventPhrase('Get Directions', langCode)}
            >
              <Navigation className="w-3.5 h-3.5 text-emerald-300" />
              <span>{translateEventPhrase('Get Directions', langCode)}</span>
            </a>

            {/* Print Camp Pass & Offline Slip */}
            <button
              type="button"
              onClick={() => handlePrintCampSlip(evt)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              title={translateEventPhrase('Print Camp Pass & Slip', langCode)}
            >
              <Printer className="w-3.5 h-3.5 text-teal-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">{translateEventPhrase('Print Pass', langCode)}</span>
            </button>

            {/* Add to Calendar */}
            <a
              href={gCalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all active:scale-95"
              title={translateEventPhrase('Add to Calendar', langCode)}
            >
              <CalendarPlus className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">{translateEventPhrase('Add to Calendar', langCode)}</span>
            </a>
          </div>

          <div className="flex items-center gap-2">
            {/* WhatsApp Share */}
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all active:scale-95"
              title={translateEventPhrase('Share', langCode)}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{translateEventPhrase('Share', langCode)}</span>
            </a>

            {/* Official Portal Link */}
            {evt.officialPortalUrl && (
              <a
                href={evt.officialPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-xl text-slate-500 hover:text-teal-700 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Open official portal"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors pb-16">
      {/* 1. Hero Header Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-teal-900 via-teal-950 to-slate-950 text-white pt-12 pb-16 px-4 sm:px-6 lg:px-8 border-b border-teal-800/40">
        <div className="absolute inset-0 bg-dot-pattern opacity-10 pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10 space-y-6">
          {/* Breadcrumb / Top Badge */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-800/80 border border-teal-500/40 text-emerald-300 text-xs font-bold shadow-xs">
              <Calendar className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('events.badge', undefined, translateEventPhrase('Live Events, Melas & Welfare Camps', langCode))}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold">
              <Building2 className="w-3 h-3 text-amber-400" />
              <span>{translateEventPhrase('🏛️ MyGov India Integrated', langCode)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>{translateEventPhrase('⚡ Brabble.ai Active', langCode)}</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{translateEventPhrase('100% Free Verified', langCode)}</span>
            </span>
          </div>

          <div className="space-y-3 max-w-3xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
              {t('events.heroTitle', undefined, translateEventPhrase('Nearby Events, Melas & Welfare Camps', langCode))}
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 text-2xl sm:text-3xl lg:text-4xl font-extrabold mt-1">
                {translateEventPhrase('Live Events, Melas & Welfare Camps Near You', langCode)}
              </span>
            </h1>
            <p className="text-sm sm:text-base text-teal-100/90 leading-relaxed font-normal">
              {t(
                'events.heroDesc',
                undefined,
                translateEventPhrase(
                  'Discover real-time hackathons, student workshops, and innovation challenges from MyGov India and Brabble.ai alongside Ayushman Bharat camps, PM-KISAN drives, Rojgar melas, and Mudra credit camps.',
                  langCode
                )
              )}
            </p>
          </div>

          {/* Quick Stats Pill Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="bg-white/10 dark:bg-slate-900/60 backdrop-blur-md rounded-xl p-3 border border-white/10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                <Building2 className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="text-base font-black text-white">{filteredGovtEvents.length}+ {translateEventPhrase('Govt', langCode)}</div>
                <div className="text-[11px] text-teal-200">{translateEventPhrase('MyGov Challenges', langCode)}</div>
              </div>
            </div>

            <div className="bg-white/10 dark:bg-slate-900/60 backdrop-blur-md rounded-xl p-3 border border-white/10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
                <Code className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-base font-black text-white">{filteredParseEvents.length}+ {translateEventPhrase('Tech', langCode)}</div>
                <div className="text-[11px] text-teal-200">{translateEventPhrase('Brabble.ai Events', langCode)}</div>
              </div>
            </div>

            <div className="bg-white/10 dark:bg-slate-900/60 backdrop-blur-md rounded-xl p-3 border border-white/10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold">
                <HeartPulse className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <div className="text-base font-black text-white">{filteredEvents.length}+ {translateEventPhrase('Camps', langCode)}</div>
                <div className="text-[11px] text-teal-200">{translateEventPhrase('Welfare Initiatives', langCode)}</div>
              </div>
            </div>

            <div className="bg-white/10 dark:bg-slate-900/60 backdrop-blur-md rounded-xl p-3 border border-white/10 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="text-base font-black text-white">{translateEventPhrase('100% Free', langCode)}</div>
                <div className="text-[11px] text-teal-200">{translateEventPhrase('Verified Portals', langCode)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Search & Location Filter Control Bar */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Search Input with Voice Search Mic */}
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  handlePincodeSearch(e.target.value.trim());
                }}
                placeholder={t(
                  'events.searchPlaceholder',
                  undefined,
                  translateEventPhrase('Search event, camp, scheme, venue, or 6-digit PIN...', langCode)
                )}
                className="w-full pl-10 pr-12 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition-all text-slate-900 dark:text-slate-100"
              />
              {isVoiceSupported && (
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all cursor-pointer ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse shadow-md ring-2 ring-rose-300'
                      : 'text-slate-400 hover:text-teal-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                  title={
                    isListening
                      ? translateEventPhrase('Listening... Click to stop', langCode)
                      : translateEventPhrase('Voice Search (बोलकर खोजें)', langCode)
                  }
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
            </div>

            {/* State Selector */}
            <div className="md:col-span-3">
              <select
                value={selectedState}
                onChange={(e) => {
                  const newState = e.target.value;
                  setSelectedState(newState);
                  setSelectedDistrict('All');
                  if (newState !== 'All India') {
                    const autoSlug = resolveCitySlug(newState);
                    setSelectedCitySlug(autoSlug);
                  }
                }}
                className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:outline-hidden text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                {INDIAN_STATES_FOR_EVENTS.map((st) => (
                  <option key={st} value={st}>
                    {st === 'All India' ? translateEventPhrase('All India', langCode) : (tp(st) || st)}
                  </option>
                ))}
              </select>
            </div>

            {/* Timeframe Selector */}
            <div className="md:col-span-2">
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value as any)}
                className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-teal-500 focus:outline-hidden text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value="all">{translateEventPhrase('Any Date', langCode)}</option>
                <option value="today">{translateEventPhrase('Happening Today', langCode)}</option>
                <option value="this_week">{translateEventPhrase('This Week', langCode)}</option>
                <option value="upcoming">{translateEventPhrase('Upcoming', langCode)}</option>
              </select>
            </div>

            {/* GPS Detect Location Button */}
            <div className="md:col-span-2">
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={detectingGps}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-60 whitespace-nowrap"
                title={translateEventPhrase('Detect Nearby Events via GPS', langCode)}
              >
                {detectingGps ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-300" />
                ) : (
                  <Crosshair className="w-4 h-4 text-emerald-300" />
                )}
                <span>{detectingGps ? translateEventPhrase('Detecting...', langCode) : translateEventPhrase('Near Me (GPS)', langCode)}</span>
              </button>
            </div>
          </div>

          {/* Location Feedback & Reset Bar */}
          {(locationMessage || selectedState !== 'All India' || selectedCategory !== 'All' || searchQuery) && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-1.5 text-teal-800 dark:text-emerald-400 font-semibold">
                <MapPin className="w-3.5 h-3.5" />
                <span>
                  {locationMessage ||
                    `${translateEventPhrase('Filtered', langCode)}: ${selectedState === 'All India' ? translateEventPhrase('All India', langCode) : (tp(selectedState) || selectedState)} | ${translateEventPhrase('City', langCode)}: ${currentCityObj.name} (${filteredGovtEvents.length} ${translateEventPhrase('Govt Initiatives', langCode)}, ${filteredParseEvents.length} ${translateEventPhrase('Brabble Events', langCode)}, ${filteredEvents.length} ${translateEventPhrase('Welfare Camps', langCode)})`}
                </span>
              </div>
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-bold underline cursor-pointer"
              >
                {translateEventPhrase('Reset All Filters', langCode)}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 3. Popular City Quick Selector Strip (Parse.bot Scraper Hubs) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                {translateEventPhrase('Live City Event Hubs', langCode)}:
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {translateEventPhrase('Active', langCode)}:{' '}
                <strong className="text-emerald-700 dark:text-emerald-400 font-bold">
                  {currentCityObj.name}
                </strong>
              </span>
            </div>

            {parseLoading && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{translateEventPhrase('Fetching live Parse.bot events...', langCode)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {POPULAR_EVENT_CITIES.map((city) => {
              const isSelected = selectedCitySlug === city.slug;
              return (
                <button
                  key={city.slug}
                  type="button"
                  onClick={() => handleCitySelect(city.slug)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-teal-700 to-emerald-700 text-white shadow-sm ring-2 ring-emerald-500/40 scale-[1.02]'
                      : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80'
                  }`}
                >
                  <span>{langCode === 'hi-IN' && city.hindiName ? city.hindiName : (tp(city.name) || city.name)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Category Filter Chips Strip */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-5">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {EVENT_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-teal-800 text-white shadow-md shadow-teal-900/20 scale-[1.02]'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {getCategoryIcon(cat.id)}
                <span>{langCode === 'hi-IN' ? cat.hindiLabel : translateEventPhrase(cat.label, langCode)}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 5. Feed Switcher Tabs & Events Section */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Feed Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-200/70 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setFeedTab('all')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              feedTab === 'all'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-300 dark:ring-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-teal-600 dark:text-emerald-400" />
            <span>{translateEventPhrase('All Sources', langCode)}</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-[11px] font-black text-slate-700 dark:text-slate-300">
              {filteredGovtEvents.length + filteredParseEvents.length + filteredEvents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFeedTab('government')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              feedTab === 'government'
                ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 shadow-sm ring-1 ring-amber-400/40'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>{translateEventPhrase('Official Govt Events (MyGov)', langCode)}</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-[11px] font-black text-amber-800 dark:text-amber-300">
              {filteredGovtEvents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFeedTab('live_parse')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              feedTab === 'live_parse'
                ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-sm ring-1 ring-emerald-400/40'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span>{translateEventPhrase('Brabble.ai (Tech & Hackathons)', langCode)}</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-[11px] font-black text-emerald-800 dark:text-emerald-300">
              {filteredParseEvents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFeedTab('welfare_camps')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              feedTab === 'welfare_camps'
                ? 'bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 shadow-sm ring-1 ring-teal-400/40'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <HeartPulse className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>{translateEventPhrase('Welfare Camps', langCode)}</span>
            <span className="px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/80 text-[11px] font-black text-teal-800 dark:text-teal-300">
              {filteredEvents.length}
            </span>
          </button>

          {/* Saved Events Tab */}
          <button
            type="button"
            onClick={() => setFeedTab('saved')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              feedTab === 'saved'
                ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm ring-1 ring-rose-400/40'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Heart className={`w-4 h-4 ${savedEventIds.length > 0 ? 'fill-rose-500 text-rose-500' : 'text-rose-500'}`} />
            <span>{translateEventPhrase('Saved Events', langCode)}</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-[11px] font-black text-rose-700 dark:text-rose-300">
              {savedEventIds.length}
            </span>
          </button>

          {/* Recommended for You Tab */}
          <button
            type="button"
            onClick={() => setFeedTab('recommended')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              feedTab === 'recommended'
                ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-300 shadow-sm ring-1 ring-purple-400/40'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span>{translateEventPhrase('Recommended for You', langCode)}</span>
            <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-[11px] font-black text-purple-700 dark:text-purple-300">
              {recommendedCount}
            </span>
          </button>

          {/* Submit Local Camp Button */}
          <div className="w-full sm:w-auto sm:ml-auto flex items-center justify-end">
            <button
              type="button"
              onClick={() => setIsAddEventModalOpen(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{translateEventPhrase('Submit Local Camp', langCode)}</span>
            </button>
          </div>
        </div>

        {/* Empty state when Saved Events tab is selected and has no items */}
        {feedTab === 'saved' && savedEventIds.length === 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800 space-y-3 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center mx-auto">
              <Heart className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {translateEventPhrase('No saved events yet', langCode)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {translateEventPhrase('Click the heart icon on any camp, contest, or hackathon to save it here for offline reference.', langCode)}
            </p>
            <button
              type="button"
              onClick={() => setFeedTab('all')}
              className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {translateEventPhrase('All Sources', langCode)}
            </button>
          </div>
        )}

        {/* Empty state when Saved Events has items but none match current filter */}
        {feedTab === 'saved' && savedEventIds.length > 0 && finalFilteredGovtEvents.length === 0 && finalFilteredParseEvents.length === 0 && filteredEvents.length === 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800 space-y-3 max-w-lg mx-auto">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {translateEventPhrase('No saved events match your search filters', langCode) || 'No saved events match your search filters'}
            </div>
            <button
              type="button"
              onClick={clearAllFilters}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              {translateEventPhrase('Reset All Filters', langCode)}
            </button>
          </div>
        )}

        {/* Empty state when Recommended tab is selected and has no matches */}
        {feedTab === 'recommended' && recommendedCount === 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800 space-y-3 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {translateEventPhrase('No personalized recommendations found', langCode)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {translateEventPhrase('Update your profile with your occupation, student status, or farming details in settings to get tailored opportunities.', langCode)}
            </p>
            <Link
              to="/profile"
              className="inline-block px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {translateEventPhrase('Update Profile', langCode) || 'Update Profile'}
            </Link>
          </div>
        )}

        {/* ========================================================================= */}
        {/* OFFICIAL GOVERNMENT EVENTS SECTION                                         */}
        {/* ========================================================================= */}
        {(feedTab === 'all' || feedTab === 'government' || (feedTab === 'saved' && finalFilteredGovtEvents.length > 0) || (feedTab === 'recommended' && finalFilteredGovtEvents.length > 0)) && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 rounded-full bg-amber-500" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {translateEventPhrase('Official Government Contests, Challenges & Hackathons', langCode)}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-xs font-black">
                  {filteredGovtEvents.length} {translateEventPhrase('Active', langCode)}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 font-mono text-[10px] text-amber-800 dark:text-amber-300 font-bold">
                  MyGov India • MeitY
                </span>
                <span>{selectedState === 'All India' ? translateEventPhrase('Pan-India Feed', langCode) : `${translateEventPhrase('Filtered', langCode)}: ${tp(selectedState) || selectedState}`}</span>
              </div>
            </div>

            {govtLoading ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-amber-600 dark:text-amber-400 mx-auto" />
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {translateEventPhrase('Fetching live official government opportunities for', langCode)} {selectedState === 'All India' ? translateEventPhrase('All India', langCode) : (tp(selectedState) || selectedState)}...
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {translateEventPhrase('Connecting to MyGov India & Central Ministries RSS Gateway', langCode)}
                </div>
              </div>
            ) : filteredGovtEvents.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800 space-y-3">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {translateEventPhrase('No government events found for', langCode)} {selectedState === 'All India' ? translateEventPhrase('All India', langCode) : (tp(selectedState) || selectedState)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {translateEventPhrase('Try switching the state filter to "All India" or clearing your category / keyword search.', langCode)}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedState('All India');
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {translateEventPhrase('Explore All India Government Initiatives', langCode)}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {translatedGovtEvents.map((evt, idx) => renderGovtEventCard(evt, idx))}
              </div>
            )}
          </section>
        )}

        {/* ========================================================================= */}
        {/* BRABBLE.AI LIVE EVENTS SECTION                                             */}
        {/* ========================================================================= */}
        {(feedTab === 'all' || feedTab === 'live_parse' || (feedTab === 'saved' && finalFilteredParseEvents.length > 0) || (feedTab === 'recommended' && finalFilteredParseEvents.length > 0)) && (
          <section className="space-y-4 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  ⚡ {translateEventPhrase('Tech Hackathons & Coding Competitions in', langCode)} {currentCityObj.name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-black">
                  {filteredParseEvents.length} {translateEventPhrase('Events', langCode)}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-slate-800 border border-emerald-200 dark:border-slate-700 font-mono text-[10px] text-emerald-800 dark:text-emerald-300 font-bold">
                  Brabble.ai API
                </span>
                <span>{translateEventPhrase('Real-time hackathons & student challenges', langCode)}</span>
              </div>
            </div>

            {parseLoading ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600 dark:text-emerald-400 mx-auto" />
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {translateEventPhrase('Fetching live upcoming events for', langCode)} {currentCityObj.name}...
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {translateEventPhrase('Connecting to Brabble.ai event stream', langCode)}
                </div>
              </div>
            ) : filteredParseEvents.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800 space-y-3">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {translateEventPhrase('No live Brabble.ai events found for', langCode)} {currentCityObj.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {translateEventPhrase('Try switching cities (e.g. Delhi-NCR, Mumbai, Bengaluru) or clearing the keyword/category filter.', langCode)}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {translateEventPhrase('Clear Filters', langCode)} ({currentCityObj.name})
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {translatedParseEvents.map((evt, idx) => renderParseEventCard(evt, idx))}
              </div>
            )}
          </section>
        )}

        {/* ========================================================================= */}
        {/* GOVERNMENT WELFARE CAMPS SECTION                                           */}
        {/* ========================================================================= */}
        {(feedTab === 'all' || feedTab === 'welfare_camps' || (feedTab === 'saved' && filteredEvents.length > 0) || (feedTab === 'recommended' && filteredEvents.length > 0)) && (
          <section className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t('events.availableHeading', undefined, translateEventPhrase('Active & Upcoming Welfare Camps', langCode))}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-emerald-300 text-xs font-black">
                  {filteredEvents.length} {translateEventPhrase('Camps', langCode)}
                </span>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {translateEventPhrase('Verified by District Administrations & Ministries', langCode)}
              </div>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800 space-y-4 max-w-lg mx-auto">
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {translateEventPhrase('No welfare camps found matching your criteria', langCode)}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {translateEventPhrase('Try expanding your state filter to "All India" or resetting search keywords to explore all nationwide welfare camps.', langCode)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-4 py-2 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {translateEventPhrase('View All Welfare Camps', langCode)}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {translatedWelfareEvents.map((evt) => renderWelfareEventCard(evt))}
              </div>
            )}
          </section>
        )}

        {/* 6. Informational Banner: Can't find a camp in your village / ward? */}
        <section className="bg-gradient-to-br from-teal-900/10 via-emerald-900/5 to-cyan-900/10 dark:from-teal-950/50 dark:to-slate-900/80 rounded-2xl p-5 sm:p-6 border border-teal-200/80 dark:border-teal-800/50 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-emerald-300 text-xs font-bold">
                <Store className="w-3.5 h-3.5" />
                <span>{translateEventPhrase('CSC Digital Seva & e-Mitra Assistance', langCode)}</span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                {translateEventPhrase("Can't find a camp scheduled in your Gram Panchayat this week?", langCode)}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {translateEventPhrase(
                  'You do not have to wait for an annual mela! Over 4,50,000 Common Service Centres (CSC Digital Seva), e-Mitra, MeeSeva, and Atal Seva Kendras provide the same instant Ayushman card printing, Aadhaar KYC, PM-KISAN seeding, and Mudra loan filing daily.',
                  langCode
                )}
              </p>
            </div>

            <Link
              to="/kendra-finder"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{translateEventPhrase('Locate Nearest Kendra', langCode)}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* 7. Community Camp Submission Modal */}
      {isAddEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-teal-50 dark:bg-slate-800 text-teal-700 dark:text-emerald-400">
                  <PlusCircle className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    {translateEventPhrase('Submit Local Camp', langCode)}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {translateEventPhrase('Community Verified', langCode)} • {translateEventPhrase('Welfare Initiatives', langCode)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddEventModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCommunityCamp} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Camp Title / Event Name (शिविर का नाम) *
                </label>
                <input
                  type="text"
                  required
                  value={newCampTitle}
                  onChange={(e) => setNewCampTitle(e.target.value)}
                  placeholder="e.g., Ayushman Golden Card Registration & KYC Camp"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category (श्रेणी) *
                  </label>
                  <select
                    value={newCampCategory}
                    onChange={(e) => setNewCampCategory(e.target.value as EventCategory)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden cursor-pointer"
                  >
                    {EVENT_CATEGORIES.filter((c) => c.id !== 'All').map((c) => (
                      <option key={c.id} value={c.id}>
                        {langCode === 'hi-IN' ? c.hindiLabel : translateEventPhrase(c.label, langCode)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    State (राज्य) *
                  </label>
                  <select
                    value={newCampState}
                    onChange={(e) => setNewCampState(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden cursor-pointer"
                  >
                    {INDIAN_STATES_FOR_EVENTS.filter((s) => s !== 'All India').map((st) => (
                      <option key={st} value={st}>
                        {tp(st) || st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    District / Tehsil (ज़िला / तहसील)
                  </label>
                  <input
                    type="text"
                    value={newCampDistrict}
                    onChange={(e) => setNewCampDistrict(e.target.value)}
                    placeholder="e.g., Gorakhpur"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Venue / Exact Location (स्थान) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCampVenue}
                    onChange={(e) => setNewCampVenue(e.target.value)}
                    placeholder="e.g., Gram Panchayat Bhawan, Ward No. 4"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date (आरंभ तिथि)
                  </label>
                  <input
                    type="date"
                    value={newCampStartDate}
                    onChange={(e) => setNewCampStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    End Date (समाप्ति तिथि)
                  </label>
                  <input
                    type="date"
                    value={newCampEndDate}
                    onChange={(e) => setNewCampEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Organizer / VLE Name (आयोजक)
                  </label>
                  <input
                    type="text"
                    value={newCampOrganizer}
                    onChange={(e) => setNewCampOrganizer(e.target.value)}
                    placeholder="e.g., CSC VLE Operator / Gram Pradhan"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Helpline / Phone Number (संपर्क)
                  </label>
                  <input
                    type="tel"
                    value={newCampContact}
                    onChange={(e) => setNewCampContact(e.target.value)}
                    placeholder="e.g., 9876543210 / 1800-180-1104"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Required Documents (ज़रूरी दस्तावेज़ - कॉमा से अलग करें)
                </label>
                <input
                  type="text"
                  value={newCampDocs}
                  onChange={(e) => setNewCampDocs(e.target.value)}
                  placeholder="e.g., Aadhaar Card, Ration Card, Bank Passbook, 2 Photos"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Key Benefits (शिविर के मुख्य लाभ - कॉमा से अलग करें)
                </label>
                <input
                  type="text"
                  value={newCampBenefits}
                  onChange={(e) => setNewCampBenefits(e.target.value)}
                  placeholder="e.g., Instant ₹5 Lakh Ayushman Card, Free Health Checkup, e-KYC"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddEventModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {translateEventPhrase('Cancel', langCode) || 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white font-bold shadow-md cursor-pointer transition-all active:scale-95"
                >
                  {translateEventPhrase('Save & Publish Camp', langCode) || 'Save & Publish Camp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
