/**
 * Comprehensive Name Transliterator for Indic Languages
 * Transliterates Indian names (e.g. "Simran", "Rahul", "Priya") into 11 Indic scripts + English.
 */

export const NAME_DICTIONARY: Record<string, Record<string, string>> = {
  simran: {
    'or-IN': 'ସିମରନ୍',
    'te-IN': 'సిమ్రాన్',
    'hi-IN': 'सिमरन',
    'bn-IN': 'সিমরান',
    'pa-IN': 'ਸਿਮਰਨ',
    'ur-IN': 'سِمرن',
    'ta-IN': 'சிம்ரன்',
    'kn-IN': 'ಸಿಮ್ರಾನ್',
    'ml-IN': 'സിമ്രാൻ',
    'mr-IN': 'सिमरन',
    'gu-IN': 'સિમરન',
    'en-IN': 'Simran',
  },
  rahul: {
    'or-IN': 'ରାହୁଲ',
    'te-IN': 'రాహుల్',
    'hi-IN': 'राहुल',
    'bn-IN': 'রাহুল',
    'pa-IN': 'ਰਾਹੁਲ',
    'ur-IN': 'راہل',
    'ta-IN': 'ராகுல்',
    'kn-IN': 'ರಾಹುಲ್',
    'ml-IN': 'രാഹുൽ',
    'mr-IN': 'राहुल',
    'gu-IN': 'રાહુલ',
    'en-IN': 'Rahul',
  },
  priya: {
    'or-IN': 'ପ୍ରିୟା',
    'te-IN': 'ప్రియా',
    'hi-IN': 'प्रिया',
    'bn-IN': 'প্রিয়া',
    'pa-IN': 'ਪ੍ਰਿਆ',
    'ur-IN': 'پریا',
    'ta-IN': 'பிரியா',
    'kn-IN': 'ಪ್ರಿಯಾ',
    'ml-IN': 'പ്രിയ',
    'mr-IN': 'प्रिया',
    'gu-IN': 'પ્રિયા',
    'en-IN': 'Priya',
  },
  amit: {
    'or-IN': 'ଅମିତ',
    'te-IN': 'అమిత్',
    'hi-IN': 'अमित',
    'bn-IN': 'অমিত',
    'pa-IN': 'ਅਮਿਤ',
    'ur-IN': 'امت',
    'ta-IN': 'அமித்',
    'kn-IN': 'ಅಮಿತ್',
    'ml-IN': 'അമിത്',
    'mr-IN': 'अमित',
    'gu-IN': 'અમિત',
    'en-IN': 'Amit',
  },
  pooja: {
    'or-IN': 'ପୂଜା',
    'te-IN': 'పూజా',
    'hi-IN': 'पूजा',
    'bn-IN': 'পূজা',
    'pa-IN': 'ਪੂਜਾ',
    'ur-IN': 'پوجا',
    'ta-IN': 'பூஜா',
    'kn-IN': 'ಪೂಜಾ',
    'ml-IN': 'പൂജ',
    'mr-IN': 'पूजा',
    'gu-IN': 'પૂજા',
    'en-IN': 'Pooja',
  },
  rohit: {
    'or-IN': 'ରୋହିତ',
    'te-IN': 'రోహిత్',
    'hi-IN': 'रोहित',
    'bn-IN': 'রোহিত',
    'pa-IN': 'ਰੋਹਿਤ',
    'ur-IN': 'روہت',
    'ta-IN': 'ரோஹித்',
    'kn-IN': 'ರೋಹಿತ್',
    'ml-IN': 'രോഹിത്',
    'mr-IN': 'रोहित',
    'gu-IN': 'રોહિત',
    'en-IN': 'Rohit',
  },
  neha: {
    'or-IN': 'ନେହା',
    'te-IN': 'నేహా',
    'hi-IN': 'नेहा',
    'bn-IN': 'নেহা',
    'pa-IN': 'ਨੇਹਾ',
    'ur-IN': 'نیہا',
    'ta-IN': 'நேகா',
    'kn-IN': 'ನೇಹಾ',
    'ml-IN': 'നേഹ',
    'mr-IN': 'नेहा',
    'gu-IN': 'નેહા',
    'en-IN': 'Neha',
  },
  deepak: {
    'or-IN': 'ଦୀପକ',
    'te-IN': 'దీపక్',
    'hi-IN': 'दीपक',
    'bn-IN': 'দীপক',
    'pa-IN': 'ਦੀਪਕ',
    'ur-IN': 'دیپک',
    'ta-IN': 'தீபக்',
    'kn-IN': 'ದೀಪಕ್',
    'ml-IN': 'ദീപക്',
    'mr-IN': 'दीपक',
    'gu-IN': 'દીપક',
    'en-IN': 'Deepak',
  },
  sunil: {
    'or-IN': 'ସୁନୀଲ',
    'te-IN': 'సునీల్',
    'hi-IN': 'सुनील',
    'bn-IN': 'সুনীল',
    'pa-IN': 'ਸੁਨੀਲ',
    'ur-IN': 'سنیل',
    'ta-IN': 'சுனில்',
    'kn-IN': 'ಸುನೀಲ್',
    'ml-IN': 'സുനിൽ',
    'mr-IN': 'सुनील',
    'gu-IN': 'સુનીલ',
    'en-IN': 'Sunil',
  },
  suresh: {
    'or-IN': 'ସୁରେଶ',
    'te-IN': 'సురేష్',
    'hi-IN': 'सुरेश',
    'bn-IN': 'সুরেশ',
    'pa-IN': 'ਸੁਰੇਸ਼',
    'ur-IN': 'سریش',
    'ta-IN': 'சுரேஷ்',
    'kn-IN': 'ಸುರೇಶ್',
    'ml-IN': 'സുരേഷ്',
    'mr-IN': 'सुरेश',
    'gu-IN': 'સુરેશ',
    'en-IN': 'Suresh',
  },
  ramesh: {
    'or-IN': 'ରମେଶ',
    'te-IN': 'రమేష్',
    'hi-IN': 'रमेश',
    'bn-IN': 'রমেশ',
    'pa-IN': 'ਰਮੇਸ਼',
    'ur-IN': 'رمیش',
    'ta-IN': 'ரமேஷ்',
    'kn-IN': 'ರಮೇಶ್',
    'ml-IN': 'രമേഷ്',
    'mr-IN': 'रमेश',
    'gu-IN': 'રમેશ',
    'en-IN': 'Ramesh',
  },
  vikram: {
    'or-IN': 'ବିକ୍ରମ',
    'te-IN': 'విక్రమ్',
    'hi-IN': 'विक्रम',
    'bn-IN': 'বিক্রম',
    'pa-IN': 'ਵਿਕਰਮ',
    'ur-IN': 'وکرم',
    'ta-IN': 'விக்ரம்',
    'kn-IN': 'ವಿಕ್ರಮ್',
    'ml-IN': 'വിക്രം',
    'mr-IN': 'विक्रम',
    'gu-IN': 'વિક્રમ',
    'en-IN': 'Vikram',
  },
  karan: {
    'or-IN': 'କରଣ',
    'te-IN': 'కరణ్',
    'hi-IN': 'करण',
    'bn-IN': 'করণ',
    'pa-IN': 'ਕਰਨ',
    'ur-IN': 'کرن',
    'ta-IN': 'கரண்',
    'kn-IN': 'ಕರಣ್',
    'ml-IN': 'കരൺ',
    'mr-IN': 'करण',
    'gu-IN': 'કરણ',
    'en-IN': 'Karan',
  },
  arjun: {
    'or-IN': 'ଅର୍ଜୁନ',
    'te-IN': 'అర్జున్',
    'hi-IN': 'अर्जुन',
    'bn-IN': 'অর্জুন',
    'pa-IN': 'ਅਰਜੁਨ',
    'ur-IN': 'ارجن',
    'ta-IN': 'அர்ஜுன்',
    'kn-IN': 'ಅರ್ಜುನ್',
    'ml-IN': 'അർജുൻ',
    'mr-IN': 'अर्जुन',
    'gu-IN': 'અર્જુન',
    'en-IN': 'Arjun',
  },
  aman: {
    'or-IN': 'ଅମନ',
    'te-IN': 'అమన్',
    'hi-IN': 'अमन',
    'bn-IN': 'আমন',
    'pa-IN': 'ਅਮਨ',
    'ur-IN': 'امان',
    'ta-IN': 'அமன்',
    'kn-IN': 'ಅಮನ್',
    'ml-IN': 'അമൻ',
    'mr-IN': 'अमन',
    'gu-IN': 'અમન',
    'en-IN': 'Aman',
  },
  kunal: {
    'or-IN': 'କୁନାଲ',
    'te-IN': 'కునాల్',
    'hi-IN': 'कुणाल',
    'bn-IN': 'কুণাল',
    'pa-IN': 'ਕੁਨਾਲ',
    'ur-IN': 'کنال',
    'ta-IN': 'குணால்',
    'kn-IN': 'ಕುಣಾಲ್',
    'ml-IN': 'കുണാൽ',
    'mr-IN': 'कुणाल',
    'gu-IN': 'કુણાલ',
    'en-IN': 'Kunal',
  },
  vikas: {
    'or-IN': 'ବିକାଶ',
    'te-IN': 'వికాస్',
    'hi-IN': 'विकास',
    'bn-IN': 'বিকাশ',
    'pa-IN': 'ਵਿਕਾਸ',
    'ur-IN': 'وکاس',
    'ta-IN': 'விகாஸ்',
    'kn-IN': 'ವಿಕಾಸ್',
    'ml-IN': 'വികാസ്',
    'mr-IN': 'विकास',
    'gu-IN': 'વિકાસ',
    'en-IN': 'Vikas',
  },
  sanjay: {
    'or-IN': 'ସଞ୍ଜୟ',
    'te-IN': 'సంజయ్',
    'hi-IN': 'संजय',
    'bn-IN': 'সঞ্জয়',
    'pa-IN': 'ਸੰਜੇ',
    'ur-IN': 'سنجے',
    'ta-IN': 'சஞ்சய்',
    'kn-IN': 'ಸಂಜಯ್',
    'ml-IN': 'സഞ്ജയ്',
    'mr-IN': 'संजय',
    'gu-IN': 'સંજય',
    'en-IN': 'Sanjay',
  },
  ajay: {
    'or-IN': 'ଅଜୟ',
    'te-IN': 'అజయ్',
    'hi-IN': 'अजय',
    'bn-IN': 'অজয়',
    'pa-IN': 'ਅਜੈ',
    'ur-IN': 'اجے',
    'ta-IN': 'அஜய்',
    'kn-IN': 'ಅಜಯ್',
    'ml-IN': 'അജയ്',
    'mr-IN': 'अजय',
    'gu-IN': 'અજય',
    'en-IN': 'Ajay',
  },
  vijay: {
    'or-IN': 'ବିଜୟ',
    'te-IN': 'విజయ్',
    'hi-IN': 'विजय',
    'bn-IN': 'বিজয়',
    'pa-IN': 'ਵਿਜੈ',
    'ur-IN': 'وجے',
    'ta-IN': 'விஜய்',
    'kn-IN': 'ವಿಜಯ್',
    'ml-IN': 'വിജയ്',
    'mr-IN': 'विजय',
    'gu-IN': 'વિજય',
    'en-IN': 'Vijay',
  },
  anita: {
    'or-IN': 'ଅନିତା',
    'te-IN': 'అనిత',
    'hi-IN': 'अनिता',
    'bn-IN': 'অনিতা',
    'pa-IN': 'ਅਨੀਤਾ',
    'ur-IN': 'انیتا',
    'ta-IN': 'அனிதா',
    'kn-IN': 'ಅನಿತಾ',
    'ml-IN': 'അനിത',
    'mr-IN': 'अनिता',
    'gu-IN': 'અનિતા',
    'en-IN': 'Anita',
  },
  kavita: {
    'or-IN': 'କବିତା',
    'te-IN': 'కవిత',
    'hi-IN': 'कविता',
    'bn-IN': 'কবিতা',
    'pa-IN': 'ਕਵਿਤਾ',
    'ur-IN': 'کویتا',
    'ta-IN': 'கவிதா',
    'kn-IN': 'ಕವಿತಾ',
    'ml-IN': 'കവിത',
    'mr-IN': 'कविता',
    'gu-IN': 'કવિતા',
    'en-IN': 'Kavita',
  },
  geeta: {
    'or-IN': 'ଗୀତା',
    'te-IN': 'గీత',
    'hi-IN': 'गीता',
    'bn-IN': 'গীতা',
    'pa-IN': 'ਗੀਤਾ',
    'ur-IN': 'گیتا',
    'ta-IN': 'கீதா',
    'kn-IN': 'ಗೀತಾ',
    'ml-IN': 'ഗീത',
    'mr-IN': 'गीता',
    'gu-IN': 'ગીતા',
    'en-IN': 'Geeta',
  },
  sunita: {
    'or-IN': 'ସୁନୀତା',
    'te-IN': 'సునీత',
    'hi-IN': 'सुनीता',
    'bn-IN': 'সুনীতা',
    'pa-IN': 'ਸੁਨੀਤਾ',
    'ur-IN': 'سنیتا',
    'ta-IN': 'சுனிதா',
    'kn-IN': 'ಸುನೀತಾ',
    'ml-IN': 'സുനിത',
    'mr-IN': 'सुनीता',
    'gu-IN': 'સુનીતા',
    'en-IN': 'Sunita',
  },
  rekha: {
    'or-IN': 'ରେଖା',
    'te-IN': 'రేఖ',
    'hi-IN': 'रेखा',
    'bn-IN': 'রেখা',
    'pa-IN': 'ਰੇਖਾ',
    'ur-IN': 'ریکھا',
    'ta-IN': 'ரேகா',
    'kn-IN': 'ರೇಖಾ',
    'ml-IN': 'രേഖ',
    'mr-IN': 'रेखा',
    'gu-IN': 'રેખા',
    'en-IN': 'Rekha',
  },
  singh: {
    'or-IN': 'ସିଂ',
    'te-IN': 'సింగ్',
    'hi-IN': 'सिंह',
    'bn-IN': 'সিংহ',
    'pa-IN': 'ਸਿੰਘ',
    'ur-IN': 'سنگھ',
    'ta-IN': 'சிங்',
    'kn-IN': 'ಸಿಂಗ್',
    'ml-IN': 'സിങ്',
    'mr-IN': 'सिंह',
    'gu-IN': 'સિંહ',
    'en-IN': 'Singh',
  },
  kumar: {
    'or-IN': 'କୁମାର',
    'te-IN': 'కుమార్',
    'hi-IN': 'कुमार',
    'bn-IN': 'কুমার',
    'pa-IN': 'ਕੁਮਾਰ',
    'ur-IN': 'کمار',
    'ta-IN': 'குமார்',
    'kn-IN': 'ಕುಮಾರ್',
    'ml-IN': 'കുമാർ',
    'mr-IN': 'कुमार',
    'gu-IN': 'કુમાર',
    'en-IN': 'Kumar',
  },
  sharma: {
    'or-IN': 'ଶର୍ମା',
    'te-IN': 'శర్మ',
    'hi-IN': 'शर्मा',
    'bn-IN': 'শর্মা',
    'pa-IN': 'ਸ਼ਰਮਾ',
    'ur-IN': 'شرما',
    'ta-IN': 'சர்மா',
    'kn-IN': 'ಶರ್ಮಾ',
    'ml-IN': 'ശർമ്മ',
    'mr-IN': 'शर्मा',
    'gu-IN': 'શર્મા',
    'en-IN': 'Sharma',
  },
  verma: {
    'or-IN': 'ବର୍ମା',
    'te-IN': 'వర్మ',
    'hi-IN': 'वर्मा',
    'bn-IN': 'বর্মা',
    'pa-IN': 'ਵਰਮਾ',
    'ur-IN': 'ورما',
    'ta-IN': 'வர்மா',
    'kn-IN': 'ವರ್ಮಾ',
    'ml-IN': 'വർമ്മ',
    'mr-IN': 'वर्मा',
    'gu-IN': 'વર્મા',
    'en-IN': 'Verma',
  },
  kaur: {
    'or-IN': 'କୌର',
    'te-IN': 'కౌర్',
    'hi-IN': 'कौर',
    'bn-IN': 'কৌর',
    'pa-IN': 'ਕੌਰ',
    'ur-IN': 'کور',
    'ta-IN': 'கௌர்',
    'kn-IN': 'ಕೌರ್',
    'ml-IN': 'കൗർ',
    'mr-IN': 'कौर',
    'gu-IN': 'કૌર',
    'en-IN': 'Kaur',
  },
  patel: {
    'or-IN': 'ପଟେଲ',
    'te-IN': 'పటేల్',
    'hi-IN': 'पटेल',
    'bn-IN': 'প্যাটেল',
    'pa-IN': 'ਪਟੇਲ',
    'ur-IN': 'پٹیل',
    'ta-IN': 'படேல்',
    'kn-IN': 'ಪಟೇಲ್',
    'ml-IN': 'പട്ടേൽ',
    'mr-IN': 'पटेल',
    'gu-IN': 'પટેલ',
    'en-IN': 'Patel',
  },
  gupta: {
    'or-IN': 'ଗୁପ୍ତା',
    'te-IN': 'గుప్తా',
    'hi-IN': 'गुप्ता',
    'bn-IN': 'গুপ্তা',
    'pa-IN': 'ਗੁਪਤਾ',
    'ur-IN': 'گپتا',
    'ta-IN': 'குப்தா',
    'kn-IN': 'ಗುಪ್ತಾ',
    'ml-IN': 'ഗുപ്ത',
    'mr-IN': 'गुप्ता',
    'gu-IN': 'ગુપ્તા',
    'en-IN': 'Gupta',
  },
  user: {
    'or-IN': 'ନାଗରିକ',
    'te-IN': 'పౌరుడు',
    'hi-IN': 'नागरिक',
    'bn-IN': 'নাগরিক',
    'pa-IN': 'ਨਾਗਰਿਕ',
    'ur-IN': 'شہری',
    'ta-IN': 'குடிமகன்',
    'kn-IN': 'ನಾಗರಿಕ',
    'ml-IN': 'പൗരൻ',
    'mr-IN': 'नागरिक',
    'gu-IN': 'નાગરિક',
    'en-IN': 'Citizen',
  },
  citizen: {
    'or-IN': 'ନାଗରିକ',
    'te-IN': 'పౌరుడు',
    'hi-IN': 'नागरिक',
    'bn-IN': 'নাগরিক',
    'pa-IN': 'ਨਾਗਰਿਕ',
    'ur-IN': 'شہری',
    'ta-IN': 'குடிமகன்',
    'kn-IN': 'ನಾಗರಿಕ',
    'ml-IN': 'പൗരൻ',
    'mr-IN': 'नागरिक',
    'gu-IN': 'નાગરિક',
    'en-IN': 'Citizen',
  },
  guest: {
    'or-IN': 'ଅତିଥି',
    'te-IN': 'అతిథి',
    'hi-IN': 'अतिथि',
    'bn-IN': 'অতিথি',
    'pa-IN': 'ਮਹਿਮਾਨ',
    'ur-IN': 'مہمان',
    'ta-IN': 'விருந்தினர்',
    'kn-IN': 'ಅತಿಥಿ',
    'ml-IN': 'അതിഥി',
    'mr-IN': 'अतिथी',
    'gu-IN': 'અતિથિ',
    'en-IN': 'Guest',
  },
};

