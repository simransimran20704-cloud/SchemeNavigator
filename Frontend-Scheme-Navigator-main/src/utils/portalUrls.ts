import { Scheme } from '../types';

// Direct Official Application Portal Registry
export const KNOWN_SCHEMES_PORTALS: Record<string, string> = {
  'aaby': 'https://eshram.gov.in',
  'aam-aadmi-bima-yojana': 'https://eshram.gov.in',
  'pm-kisan': 'https://pmkisan.gov.in',
  'pm-kisan-samman-nidhi': 'https://pmkisan.gov.in',
  'pmjay': 'https://beneficiary.nha.gov.in',
  'ayushman-bharat-pmjay': 'https://beneficiary.nha.gov.in',
  'ayushman-vaya-vandana-senior-citizens': 'https://beneficiary.nha.gov.in',
  'pm-vishwakarma-scheme': 'https://pmvishwakarma.gov.in',
  'pm-vishwakarma': 'https://pmvishwakarma.gov.in',
  'pradhan-mantri-mudra-yojana': 'https://www.udyamimitra.in',
  'pradhan-mantri-mudra-yojana-pmmy': 'https://www.udyamimitra.in',
  'pm-mudra': 'https://www.udyamimitra.in',
  'prime-minister-employment-generation-programme': 'https://www.kviconline.gov.in/pmegpeportal',
  'sukanya-samriddhi-yojana': 'https://www.indiapost.gov.in',
  'atal-pension-yojana': 'https://enps.nsdl.com',
  'pm-svanidhi': 'https://pmsvanidhi.mohua.gov.in',
  'pmsvanidhi': 'https://pmsvanidhi.mohua.gov.in',
  'pm-matru-vandana-yojana': 'https://pmmvy.wcd.gov.in',
  'pmmvy': 'https://pmmvy.wcd.gov.in',
  'pm-shram-yogi-mandhan': 'https://maandhan.in',
  'pm-sym': 'https://maandhan.in',
  'national-scholarship-portal': 'https://scholarships.gov.in',
  'post-matric-scholarship-sc-obc-minority': 'https://scholarships.gov.in',
  'pre-matric-scholarship': 'https://scholarships.gov.in',
  'pm-uchchatar-shiksha-protsahan-yojana': 'https://scholarships.gov.in',
  'pm-fasal-bima-yojana': 'https://pmfby.gov.in',
  'pmfby': 'https://pmfby.gov.in',
  'kisan-credit-card': 'https://pmkisan.gov.in',
  'kcc': 'https://pmkisan.gov.in',
  'pm-awas-yojana-urban': 'https://pmaymis.gov.in',
  'pm-awas-yojana-gramin': 'https://pmayg.nic.in',
  'pmay': 'https://pmaymis.gov.in',
  'stand-up-india': 'https://www.standupmitra.in',
  'udyam-registration': 'https://udyamregistration.gov.in',
  'pm-kusum': 'https://pmkusum.mnre.gov.in',
  'swamitva-scheme': 'https://swamitva.nic.in',
  'jan-aushadhi-scheme': 'https://janaushadhi.gov.in',
  'national-apprenticeship-promotion-scheme': 'https://www.apprenticeshipindia.gov.in',
};

