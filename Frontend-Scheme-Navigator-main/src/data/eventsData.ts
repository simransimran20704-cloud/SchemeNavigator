export type EventCategory =
  | 'Healthcare & Ayushman'
  | 'Agriculture & Kisan Melas'
  | 'Jobs & Rojgar Melas'
  | 'Loans, MSME & Credit'
  | 'Education & Scholarships'
  | 'Aadhaar, e-KYC & Welfare';

export type EventStatus = 'active' | 'upcoming' | 'ongoing';

export interface WelfareEvent {
  id: string;
  title: string;
  hindiTitle?: string;
  category: EventCategory;
  state: string; // Specific state or 'All India'
  district: string; // Specific district or 'All Districts'
  cityOrBlock?: string;
  venue: string;
  landmark?: string;
  pincode?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  timing: string;
  organizer: string;
  departmentOrMinistry: string;
  badge: string;
  description: string;
  keyBenefits: string[];
  requiredDocuments: string[];
  targetBeneficiaries: string[];
  contactNumber?: string;
  officialPortalUrl?: string;
  isFreeEntry: boolean;
  latitude?: number;
  longitude?: number;
}

export const INDIAN_STATES_FOR_EVENTS = [
  'All India',
  'Andhra Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Delhi',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Tamil Nadu',
  'Telangana',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

export const EVENT_CATEGORIES: { id: string; label: string; hindiLabel: string; icon: string }[] = [
  { id: 'All', label: 'All Events', hindiLabel: 'सभी कार्यक्रम व शिविर', icon: 'Sparkles' },
  { id: 'Healthcare & Ayushman', label: 'Health & Ayushman Camps', hindiLabel: 'स्वास्थ्य एवं आयुष्मान शिविर', icon: 'HeartPulse' },
  { id: 'Agriculture & Kisan Melas', label: 'Farmer & Krishi Melas', hindiLabel: 'किसान एवं कृषि मेले', icon: 'Wheat' },
  { id: 'Jobs & Rojgar Melas', label: 'Job & Rojgar Melas', hindiLabel: 'रोजगार एवं अप्रेंटिसशिप मेले', icon: 'Briefcase' },
  { id: 'Loans, MSME & Credit', label: 'Mudra Loans & MSME Melas', hindiLabel: 'मुद्रा ऋण एवं व्यापार मेला', icon: 'BadgeIndianRupee' },
  { id: 'Education & Scholarships', label: 'Scholarships & Education', hindiLabel: 'छात्रवृत्ति एवं शिक्षा ड्राइव', icon: 'GraduationCap' },
  { id: 'Aadhaar, e-KYC & Welfare', label: 'Aadhaar & e-KYC Drives', hindiLabel: 'आधार एवं ई-केवाईसी शिविर', icon: 'Fingerprint' },
];

export const WELFARE_EVENTS_DATA: WelfareEvent[] = [
  // 1. Healthcare & Ayushman
  {
    id: 'evt-ayush-01',
    title: 'Ayushman Bharat Golden Card & Free Health Screening Mega Camp',
    hindiTitle: 'आयुष्मान भारत गोल्डन कार्ड निर्माण एवं निःशुल्क स्वास्थ्य जांच शिविर',
    category: 'Healthcare & Ayushman',
    state: 'Uttar Pradesh',
    district: 'Lucknow',
    cityOrBlock: 'Bakshi Ka Talab & Sarojini Nagar',
    venue: 'Community Health Centre (CHC) Campus, Sitapur Road',
    landmark: 'Near Tehsil Office, Bakshi Ka Talab',
    pincode: '226201',
    startDate: '2026-10-04',
    endDate: '2026-10-08',
    timing: '09:00 AM – 05:00 PM',
    organizer: 'National Health Authority (NHA) & UP State Health Agency',
    departmentOrMinistry: 'Ministry of Health & Family Welfare',
    badge: 'Free ₹5 Lakh Health Cover',
    description: 'Special on-spot verification and biometric issuance of Ayushman Vay Vandana & Golden Cards for eligible families. Instant free medical checkups, cataract screening, and medicine distribution.',
    keyBenefits: [
      'Instant Ayushman Golden Card generation & printout',
      'Free general health consultation, BP, diabetes and blood testing',
      'Senior Citizen Vay Vandana card priority registration (age 70+)',
      'Free generic medicine kit from Jan Aushadhi Kendra counter'
    ],
    requiredDocuments: [
      'Aadhaar Card (linked with mobile number for OTP)',
      'Ration Card / NFSA Family ID letter',
      '2 Passport size photographs',
      'Previous medical prescriptions (if any)'
    ],
    targetBeneficiaries: ['Low-income families', 'Senior Citizens (70+ yrs)', 'NFSA / SECC Ration Card holders'],
    contactNumber: '14555 / 1800-180-5145',
    officialPortalUrl: 'https://beneficiary.nha.gov.in',
    isFreeEntry: true,
    latitude: 26.9839,
    longitude: 80.9322,
  },
  {
    id: 'evt-ayush-02',
    title: 'PM Surakshit Matritva & Child Nutrition Mega Camp',
    hindiTitle: 'प्रधानमंत्री सुरक्षित मातृत्व अभियान एवं पोषण स्वास्थ्य शिविर',
    category: 'Healthcare & Ayushman',
    state: 'Rajasthan',
    district: 'Jaipur',
    cityOrBlock: 'Sanganer & Amer',
    venue: 'Sub-District Hospital Grounds, Tonk Road, Sanganer',
    landmark: 'Opposite Government Girls Senior Secondary School',
    pincode: '302029',
    startDate: '2026-10-05',
    endDate: '2026-10-09',
    timing: '09:30 AM – 04:30 PM',
    organizer: 'Department of Medical, Health & Family Welfare, Rajasthan',
    departmentOrMinistry: 'Ministry of Health & Family Welfare',
    badge: 'Maternal & Child Care',
    description: 'Comprehensive antenatal care, ultrasound vouchers, hemoglobin tests, and Pradhan Mantri Matru Vandana Yojana (PMMVY ₹5,000) spot bank account linkage.',
    keyBenefits: [
      'Free Specialist Obstetrician check-up & ultrasound diagnostic vouchers',
      'PMMVY direct bank DBT account verification for pregnant mothers',
      'Iron, Folic Acid & Calcium nutritional kits distribution',
      'Immunization & Polio booster drops for infants'
    ],
    requiredDocuments: [
      'Mother and Child Protection (MCP) Card',
      'Aadhaar Card of pregnant woman and spouse',
      'Bank passbook photocopy showing IFSC & Account No.'
    ],
    targetBeneficiaries: ['Pregnant women', 'Lactating mothers', 'Infants up to 2 years'],
    contactNumber: '104 / 108',
    officialPortalUrl: 'https://pmmvy.wcd.gov.in',
    isFreeEntry: true,
    latitude: 26.8202,
    longitude: 75.7873,
  },
  {
    id: 'evt-ayush-03',
    title: 'Divyangjan ADIP Free Tricycle, Hearing Aid & Wheelchair Camp',
    hindiTitle: 'दिव्यांगजन एडिप निःशुल्क सहायक उपकरण एवं व्हीलचेयर वितरण शिविर',
    category: 'Healthcare & Ayushman',
    state: 'Punjab',
    district: 'Ludhiana',
    cityOrBlock: 'Ludhiana Central',
    venue: 'Guru Nanak Stadium Indoor Complex, Club Road',
    landmark: 'Near District Courts Complex',
    pincode: '141001',
    startDate: '2026-10-06',
    endDate: '2026-10-09',
    timing: '10:00 AM – 05:00 PM',
    organizer: 'ALIMCO & Department of Social Security and Women & Child Development',
    departmentOrMinistry: 'Ministry of Social Justice & Empowerment',
    badge: '100% Free Assistive Devices',
    description: 'On-spot assessment and distribution of motorized tricycles, smart canes, digital hearing aids, artificial limbs, and wheelchairs for Persons with Benchmark Disabilities (PwD).',
    keyBenefits: [
      'Free motorized and battery-operated tricycles for eligible orthopedically challenged citizens',
      'Digital BTE hearing aids & Braille kits distribution',
      'On-the-spot UDID (Unique Disability ID) biometric application assistance',
      'Free prosthetic limb measurements'
    ],
    requiredDocuments: [
      'Disability Certificate showing 40% or more impairment (or UDID card)',
      'Aadhaar Card / Voter ID Card',
      'Income Certificate (monthly income less than ₹22,500)',
      '3 Passport-sized photographs showing the disability'
    ],
    targetBeneficiaries: ['Persons with Benchmark Disabilities (PwD)', 'Senior Citizens with locomotor/hearing issues'],
    contactNumber: '1800-180-5129',
    officialPortalUrl: 'https://www.alimco.in',
    isFreeEntry: true,
    latitude: 30.9010,
    longitude: 75.8573,
  },

  // 2. Agriculture & Kisan Melas
  {
    id: 'evt-kisan-01',
    title: 'PM-KISAN Samman Nidhi e-KYC, Land Seeding & DBT Resolution Camp',
    hindiTitle: 'पीएम-किसान सम्मान निधि ई-केवाईसी एवं भूलेख अंकन समाधान शिविर',
    category: 'Agriculture & Kisan Melas',
    state: 'Uttar Pradesh',
    district: 'Gorakhpur',
    cityOrBlock: 'Pipraich & Campierganj',
    venue: 'Krishi Vigyan Kendra (KVK) & Block Development Office',
    landmark: 'KVK Campus, Maharajganj Road',
    pincode: '273001',
    startDate: '2026-10-04',
    endDate: '2026-10-10',
    timing: '09:30 AM – 05:30 PM',
    organizer: 'Department of Agriculture, Government of Uttar Pradesh',
    departmentOrMinistry: 'Ministry of Agriculture & Farmers Welfare',
    badge: 'Instant ₹2,000 Installment Clearance',
    description: 'Resolve pending PM-KISAN installments, biometric e-KYC failures, Aadhaar NPCI bank account unlinking, and Khatauni land record seeding with Tehsildar and CSC staff present on spot.',
    keyBenefits: [
      'Instant biometric face/fingerprint e-KYC done within 2 minutes',
      'Land Record (Khatauni / Jamabandi) digital porting for stalled accounts',
      'NPCI Aadhaar-DBT bank seeding status verification',
      'New farmer registration for upcoming 19th and 20th installment cycles'
    ],
    requiredDocuments: [
      'Aadhaar Card with linked mobile',
      'Updated Land Khatauni / Jamabandi certified copy',
      'Bank passbook with Bank Account & IFSC code',
      'PM-KISAN Registration / Farmer ID number'
    ],
    targetBeneficiaries: ['Small & Marginal Farmers', 'Land-holding rural cultivators'],
    contactNumber: '155261 / 1800-115-526',
    officialPortalUrl: 'https://pmkisan.gov.in',
    isFreeEntry: true,
    latitude: 26.7606,
    longitude: 83.3732,
  },
  {
    id: 'evt-kisan-02',
    title: 'All India Krishi Darshan Expo & Agricultural Machinery Subsidy Mela',
    hindiTitle: 'अखिल भारतीय कृषि दर्शन मेला एवं कृषि यंत्र अनुदान शिविर',
    category: 'Agriculture & Kisan Melas',
    state: 'Haryana',
    district: 'Hisar',
    cityOrBlock: 'Hisar Rural',
    venue: 'Northern Region Farm Machinery Training & Testing Institute (NRFMTTI)',
    landmark: 'Tractor Nagar, Sirsa Road',
    pincode: '125001',
    startDate: '2026-10-07',
    endDate: '2026-10-11',
    timing: '09:00 AM – 06:00 PM',
    organizer: 'Ministry of Agriculture and Farmers Welfare (Govt of India)',
    departmentOrMinistry: 'Ministry of Agriculture & Farmers Welfare',
    badge: 'Up to 50% Machine Subsidy',
    description: 'Demonstration and spot subsidy token issuance for Super Seeder, Happy Seeder, solar pumps under PM-KUSUM, drip irrigation systems, and drone spray demonstrations.',
    keyBenefits: [
      'Spot application for PM-KUSUM 75% subsidized solar water pumps',
      '50% direct subsidy tokens for stubble management and tillage equipment',
      'Free certified wheat & mustard high-yielding seed mini-kits',
      'Soil Health Card rapid testing within 30 minutes'
    ],
    requiredDocuments: [
      'Meri Fasal Mera Byora / State Farmer Portal Registration slip',
      'Aadhaar Card and Parivar Pehchan Patra (PPP)',
      'Electricity connection bill or proof of tubewell',
      'Land Ownership Record (Fard / Jamabandi)'
    ],
    targetBeneficiaries: ['Farmers', 'Custom Hiring Centre (CHC) operators', 'FPO members'],
    contactNumber: '01662-276984',
    officialPortalUrl: 'https://agrimachinery.nic.in',
    isFreeEntry: true,
    latitude: 29.1492,
    longitude: 75.7217,
  },
  {
    id: 'evt-kisan-03',
    title: 'State Agri-Tech & Horticulture Subsidy Drive',
    hindiTitle: 'राज्य कृषि-तकनीक एवं बागवानी ड्रिप सिंचाई अनुदान ड्राइव',
    category: 'Agriculture & Kisan Melas',
    state: 'Maharashtra',
    district: 'Nashik',
    cityOrBlock: 'Panchavati & Niphad',
    venue: 'Krishi Vigyan Kendra, Yashwantrao Chavan Maharashtra Open University',
    landmark: 'Gangapur Road, Near Dugaon',
    pincode: '422222',
    startDate: '2026-10-06',
    endDate: '2026-10-09',
    timing: '10:00 AM – 05:00 PM',
    organizer: 'Maharashtra Agriculture Department & MahaDBT Cell',
    departmentOrMinistry: 'Department of Agriculture, Maharashtra',
    badge: 'MahaDBT Spot Approval',
    description: 'Fast-track lottery and spot allocation for micro-irrigation (sprinkler/drip), onion storage sheds (Kanda Chawl), and shade-net polyhouses under National Horticulture Mission.',
    keyBenefits: [
      'Direct on-spot verification of pending MahaDBT lottery allocations',
      'Free Soil organic carbon testing and crop advisory',
      'Weather-based crop insurance (PMFBY) claim redressal counter'
    ],
    requiredDocuments: [
      '7/12 (Saat Bara) and 8A extracts',
      'Aadhaar Card linked to Mobile',
      'Caste Certificate (for SC/ST enhanced subsidy of 70%)',
      'Bank passbook copy'
    ],
    targetBeneficiaries: ['Grape, Onion & Vegetable growers', 'Horticultural farmers'],
    contactNumber: '1800-120-8040',
    officialPortalUrl: 'https://mahadbt.maharashtra.gov.in',
    isFreeEntry: true,
    latitude: 19.9975,
    longitude: 73.7898,
  },

  // 3. Jobs & Rojgar Melas
  {
    id: 'evt-job-01',
    title: 'Pradhan Mantri National Apprenticeship & Rojgar Mela (PMNAM)',
    hindiTitle: 'प्रधानमंत्री राष्ट्रीय शिक्षुता एवं वृहद रोजगार मेला',
    category: 'Jobs & Rojgar Melas',
    state: 'Delhi',
    district: 'South West Delhi',
    cityOrBlock: 'Dwarka Sector 9',
    venue: 'Government Industrial Training Institute (ITI) Campus',
    landmark: 'Near Sector 9 Metro Station',
    pincode: '110077',
    startDate: '2026-10-04',
    endDate: '2026-10-07',
    timing: '09:00 AM – 05:00 PM',
    organizer: 'Directorate General of Training (DGT) & Ministry of Skill Development',
    departmentOrMinistry: 'Ministry of Skill Development & Entrepreneurship',
    badge: '80+ Hiring Companies',
    description: 'Mega hiring drive with 80+ top manufacturing, logistics, retail, and IT establishments conducting spot written tests and face-to-face interviews. Direct offer letters and apprenticeship stipends up to ₹16,500/month.',
    keyBenefits: [
      'Direct on-the-spot interviews and placement offers',
      'Government NAPS stipend subsidy credited directly to bank account',
      'National Apprenticeship Certificate (NAC) upon completion',
      'Free career counselling and CV enhancement kiosk'
    ],
    requiredDocuments: [
      '5 Hard Copies of updated Resume / CV',
      '10th / 12th / ITI / Diploma / Degree marksheets (original + 2 sets of photocopies)',
      'Aadhaar Card and PAN Card',
      '4 Passport-sized recent photographs'
    ],
    targetBeneficiaries: ['10th/12th Pass Candidates', 'ITI Diploma holders', 'Graduate Jobseekers (Age 18-35)'],
    contactNumber: '1800-123-9626',
    officialPortalUrl: 'https://www.apprenticeshipindia.gov.in',
    isFreeEntry: true,
    latitude: 28.5772,
    longitude: 77.0654,
  },
  {
    id: 'evt-job-02',
    title: 'State Employment Exchange Mega Job Fair & Youth Skill Drive',
    hindiTitle: 'राज्य सेवायोजन महा रोजगार मेला एवं युवा कौशल शिविर',
    category: 'Jobs & Rojgar Melas',
    state: 'Bihar',
    district: 'Patna',
    cityOrBlock: 'Kankarbagh & Gandhi Maidan',
    venue: 'Moin-ul-Haq Stadium Complex / Model Career Centre (MCC)',
    landmark: 'Rajendra Nagar, Near Bahadurpur Flyover',
    pincode: '800016',
    startDate: '2026-10-06',
    endDate: '2026-10-10',
    timing: '09:30 AM – 04:30 PM',
    organizer: 'Labour Resources Department, Government of Bihar',
    departmentOrMinistry: 'National Career Service (NCS)',
    badge: 'Spot Offer Letters',
    description: 'Over 5,000 vacancies across banking, healthcare, telecom, hospitality, and automobile sectors. National Career Service (NCS) portal instant jobseeker registration.',
    keyBenefits: [
      'Instant NCS Jobseeker ID registration card with QR code',
      'Walk-in interviews with 50+ multinational and regional employers',
      'Free enrollment into Mukhyamantri Nishchay Swayam Sahayata Bhatta (MNSSBY - ₹1,000/month allowance for 2 years)',
      'Free soft-skills and interview preparation mini-workshops'
    ],
    requiredDocuments: [
      'NCS Registration Slip (can be created on spot)',
      'Educational certificates (Matric onwards)',
      'Bihar Domicile / Residential Certificate (Niwas Praman Patra)',
      'Aadhaar Card & 4 photos'
    ],
    targetBeneficiaries: ['Unemployed youth aged 18 to 30 years', 'Technical & General graduates'],
    contactNumber: '1800-425-1514',
    officialPortalUrl: 'https://www.ncs.gov.in',
    isFreeEntry: true,
    latitude: 25.6022,
    longitude: 85.1611,
  },
  {
    id: 'evt-job-03',
    title: 'PM Vishwakarma Artisan Onboarding, Toolkit Grant & Certification Camp',
    hindiTitle: 'पीएम विश्वकर्मा शिल्पकार पंजीकरण, टूलकिट एवं निःशुल्क प्रमाण पत्र शिविर',
    category: 'Jobs & Rojgar Melas',
    state: 'Rajasthan',
    district: 'Jodhpur',
    cityOrBlock: 'Mandore & Industrial Area',
    venue: 'District Industries & Commerce Centre (DIC), New Power House Road',
    landmark: 'Near Shastri Nagar Circle',
    pincode: '342003',
    startDate: '2026-10-05',
    endDate: '2026-10-09',
    timing: '10:00 AM – 05:00 PM',
    organizer: 'Ministry of Micro, Small and Medium Enterprises (MSME)',
    departmentOrMinistry: 'Ministry of MSME',
    badge: '₹15,000 Free Modern Toolkit',
    description: 'Level-2 and Level-3 spot physical verification for 18 traditional artisan trades (Carpenters, Blacksmiths, Masons, Tailors, Cobblers, Potters). Receive ₹15,000 digital toolkit incentive and 5% interest collateral-free loan access.',
    keyBenefits: [
      'PM Vishwakarma Digital ID Certificate & Badge',
      '₹15,000 e-voucher for modern electronic toolkit purchase',
      '5-day basic training with ₹500/day daily stipend credited to bank',
      'Access to ₹1 Lakh (Tranche 1) and ₹2 Lakh (Tranche 2) loans at 5% interest'
    ],
    requiredDocuments: [
      'Aadhaar Card with biometric verification',
      'Active mobile number linked to Aadhaar',
      'Bank passbook details',
      'Proof of family trade occupation / Self-declaration form'
    ],
    targetBeneficiaries: ['Carpenters', 'Potters', 'Blacksmiths', 'Sculptors', 'Cobblers', 'Masons', 'Barbers', 'Tailors'],
    contactNumber: '1800-267-7777',
    officialPortalUrl: 'https://pmvishwakarma.gov.in',
    isFreeEntry: true,
    latitude: 26.2731,
    longitude: 73.0189,
  },

  // 4. Loans, MSME & Credit
  {
    id: 'evt-loan-01',
    title: 'PM Mudra & PM SVANidhi Street Vendor Spot Loan Sanction Mela',
    hindiTitle: 'पीएम मुद्रा एवं पीएम स्वनिधि ऋण स्वीकृति महाशिविर',
    category: 'Loans, MSME & Credit',
    state: 'Madhya Pradesh',
    district: 'Indore',
    cityOrBlock: 'Chhavani & Rajwada',
    venue: 'Municipal Corporation Convention Hall (Indore Nagar Nigam)',
    landmark: 'Near Nehru Stadium, Residency Area',
    pincode: '452001',
    startDate: '2026-10-04',
    endDate: '2026-10-08',
    timing: '10:00 AM – 05:30 PM',
    organizer: 'Lead District Bank (LDB), State Bank of India & Indore Municipal Corporation',
    departmentOrMinistry: 'Ministry of Finance & Ministry of Housing and Urban Affairs',
    badge: 'Collateral-Free Instant Loan',
    description: 'All public sector and rural banks gathered under one roof. Instant document verification and in-principle loan sanction for Shishu (up to ₹50,000), Kishore (up to ₹5 Lakh), Tarun (up to ₹10 Lakh), and SVANidhi (₹10,000 / ₹20,000 / ₹50,000) loans.',
    keyBenefits: [
      'Zero collateral or guarantor requirement for Mudra loans up to ₹10 Lakh',
      '7% interest subsidy & up to ₹1,200 annual cashback for digital UPI transactions under SVANidhi',
      'On-the-spot Mudra debit card issuance',
      'Spot Udyam Assist Certificate generation for micro-enterprises'
    ],
    requiredDocuments: [
      'Aadhaar Card and PAN Card (mandatory for loan processing)',
      'Urban Local Body Vendor ID / Vending Certificate (for SVANidhi applicants)',
      '6 Months Bank Statement',
      'Shop / Business address proof (Rent agreement or Electricity bill)'
    ],
    targetBeneficiaries: ['Street vendors', 'Hawkers', 'Small shopkeepers', 'Self-employed tradespersons'],
    contactNumber: '1800-180-1111',
    officialPortalUrl: 'https://pmsvanidhi.mohua.gov.in',
    isFreeEntry: true,
    latitude: 22.7196,
    longitude: 75.8577,
  },
  {
    id: 'evt-loan-02',
    title: 'PMEGP & Stand-Up India Youth Entrepreneurship Disbursement Camp',
    hindiTitle: 'पीएमईजीपी एवं स्टैंड-अप इंडिया उद्यमिता ऋण वितरण शिविर',
    category: 'Loans, MSME & Credit',
    state: 'Punjab',
    district: 'Amritsar',
    cityOrBlock: 'Ranjit Avenue',
    venue: 'Khadi & Village Industries Commission (KVIC) Regional Centre',
    landmark: 'Near Income Tax Colony, Court Road',
    pincode: '143001',
    startDate: '2026-10-08',
    endDate: '2026-10-12',
    timing: '10:00 AM – 04:30 PM',
    organizer: 'KVIC & Punjab State Industrial Development Corporation (PSIDC)',
    departmentOrMinistry: 'Ministry of MSME',
    badge: '35% Government Subsidy',
    description: 'Accelerated clearance for manufacturing projects up to ₹50 Lakh and service projects up to ₹20 Lakh. Special assistance for SC, ST, Women, and Ex-servicemen applicants.',
    keyBenefits: [
      'Up to 35% government capital subsidy on project cost',
      'Direct interview with Bank Branch Managers and General Managers of DIC',
      'Free preparation and vetting of Detailed Project Report (DPR)',
      'Mandatory EDP (Entrepreneurship Development Program) token generation'
    ],
    requiredDocuments: [
      'Detailed Project Profile / Business Plan outline',
      'Highest educational qualification certificate (minimum 8th pass for >₹10L projects)',
      'Special category / Caste certificate (if seeking 35% rural subsidy)',
      'PAN card and Aadhaar card'
    ],
    targetBeneficiaries: ['New entrepreneurs', 'Women entrepreneurs', 'Rural food processing & manufacturing units'],
    contactNumber: '1800-3000-0034',
    officialPortalUrl: 'https://www.kviconline.gov.in/pmegp',
    isFreeEntry: true,
    latitude: 31.6340,
    longitude: 74.8723,
  },

  // 5. Education & Scholarships
  {
    id: 'evt-edu-01',
    title: 'National Scholarship Portal (NSP) Biometric & Institute Verification Drive',
    hindiTitle: 'राष्ट्रीय छात्रवृत्ति पोर्टल (एनएसपी) बायोमेट्रिक प्रमाणीकरण महा-अभियान',
    category: 'Education & Scholarships',
    state: 'West Bengal',
    district: 'Kolkata',
    cityOrBlock: 'Bidhannagar (Salt Lake) & Central Kolkata',
    venue: 'Bikash Bhavan Campus, Higher Education Council Complex',
    landmark: 'Salt Lake Sector 1, Near Karunamoyee',
    pincode: '700091',
    startDate: '2026-10-04',
    endDate: '2026-10-09',
    timing: '10:00 AM – 05:00 PM',
    organizer: 'National Scholarship Division & State Directorate of School/Higher Education',
    departmentOrMinistry: 'Ministry of Electronics and Information Technology (MeitY)',
    badge: 'Avoid Scholarship Cancellation',
    description: 'Mandatory Aadhaar facial and fingerprint biometric authentication camp for students who applied for Post-Matric, Pre-Matric, NMMS, and Central Sector Scheme scholarships. Institute Nodal Officers (INO) counters available.',
    keyBenefits: [
      'Completion of mandatory e-KYC requirement to avoid scholarship cancellation',
      'Direct resolution of "Defective / Pending at Institute" application errors',
      'NPCI Aadhaar-seeded bank account check for prompt Direct Benefit Transfer',
      'Scholarships disbursed ranges from ₹12,000 to ₹75,000 per academic year'
    ],
    requiredDocuments: [
      'NSP Application ID and registered mobile number',
      'Student Aadhaar Card (physical card or e-Aadhaar print)',
      'College / School Identity Card / Bonafide Certificate',
      'Student Savings Bank Passbook copy (must be in student name)'
    ],
    targetBeneficiaries: ['College & University students', 'School students (Classes 9 to 12)', 'Scholarship applicants'],
    contactNumber: '0120-6619540',
    officialPortalUrl: 'https://scholarships.gov.in',
    isFreeEntry: true,
    latitude: 22.5855,
    longitude: 88.4187,
  },
  {
    id: 'evt-edu-02',
    title: 'SC/ST/OBC Post-Matric Fee Reimbursement & Scholarship Camp',
    hindiTitle: 'अनुसूचित जाति/जनजाति/पिछड़ा वर्ग छात्रवृत्ति एवं शुल्क प्रतिपूर्ति शिविर',
    category: 'Education & Scholarships',
    state: 'Karnataka',
    district: 'Bengaluru Urban',
    cityOrBlock: 'Sheshadripuram & Majestic',
    venue: 'Social Welfare Department Auditorium, MS Building Complex',
    landmark: 'Near Dr. B.R. Ambedkar Veedhi, Vidhana Soudha',
    pincode: '560001',
    startDate: '2026-10-06',
    endDate: '2026-10-10',
    timing: '09:30 AM – 04:30 PM',
    organizer: 'Social Welfare Department, Government of Karnataka',
    departmentOrMinistry: 'State Scholarship Portal (SSP)',
    badge: '100% Tuition Fee Refund',
    description: 'On-spot e-Attestation and clearance for state and central scholarship portals. Social Welfare Officers clearing pending caste, income, and university enrollment validations.',
    keyBenefits: [
      '100% college tuition fee reimbursement clearance',
      'Maintenance and hostel allowance credit sanction (up to ₹1,200/month)',
      'Kutumba ID and Ration Card mapping with SSP database'
    ],
    requiredDocuments: [
      'Valid Caste Certificate with RD Number (Revenue Department)',
      'Income Certificate (Family income ceiling as per category)',
      'College Fee Receipt and Admission Letter',
      'Aadhaar Card'
    ],
    targetBeneficiaries: ['SC / ST / OBC / Minorities pursuing Diploma, Degree, Medical, Engineering courses'],
    contactNumber: '1902 / 080-35254757',
    officialPortalUrl: 'https://ssp.postmatric.karnataka.gov.in',
    isFreeEntry: true,
    latitude: 12.9792,
    longitude: 77.5907,
  },

  // 6. Aadhaar, e-KYC & Welfare
  {
    id: 'evt-aadhaar-01',
    title: 'Aadhaar Biometric Update, Mandatory Child Biometric & e-KYC Mega Drive',
    hindiTitle: 'आधार बायोमेट्रिक अपडेशन, अनिवार्य बाल आधार एवं ई-केवाईसी महाअभियान',
    category: 'Aadhaar, e-KYC & Welfare',
    state: 'Delhi',
    district: 'North Delhi',
    cityOrBlock: 'Civil Lines & Model Town',
    venue: 'District Magistrate Complex, 1 Kripa Narain Marg, Alipur Road',
    landmark: 'Near Civil Lines Metro Station Gate 2',
    pincode: '110054',
    startDate: '2026-10-04',
    endDate: '2026-10-11',
    timing: '08:30 AM – 06:00 PM',
    organizer: 'Unique Identification Authority of India (UIDAI) & Revenue Department',
    departmentOrMinistry: 'Ministry of Electronics & Information Technology',
    badge: 'Mandatory Free Child Update (5 & 15 Yrs)',
    description: '10 Aadhaar update kits deployed. Free mandatory biometric updates for children who completed 5 or 15 years. Free document updates for Aadhaar cards issued over 10 years ago to keep government benefits active.',
    keyBenefits: [
      '100% Free mandatory biometric update for age 5 to 7 and 15 to 17',
      'Free Proof of Identity (PoI) and Proof of Address (PoA) document renewal',
      'Mobile number and email linking in Aadhaar database within 24 hours',
      'Restoration of suspended welfare pensions and ration card benefits'
    ],
    requiredDocuments: [
      'Original Aadhaar card or 12-digit Aadhaar number',
      'Birth Certificate (for children biometric update)',
      'Any 1 Proof of Address (Electricity bill, Voter ID, Ration Card, Bank Passbook)',
      'Parent Aadhaar card (in case of minors)'
    ],
    targetBeneficiaries: ['All citizens', 'School students aged 5 to 17', 'Holders of >10 year old Aadhaar cards'],
    contactNumber: '1947',
    officialPortalUrl: 'https://myaadhaar.uidai.gov.in',
    isFreeEntry: true,
    latitude: 28.6756,
    longitude: 77.2255,
  },
  {
    id: 'evt-aadhaar-02',
    title: 'Antyodaya & Priority Ration Card e-KYC & Annapurna Grain Drive',
    hindiTitle: 'अंत्योदय एवं प्राथमिकता राशन कार्ड ई-केवाईसी व अन्नपूर्णा शिविर',
    category: 'Aadhaar, e-KYC & Welfare',
    state: 'Gujarat',
    district: 'Ahmedabad',
    cityOrBlock: 'Maninagar & Vatva',
    venue: 'Zonal Food & Civil Supplies Office, Near Kankaria Lake',
    landmark: 'Opposite Football Ground, Maninagar',
    pincode: '380008',
    startDate: '2026-10-05',
    endDate: '2026-10-09',
    timing: '09:00 AM – 05:00 PM',
    organizer: 'Food, Civil Supplies & Consumer Affairs Department, Gujarat',
    departmentOrMinistry: 'Ministry of Consumer Affairs, Food & Public Distribution',
    badge: 'Protect Monthly Free Ration',
    description: 'Mandatory POS machine e-KYC for all family members listed on Ration Card under One Nation One Ration Card (ONORC). Addition of newborn children and daughter-in-law names in ration cards.',
    keyBenefits: [
      'Prevention of ration card suspension / family member name deletion',
      'Addition of newly married women and infant names with minimal paperwork',
      'Inter-state portability card activation for migrant workers',
      'Continued free grain distribution under Pradhan Mantri Garib Kalyan Anna Yojana (PMGKAY)'
    ],
    requiredDocuments: [
      'Original Digital Ration Card booklet',
      'Aadhaar cards of ALL family members listed on the card',
      'Birth Certificate (if adding newborn)',
      'Marriage Certificate / Domicile proof (if adding new bride)'
    ],
    targetBeneficiaries: ['NFSA card holders', 'BPL & Antyodaya families', 'Migrant labourers'],
    contactNumber: '1967 / 1800-233-5500',
    officialPortalUrl: 'https://nfsa.gov.in',
    isFreeEntry: true,
    latitude: 23.0039,
    longitude: 72.6006,
  },
  {
    id: 'evt-aadhaar-03',
    title: 'E-Shram & Building Worker (BOCW) Registration & Health Card Camp',
    hindiTitle: 'ई-श्रम एवं भवन निर्माण कर्मकार (बीओसीडब्ल्यू) पंजीयन व स्वास्थ्य कार्ड शिविर',
    category: 'Aadhaar, e-KYC & Welfare',
    state: 'Uttar Pradesh',
    district: 'Varanasi',
    cityOrBlock: 'Shivpur & Sigra',
    venue: 'Labour Welfare Centre & District Sports Ground',
    landmark: 'Near Sigra Stadium, Vidyapeeth Road',
    pincode: '221002',
    startDate: '2026-10-06',
    endDate: '2026-10-10',
    timing: '09:30 AM – 05:00 PM',
    organizer: 'Uttar Pradesh Building & Other Construction Workers Board (BOCW)',
    departmentOrMinistry: 'Ministry of Labour & Employment',
    badge: '₹2 Lakh Accidental Insurance',
    description: 'Spot issuance of plastic e-Shram UAN Cards and BOCW labour welfare registration. Eligible workers get access to daughter marriage grant (₹51,000), cycle subsidy, and pension schemes.',
    keyBenefits: [
      'Instant e-Shram plastic card with 12-digit UAN number',
      'Free ₹2,00,000 PMSBY Accidental Death Insurance cover',
      'Spot enrollment into Shramik Shiksha Sahayata & Medhavi Chhatra Yojana',
      'Maternity and infant healthcare cash assistance enrollment'
    ],
    requiredDocuments: [
      'Aadhaar Card (must be linked to bank account)',
      'Bank passbook showing account number and IFSC',
      'Self-declaration of 90 days work as construction / unorganised worker',
      '2 Passport size photos'
    ],
    targetBeneficiaries: ['Construction workers', 'Painters', 'Plumbers', 'Domestic workers', 'Street vendors', 'Agri-labourers'],
    contactNumber: '14434',
    officialPortalUrl: 'https://eshram.gov.in',
    isFreeEntry: true,
    latitude: 25.3176,
    longitude: 82.9739,
  }
];

// Helper to filter events based on criteria
export interface EventFilterOptions {
  state?: string;
  district?: string;
  category?: string;
  searchQuery?: string;
  timeframe?: 'all' | 'today' | 'this_week' | 'upcoming';
}

export function filterWelfareEvents(
  events: WelfareEvent[],
  options: EventFilterOptions
): WelfareEvent[] {
  const { state, district, category, searchQuery, timeframe } = options;
  const todayStr = '2026-10-04'; // Based on current runtime context

  return events.filter((evt) => {
    // 1. State filter
    if (state && state !== 'All' && state !== 'All India') {
      if (evt.state !== 'All India' && evt.state.toLowerCase() !== state.toLowerCase()) {
        return false;
      }
    }

    // 2. District filter
    if (district && district !== 'All' && district !== 'All Districts') {
      if (
        evt.district !== 'All Districts' &&
        !evt.district.toLowerCase().includes(district.toLowerCase())
      ) {
        return false;
      }
    }

    // 3. Category filter
    if (category && category !== 'All') {
      if (evt.category !== category) {
        return false;
      }
    }

    // 4. Search query
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const match =
        evt.title.toLowerCase().includes(q) ||
        (evt.hindiTitle && evt.hindiTitle.toLowerCase().includes(q)) ||
        evt.district.toLowerCase().includes(q) ||
        evt.state.toLowerCase().includes(q) ||
        evt.venue.toLowerCase().includes(q) ||
        evt.organizer.toLowerCase().includes(q) ||
        evt.description.toLowerCase().includes(q) ||
        evt.badge.toLowerCase().includes(q) ||
        (evt.pincode && evt.pincode.includes(q));
      if (!match) return false;
    }

    // 5. Timeframe filter
    if (timeframe && timeframe !== 'all') {
      if (timeframe === 'today') {
        const isToday = evt.startDate <= todayStr && evt.endDate >= todayStr;
        if (!isToday) return false;
      } else if (timeframe === 'this_week') {
        // e.g. within 7 days
        const isOngoingOrThisWeek = evt.endDate >= todayStr;
        if (!isOngoingOrThisWeek) return false;
      } else if (timeframe === 'upcoming') {
        if (evt.startDate < todayStr) return false;
      }
    }

    return true;
  });
}