/**
 * Phonetic transliteration table for unlisted Latin syllables into Indic scripts
 */
interface ScriptMap {
  consonants: Record<string, string>;
  vowels: Record<string, string>; // matras
  independentVowels: Record<string, string>;
  halant: string;
}

const SCRIPTS: Record<string, ScriptMap> = {
  'or-IN': {
    halant: '୍',
    consonants: {
      k: 'କ', kh: 'ଖ', g: 'ଗ', gh: 'ଘ',
      ch: 'ଚ', chh: 'ଛ', j: 'ଜ', jh: 'ଝ',
      t: 'ଟ', th: 'ଠ', d: 'ଡ', dh: 'ଢ', n: 'ନ',
      p: 'ପ', ph: 'ଫ', f: 'ଫ', b: 'ବ', bh: 'ଭ', m: 'ମ',
      y: 'ଯ', r: 'ର', l: 'ଲ', v: 'ଭ', w: 'ୱ',
      sh: 'ଶ', s: 'ସ', h: 'ହ',
    },
    vowels: {
      a: '', aa: 'ା', i: 'ି', ee: 'ୀ', u: 'ୁ', oo: 'ୂ',
      e: 'େ', ai: 'ୈ', o: 'ୋ', au: 'ୌ',
    },
    independentVowels: {
      a: 'ଅ', aa: 'ଆ', i: 'ଇ', ee: 'ଈ', u: 'ଉ', oo: 'ଊ',
      e: 'ଏ', ai: 'ଐ', o: 'ଓ', au: 'ଔ',
    },
  },
  'te-IN': {
    halant: '్',
    consonants: {
      k: 'క', kh: 'ఖ', g: 'గ', gh: 'ఘ',
      ch: 'చ', chh: 'ఛ', j: 'జ', jh: 'ఝ',
      t: 'ట', th: 'ఠ', d: 'డ', dh: 'ఢ', n: 'న',
      p: 'ప', ph: 'ఫ', f: 'ఫ', b: 'బ', bh: 'భ', m: 'మ',
      y: 'య', r: 'ర', l: 'ల', v: 'వ', w: 'వ',
      sh: 'శ', s: 'స', h: 'హ',
    },
    vowels: {
      a: '', aa: 'ా', i: 'ి', ee: 'ీ', u: 'ు', oo: 'ూ',
      e: 'ె', ai: 'ై', o: 'ొ', au: 'ౌ',
    },
    independentVowels: {
      a: 'అ', aa: 'ఆ', i: 'ఇ', ee: 'ఈ', u: 'ఉ', oo: 'ఊ',
      e: 'ఎ', ai: 'ఐ', o: 'ఒ', au: 'ఔ',
    },
  },
  'hi-IN': {
    halant: '्',
    consonants: {
      k: 'क', kh: 'ख', g: 'ग', gh: 'घ',
      ch: 'च', chh: 'छ', j: 'ज', jh: 'झ',
      t: 'त', th: 'थ', d: 'द', dh: 'ध', n: 'न',
      p: 'प', ph: 'फ', f: 'फ़', b: 'ब', bh: 'भ', m: 'म',
      y: 'य', r: 'र', l: 'ल', v: 'व', w: 'व',
      sh: 'श', s: 'स', h: 'ह',
    },
    vowels: {
      a: '', aa: 'ा', i: 'ि', ee: 'ी', u: 'ु', oo: 'ू',
      e: 'े', ai: 'ै', o: 'ो', au: 'ौ',
    },
    independentVowels: {
      a: 'अ', aa: 'आ', i: 'इ', ee: 'ई', u: 'उ', oo: 'ऊ',
      e: 'ए', ai: 'ऐ', o: 'ओ', au: 'औ',
    },
  },
  'bn-IN': {
    halant: '্',
    consonants: {
      k: 'ক', kh: 'খ', g: 'গ', gh: 'ঘ',
      ch: 'চ', chh: 'ছ', j: 'জ', jh: 'ঝ',
      t: 'ত', th: 'থ', d: 'দ', dh: 'ধ', n: 'ন',
      p: 'প', ph: 'ফ', f: 'ফ', b: 'ব', bh: 'ভ', m: 'ম',
      y: 'য', r: 'র', l: 'ল', v: 'ভ', w: 'ওয়',
      sh: 'শ', s: 'স', h: 'হ',
    },
    vowels: {
      a: '', aa: 'া', i: 'ি', ee: 'ী', u: 'ু', oo: 'ূ',
      e: 'ে', ai: 'ৈ', o: 'ো', au: 'ৌ',
    },
    independentVowels: {
      a: 'অ', aa: 'আ', i: 'ই', ee: 'ঈ', u: 'উ', oo: 'ঊ',
      e: 'এ', ai: 'ঐ', o: 'ও', au: 'ঔ',
    },
  },
  'pa-IN': {
    halant: '੍',
    consonants: {
      k: 'ਕ', kh: 'ਖ', g: 'ਗ', gh: 'ਘ',
      ch: 'ਚ', chh: 'ਛ', j: 'ਜ', jh: 'ਝ',
      t: 'ਤ', th: 'ਥ', d: 'ਦ', dh: 'ਧ', n: 'ਨ',
      p: 'ਪ', ph: 'ਫ', f: 'ਫ਼', b: 'ਬ', bh: 'ਭ', m: 'ਮ',
      y: 'ਯ', r: 'ਰ', l: 'ਲ', v: 'ਵ', w: 'ਵ',
      sh: 'ਸ਼', s: 'ਸ', h: 'ਹ',
    },
    vowels: {
      a: '', aa: 'ਾ', i: 'ਿ', ee: 'ੀ', u: 'ੁ', oo: 'ੂ',
      e: 'ੇ', ai: 'ੈ', o: 'ੋ', au: 'ੌ',
    },
    independentVowels: {
      a: 'ਅ', aa: 'ਆ', i: 'ਇ', ee: 'ਈ', u: 'ਉ', oo: 'ਊ',
      e: 'ਏ', ai: 'ਐ', o: 'ਓ', au: 'ਔ',
    },
  },
  'mr-IN': {
    halant: '्',
    consonants: {
      k: 'क', kh: 'ख', g: 'ग', gh: 'घ',
      ch: 'च', chh: 'छ', j: 'ज', jh: 'झ',
      t: 'त', th: 'थ', d: 'द', dh: 'ध', n: 'न',
      p: 'प', ph: 'फ', f: 'फ', b: 'ब', bh: 'भ', m: 'म',
      y: 'य', r: 'र', l: 'ल', v: 'व', w: 'व',
      sh: 'श', s: 'स', h: 'ह',
    },
    vowels: {
      a: '', aa: 'ा', i: 'ि', ee: 'ी', u: 'ु', oo: 'ू',
      e: 'े', ai: 'ै', o: 'ो', au: 'ौ',
    },
    independentVowels: {
      a: 'अ', aa: 'आ', i: 'इ', ee: 'ई', u: 'उ', oo: 'ऊ',
      e: 'ए', ai: 'ऐ', o: 'ओ', au: 'औ',
    },
  },
  'gu-IN': {
    halant: '્',
    consonants: {
      k: 'ક', kh: 'ખ', g: 'ગ', gh: 'ઘ',
      ch: 'ચ', chh: 'છ', j: 'જ', jh: 'ઝ',
      t: 'ત', th: 'થ', d: 'દ', dh: 'ધ', n: 'ન',
      p: 'પ', ph: 'ફ', f: 'ફ', b: 'બ', bh: 'ભ', m: 'મ',
      y: 'ય', r: 'ર', l: 'લ', v: 'વ', w: 'વ',
      sh: 'શ', s: 'સ', h: 'હ',
    },
    vowels: {
      a: '', aa: 'ા', i: 'િ', ee: 'ી', u: 'ુ', oo: 'ૂ',
      e: 'ે', ai: 'ૈ', o: 'ો', au: 'ૌ',
    },
    independentVowels: {
      a: 'અ', aa: 'આ', i: 'ઇ', ee: 'ઈ', u: 'ઉ', oo: 'ઊ',
      e: 'એ', ai: 'ઐ', o: 'ઓ', au: 'ઔ',
    },
  },
  'kn-IN': {
    halant: '್',
    consonants: {
      k: 'ಕ', kh: 'ಖ', g: 'ಗ', gh: 'ಘ',
      ch: 'ಚ', chh: 'ಛ', j: 'ಜ', jh: 'ಝ',
      t: 'ತ', th: 'ಥ', d: 'ದ', dh: 'ಧ', n: 'ನ',
      p: 'ಪ', ph: 'ಫ', f: 'ಫ', b: 'ಬ', bh: 'ಭ', m: 'ಮ',
      y: 'ಯ', r: 'ರ', l: 'ಲ', v: 'ವ', w: 'ವ',
      sh: 'ಶ', s: 'ಸ', h: 'ಹ',
    },
    vowels: {
      a: '', aa: 'ಾ', i: 'ಿ', ee: 'ೀ', u: 'ು', oo: 'ೂ',
      e: 'ೆ', ai: 'ೈ', o: 'ೊ', au: 'ೌ',
    },
    independentVowels: {
      a: 'ಅ', aa: 'ಆ', i: 'ಇ', ee: 'ಈ', u: 'ಉ', oo: 'ಊ',
      e: 'ಎ', ai: 'ಐ', o: 'ಒ', au: 'ಔ',
    },
  },
  'ta-IN': {
    halant: '்',
    consonants: {
      k: 'க', kh: 'க', g: 'க', gh: 'க',
      ch: 'ச', chh: 'ச', j: 'ஜ', jh: 'ஜ',
      t: 'த', th: 'த', d: 'ட', dh: 'ட', n: 'ந',
      p: 'ப', ph: 'ப', f: 'ப', b: 'ப', bh: 'ப', m: 'ம',
      y: 'ய', r: 'ர', l: 'ல', v: 'வ', w: 'வ',
      sh: 'ஷ', s: 'ஸ', h: 'ஹ',
    },
    vowels: {
      a: '', aa: 'ா', i: 'ி', ee: 'ீ', u: 'ு', oo: 'ூ',
      e: 'ெ', ai: 'ை', o: 'ொ', au: 'ௌ',
    },
    independentVowels: {
      a: 'அ', aa: 'ஆ', i: 'இ', ee: 'ஈ', u: 'உ', oo: 'ஊ',
      e: 'எ', ai: 'ஐ', o: 'ஒ', au: 'ஔ',
    },
  },
  'ml-IN': {
    halant: '്',
    consonants: {
      k: 'ക', kh: 'ഖ', g: 'ഗ', gh: 'ഘ',
      ch: 'ച', chh: 'ഛ', j: 'ജ', jh: 'ഝ',
      t: 'ത', th: 'ഥ', d: 'ദ', dh: 'ധ', n: 'ന',
      p: 'പ', ph: 'ഫ', f: 'ഫ', b: 'ബ', bh: 'ഭ', m: 'മ',
      y: 'യ', r: 'ര', l: 'ല', v: 'വ', w: 'വ',
      sh: 'ശ', s: 'സ', h: 'ഹ',
    },
    vowels: {
      a: '', aa: 'ാ', i: 'ി', ee: 'ീ', u: 'ു', oo: 'ൂ',
      e: 'െ', ai: 'ൈ', o: 'ൊ', au: 'ൌ',
    },
    independentVowels: {
      a: 'അ', aa: 'ആ', i: 'ഇ', ee: 'ഈ', u: 'ഉ', oo: 'ഊ',
      e: 'എ', ai: 'ഐ', o: 'ഒ', au: 'ഔ',
    },
  },
};