export const STATE_DIRECT_PORTALS: Record<string, string> = {
  'Assam': 'https://sewasetu.assam.gov.in',
  'Odisha': 'https://edistrict.odisha.gov.in',
  'Puducherry': 'https://edistrict.py.gov.in',
  'Delhi': 'https://edistrict.delhigovt.nic.in',
  'Uttar Pradesh': 'https://edistrict.up.gov.in',
  'Maharashtra': 'https://aaplesarkar.mahaonline.gov.in',
  'Karnataka': 'https://sevasindhu.karnataka.gov.in',
  'Tamil Nadu': 'https://www.tnesevai.tn.gov.in',
  'Bihar': 'https://serviceonline.bihar.gov.in',
  'West Bengal': 'https://edistrict.wb.gov.in',
  'Rajasthan': 'https://jansoochna.rajasthan.gov.in',
  'Gujarat': 'https://digitalgujarat.gov.in',
  'Madhya Pradesh': 'https://mpedistrict.gov.in',
  'Punjab': 'https://esewa.punjab.gov.in',
  'Haryana': 'https://saralharyana.gov.in',
  'Andhra Pradesh': 'https://navasakam.ap.gov.in',
  'Telangana': 'https://tg.meeseva.gov.in',
  'Kerala': 'https://edistrict.kerala.gov.in',
  'Jharkhand': 'https://jharsewa.jharkhand.gov.in',
  'Chhattisgarh': 'https://edistrict.cgstate.gov.in',
  'Himachal Pradesh': 'https://edistrict.hp.gov.in',
  'Uttarakhand': 'https://eservices.uk.gov.in',
  'Jammu and Kashmir': 'https://jkeservices.jk.gov.in',
  'Goa': 'https://goaonline.gov.in',
  'Tripura': 'https://edistrict.tripura.gov.in',
  'Meghalaya': 'https://megedistrict.gov.in',
  'Manipur': 'https://eservicesmanipur.gov.in',
  'Nagaland': 'https://edistrict.nagaland.gov.in',
  'Mizoram': 'https://edistrict.mizoram.gov.in',
  'Sikkim': 'https://services.sikkim.gov.in',
  'Arunachal Pradesh': 'https://eservice.arunachal.gov.in',
  'Chandigarh': 'https://chdservices.gov.in',
};

export const MINISTRY_DIRECT_PORTALS: Record<string, string> = {
  'education': 'https://scholarships.gov.in',
  'social justice': 'https://socialjustice.gov.in',
  'science': 'https://online-inspire.gov.in',
  'commerce': 'https://www.startupindia.gov.in',
  'agriculture': 'https://pmkisan.gov.in',
  'msme': 'https://udyamregistration.gov.in',
  'small scale': 'https://udyamregistration.gov.in',
  'textile': 'https://handicrafts.nic.in',
  'electronics': 'https://www.digitalindia.gov.in',
  'sports': 'https://yas.nic.in',
  'culture': 'https://indiaculture.gov.in',
  'finance': 'https://www.udyamimitra.in',
  'home affairs': 'https://mha.gov.in',
  'defence': 'https://mod.gov.in',
  'health': 'https://beneficiary.nha.gov.in',
  'labour': 'https://eshram.gov.in',
  'fisheries': 'https://dof.gov.in',
  'minority': 'https://scholarships.gov.in',
  'skill': 'https://www.skillindia.gov.in',
  'women': 'https://wcd.nic.in',
  'housing': 'https://pmsvanidhi.mohua.gov.in',
  'rural': 'https://rural.nic.in',
};