/**
 * Generate a direct Google Calendar creation link with all event metadata pre-populated.
 */
export function generateGoogleCalendarUrl(evt: WelfareEvent): string {
  const cleanStartDate = evt.startDate.replace(/-/g, '');
  const cleanEndDate = evt.endDate.replace(/-/g, '');
  const dates = `${cleanStartDate}T040000Z/${cleanEndDate}T120000Z`;
  
  const title = encodeURIComponent(`[Govt Camp] ${evt.title}`);
  const details = encodeURIComponent(
    `${evt.description}\n\nKey Benefits:\n${evt.keyBenefits.map(b => `• ${b}`).join('\n')}\n\nDocuments to Bring:\n${evt.requiredDocuments.map(d => `• ${d}`).join('\n')}\n\nOrganizer: ${evt.organizer}\nHelpline: ${evt.contactNumber || '14555'}`
  );
  const location = encodeURIComponent(`${evt.venue}, ${evt.district}, ${evt.state} - ${evt.pincode || ''}`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
}

/**
 * Generate Google Maps navigation link
 */
export function generateGoogleMapsDirectionsUrl(evt: WelfareEvent): string {
  if (evt.latitude && evt.longitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${evt.latitude},${evt.longitude}`;
  }
  const query = encodeURIComponent(`${evt.venue}, ${evt.district}, ${evt.state} ${evt.pincode || ''}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * Generate WhatsApp share text & link
 */
export function generateWhatsAppShareUrl(evt: WelfareEvent): string {
  const message = `📢 *सरकारी कल्याणकारी शिविर की सूचना (Government Welfare Camp)* 📢\n\n📌 *${evt.title}*\n🗓️ *दिनांक (Date):* ${evt.startDate} से ${evt.endDate}\n⏰ *समय (Time):* ${evt.timing}\n📍 *स्थान (Venue):* ${evt.venue}, ${evt.district}, ${evt.state} (${evt.pincode || ''})\n\n✨ *विशेष लाभ (Benefits):*\n${evt.keyBenefits.map(b => `✓ ${b}`).join('\n')}\n\n📄 *साथ ले जाने वाले दस्तावेज (Documents Needed):*\n${evt.requiredDocuments.map(d => `• ${d}`).join('\n')}\n\nअधिक जानकारी और पोर्टल: ${evt.officialPortalUrl || 'https://schemenavigator.gov.in'}\n(SchemeNavigator से साझा किया गया)`;
  
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}
