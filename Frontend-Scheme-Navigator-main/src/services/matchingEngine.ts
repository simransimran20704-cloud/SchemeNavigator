import { Scheme, UserProfile, SchemeMatchResult, MatchFactor } from '../types';

export function isMatchingState(userState?: string, coveredStates?: string[]): boolean {
  if (!userState) return false;
  if (!Array.isArray(coveredStates) || coveredStates.length === 0) return true;
  if (coveredStates.includes('All India')) return true;

  const normalize = (name: string) =>
    name
      .toLowerCase()
      .replace(/\(.*?\)/g, '')
      .replace(/nct of/g, '')
      .replace(/state of/g, '')
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]/g, '')
      .trim();

  const uNorm = normalize(userState);
  if (!uNorm) return false;

  return coveredStates.some((cs) => {
    if (cs === 'All India') return true;
    const cNorm = normalize(String(cs));
    if (!cNorm) return false;
    return uNorm === cNorm || uNorm.includes(cNorm) || cNorm.includes(uNorm);
  });
}

export function calculateSchemeMatch(scheme: Scheme, profile: UserProfile): SchemeMatchResult {
  const factors: MatchFactor[] = [];
  const matchedReasons: string[] = [];
  const unmatchedWarnings: string[] = [];

  const eligibility = scheme?.eligibility || {};
  const coveredStates = Array.isArray(scheme?.coveredStates) ? scheme.coveredStates : ['All India'];
  const name = (scheme?.name || '').trim();
  const nameL = name.toLowerCase();
  const tagline = (scheme?.tagline || '').trim().toLowerCase();
  const desc = (scheme?.shortDescription || scheme?.detailedDescription || '').trim().toLowerCase();
  const cat = (scheme?.category || '').trim();
  const customConds = (eligibility.customConditions || []).map((c) => String(c).toLowerCase());
  const condsText = customConds.join(' ');
  const tagsText = (scheme?.tags || []).join(' ').toLowerCase();
  const allText = `${nameL} ${cat.toLowerCase()} ${tagline} ${desc} ${condsText} ${tagsText}`;

  const userAge = typeof profile?.age === 'number' ? profile.age : null;
  const userGender = String(profile?.gender || '').trim().toLowerCase();
  const userState = (profile?.state || '').trim();
  const userOcc = String(profile?.employmentType || profile?.employmentStatus || profile?.occupation || '').trim().toLowerCase();
  const userCat = (profile?.category || 'General').trim();
  const userIncome = profile?.incomeRange || '';
  const userDisabled = Boolean(profile?.isDisability || profile?.hasDisability);
  const userBpl = Boolean(profile?.hasBPLCard || profile?.isBPL || userIncome === 'Below ₹1 lakh');
  const userMinority = Boolean(profile?.isMinority);

  // Helper to build not eligible response
  const notEligible = (warning: string): SchemeMatchResult => ({
    scheme,
    matchScore: 0,
    matchGrade: 'Not Eligible',
    matchedReasons: [],
    unmatchedWarnings: [warning],
    factors: [
      {
        criterion: 'Eligibility Check',
        status: 'mismatch',
        explanation: warning,
        weight: 100,
        score: 0,
      },
    ],
  });

  // =========================================================================
  // STRICT STATUTORY INELIGIBILITY FILTERS (Score 0 on Violation)
  // =========================================================================

  // 1. State / Geography Verification
  const isAllIndia = coveredStates.includes('All India') || coveredStates.length === 0;
  const isUserState = isMatchingState(userState, coveredStates);
  if (!isAllIndia && !isUserState && userState) {
    return notEligible(`Restricted to residents of ${coveredStates.join(', ')} (your state is ${userState})`);
  }

  // 2. Gender Verification
  const allowedGenders = (eligibility.allowedGenders || []).map((g) => String(g).toLowerCase());
  if (allowedGenders.length > 0 && !allowedGenders.includes('all') && userGender) {
    if (!allowedGenders.includes(userGender)) {
      return notEligible(`Reserved for ${allowedGenders.join(', ')} applicants only`);
    }
  }

  const femaleKw = [
    'mahila', 'kanya', 'sukanya', 'widow', 'maternity', 'pregnant',
    'girl child', 'kishori', 'ladli', 'women only', 'female only', 'matru vandana',
    'laxmi', 'bhagyashree', 'prasooti', 'stree', 'didi', 'beti', 'balika', 'nari'
  ];
  if (userGender === 'male') {
    if (cat === 'Women & Child') {
      return notEligible('Targeted specifically for female beneficiaries');
    }
    if (femaleKw.some((kw) => allText.includes(kw)) || allText.includes('widow')) {
      const broadWords = ['both boys and girls', 'all genders', 'boys and girls', 'children of', 'widower'];
      if (!broadWords.some((w) => allText.includes(w))) {
        return notEligible('Targeted specifically for female beneficiaries');
      }
    }
    if (['applicant should be a female', 'girl child', 'widow', 'pregnant woman', 'lactating mother'].some((kw) => condsText.includes(kw))) {
      return notEligible('Targeted specifically for female beneficiaries');
    }
  }

  if (userGender === 'female') {
    if (['men only', 'male only', 'boys only', 'purush'].some((kw) => allText.includes(kw))) {
      return notEligible('Targeted specifically for male beneficiaries');
    }
  }

  // 3. Benchmark Disability Verification
  const disabilityKw = [
    'students with disabilities', 'persons with disabilities', 'divyangjan',
    'disability pension', 'locomotor disability', 'benchmark disability', 'handicapped'
  ];
  const requiresDisability = Boolean(eligibility.requiresDisability) || (
    disabilityKw.some((kw) => allText.includes(kw)) && !allText.includes('without disability')
  );
  if (requiresDisability && !userDisabled) {
    return notEligible('Requires benchmark disability certificate (40%+ Divyangjan)');
  }

  // 4. Social Category / Caste Reservation Verification
  const allowedCats = eligibility.allowedCategories || [];
  if (allowedCats.length > 0 && !allowedCats.includes('All' as any) && userCat) {
    const isCatMatched = allowedCats.includes(userCat as any) ||
      (userCat === 'SC' && allowedCats.includes('ST' as any)) ||
      (userCat === 'ST' && allowedCats.includes('SC' as any));
    if (!isCatMatched) {
      return notEligible(`Reserved exclusively for ${allowedCats.join(', ')} categories`);
    }
  }

  const minorityRegex = /\b(for\s+minority|for\s+minorities|minority\s+students|minority\s+community|minority\s+scheme)\b/i;
  const requiresMinority = Boolean(eligibility.requiresMinority) || (
    minorityRegex.test(allText) && !allText.includes('non-minority') && !allText.includes('all communities')
  );
  if (requiresMinority && !userMinority) {
    return notEligible('Reserved for students from notified minority communities');
  }

  if (userCat === 'General') {
    const affirmativeRegex = /\b(for\s+sc\b|for\s+st\b|for\s+obc\b|for\s+ebc\b|for\s+dnt\b|scheduled\s+caste|scheduled\s+tribe|backward\s+classes|obc\s+students|sc\s+students|st\s+students|obc\s+candidates|minority\s+community|for\s+minority|for\s+minorities)\b/i;
    if (affirmativeRegex.test(allText)) {
      if (!['general', 'all categories', 'open to all'].some((w) => allText.includes(w))) {
        return notEligible('Reserved for affirmative action categories (SC/ST/OBC/Minority)');
      }
    }
    if (customConds.some((c) => affirmativeRegex.test(c))) {
      if (!['general', 'all categories', 'open to all'].some((w) => condsText.includes(w))) {
        return notEligible('Reserved for affirmative action categories (SC/ST/OBC/Minority)');
      }
    }
  }

  // 5. Age Limits & Statutory Age Verification
  const minAge = eligibility.minAge ?? 0;
  const maxAge = eligibility.maxAge ?? 100;
  if (userAge !== null) {
    if (minAge > 0 && userAge < minAge - 1) {
      return notEligible(`Minimum eligible age is ${minAge} years (your age: ${userAge})`);
    }
    if (maxAge < 100 && userAge > maxAge + 1) {
      return notEligible(`Maximum eligible age is ${maxAge} years (your age: ${userAge})`);
    }

    // Senior citizen pensions (60+)
    const seniorKw = [
      'senior citizen pension', 'old age pension', 'vridha pension', 'vridhavastha',
      'vaya vandana', '70+ years', 'age of 60 years or above', 'aged 60 years and above'
    ];
    if (seniorKw.some((term) => allText.includes(term)) && userAge < 60) {
      return notEligible(`Reserved for Senior Citizens aged 60+ (your age: ${userAge})`);
    }

    // Minor school child schemes
    const schoolRegex = /\b(class\s*(?:1|1st|i)\s*to\s*(?:8|8th|10|10th|12|12th)|classes\s*1\s*to\s*12|pre-matric|school\s*children|primary\s*school|girl\s*child\s*under\s*10|school\s*uniforms)\b/i;
    if (schoolRegex.test(allText) && userAge >= 18) {
      return notEligible('Restricted to school-going children (Class 1st to 12th)');
    }
  }

  // 6. DOMAIN & OCCUPATIONAL STATUTORY EXCLUSIONS
  // A) Education & Student Schemes
  const isEducationScheme =
    cat === 'Education' ||
    cat === 'Education & Learning' ||
    ['scholarship', 'fellowship', 'school', 'college', 'tuition', 'b.tech', 'ug/pg', 'higher education', 'vidyarthi', 'shiksha', 'pre-matric', 'post-matric', 'aicte', 'merit-cum-means'].some((w) => nameL.includes(w)) ||
    ['scholarship', 'fellowship', 'school student', 'college student', 'aicte', 'post-matric', 'pre-matric', 'tuition fee', 'b.tech', 'ug/pg', 'higher education', 'study tour', 'degree college', 'hostel subsidy'].some((w) => allText.includes(w));

  if (isEducationScheme) {
    if (!['student', 'other', ''].includes(userOcc)) {
      return notEligible('Restricted to actively enrolled students & education seekers');
    }
    if (userAge !== null && userAge >= 35 && userOcc !== 'student') {
      return notEligible('Restricted to enrolled students and youth pursuing education');
    }
  }

  // B) Agriculture & Farmer Subsidies
  const agriKw = [
    'kisan', 'fasal bima', 'pm-kusum', 'crop insurance', 'krishi',
    'tractor subsidy', 'fertilizer subsidy', 'fish hatcheries', 'aquaculture',
    'seed subsidy', 'irrigation subsidy', 'soil health', 'horticulture mission'
  ];
  const isAgri =
    cat === 'Agriculture' ||
    cat === 'Agriculture, Rural & Environment' ||
    ['kisan', 'krishi', 'fasal', 'crop', 'kusum', 'soil health', 'fertilizer subsidy', 'seed subsidy', 'tractor', 'irrigation', 'horticulture', 'dairy', 'pashu'].some((w) => nameL.includes(w)) ||
    agriKw.some((w) => allText.includes(w));

  if (isAgri && userOcc !== 'farmer') {
    if (['student', 'retired', 'homemaker', 'unemployed'].includes(userOcc)) {
      return notEligible('Targeted exclusively for agricultural farmers & landholders');
    }
    if (['employed'].includes(userOcc) && !['all citizens', 'open to all', 'general public'].some((w) => allText.includes(w))) {
      return notEligible('Targeted exclusively for active agricultural farmers');
    }
  }

  // C) Non-Agricultural Industrial / Heavy Manufacturing for Farmers
  if (userOcc === 'farmer') {
    const nonAgriIndustrial = [
      'electronic manufacturing', 'electronics manufacturing', 'emc scheme', 'emc 2.0', 'software technology park', 'stpi',
      'footwear design', 'leather complex', 'chemical park', 'plastic park',
      'shipbuilding', 'mining lease', 'aviation', 'defence industrial',
      'textile park', 'power loom', 'auto components'
    ];
    if (nonAgriIndustrial.some((ind) => nameL.includes(ind))) {
      return notEligible('Restricted to heavy industrial / electronics / manufacturing enterprises');
    }
  }

  // D) Commercial MSME Schemes for Students
  if (userOcc === 'student') {
    const commercialBiz = [
      'industrial cluster', 'emc scheme', 'factory', 'commercial credit',
      'export infrastructure', 'patent reimbursement for msme', 'iso certification for msme'
    ];
    if (commercialBiz.some((ind) => nameL.includes(ind))) {
      return notEligible('Restricted to operational commercial MSMEs and registered enterprises');
    }
  }

  // E) Senior Citizen vs Youth Schemes
  if (userAge !== null && userAge >= 50) {
    const youthKw = [
      'youth seed', 'yuva udyami', 'yuvak', 'adolescent', 'between 18 and 35 years', '18-35 years', '18 to 35'
    ];
    if (youthKw.some((w) => allText.includes(w))) {
      return notEligible('Restricted to youth beneficiaries');
    }
  }

  // F) Labour / Construction Board (BOCW)
  const labourKw = ['hbocwwb', 'construction worker', 'silicosis board', 'building or construction work', 'bocw', 'shramik card'];
  if (labourKw.some((w) => allText.includes(w))) {
    if (!['unemployed', 'self-employed', 'labour', 'construction worker', 'shramik'].includes(userOcc)) {
      return notEligible('Requires active registration with Construction Labour Board (BOCW)');
    }
  }

  // D) Specialized Target Group Exclusions (Weavers, Artisans, Displaced, Safai Karamchari, Armed Forces)
  const targetGroupExclusions: [string[], string][] = [
    [['displaced families', 'pok and chhamb', 'refugee', 'migrant camp'], 'Displaced / refugee families from specified conflict zones'],
    [['handloom weaver', 'weaver mudra', 'yarn supply', 'bunkar'], 'Certified handloom weavers & allied textile workers'],
    [['artisan', 'vishwakarma', 'craftsman', 'shilpkar'], 'Traditional trade artisans and craftspersons'],
    [['safai karamchari', 'manual scavenger', 'sanitation worker'], 'Registered sanitation workers & Safai Karamcharis'],
    [['beedi worker', 'iron ore mine', 'mica mine', 'cine worker'], 'Specified welfare fund workers (mines/beedi/cine)'],
    [['ex-servicemen', 'war widows', 'armed forces personnel', 'defense personnel'], 'Ex-servicemen and defense personnel / dependents'],
    [['advocate welfare', 'advocates clerk', 'bar council'], 'Practicing advocates enrolled with Bar Council'],
  ];
  for (const [terms, groupDesc] of targetGroupExclusions) {
    if (terms.some((term) => nameL.includes(term))) {
      if (['farmer', 'student', 'retired'].includes(userOcc)) {
        return notEligible(`Targeted exclusively for ${groupDesc}`);
      }
    }
  }

  // E) Geographic & Agro-Climatic Exclusions in Scheme Title/Content
  const userStateLower = userState.toLowerCase();
  const neStates = ['assam', 'meghalaya', 'mizoram', 'nagaland', 'manipur', 'tripura', 'arunachal', 'sikkim'];
  const isUserNe = neStates.some((s) => userStateLower.includes(s));

  const neIndicators = ['north eastern region', 'north-eastern region', 'in ner', 'for north east', 'north east region'];
  if (neIndicators.some((ind) => nameL.includes(ind) || tagline.includes(ind)) && !isUserNe) {
    return notEligible('Geographically restricted to North Eastern Region (NER) states');
  }

  const jkIndicators = ['jammu and kashmir', 'jammu & kashmir', 'j&k', 'ladakh'];
  const isUserJk = ['jammu', 'kashmir', 'ladakh'].some((s) => userStateLower.includes(s));
  if (jkIndicators.some((ind) => nameL.includes(ind)) && !isUserJk) {
    return notEligible('Geographically restricted to Jammu & Kashmir / Ladakh');
  }

  // Plantation crops specific to coastal/tropical zones (Coconut, Coffee, Rubber, Coir, etc.)
  if (['delhi', 'haryana', 'punjab', 'rajasthan', 'uttar pradesh', 'bihar', 'madhya pradesh', 'chandigarh'].some((s) => userStateLower.includes(s))) {
    const plantationCrops = ['coconut', 'coffee', 'rubber', 'tea development in hills', 'coir', 'spices board', 'cardamom', 'arecanut', 'cashew'];
    if (plantationCrops.some((crop) => nameL.includes(crop))) {
      return notEligible('Agro-climatically restricted to coastal or hilly plantation zones');
    }
  }

  // F) High Income Means Testing & Statutory Income Tax Exclusions
  if (['₹5–10 lakh', '₹10 lakh+', 'Above ₹5 lakh'].includes(userIncome)) {
    const requiresBpl = Boolean(eligibility.requiresBPL) || ['bpl card', 'antyodaya', 'ration card holder', 'below poverty line', 'destitute'].some((w) => condsText.includes(w));
    if (requiresBpl) {
      return notEligible('Income ceiling exceeded (reserved for BPL/Antyodaya households)');
    }
    if (eligibility.maxAnnualIncome && eligibility.maxAnnualIncome <= 300000) {
      return notEligible(`Income exceeds ceiling of ₹${eligibility.maxAnnualIncome.toLocaleString()}`);
    }

    // Statutory income tax payee exclusion (e.g. PM-KISAN guidelines para 2.2 explicitly excludes income tax payees)
    const isPmKisan = nameL.includes('pm-kisan') || nameL.includes('kisan samman nidhi');
    const taxExclusionTerms = ['income tax', 'tax payee', 'taxpayer'];
    if (isPmKisan || taxExclusionTerms.some((t) => condsText.includes(t))) {
      if (!['open to all taxpayers', 'no tax limit', 'all income levels'].some((w) => condsText.includes(w))) {
        return notEligible('Excluded by statutory guidelines: Scheme excludes income tax payees');
      }
    }
  }

  // =========================================================================
  // TRUE ZERO-BASED SCORE TRACKING (Starting at 0, Points Earned on True Fit)
  // =========================================================================
  let score = 0;

  // --- FACTOR 1: Primary Occupation & Sector Fit (0 to 35 pts) ---
  let occScore = 0;
  if (userOcc === 'farmer') {
    if (isAgri) {
      occScore = 35;
      matchedReasons.push('Directly matches your farming & agricultural background');
    } else if (userAge !== null && userAge >= 60 && ['pension', 'old age', 'senior citizen', 'vridha'].some((w) => allText.includes(w))) {
      occScore = 35;
      matchedReasons.push('Dedicated senior citizen welfare & support');
    } else if (['Financial Assistance', 'Business'].includes(cat)) {
      if (['solar', 'kusum', 'infrastructure', 'cold storage', 'warehouse', 'processing', 'kisan', 'krishi', 'rural'].some((w) => allText.includes(w))) {
        occScore = 30;
        matchedReasons.push('Supports agricultural enterprise, solarization, and farm infrastructure');
      } else {
        occScore = 18;
        matchedReasons.push('Enterprise & financial assistance available to rural households');
      }
    } else if (['Healthcare', 'Social Security', 'Housing'].includes(cat)) {
      occScore = userAge !== null && userAge >= 60 ? 16 : 14;
      matchedReasons.push('General public welfare initiative available to rural households');
    } else {
      occScore = 5;
    }
  } else if (userOcc === 'student') {
    if (isEducationScheme || ['Education'].includes(cat)) {
      occScore = 35;
      matchedReasons.push('Directly tailored for student education & skill building');
    } else if (['Skill Development'].includes(cat)) {
      occScore = 30;
      matchedReasons.push('Vocational training & skill certification for students & youth');
    } else if (['Financial Assistance', 'Social Security', 'Healthcare'].includes(cat)) {
      occScore = 14;
      matchedReasons.push('General public welfare initiative available to students');
    } else {
      occScore = 5;
    }
  } else if (['business owner', 'self-employed'].includes(userOcc)) {
    const bizMatches = ['msme', 'mudra', 'startup', 'udyam', 'pmegp', 'credit', 'enterprise', 'subsidy'];
    if (['Business', 'Employment'].includes(cat) || bizMatches.some((w) => allText.includes(w))) {
      occScore = 35;
      matchedReasons.push('Supports business enterprises and self-employed professionals');
    } else if (['Financial Assistance', 'Skill Development'].includes(cat)) {
      occScore = 22;
    } else if (['Healthcare', 'Social Security'].includes(cat)) {
      occScore = 14;
    } else {
      occScore = 6;
    }
  } else if (userOcc === 'retired' || (userAge !== null && userAge >= 60)) {
    const pensionKw = ['pension', 'old age', 'senior citizen', 'vridha', 'elderly', 'ignaps'];
    if (pensionKw.some((w) => allText.includes(w))) {
      occScore = 35;
      matchedReasons.push('Dedicated senior citizen / pension support');
    } else if (['Social Security', 'Healthcare', 'Financial Assistance'].includes(cat)) {
      occScore = 22;
    } else {
      occScore = 8;
    }
  } else if (userOcc === 'unemployed') {
    if (['Employment', 'Skill Development'].includes(cat) || ['rozgar', 'mgnrega', 'kaushal', 'pmkvy', 'apprentice', 'skill'].some((w) => allText.includes(w))) {
      occScore = 35;
      matchedReasons.push('Directly provides employment opportunities and skill training');
    } else if (['Social Security', 'Financial Assistance'].includes(cat)) {
      occScore = 18;
    } else {
      occScore = 8;
    }
  } else if (userOcc === 'homemaker') {
    if (['Women & Child', 'Social Security'].includes(cat) || ['ujjwala', 'ration', 'poshan', 'lakhpati', 'shg', 'aajeevika'].some((w) => allText.includes(w))) {
      occScore = 35;
      matchedReasons.push('Dedicated welfare support for families and women');
    } else if (['Financial Assistance', 'Healthcare', 'Housing'].includes(cat)) {
      occScore = 20;
    } else {
      occScore = 8;
    }
  } else {
    occScore = 16;
  }

  score += occScore;
  factors.push({
    criterion: 'Occupation Alignment',
    score: occScore,
    weight: 35,
    status: occScore >= 20 ? 'matched' : 'neutral',
    explanation: `Domain fit based on ${profile?.employmentType || profile?.occupation || 'general background'}.`,
  });

  // --- FACTOR 2: Age Bracket & Life Stage Alignment (0 to 25 pts) ---
  let ageScore = 0;
  if (userAge !== null && userAge >= 60) {
    const seniorFit = ['pension', 'old age', 'senior citizen', 'vridha', 'elderly', 'ignaps', 'geriatric', 'vaya vandana'];
    if (seniorFit.some((w) => allText.includes(w))) {
      ageScore = 25;
      matchedReasons.push(`Specifically designed for Senior Citizens aged ${userAge}+`);
    } else if (isAgri && userOcc === 'farmer') {
      ageScore = 25;
      matchedReasons.push('Eligible adult farmer with full life-stage qualification');
    } else if (['Healthcare', 'Social Security'].includes(cat)) {
      ageScore = 20;
    } else {
      ageScore = 14;
    }
  } else if (userAge !== null && userAge >= 18 && userAge <= 25) {
    const youthFit = ['youth', 'yuva', 'student', 'scholarship', 'higher education', 'undergraduate', 'b.tech'];
    if (youthFit.some((w) => allText.includes(w))) {
      ageScore = 25;
      matchedReasons.push(`Prime eligibility for youth / students aged ${userAge}`);
    } else if (['Education', 'Skill Development'].includes(cat)) {
      ageScore = 25;
    } else {
      ageScore = 16;
    }
  } else {
    // Working adult (26 to 59)
    const minAge = eligibility.minAge || 0;
    const maxAge = eligibility.maxAge || 100;
    if (minAge > 0 && maxAge < 100 && userAge !== null && userAge >= minAge && userAge <= maxAge) {
      ageScore = 25;
      matchedReasons.push(`Age ${userAge} perfectly satisfies statutory age criteria (${minAge}–${maxAge} years)`);
    } else if (isAgri && userOcc === 'farmer') {
      ageScore = 25;
      matchedReasons.push('Prime adult farming qualification (age 18+)');
    } else if (['business owner', 'self-employed'].includes(userOcc) && ['Business', 'Employment'].includes(cat)) {
      ageScore = 25;
      matchedReasons.push('Prime entrepreneurial working age bracket');
    } else if (userAge !== null && userAge >= 18) {
      ageScore = 18;
      matchedReasons.push(`Adult life-stage qualification (age ${userAge})`);
    } else {
      ageScore = 14;
    }
  }

  score += ageScore;
  factors.push({
    criterion: 'Age & Life Stage',
    score: ageScore,
    weight: 25,
    status: ageScore >= 18 ? 'matched' : 'neutral',
    explanation: `Life stage evaluated for age ${userAge ?? 'specified'}.`,
  });

  // --- FACTOR 3: Geographic & State Implementation (0 to 25 pts) ---
  let locScore = 0;
  if (isUserState && !isAllIndia) {
    locScore = 25;
    matchedReasons.push(`State-specific initiative enacted by Government of ${userState}`);
  } else if (isAllIndia) {
    if ((isAgri && userOcc === 'farmer') || (isEducationScheme && userOcc === 'student')) {
      locScore = 25;
    } else {
      locScore = 20;
    }
    matchedReasons.push(`Central / Nationwide flagship scheme fully active in ${userState || 'India'}`);
  } else {
    locScore = 14;
  }

  score += locScore;
  factors.push({
    criterion: 'State Location',
    score: locScore,
    weight: 25,
    status: locScore >= 18 ? 'matched' : 'neutral',
    explanation: `Implementation jurisdiction in ${userState || 'India'}.`,
  });

  // --- FACTOR 4: Socio-Economic & Income Fit (0 to 15 pts) ---
  let econScore = 0;
  const hasIncomeCeiling = Boolean(eligibility.maxAnnualIncome || eligibility.requiresBPL) || ['bpl', 'antyodaya', 'low income only', 'below poverty line', 'income ceiling'].some((w) => condsText.includes(w));

  if (userBpl) {
    econScore = 15;
    matchedReasons.push('Income bracket fully satisfies financial assistance norms');
  } else if (!hasIncomeCeiling) {
    if ((isAgri && userOcc === 'farmer') || (isEducationScheme && userOcc === 'student')) {
      econScore = 14;
      matchedReasons.push('Universal economic eligibility with no statutory income ceiling');
    } else {
      econScore = 10;
      matchedReasons.push('Universal economic access across income brackets');
    }
  } else if (['Below ₹1 lakh', '₹1–2.5 lakh'].includes(userIncome)) {
    econScore = 15;
    matchedReasons.push('Income within eligible bracket for targeted public support');
  } else if (['₹2.5–5 lakh'].includes(userIncome)) {
    econScore = 12;
  } else {
    // High income (₹5-10 lakh, ₹10 lakh+) on schemes that have broad parameters
    econScore = 6;
  }

  score += econScore;
  factors.push({
    criterion: 'Economic Need',
    score: econScore,
    weight: 15,
    status: econScore >= 10 ? 'matched' : 'neutral',
    explanation: `Income evaluated for ${userIncome || 'general'} bracket.`,
  });

  // Cutoff: Schemes scoring below 40% are not qualified / rejected
  if (score < 40) {
    return notEligible('Below statutory compatibility threshold (minimum 40% required)');
  }

  const finalScore = Math.max(40, Math.min(99, score));
  // Ensure factor sum exactly equals finalScore
  const factorSum = factors.reduce((acc, f) => acc + (f.score || 0), 0);
  if (factors.length > 0 && factorSum !== finalScore) {
    const diff = finalScore - factorSum;
    const occFactor = factors.find((f) => f.criterion === 'Occupation Alignment') || factors[0];
    if (occFactor) {
      occFactor.score = Math.max(0, Math.min(occFactor.weight, occFactor.score + diff));
    }
  }
  let matchGrade: SchemeMatchResult['matchGrade'] = 'General Match';
  if (finalScore >= 85) matchGrade = 'High Potential';
  else if (finalScore >= 70) matchGrade = 'Good Match';
  else if (finalScore >= 50) matchGrade = 'Moderate Match';
  else if (finalScore >= 40) matchGrade = 'General Match';

  return {
    scheme,
    matchScore: finalScore,
    matchGrade,
    matchedReasons: matchedReasons.slice(0, 4),
    unmatchedWarnings: unmatchedWarnings.slice(0, 3),
    factors,
  };
}

export function rankSchemesForProfile(
  profile: UserProfile,
  schemes: Scheme[] = []
): SchemeMatchResult[] {
  const results = schemes
    .map((scheme) => calculateSchemeMatch(scheme, profile))
    .filter((r) => r.matchScore >= 40 && r.matchGrade !== 'Not Eligible');

  // Sort descending by match score, then popularity
  return results.sort((a, b) => {
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return (b.scheme.popularScore || 0) - (a.scheme.popularScore || 0);
  });
}