const URL_REGEX = /https?:\/\/[^\s'"<>]+/g;

export function extractCleanPortalUrl(rawUrl: string | undefined | null): string {
  if (!rawUrl) return '';
  let cleaned = rawUrl
    .replace(/chrome-extension:\/\/[a-z0-9]+\/https?:\/\//g, 'https://')
    .replace(/chrome-extensionhttps?:\/\//g, 'https://');

  const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('file:///'));
  if (lines.length === 0) return '';

  const candidates: { score: number; url: string }[] = [];

  const priorityKeywords: [string[], number][] = [
    [['official website', 'official portal', 'portal', 'website', 'online application', 'apply', 'registration', 'apply online', 'portal login'], 120],
    [['sanman portal', 'sso', 'edistrict', 'service', 'dbt', 'mahaonline', 'e-services'], 100],
    [['application form', 'application status', 'scheme details', 'detail', 'details', 'about'], 80],
    [['guidelines', 'guideline', 'notification', 'circular', 'order', 'amendment', 'press release'], 50],
    [['user manual', 'faq', 'contact'], 30],
  ];

  for (const line of lines) {
    const matches = line.match(URL_REGEX) || [];
    for (let u of matches) {
      u = u.replace(/[.,;)\]#'"]+$/, '');
      if (!u.startsWith('http')) continue;

      // Handle google redirects
      if (u.includes('google.co.in/url?') || u.includes('google.com/url?')) {
        try {
          const parsed = new URL(u);
          const target = parsed.searchParams.get('url');
          if (target) u = target;
        } catch {
          // ignore
        }
      }

      // Handle translate.goog
      if (u.includes('translate.goog')) {
        u = u.replace(/([a-zA-Z0-9-]+)-([a-zA-Z0-9-]+)-gov-in\.translate\.goog/g, '$1.$2.gov.in')
             .replace(/([a-zA-Z0-9-]+)-gov-in\.translate\.goog/g, '$1.gov.in')
             .replace(/\.translate\.goog/g, '');
      }

      if (u.includes(':8080')) {
        u = u.replace(':8080', '');
      }

      const lineLower = line.toLowerCase();
      const uLower = u.toLowerCase();
      let score = 10;

      for (const [kws, sVal] of priorityKeywords) {
        if (kws.some(kw => lineLower.includes(kw))) {
          score = sVal;
          break;
        }
      }

      try {
        const host = new URL(u).hostname.toLowerCase();
        if (host.endsWith('.gov.in') || host.endsWith('.nic.in')) {
          score += 50;
        } else if (host.endsWith('.org.in') || host.endsWith('.ac.in') || host.endsWith('.res.in') || host.endsWith('.edu.in') || host.endsWith('.in')) {
          score += 20;
        }

        if (['drive.google.com', 'docs.google.com', 'dropbox.com', 'amazonaws.com', 'govtschemes.in', 'google.com', 'google.co.in'].some(b => host.includes(b))) {
          score -= 100;
        }
      } catch {
        continue;
      }

      if (uLower.endsWith('.pdf')) {
        score -= 25;
      } else {
        score += 15;
      }

      candidates.push({ score, url: u });
    }
  }

  if (candidates.length === 0) return '';
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].score > 0 ? candidates[0].url : '';
}

export function getSafeOfficialUrl(scheme: Scheme | null | undefined): string {
  if (!scheme) return 'https://services.india.gov.in';

  const rawUrl = scheme.verification?.officialPortalUrl?.trim();
  const cleanExtracted = extractCleanPortalUrl(rawUrl);

  if (cleanExtracted && cleanExtracted !== '#' && cleanExtracted.toLowerCase() !== 'none' && !cleanExtracted.includes('myscheme.gov.in')) {
    return cleanExtracted;
  }

  // Resolve direct application portal from scheme identity & category
  const slug = (scheme.slug || scheme.id || '').toLowerCase();
  const name = (scheme.name || '').toLowerCase();

  for (const [key, directUrl] of Object.entries(KNOWN_SCHEMES_PORTALS)) {
    if (slug === key || slug.includes(key) || name.includes(key)) {
      return directUrl;
    }
  }

  if (name.includes('scholarship') || name.includes('fellowship') || name.includes('vidyarthi') || name.includes('shiksha') || name.includes('stipend')) {
    return 'https://scholarships.gov.in';
  }
  if (name.includes('kisan') || name.includes('farmer') || name.includes('krishi') || name.includes('crop') || name.includes('paddy') || name.includes('farming')) {
    return 'https://pmkisan.gov.in';
  }
  if (name.includes('bima') || name.includes('insurance') || name.includes('ayushman') || name.includes('arogya') || name.includes('swasthya') || name.includes('health')) {
    return 'https://beneficiary.nha.gov.in';
  }
  if (name.includes('mudra') || name.includes('loan') || name.includes('credit') || name.includes('subsidy') || name.includes('business') || name.includes('udyam') || name.includes('coir') || name.includes('handicraft') || name.includes('industry')) {
    return 'https://udyamregistration.gov.in';
  }
  if (name.includes('pension') || name.includes('vridha') || name.includes('old age') || name.includes('divyang') || name.includes('disability')) {
    return 'https://enps.nsdl.com';
  }
  if (name.includes('awas') || name.includes('housing') || name.includes('ghar')) {
    return 'https://pmaymis.gov.in';
  }
  if (name.includes('labour') || name.includes('worker') || name.includes('shramik') || name.includes('employment') || name.includes('rozgar') || name.includes('job')) {
    return 'https://eshram.gov.in';
  }

  const covered = Array.isArray(scheme.coveredStates) ? scheme.coveredStates : [];
  if (covered.length > 0 && !covered.includes('All India')) {
    for (const st of covered) {
      if (STATE_DIRECT_PORTALS[st]) {
        return STATE_DIRECT_PORTALS[st];
      }
    }
  }

  const dept = (scheme.verification?.ministryOrAuthority || scheme.verification?.sourceDepartment || '').toLowerCase();
  for (const [key, directUrl] of Object.entries(MINISTRY_DIRECT_PORTALS)) {
    if (dept.includes(key)) {
      return directUrl;
    }
  }

  return 'https://services.india.gov.in';
}