/**
 * Phonetically transliterates arbitrary single word into target Indic script
 */
function phoneticWord(word: string, langCode: string): string {
  const map = SCRIPTS[langCode];
  if (!map) return word;

  const w = word.toLowerCase().trim();
  let result = '';
  let i = 0;

  while (i < w.length) {
    // Check 2-letter consonants first: ch, kh, gh, jh, th, dh, ph, bh, sh
    const twoCons = w.slice(i, i + 2);
    if (map.consonants[twoCons]) {
      const c = map.consonants[twoCons];
      i += 2;
      // Check subsequent vowel
      const twoVow = w.slice(i, i + 2);
      if (map.vowels[twoVow] !== undefined) {
        result += c + map.vowels[twoVow];
        i += 2;
      } else if (map.vowels[w[i]] !== undefined) {
        result += c + map.vowels[w[i]];
        i += 1;
      } else {
        // If at the end or before another consonant
        if (i < w.length) {
          result += c + map.halant;
        } else {
          result += c;
        }
      }
      continue;
    }

    // 1-letter consonant
    const oneCons = w[i];
    if (map.consonants[oneCons]) {
      const c = map.consonants[oneCons];
      i += 1;
      // Check subsequent vowel
      const twoVow = w.slice(i, i + 2);
      if (map.vowels[twoVow] !== undefined) {
        result += c + map.vowels[twoVow];
        i += 2;
      } else if (map.vowels[w[i]] !== undefined) {
        result += c + map.vowels[w[i]];
        i += 1;
      } else {
        if (i < w.length) {
          result += c + map.halant;
        } else {
          result += c;
        }
      }
      continue;
    }

    // Initial independent vowel
    const twoInd = w.slice(i, i + 2);
    if (map.independentVowels[twoInd]) {
      result += map.independentVowels[twoInd];
      i += 2;
      continue;
    }
    const oneInd = w[i];
    if (map.independentVowels[oneInd]) {
      result += map.independentVowels[oneInd];
      i += 1;
      continue;
    }

    // Unknown char (e.g. number or punctuation)
    result += w[i];
    i += 1;
  }

  return result;
}

/**
 * Main export: Translates/transliterates any user name into the active language script.
 */
export function transliterateName(name: string | undefined | null, langCode: string = 'en-IN'): string {
  if (!name || !name.trim()) return '';
  if (langCode === 'en-IN' || langCode === 'en') return name;

  const trimmed = name.trim();

  // If already in an Indic script, return directly
  if (/[\u0900-\u0DFF\u0600-\u06FF]/.test(trimmed)) {
    return trimmed;
  }

  // Split multi-word names (e.g. "Simran Kaur", "Rahul Sharma")
  const parts = trimmed.split(/\s+/);
  const transliteratedParts = parts.map((part) => {
    const key = part.toLowerCase();

    // 1. Direct dictionary match
    if (NAME_DICTIONARY[key] && NAME_DICTIONARY[key][langCode]) {
      return NAME_DICTIONARY[key][langCode];
    }

    // 2. Urdu special fallback
    if (langCode === 'ur-IN') {
      return NAME_DICTIONARY[key]?.['ur-IN'] || part;
    }

    // 3. Algorithmic phonetic transliteration
    const converted = phoneticWord(part, langCode);
    return converted || part;
  });

  return transliteratedParts.join(' ');
}
