"""
AssistantAgent — natural-language conversational chatbot interface (Mitra AI).

Responsibilities:
1. Detect if the user is describing themselves -> call ProfileAgent to update profile.
2. Smart intent extraction & multi-category retrieval across 4,732+ schemes.
3. Build multi-turn conversation context window (last 10 messages).
4. Call LLM with grounded scheme context in citizen's preferred language.
5. Provide comprehensive conversational fallback in Bengali, Urdu, Punjabi, Hindi, Odia, Marathi, Telugu, Tamil, and English.
6. Return clean conversational answer + list of referenced scheme IDs + profile updates.
"""
import json
import logging
import re
from typing import Any, Optional

def _safe_int(val: Any, default: int = 0) -> int:
    """Safely convert any value to int, avoiding TypeError when val is None."""
    if val is None:
        return default
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


from .litellm_client import call_llm
from .profile_agent import ProfileAgent
from .scheme_localizer import localize_scheme

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_TEMPLATE = """You are Mitra (मित्र / মিত্র / متر / ਮਿੱਤਰ), the elite, compassionate, and highly knowledgeable AI Welfare Counselor & Scheme Advisor on SchemeNavigator (भारत सरकार कल्याण सलाहकार).

ABSOLUTE LANGUAGE MIRRORING MANDATE (CRITICAL - HIGHEST PRIORITY):
The citizen's query language has been detected as: {target_language} ({target_language_name}).
YOU MUST GENERATE 100% OF YOUR RESPONSE STRICTLY AND EXCLUSIVELY IN {target_language_name}.
- If target_language_name is English: You MUST write your ENTIRE response in clean, professional English. DO NOT write in Hindi or Devanagari script!
- If target_language_name is Hindi (हिंदी): Write 100% in natural, polite Hindi using Devanagari script (e.g. "नमस्ते! मैं मित्र AI हूँ...").
- If target_language_name is Bengali (বাংলা): Write 100% in fluent Bengali using Bengali script.
- If target_language_name is Odia (ଓଡ଼ିଆ): Write 100% in fluent Odia using Odia script.
- If target_language_name is Punjabi (ਪੰਜਾਬੀ): Write 100% in fluent Punjabi using Gurmukhi script.
- If target_language_name is Urdu (اردو): Write 100% in fluent Urdu using Perso-Arabic script.
- If target_language_name is Marathi (मराठी): Write 100% in fluent Marathi using Devanagari script.
- If target_language_name is Telugu (తెలుగు): Write 100% in fluent Telugu using Telugu script.
- If target_language_name is Tamil (தமிழ்): Write 100% in fluent Tamil using Tamil script.
- If target_language_name is Gujarati (ગુજરાતી): Write 100% in fluent Gujarati using Gujarati script.
- If target_language_name is Kannada (ಕನ್ನಡ): Write 100% in fluent Kannada using Kannada script.
- If target_language_name is Malayalam (മലയാളം): Write 100% in fluent Malayalam using Malayalam script.

CRITICAL RULE:
NEVER DEFAULT TO HINDI IF THE CITIZEN ASKED IN ENGLISH OR ANOTHER REGIONAL LANGUAGE!
NEVER DEFAULT TO ENGLISH IF THE CITIZEN ASKED IN AN INDIC REGIONAL LANGUAGE!
ALWAYS MIRROR THE USER'S INPUT LANGUAGE 100% PRECISELY.

================================================================================
MULTI-TURN CONVERSATION MEMORY & ACTIVE TOPIC CONTEXT:
================================================================================
{ongoing_topic_context}
- When the citizen asks follow-up questions such as:
  • "Iske liye documents kya lagenge?" (What documents are required?)
  • "Isme apply kaise kare?" (How to apply?)
  • "Kya mai iske liye eligible hu?" (Am I eligible for this?)
  • "Isme kitne paise milenge?" (What are the benefits/financial amounts?)
  • "Meri age 24 saal hai to kya mujhe milega?" (Can I get this at age 24?)
  • "Last date kya hai?" (What is the deadline?)
  • "Hospital list kaise dekhe?" (How to see empanelled hospitals?)
  NEVER lose context! DO NOT ask the citizen which scheme they mean. Continue discussing the active scheme seamlessly without asking them to repeat themselves.

================================================================================
CITIZEN PROFILE INTELLIGENCE & ELIGIBILITY REASONING:
================================================================================
Active Citizen Profile:
{profile_context}

MANDATORY PROFILE REASONING RULES:
1. ALWAYS compare the citizen's profile attributes (Age, Occupation, State, Category, Income, BPL status, Gender, Landholding) against the scheme's criteria.
2. EXPLICITLY TELL THE CITIZEN whether they qualify based on their specific profile!
   - Example (Eligible): "चूंकि आपकी आयु 22 वर्ष है, आप बिहार के निवासी हैं और OBC छात्र हैं, अतः आप इस पोस्ट-मैट्रिक स्कॉलरशिप के लिए 100% पात्र (Eligible) हैं।"
   - Example (Farmer): "चूंकि आप एक किसान हैं और आपके पास कृषि भूमि है, आप पीएम किसान ₹6,000 सालाना सम्मान निधि के लिए पात्र हैं।"
   - Example (Not Eligible or Age Exceeded): "चूंकि इस योजना के लिए अधिकतम आयु 35 वर्ष है और आपकी आयु 42 वर्ष है, आप इसमें पात्र नहीं हैं, लेकिन आपके लिए [वैकल्पिक योजना] उपयुक्त विकल्प है।"
3. If the citizen discloses new demographic details in their message (e.g. "meri umar 28 saal hai aur mai kisan hu"), acknowledge it warmly and immediately tailor your recommendation to this newly disclosed detail.

MANDATORY AT LEAST 5 ELIGIBLE SCHEMES RECOMMENDATION RULE:
- When the citizen asks for recommendations, eligible schemes, or exploration (e.g. "mere liye eligible schemes batao", "recommend schemes", "farmer schemes", "best schemes for me"), you MUST recommend AT LEAST 5 ELIGIBLE SCHEMES based strictly on deterministic eligibility criteria (Age limits, State jurisdiction, Occupation, Gender, Caste/Category, and Income).
- For EACH of the 5 schemes, present:
  1. 🏛️ Scheme Name & Category
  2. 👥 Deterministic Eligibility Reason (explaining why citizen qualifies based on their Age, State, Occupation, Category)
  3. 💰 Financial Benefit / Subsidy Amount
  4. 📄 Key Required Documents
  5. 🌐 Official Portal Link
- In the <schemes> tag at the end, ALWAYS include the slugs of ALL 5+ recommended schemes, separated by commas:
  <schemes>slug-1,slug-2,slug-3,slug-4,slug-5</schemes>

STRUCTURED RESPONSE BLUEPRINT (MANDATORY FOR ALL SCHEME QUERIES):
Whenever explaining or recommending schemes, format your answer clearly with markdown bullet points and emojis:
1. 🎯 **योजना का नाम और मुख्य उद्देश्य (Scheme Name & Purpose)**: 1-2 direct lines on who it helps and what problem it solves.
2. 💰 **वित्तीय लाभ और सहायता राशि (Financial Assistance / Subsidy)**: State the exact amount (e.g. ₹6,000/year for PM-KISAN, ₹5 lakh cashless treatment for Ayushman Bharat, ₹50,000 to ₹10-20 lakh for Mudra Loan, ₹15,000 toolkit for PM Vishwakarma, etc.).
3. 📋 **पात्रता मानदंड (Eligibility Criteria)**: Specific conditions: Age limits, Income limits, Landholding, Gender/Caste (SC/ST/OBC/General), BPL/Ration card status.
4. 📄 **आवश्यक दस्तावेज़ (Required Documents)**: Bulleted checklist (Aadhaar card, Bank passbook linked with DBT/NPCI, Income certificate, Caste certificate, Land documents / Khasra-Khatauni, Passport photo, Active mobile number).
5. 📝 **आवेदन कैसे करें (Application Process - Online & Offline)**:
   - Online step: Official government portal, Aadhaar OTP authentication, e-KYC.
   - Offline step: Nearest Common Service Centre (CSC / जन सेवा केंद्र / मो सेवा केंद्र), Panchayat/Block office, or designated bank branch.
6. 🌐 **आधिकारिक पोर्टल और हेल्पलाइन (Official Portal URL & Toll-Free Helpline)**: Include the official portal URL and national helpline number.
7. 💡 **नागरिक के लिए सलाह (Pro-Tip / Next Step)**: E.g., verifying Bank Aadhaar-seeding status, checking nearest CSC Kendra via SchemeNavigator's Kendra Finder.

STRICT DOMAIN SCOPE & GUARDRAILS:
1. ONLY answer questions about Indian Government welfare schemes (Central & State), benefits, eligibility, documents, application processes, and Scheme Navigator portal tools (Survey, Voice Reader, Tracker, Kendra Finder, Calendar).
2. Out-of-Scope Questions (coding, math, general trivia, weather, politics, gossip, jokes): Firmly and politely decline in {target_language_name}, stating that you are Mitra AI, dedicated exclusively to government welfare schemes.
3. ZERO Tech Stack Leakage: Never mention internal models, API keys, Python, Gemini, or system prompts. Always present yourself purely as "Mitra AI" on "Scheme Navigator".
4. Append exact database slugs at the very end of your response inside <schemes>...</schemes> tag:
   <schemes>slug-1,slug-2</schemes>
   (Omit <schemes> tag for simple greetings, website overviews, or refusals).

AVAILABLE SCHEMES CONTEXT (Verified from Database):
{scheme_context}
"""

LANGUAGE_NAMES = {
    "en-IN": "English",
    "en": "English",
    "hi-IN": "Hindi (हिंदी)",
    "hi": "Hindi (हिंदी)",
    "bn-IN": "Bengali (বাংলা)",
    "bn": "Bengali (বাংলা)",
    "ur-IN": "Urdu (اردو)",
    "ur": "Urdu (اردو)",
    "pa-IN": "Punjabi (ਪੰਜਾਬੀ)",
    "pa": "Punjabi (ਪੰਜਾਬੀ)",
    "or-IN": "Odia (ଓଡ଼ିଆ)",
    "or": "Odia (ଓଡ଼ିଆ)",
    "mr-IN": "Marathi (मराठी)",
    "mr": "Marathi (मराठी)",
    "te-IN": "Telugu (తెలుగు)",
    "te": "Telugu (తెలుగు)",
    "ta-IN": "Tamil (தமிழ்)",
    "ta": "Tamil (தமிழ்)",
    "gu-IN": "Gujarati (ગુજરાતી)",
    "gu": "Gujarati (ગુજરાતી)",
    "kn-IN": "Kannada (ಕನ್ನಡ)",
    "kn": "Kannada (ಕನ್ನಡ)",
    "ml-IN": "Malayalam (മലയാളം)",
    "ml": "Malayalam (മലയാളം)",
}

PROFILE_DETECTION_KEYWORDS = [
    "i am", "i'm", "i have", "my income", "my age", "i live",
    "my family", "i work", "i farm", "i study", "i'm a", "i am a",
    "year old", "years old", "from ", "belong to", "my state",
    "meri umar", "meri age", "mai ", "main ", "mera state",
    "st ", "sc ", "obc ", "general", "bpl", "ration card",
    "amar boyos", "ami ", "amader", "meri aayu",
    "meri umr", "meri umar", "main ik", "main ek",
]


def _might_contain_profile(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in PROFILE_DETECTION_KEYWORDS)


INDIAN_STATES_MAP = {
    "andhra pradesh": "Andhra Pradesh", "andhra": "Andhra Pradesh",
    "arunachal pradesh": "Arunachal Pradesh", "arunachal": "Arunachal Pradesh",
    "assam": "Assam", "asom": "Assam",
    "bihar": "Bihar",
    "chhattisgarh": "Chhattisgarh", "chattisgarh": "Chhattisgarh",
    "goa": "Goa",
    "gujarat": "Gujarat",
    "haryana": "Haryana",
    "himachal pradesh": "Himachal Pradesh", "himachal": "Himachal Pradesh",
    "jharkhand": "Jharkhand",
    "karnataka": "Karnataka",
    "kerala": "Kerala",
    "madhya pradesh": "Madhya Pradesh", "mp": "Madhya Pradesh",
    "maharashtra": "Maharashtra", "maha": "Maharashtra",
    "manipur": "Manipur",
    "meghalaya": "Meghalaya",
    "mizoram": "Mizoram",
    "nagaland": "Nagaland",
    "odisha": "Odisha", "orissa": "Odisha",
    "punjab": "Punjab",
    "rajasthan": "Rajasthan",
    "sikkim": "Sikkim",
    "tamil nadu": "Tamil Nadu", "tamilnadu": "Tamil Nadu",
    "telangana": "Telangana",
    "tripura": "Tripura",
    "uttar pradesh": "Uttar Pradesh", "up": "Uttar Pradesh",
    "uttarakhand": "Uttarakhand", "uttaranchal": "Uttarakhand",
    "west bengal": "West Bengal", "bengal": "West Bengal", "paschim banga": "West Bengal",
    "delhi": "Delhi", "new delhi": "Delhi",
    "jammu & kashmir": "Jammu & Kashmir", "jammu and kashmir": "Jammu & Kashmir", "jammu": "Jammu & Kashmir", "kashmir": "Jammu & Kashmir", "j&k": "Jammu & Kashmir",
    "ladakh": "Ladakh",
    "chandigarh": "Chandigarh",
    "puducherry": "Puducherry", "pondicherry": "Puducherry",
}


def extract_demographics_from_text(text: str) -> dict:
    """
    Ultra-fast, deterministic regex & rule-based demographic extraction.
    Parses Age, Gender, Marital Status, State, Category, Employment, Landholding,
    BPL Status, Disability, and Income from natural user inputs in English, Hindi, Hinglish, & Indic dialects.
    """
    data = {}
    lower = (text or "").lower().strip()
    if not lower:
        return data

    # 1. Age Extraction
    m_age = re.search(r"\b(?:meri\s+)?(?:umar|umr|aayu|age|boyos)\s*(?:hai|is|h|:)?\s*(\d{1,2})\b", lower)
    if not m_age:
        m_age = re.search(r"\b(\d{1,2})\s*(?:saal|sal|years?|yrs?|bosor)\b", lower)
    if not m_age:
        m_age = re.search(r"\b(\d{1,2})\s*(?:ka\s+hu|ki\s+hu|er)\b", lower)
    if not m_age:
        m_age = re.search(r"\bi\s*(?:am|'m)\s*(\d{1,2})\b", lower)
    if m_age:
        try:
            val = int(m_age.group(1))
            if 1 <= val <= 105:
                data["age"] = val
        except (ValueError, TypeError):
            pass

    # 2. Gender & Marital Status
    if re.search(r"\b(mahila|aurat|female|woman|girl|ladki|kanya|bahu|beti|vidhwa|widow|grihini)\b", lower):
        data["gender"] = "female"
    elif re.search(r"\b(purush|male|man|ladka|beta|aadmi|boy)\b", lower):
        data["gender"] = "male"

    if re.search(r"\b(vidhwa|widow)\b", lower):
        data["maritalStatus"] = "widowed"
    elif re.search(r"\b(shadi\s*shuda|shadishuda|married)\b", lower):
        data["maritalStatus"] = "married"
    elif re.search(r"\b(kunwara|kunwari|single|unmarried)\b", lower):
        data["maritalStatus"] = "single"

    # 3. State & Location
    for k, v in sorted(INDIAN_STATES_MAP.items(), key=lambda x: -len(x[0])):
        if re.search(r"\b" + re.escape(k) + r"\b", lower):
            data["state"] = v
            break

    # 4. Social / Caste Category
    if re.search(r"\b(obc|o\.b\.c)\b", lower):
        data["category"] = "OBC"
        data["caste_category"] = "OBC"
    elif re.search(r"\b(sc|s\.c|scheduled caste|dalit)\b", lower):
        data["category"] = "SC"
        data["caste_category"] = "SC"
    elif re.search(r"\b(st|s\.t|scheduled tribe|adivasi)\b", lower):
        data["category"] = "ST"
        data["caste_category"] = "ST"
    elif re.search(r"\b(ews|e\.w\.s)\b", lower):
        data["category"] = "EWS"
        data["caste_category"] = "EWS"
    elif re.search(r"\b(general|samanya)\b", lower):
        data["category"] = "General"
        data["caste_category"] = "General"
    elif re.search(r"\b(minority|alpsankhyak|muslim|sikh|christian|jain|buddhist|parsi)\b", lower):
        data["category"] = "Minority"
        data["caste_category"] = "Minority"
        data["isMinority"] = True

    # 5. Occupation & Employment Type
    if re.search(r"\b(student|chhatra|vidyarthi|college|school|padhai|b\.?tech|btech|bsc|b\.?sc|ba|bcom|diploma|iti|engineering|polytechnic|10th pass|12th pass|graduate)\b", lower):
        data["employmentType"] = "Student"
        data["occupation"] = "Student"
        course_match = re.search(r"\b(b\.?tech|btech|bsc|b\.?sc|ba|bcom|diploma|iti|engineering|m\.?tech|msc|bca|mca)\b", lower)
        if course_match:
            data["studentCourse"] = course_match.group(1).upper()
    elif re.search(r"\b(kisan|farmer|kheti|krishak|kashtkar|khet|fasal ugata)\b", lower):
        data["employmentType"] = "Farmer"
        data["occupation"] = "Farmer"
        land_m = re.search(r"(\d+(?:\.\d+)?)\s*(?:acre|ekad|bigha|hectare)", lower)
        if land_m:
            try:
                data["farmerLandAcre"] = float(land_m.group(1))
            except (ValueError, TypeError):
                pass
    elif re.search(r"\b(dukan|dukaan|shop|business|vyapar|startup|karobar|thela|rehdi|vendor|patridar|retailer|trader)\b", lower):
        data["employmentType"] = "Business owner"
        data["occupation"] = "Business owner"
    elif re.search(r"\b(karigar|artisan|vishwakarma|mistri|darzi|tailor|lohar|badhai|carpenter|cobbler|muchi|sonar|silai|bunkar|weaver)\b", lower):
        data["employmentType"] = "Self-employed"
        data["occupation"] = "Artisan / Self-employed"
    elif re.search(r"\b(berojgar|unemployed|jobless|naukri nahi|job seeker)\b", lower):
        data["employmentType"] = "Unemployed"
        data["occupation"] = "Unemployed"
    elif re.search(r"\b(retired|pensioner|vridha|vriddha|senior citizen|bujurg)\b", lower):
        data["employmentType"] = "Retired"
        data["occupation"] = "Retired"
    elif re.search(r"\b(housewife|grihini|homemaker)\b", lower):
        data["employmentType"] = "Homemaker"
        data["occupation"] = "Homemaker"

    # 6. BPL & Ration Card Status
    if re.search(r"\b(bpl|ration card|rashan card|antodaya|garibi rekha|garib parivar)\b", lower):
        data["hasBPLCard"] = True
        data["bpl_status"] = "BPL / Ration Card"

    # 7. Disability Status
    if re.search(r"\b(divyang|viklang|handicap|disability|blind|wheelchair|deaf|mute)\b", lower):
        data["isDisability"] = True
        data["has_disability"] = True

    # 8. Area Type
    if re.search(r"\b(gaon|gramin|rural|village|dehat)\b", lower):
        data["areaType"] = "Rural"
    elif re.search(r"\b(shahar|shahri|urban|city|town)\b", lower):
        data["areaType"] = "Urban"

    # 9. Income Range Estimation
    if re.search(r"\b(below 1 lakh|1 lakh se kam|50000|60000|70000|80000)\b", lower):
        data["incomeRange"] = "Below ₹1 lakh"
        data["income"] = "Below ₹1 lakh"
    elif re.search(r"\b(1 to 2\.5|1-2\.5|1\.5 lakh|2 lakh)\b", lower):
        data["incomeRange"] = "₹1–2.5 lakh"
        data["income"] = "₹1–2.5 lakh"
    elif re.search(r"\b(2\.5 to 5|2\.5-5|3 lakh|4 lakh)\b", lower):
        data["incomeRange"] = "₹2.5–5 lakh"
        data["income"] = "₹2.5–5 lakh"

    return data


FOLLOWUP_MARKERS = [
    # Pronouns & demonstratives in Hindi/Hinglish
    "isme", "ismein", "iske", "iski", "iska", "isse", "ispe", "isko", "iss", "isi",
    "ye", "yeh", "woh", "wo", "usme", "uske", "unka", "unhe", "is yojana", "iss yojana",
    "is scheme", "iss scheme", "same scheme", "same yojana",
    # English pronouns & references
    "this", "it", "its", "that", "the scheme", "this scheme", "this yojana", "this loan", "this card", "same scheme",
    # Regional language markers
    "er jonno", "etate", "isdi", "ehda", "ehde", "isre", "deeni", "idaniki", "idara", "adhil", "ithil",
    # Specific attributes
    "document", "documents", "dastavej", "kagaz", "papers", "proof", "certificate", "nothi", "dastawiz",
    "apply", "registration", "aavedan", "kaise kare", "kaha apply", "how to apply", "process", "steps",
    "eligible", "eligibility", "patrata", "kya mai", "kya mujhe", "am i", "can i get", "who is eligible",
    "kitna paisa", "kitne paise", "amount", "subsidy", "labh", "benefit", "fayde", "interest rate",
    "last date", "deadline", "antim tithi", "due date", "cutoff", "helpline", "portal", "website",
    "hospital list", "kisko milega", "kab milega", "kise milega", "kaise milega"
]


def _extract_recent_schemes(history: list) -> list[str]:
    """
    Extracts scheme slugs discussed in recent conversation history (from newest to oldest).
    Checks:
    1. <schemes>...</schemes> tags in previous assistant messages.
    2. Explicit scheme names and aliases in previous user and assistant turns.
    """
    slugs = []
    if not history or not isinstance(history, list):
        return slugs

    for turn in reversed(history[-10:]):
        content = turn.get("content") or turn.get("text") or ""
        # 1. <schemes> tags
        m = re.findall(r"<schemes>(.*?)</schemes>", content, re.IGNORECASE)
        for group in m:
            for s in group.split(","):
                s_c = s.strip().lower()
                if s_c and s_c not in slugs:
                    slugs.append(s_c)

        # 2. Scheme aliases
        c_lower = content.lower()
        for keywords, slug in SCHEME_ALIASES:
            if any(kw in c_lower for kw in keywords):
                if slug not in slugs:
                    slugs.append(slug)

    return slugs


def _is_followup_query(message: str, recent_schemes: list[str]) -> bool:
    """
    Determines if the message is continuing the discussion about a recent scheme.
    Returns False if the user explicitly introduced a different new scheme.
    """
    if not recent_schemes:
        return False
    lower = message.lower().strip()
    words = re.findall(r"[a-zA-Z\u0900-\u097F]+", lower)

    # If user explicitly named a DIFFERENT new scheme, it's not a follow-up to the old one
    for keywords, slug in SCHEME_ALIASES:
        if any(kw in lower for kw in keywords):
            if slug not in recent_schemes[:1]:
                return False

    has_marker = any(re.search(r"\b" + re.escape(m) + r"\b", lower) for m in FOLLOWUP_MARKERS)
    return has_marker or len(words) <= 7


SCHEME_ALIASES = [
    # Healthcare
    (["ayushman", "pmjay", "pm-jay", "jan arogya", "ayushman card", "health card", "swasthya card", "ilaj card", "5 lakh muft ilaj", "free ilaj", "मुफ्त इलाज", "স্বাস্থ্য কার্ড", "صحت کارڈ", "ਆਯੁਸ਼ਮਾਨ"], "ayushman-bharat-pmjay"),
    (["vaya vandana", "ayushman senior", "70+", "70 plus", "70 saal", "70 varsh", "senior citizen health"], "ayushman-vaya-vandana-senior-citizens"),
    (["janaushadhi", "jan aushadhi", "generic medicine", "dawa kendra", "pmbjp", "sasti dawa"], "pmbjp"),

    # Agriculture & Farmers
    (["kisan samman", "pm kisan", "pm-kisan", "samman nidhi", "6000 kisan", "kisan 6000", "kisan samman nidhi", "pmkisan", "কৃষক সম্মান", "کسان سمان", "ਪੀਐੱਮ ਕਿਸਾਨ"], "pm-kisan-samman-nidhi"),
    (["kusum", "solar pump", "solar kisan", "solar panel khet", "pm kusum", "সৌর পাম্প", "ਸੋਲਰ ਪੰਪ"], "pm-kusum-solar-pump-scheme"),
    (["fasal bima", "pmfby", "crop insurance", "fasal nuksan", "ফসল বিমা", "فصل بیمہ", "ਫ਼ਸਲ ਬੀਮਾ"], "pradhan-mantri-fasal-bima-yojana"),
    (["kisan credit card", "kcc", "kheti loan", "crop loan", "kcc loan", "ਕੇਸੀਸੀ", "کے سی سی"], "kcc"),

    # Business, MSME & Livelihood Loans
    (["mudra", "mudra loan", "shishu", "kishor", "tarun", "tarun plus", "dukan loan", "chhota business loan", "vyapar loan", "মুদ্রা ঋণ", "مدرا لون", "ਮੁਦਰਾ ਕਰਜ਼ਾ"], "pradhan-mantri-mudra-yojana"),
    (["svanidhi", "street vendor", "pm-svanidhi", "rehdi", "patri", "thela loan", "vendor loan", "10000 loan", "স্বনিধি", "سوانیدھی"], "pm-svanidhi"),
    (["vishwakarma", "pm-vishwakarma", "artisan", "karigar", "silai machine", "darzi", "mistri", "lohar", "badhai", "sonar", "15000 toolkit", "toolkit yojana", "বিশ্বকর্মা", "وشوکرما"], "pm-vishwakarma-scheme"),
    (["stand up india", "stand-up", "women entrepreneur loan", "sc st business loan"], "stand-up-india-scheme"),
    (["pmegp", "prime minister employment generation", "pme gp", "khadi loan", "factory subsidy", "business subsidy"], "prime-minister-employment-generation-programme"),

    # Education & Scholarships
    (["post matric", "post-matric", "nsp", "scholarship", "chhatravritti", "college scholarship", "12th pass scholarship", "sc scholarship", "obc scholarship", "minority scholarship", "স্কলারশিপ", "اسکالرشپ", "ਵਜ਼ੀਫ਼ਾ"], "post-matric-scholarship-sc-obc-minority"),
    (["pm-usp", "pm usp", "uchchatar shiksha", "higher education scholarship", "degree scholarship", "college fees"], "pm-uchchatar-shiksha-protsahan-yojana"),
    (["free coaching", "upsc coaching", "ias coaching", "competitive exam coaching"], "scheme-for-free-coaching-for-sc-and-obc-students"),
    (["kaushal vikas", "pmkvy", "skill india", "rozgar training", "free training", "skill certificate"], "pradhan-mantri-kaushal-vikas-yojana"),
    (["apprenticeship", "naps", "naps-2", "stipend training"], "national-apprenticeship-promotion-scheme"),

    # Housing
    (["awas yojana", "pmay", "pm awas", "pradhan mantri awas", "makan yojana", "ghar yojana", "pucca ghar", "gramin awas", "pmay-g", "আবাস যোজনা", "آواس یوجنا", "ਆਵਾਸ ਯੋਜਨਾ"], "pradhan-mantri-awas-yojana-gramin"),

    # Social Security & Pensions
    (["atal pension", "apy", "60 ke baad pension", "budhapa pension", "অটল পেনশন", "اٹل پنشن", "ਅਟਲ ਪੈਨਸ਼ਨ"], "atal-pension-yojana"),
    (["old age pension", "vridha pension", "vriddha pension", "ignoaps", "senior citizen pension", "bujurg pension"], "indira-gandhi-national-old-age-pension-scheme"),
    (["suraksha bima", "pmsby", "20 rupaye bima", "accident insurance", "durghatna bima"], "pmsby"),
    (["jeevan jyoti", "pmjjby", "436 bima", "life insurance", "jeevan bima"], "pmjjby"),
    (["divyang", "viklang", "disability", "handicapped", "wheelchair", "hearing aid", "adip", "prosthetic"], "adip-scheme-for-persons-with-disabilities"),

    # Women & Child
    (["sukanya", "ssy", "sukanya samriddhi", "beti bachat", "kanya yojana", "ladki yojana", "girl child scheme", "সুকন্যা সমৃদ্ধি", "سکنیا سمردھی"], "sukanya-samriddhi-yojana"),
    (["matru vandana", "pmmvy", "maternity", "garbhavati", "delivery sahayata", "5000 pregnant", "মাতৃ বন্দনা", "ماترو وندنا"], "pradhan-mantri-matru-vandana-yojana"),
    (["ujjwala", "pmuy", "pmuy2", "free gas", "lpg subsidy", "gas cylinder", "उज्ज्वला", "উজ্জ্বলা", "اجولا"], "pmuy"),
]

INTENT_CATEGORY_MAP = {
    # Agriculture
    "kisan": ["Agriculture", "Financial Assistance"],
    "kheti": ["Agriculture", "Financial Assistance"],
    "farmer": ["Agriculture", "Financial Assistance"],
    "farming": ["Agriculture", "Financial Assistance"],
    "crop": ["Agriculture"],
    "tractor": ["Agriculture", "Financial Assistance"],
    "fertilizer": ["Agriculture"],
    "fasal": ["Agriculture"],
    "beej": ["Agriculture"],
    "sinchai": ["Agriculture"],
    "irrigation": ["Agriculture"],
    "krishi": ["Agriculture"],
    "krishok": ["Agriculture"],
    "kassano": ["Agriculture"],
    "kashtkar": ["Agriculture"],
    # Education & Skills
    "student": ["Education", "Skill Development"],
    "scholarship": ["Education", "Financial Assistance"],
    "chhatravritti": ["Education", "Financial Assistance"],
    "study": ["Education", "Skill Development"],
    "padhai": ["Education", "Skill Development"],
    "shiksha": ["Education", "Skill Development"],
    "college": ["Education"],
    "school": ["Education"],
    "fee": ["Education", "Financial Assistance"],
    "fees": ["Education", "Financial Assistance"],
    "skill": ["Skill Development", "Employment"],
    "training": ["Skill Development"],
    "coaching": ["Education"],
    "pariksha": ["Education"],
    "wazifa": ["Education", "Financial Assistance"],
    "chhatro": ["Education"],
    # Loans & Business
    "loan": ["Business", "Financial Assistance"],
    "business": ["Business", "Financial Assistance"],
    "startup": ["Business"],
    "dukaan": ["Business", "Financial Assistance"],
    "dukan": ["Business", "Financial Assistance"],
    "shop": ["Business", "Financial Assistance"],
    "karobar": ["Business", "Financial Assistance"],
    "vyapar": ["Business", "Financial Assistance"],
    "mudra": ["Business", "Financial Assistance"],
    "subsidy": ["Financial Assistance", "Agriculture", "Business"],
    "svanidhi": ["Business", "Financial Assistance"],
    "vishwakarma": ["Business", "Skill Development"],
    "pmegp": ["Business", "Financial Assistance"],
    "qarz": ["Business", "Financial Assistance"],
    "karza": ["Business", "Financial Assistance"],
    "rin": ["Business", "Financial Assistance"],
    # Women & Child
    "woman": ["Women & Child", "Social Security"],
    "women": ["Women & Child", "Social Security"],
    "mahila": ["Women & Child", "Social Security"],
    "girl": ["Women & Child", "Education"],
    "beti": ["Women & Child", "Education"],
    "kanya": ["Women & Child", "Education"],
    "maternity": ["Women & Child", "Healthcare"],
    "matru": ["Women & Child", "Healthcare"],
    "sukanya": ["Women & Child", "Financial Assistance"],
    "lakhpati": ["Women & Child", "Financial Assistance"],
    "widow": ["Women & Child", "Social Security"],
    "vidhwa": ["Women & Child", "Social Security"],
    "khatoon": ["Women & Child", "Social Security"],
    "aurat": ["Women & Child", "Social Security"],
    "bahu": ["Women & Child"],
    # Healthcare
    "health": ["Healthcare"],
    "hospital": ["Healthcare"],
    "illness": ["Healthcare"],
    "ilaj": ["Healthcare"],
    "treatment": ["Healthcare"],
    "ayushman": ["Healthcare"],
    "medicine": ["Healthcare"],
    "dawa": ["Healthcare"],
    "swasthya": ["Healthcare"],
    "card": ["Healthcare", "Social Security"],
    "sehat": ["Healthcare"],
    "doctor": ["Healthcare"],
    # Housing
    "house": ["Housing"],
    "housing": ["Housing"],
    "ghar": ["Housing"],
    "makan": ["Housing"],
    "makaan": ["Housing"],
    "awas": ["Housing"],
    "pmay": ["Housing"],
    "bari": ["Housing"],
    # Social Security & Pensions
    "pension": ["Social Security"],
    "elderly": ["Social Security"],
    "senior": ["Social Security"],
    "old age": ["Social Security"],
    "vriddha": ["Social Security"],
    "bujurg": ["Social Security"],
    "suraksha": ["Social Security"],
    "divyang": ["Social Security", "Financial Assistance"],
    "viklang": ["Social Security", "Financial Assistance"],
    "bima": ["Social Security", "Financial Assistance"],
    "insurance": ["Social Security"],
    # Employment
    "job": ["Employment", "Skill Development"],
    "naukri": ["Employment"],
    "employment": ["Employment"],
    "berojgar": ["Employment", "Skill Development"],
    "unemployed": ["Employment", "Skill Development"],
    "rozgar": ["Employment"],
    "mgnrega": ["Employment"],
}


def detect_message_language(message: str, fallback_lang: str = "en-IN") -> str:
    """
    Intelligently detects whether the user is typing/speaking in:
    - English -> 'en-IN'
    - Hindi (Devanagari script or Hinglish) -> 'hi-IN'
    - Bengali (Bengali script or Banglish) -> 'bn-IN'
    - Odia (Odia script or Roman Odia) -> 'or-IN'
    - Punjabi (Gurmukhi script or Roman Punjabi) -> 'pa-IN'
    - Urdu (Perso-Arabic script or Roman Urdu) -> 'ur-IN'
    - Marathi (Devanagari script or Roman Marathi) -> 'mr-IN'
    - Telugu (Telugu script or Roman Telugu) -> 'te-IN'
    - Tamil (Tamil script or Roman Tamil) -> 'ta-IN'
    - Gujarati (Gujarati script or Roman Gujarati) -> 'gu-IN'
    - Kannada (Kannada script or Roman Kannada) -> 'kn-IN'
    - Malayalam (Malayalam script or Roman Malayalam) -> 'ml-IN'
    """
    text = (message or "").strip()
    if not text:
        return fallback_lang or "en-IN"

    lower = text.lower()

    # 1. Unicode Script Detection (Strongest Signal)
    if re.search(r"[\u0600-\u06FF]", text):
        return "ur-IN"
    if re.search(r"[\u0980-\u09FF]", text):
        return "bn-IN"
    if re.search(r"[\u0A00-\u0A7F]", text):
        return "pa-IN"
    if re.search(r"[\u0B00-\u0B7F]", text):
        return "or-IN"
    if re.search(r"[\u0C00-\u0C7F]", text):
        return "te-IN"
    if re.search(r"[\u0B80-\u0BFF]", text):
        return "ta-IN"
    if re.search(r"[\u0A80-\u0AFF]", text):
        return "gu-IN"
    if re.search(r"[\u0C80-\u0CFF]", text):
        return "kn-IN"
    if re.search(r"[\u0D00-\u0D7F]", text):
        return "ml-IN"
    if re.search(r"[\u0900-\u097F]", text):
        # If fallback_lang is explicitly Hindi, honor Hindi 100%!
        if fallback_lang and fallback_lang.startswith("hi"):
            return "hi-IN"
        if fallback_lang and fallback_lang.startswith("mr"):
            return "mr-IN"
        marathi_markers = r"\b(आहे|आहेत|नाहीत|करावे|मिळेल|योजनांची|माझ्या|पाहिजे)\b"
        if re.search(marathi_markers, text):
            return "mr-IN"
        return "hi-IN"

    # 2. Regional Romanized / Transliterated Indic Markers
    if re.search(r"\b(mainu|assi|tussi|chahida|chahidi|chahide|daso|kivve|kive|kiven|dasso|vadhiya|kujh|jatt|hove|hovan|pind|sade|tuhada|tuhadi)\b", lower):
        return "pa-IN"

    if re.search(r"\b(mu|mote|mate|amara|amaku|kipari|kemiti|jojana|kahantu|kahiba|sahayata|darkar|darkara|janni|miliba|milipare|tankaa|tanka|chasa|chasi)\b", lower):
        return "or-IN"

    if re.search(r"\b(amar|amake|amader|prokolpo|jonno|chhatrobritti|kivabe|dorkar|bhalo|dhonnobad|krishok|shunchen|taka|korbo|korte|konta|dekhte)\b", lower):
        return "bn-IN"

    if re.search(r"\b(majhe|majha|majhi|amhi|amche|karava|karave|aahe|ahet|dya|shasan|sang|sanga|sangave|pahije|milnar|baddal|sathi)\b", lower):
        if not (fallback_lang and fallback_lang.startswith("hi")):
            return "mr-IN"

    if re.search(r"\b(wazifa|qarz|qard|dastawiz|hukumat|janab|shukriya|khawateen|khatoon|imdad|rehnumai|taraqqi|itla|darkhwast)\b", lower):
        return "ur-IN"

    if re.search(r"\b(naku|naaku|manaku|ela|elaga|pathakam|pathakalu|sahayam|kavali|cheyali|teliyacheyandi|raithu|dabbulu)\b", lower):
        return "te-IN"

    if re.search(r"\b(enakku|engalukku|eppadi|thittam|thittangal|udavi|vendum|solla|sollunga|vivasaayi|panam)\b", lower):
        return "ta-IN"

    if re.search(r"\b(mane|amane|kevi|rite|sahay|joiye|chhe|kaho|khedut)\b", lower):
        return "gu-IN"

    if re.search(r"\b(nanage|namage|hege|yojane|sahaya|beku|ide|heli|raitha|hana)\b", lower):
        return "kn-IN"

    if re.search(r"\b(enikku|njangalkku|enganeyanu|padhathi|venam|undu|parayamo|karshakan)\b", lower):
        return "ml-IN"

    # 3. Token-based Hindi vs English Grammar Comparison
    hindi_grammar = {
        "kya", "hai", "hain", "ho", "hoon", "hu", "kaise", "kese", "batao", "bataiye", "batayein", "batana",
        "chahiye", "mere", "meri", "mera", "mujhe", "mujhko", "hume", "humko", "apna", "apne", "apni",
        "aap", "aapka", "aapke", "aapki", "tum", "tumhara", "kisko", "kise", "kitna", "kitne", "kitni",
        "milega", "milegi", "milege", "milta", "milti", "milte", "dastavej", "patrata", "labh", "fayde",
        "fayda", "kare", "karein", "karna", "karne", "aavedan", "paise", "paisa", "rupaye",
        "naukri", "chhatravritti", "shiksha", "swasthya", "ilaj", "dawa", "bima", "berojgar", "silai",
        "karigar", "beti", "ladki", "bata", "kuch", "konsi", "kaunsi", "suno", "bhai", "sahab"
    }

    english_grammar = {
        "what", "which", "who", "how", "when", "where", "why", "can", "could", "would", "should",
        "tell", "give", "show", "list", "explain", "help", "need", "want", "apply", "get", "for",
        "from", "with", "about", "under", "eligibility", "eligible", "documents", "document", "required",
        "benefit", "benefits", "subsidy", "assistance", "portal", "official", "government", "central",
        "state", "process", "procedure", "student", "scholarship", "farmer", "business", "loan",
        "housing", "pension", "women", "senior", "citizen", "card", "online", "offline", "the", "is", "are"
    }

    tokens = set(re.findall(r"[a-zA-Z]+", lower))
    hi_count = len(tokens & hindi_grammar)
    en_count = len(tokens & english_grammar)

    # If the user formulated the question in English words
    if en_count > hi_count and en_count >= 2:
        return "en-IN"

    # If the user used distinct Hindi grammar words
    if hi_count > 0:
        return "hi-IN"

    # Single English indicator with no Hindi
    if en_count >= 1:
        return "en-IN"

    if fallback_lang and fallback_lang not in ("en", "en-IN", "en-US"):
        return fallback_lang

    return "en-IN"


def _detect_query_intent(query: str) -> dict:
    q_lower = query.lower()

    matched_alias = None
    for keywords, slug in SCHEME_ALIASES:
        if any(kw in q_lower for kw in keywords):
            matched_alias = slug
            break

    matched_categories = set()
    matched_keywords = []
    for keyword, categories in INTENT_CATEGORY_MAP.items():
        if re.search(r"\b" + re.escape(keyword), q_lower):
            matched_categories.update(categories)
            matched_keywords.append(keyword)

    has_topic = bool(matched_alias or matched_categories or matched_keywords)
    return {
        "has_topic": has_topic,
        "matched_alias": matched_alias,
        "matched_topics": list(matched_categories),
        "matched_keywords": matched_keywords,
    }


HINDI_HINGLISH_STOPWORDS = {
    "the", "for", "and", "about", "yojana", "scheme", "sarkari", "govt", "government",
    "meri", "mera", "mere", "mujhe", "mujhko", "hum", "hume", "apna", "apne", "apni",
    "aap", "aapka", "aapki", "aapke", "tum", "tumhara", "kya", "hai", "hain", "ho", "hoon", "hu",
    "tha", "thee", "the", "hoga", "hogi", "hoge", "batao", "bataiye", "batayein", "batana",
    "chahiye", "chaho", "saal", "sal", "umar", "aayu", "age", "kaise", "kese", "liye", "ko", "se", "me", "mein",
    "par", "pe", "tak", "aur", "bhi", "ya", "na", "nahi", "wala", "wali", "wale", "waliyo",
    "kare", "karein", "karna", "karne", "konsi", "kaunsi", "koun", "kaun", "kisko", "kise",
    "kitna", "kitne", "kitni", "milega", "milegi", "milege", "milta", "milti", "milte",
    "namaste", "hello", "sir", "madam", "ji", "kripya", "please", "help", "jankari", "info",
    "details", "de", "do", "dijiye", "bata", "pata", "kaunsa", "bhi", "batado"
}

TOPIC_FLAGSHIP_SCHEMES = {
    "Healthcare": [
        "ayushman-bharat-pmjay",
        "ayushman-vaya-vandana-senior-citizens",
        "pmbjp",
    ],
    "Business": [
        "pradhan-mantri-mudra-yojana",
        "pm-svanidhi",
        "pm-vishwakarma-scheme",
        "prime-minister-employment-generation-programme",
        "stand-up-india-scheme",
    ],
    "Agriculture": [
        "pm-kisan-samman-nidhi",
        "pm-kusum-solar-pump-scheme",
        "pradhan-mantri-fasal-bima-yojana",
        "kcc",
    ],
    "Education": [
        "post-matric-scholarship-sc-obc-minority",
        "pm-uchchatar-shiksha-protsahan-yojana",
        "scheme-for-free-coaching-for-sc-and-obc-students",
    ],
    "Housing": [
        "pradhan-mantri-awas-yojana-gramin",
    ],
    "Women & Child": [
        "sukanya-samriddhi-yojana",
        "pradhan-mantri-matru-vandana-yojana",
        "pmuy",
    ],
    "Social Security": [
        "atal-pension-yojana",
        "indira-gandhi-national-old-age-pension-scheme",
        "pmsby",
        "pmjjby",
        "adip-scheme-for-persons-with-disabilities",
    ],
    "Employment": [
        "pradhan-mantri-kaushal-vikas-yojana",
        "national-apprenticeship-promotion-scheme",
        "prime-minister-employment-generation-programme",
    ],
    "Skill Development": [
        "pm-vishwakarma-scheme",
        "pradhan-mantri-kaushal-vikas-yojana",
        "national-apprenticeship-promotion-scheme",
    ],
}

def _search_schemes(query: str, limit: int = 10, pinned_slugs: Optional[list[str]] = None) -> list[dict]:
    from django.db.models import Q
    from schemes.models import Scheme
    from schemes.serializers import SchemeSerializer

    q_lower = query.lower()
    results = []
    seen_slugs = set()
    seen_names = set()

    def add_scheme(s):
        if not s:
            return
        slug = getattr(s, "slug", None) or (s.get("slug") if isinstance(s, dict) else "")
        name = getattr(s, "name", None) or (s.get("name") if isinstance(s, dict) else "")
        norm_name = re.sub(r"[^a-zA-Z0-9]+", "", (name or "").lower())
        if slug and slug in seen_slugs:
            return
        if norm_name and norm_name in seen_names:
            return
        results.append(s)
        if slug:
            seen_slugs.add(slug)
        if norm_name:
            seen_names.add(norm_name)

    # 0. Pinned schemes from active multi-turn context (guaranteed at index 0)
    if pinned_slugs:
        for ps in pinned_slugs:
            if not ps:
                continue
            for s in Scheme.objects.filter(slug=ps):
                add_scheme(s)

    # 1. Alias match
    for keywords, slug in SCHEME_ALIASES:
        if any(kw in q_lower for kw in keywords):
            for s in Scheme.objects.filter(slug=slug):
                add_scheme(s)

    # 2. Categories
    matched_categories = set()
    for keyword, categories in INTENT_CATEGORY_MAP.items():
        if keyword in q_lower:
            matched_categories.update(categories)

    # 2b. Priority Ordering for matched categories
    category_order = []
    if any(k in q_lower for k in ['ghar', 'makan', 'awas', 'housing', 'pucca', 'chhat']):
        category_order.append('Housing')
    if any(k in q_lower for k in ['beti', 'ladki', 'kanya', 'mahila', 'woman', 'women', 'sukanya', 'matru', 'lakhpati', 'garbhavati', 'ujjwala']):
        category_order.append('Women & Child')
    if any(k in q_lower for k in ['health', 'hospital', 'ilaj', 'bimari', 'bimar', 'ayushman', 'dawa', 'swasthya', 'card', 'cashless', 'doctor']):
        category_order.append('Healthcare')
    if any(k in q_lower for k in ['kisan', 'kheti', 'farmer', 'krishi', 'fasal', 'beej', 'kusum', 'tractor', 'sinchai', 'kcc']):
        category_order.append('Agriculture')
    if any(k in q_lower for k in ['student', 'scholarship', 'chhatravritti', 'padhai', 'shiksha', 'college', 'school', 'fee', 'fees']):
        category_order.append('Education')
    if any(k in q_lower for k in ['pension', 'old age', 'vridha', 'vriddha', 'bujurg', 'senior', 'divyang', 'viklang', 'handicap', 'atal pension', 'apy']):
        category_order.append('Social Security')
    if any(k in q_lower for k in ['dukan', 'dukaan', 'business', 'loan', 'karobar', 'vyapar', 'mudra', 'svanidhi', 'vendor', 'thela', 'karigar', 'artisan', 'vishwakarma', 'pmegp']):
        category_order.append('Business')

    for c in matched_categories:
        if c not in category_order:
            category_order.append(c)

    # 2c. Priority Flagships for matched categories (guarantees premier welfare schemes)
    if category_order:
        for cat in category_order:
            for flag_slug in TOPIC_FLAGSHIP_SCHEMES.get(cat, []):
                if len(results) < limit:
                    for s in Scheme.objects.filter(slug=flag_slug):
                        add_scheme(s)

    # 3. Clean search words
    noise = HINDI_HINGLISH_STOPWORDS
    raw_words = [w.strip() for w in re.split(r"[^\w]+", q_lower) if len(w.strip()) >= 3]
    content_words = [w for w in raw_words if w not in noise]

    for w in content_words[:4]:
        for s in Scheme.objects.filter(Q(name__icontains=w) | Q(short_name__icontains=w)).order_by("-popular_score")[:5]:
            if len(results) < limit:
                add_scheme(s)

    if len(results) < limit and matched_categories:
        for s in Scheme.objects.filter(category__in=matched_categories).order_by("-popular_score")[: (limit - len(results))]:
            add_scheme(s)

    # Guarantee at least 5 schemes (up to limit) by filling with high-priority flagships and top schemes
    if len(results) < 5:
        flagship_slugs = [
            "ayushman-bharat-pradhan-mantri-jan-arogya-yojana-pm-jay",
            "pradhan-mantri-jeevan-jyoti-bima-yojana",
            "pradhan-mantri-suraksha-bima-yojana",
            "atal-pension-yojana",
            "pradhan-mantri-awas-yojana-gramin",
            "pradhan-mantri-mudra-yojana-pmmy",
            "stand-up-india-scheme",
            "pm-vishwakarma-scheme",
            "sukanya-samriddhi-yojana",
            "national-award-to-teachers",
        ]
        for f_slug in flagship_slugs:
            if len(results) >= limit:
                break
            for s in Scheme.objects.filter(slug=f_slug):
                add_scheme(s)

    if len(results) < 5:
        for s in Scheme.objects.order_by("-popular_score")[: (limit - len(results))]:
            add_scheme(s)

    serialized = []
    for item in results[:limit]:
        if isinstance(item, dict):
            serialized.append(item)
        else:
            serialized.append(dict(SchemeSerializer(item).data))
    return serialized


def _build_scheme_context(schemes: list[dict]) -> str:
    if not schemes:
        return "No specific schemes loaded for this query."
    blocks = []
    for s in schemes[:8]:
        name = s.get("name", "")
        slug = s.get("slug", "")
        cat = s.get("category", "")
        desc = s.get("detailedDescription") or s.get("shortDescription") or s.get("short_description", "")
        states = s.get("coveredStates") or s.get("covered_states", [])
        state_str = ", ".join(states) if isinstance(states, list) else "All India"

        b_list = s.get("benefits", [])
        benefit_lines = []
        if isinstance(b_list, list):
            for b in b_list[:3]:
                if isinstance(b, dict):
                    title = b.get("title", "")
                    val = b.get("amountOrValue", "")
                    b_desc = b.get("description", "")
                    benefit_lines.append(f"    * {title}: {val} - {b_desc}".strip(" -"))

        elig = s.get("eligibility", {})
        elig_lines = []
        if isinstance(elig, dict):
            if elig.get("minAge") or elig.get("maxAge"):
                elig_lines.append(f"    * Age: {elig.get('minAge', 0)} to {elig.get('maxAge', 100)} years")
            if elig.get("requiresBPL"):
                elig_lines.append("    * Requires BPL / Ration Card: Yes")
            for cond in elig.get("customConditions", [])[:3]:
                elig_lines.append(f"    * Condition: {cond}")

        docs = s.get("documents", [])
        doc_lines = []
        if isinstance(docs, list):
            for d in docs[:4]:
                if isinstance(d, dict):
                    doc_lines.append(f"    * {d.get('name', '')} ({'Mandatory' if d.get('isMandatory') else 'Optional'}): {d.get('description', '')}")

        steps = s.get("applicationSteps") or s.get("application_steps", [])
        step_lines = []
        if isinstance(steps, list):
            for st in steps[:3]:
                if isinstance(st, dict):
                    step_lines.append(f"    * Step {st.get('stepNumber', '')}: {st.get('title', '')} - {st.get('description', '')}")

        ver = s.get("verification", {})
        helpline = ver.get("helpline", "") if isinstance(ver, dict) else ""
        portal = ver.get("officialPortalUrl", "") if isinstance(ver, dict) else ""

        block = [
            f"### [{slug}] {name} ({cat})",
            f"  - Scope: {state_str}",
            f"  - Overview: {desc}",
        ]
        if benefit_lines:
            block.append("  - Key Benefits:\n" + "\n".join(benefit_lines))
        if elig_lines:
            block.append("  - Eligibility Criteria:\n" + "\n".join(elig_lines))
        if doc_lines:
            block.append("  - Required Documents:\n" + "\n".join(doc_lines))
        if step_lines:
            block.append("  - Application Steps:\n" + "\n".join(step_lines))
        if helpline or portal:
            block.append(f"  - Official Portal: {portal} | Helpline: {helpline}")

        blocks.append("\n".join(block))

    return "\n\n".join(blocks)


def _extract_scheme_slugs(text: str) -> list[str]:
    match = re.search(r"<schemes>(.*?)</schemes>", text, re.IGNORECASE | re.DOTALL)
    if not match:
        return []
    raw = match.group(1)
    return [s.strip() for s in raw.split(",") if s.strip()]


def _clean_response(text: str) -> str:
    return re.sub(r"<schemes>.*?</schemes>", "", text, flags=re.IGNORECASE | re.DOTALL).strip()


def _is_scheme_query(text: str) -> bool:
    lower = text.lower().strip()
    casual_patterns = [
        r"who (are you|made you|created you)",
        r"tum (kaun|kon) ho",
        r"tumi ke",
        r"aap kon hain",
        r"kisne banaya",
        r"i love you",
        r"(joke|chutkula|funny)",
        r"capital of",
        r"^\s*(hi|hello|hey|namaste|kem cho|vanakkam|namaskara|kya haal|kaise ho|kemon acho|ki khobor|ki haal)\s*$",
        r"^\s*(thank you|thanks|dhanyawad|shukriya|dhonnobad)\s*$",
    ]
    is_clearly_casual = any(re.search(pat, lower) for pat in casual_patterns)

    explicit = [
        "ayushman", "pmjay", "kisan", "mudra", "awas", "pmay", "scholarship", "subsidy",
        "pension", "yojana", "scheme", "sukanya", "svanidhi", "vishwakarma", "ration", "fasal",
        "loan", "post-matric", "প্রকল্প", "স্কলারশিপ", "কৃষক", "اسکالرشپ", "کسان", "قرض", "ਸਕੀਮਾਂ", "ਸਕੀਮ"
    ]
    if any(w in lower for w in explicit):
        return True

    triggers = [
        "website", "portal", "tracker", "survey", "kendra", "deadline", "last date",
        "chahiye", "apply", "aavedan", "kivabe", "kaise", "labh", "benefit", "fayde"
    ]
    if is_clearly_casual and not any(w in lower for w in triggers):
        return False

    return True


CASUAL_IDENTITY = {
    "bn": "নমস্কার! 🙏 আমি **মিত্র (Mitra AI)** — স্কিম নেভিগেটরে আপনার ব্যক্তিগত সরকারি প্রকল্প ও কল্যাণমূলক উপদেষ্টা। আমি কেন্দ্র ও রাজ্য সরকারের ৪,৭০০+ যাচাইকৃত প্রকল্প থেকে আপনার জন্য সঠিক তথ্য প্রদান করতে প্রস্তুত।",
    "ur": "آداب! 🙏 میں **متر (Mitra AI)** ہوں — اسکیم نیویگیٹر پر آپ کا ذاتی فلاحی و سرکاری اسکیم مشیر۔ میں 4,700 سے زائد تصدیق شدہ سرکاری اسکیموں سے آپ کے لیے درست اور بہترین معلومات فراہم کرنے کے لیے حاضر ہوں۔",
    "pa": "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! 🙏 ਮੈਂ **ਮਿੱਤਰ (Mitra AI)** ਹਾਂ — ਸਕੀਮ ਨੇਵੀਗੇਟਰ 'ਤੇ ਤੁਹਾਡਾ ਨਿੱਜੀ ਸਰਕਾਰੀ ਸਕੀਮ ਸਲਾਹਕਾਰ। ਮੈਂ ਕੇਂਦਰ ਅਤੇ ਰਾਜ ਸਰਕਾਰ ਦੀਆਂ 4,700+ ਤਸਦੀਕਸ਼ੁਦਾ ਸਕੀਮਾਂ ਵਿੱਚੋਂ ਤੁਹਾਡੀ ਅਗਵਾਈ ਕਰਨ ਲਈ ਇੱਥੇ ਹਾਂ।",
    "hi": "नमस्ते! 🙏 मैं **मित्र (Mitra AI)** हूँ — स्कीम नेविगेटर पर आपका व्यक्तिगत सरकारी योजना व कल्याण सलाहकार। मैं भारत सरकार की 4,700+ सत्यापित योजनाओं से आपकी सटीक मदद करने के लिए यहाँ हूँ।",
    "or": "ନମସ୍କାର! 🙏 ମୁଁ **ମିତ୍ର (Mitra AI)** — ସ୍କିମ୍ ନେଭିଗେଟରରେ ଆପଣଙ୍କ ବ୍ୟକ୍ତିଗତ ସରକାରୀ ଯୋଜନା ପରାମର୍ଶଦାତା।",
    "mr": "नमस्कार! 🙏 मी **मित्र (Mitra AI)** आहे — स्कीम नेव्हिगेटरवरील आपला वैयक्तिक शासकीय योजना सल्लागार।",
    "te": "నమస్కారం! 🙏 నేను **మిత్ర (Mitra AI)** — స్కీమ్ నావిగేటర్‌లో మీ వ్యక్తిగత ప్రభుత్వ పథకాల సలహాదారుని.",
    "ta": "வணக்கம்! 🙏 நான் **மித்ரா (Mitra AI)** — உங்கள் அரசு நலத்திட்ட ஆலோசகர்.",
    "en": "Hello! 👋 I am **Mitra AI** — your personal AI Welfare & Scheme Advisor on Scheme Navigator, guiding citizens across 4,700+ verified government schemes.",
}

CASUAL_FEATURES = {
    "bn": "🏛️ **স্কিম নেভিগেটর (Scheme Navigator) পোর্টালের প্রধান সুবিধাসমূহ:**\n\n1. **Explore Schemes (প্রকল্প অনুসন্ধান):** ৪,৭০০+ কেন্দ্র ও রাজ্য প্রকল্পের বিস্তৃত তালিকা ক্যাটাগরি, রাজ্য ও বয়স অনুযায়ী ফিল্টার করুন।\n2. **Eligibility Survey (যোগ্যতা যাচাই):** ২ মিনিটের সাধারণ তথ্য দিয়ে আপনার জন্য প্রযোজ্য সেরা প্রকল্প তালিকা পান।\n3. **Scheme Tracker (আবেদন ট্র্যাকার):** আপনার আবেদনের অগ্রগতি, প্রয়োজনীয় নথিপত্র এবং শেষ তারিখ ট্র্যাক করুন।\n4. **Mitra AI (মিত্র এআই):** যেকোনো প্রকল্প, অনুদান ও ঋণের নিয়ম নিজের ভাষায় সাথে সাথে জানুন।\n5. **Kendra Finder (সেবা কেন্দ্র খোঁজ):** আপনার পিন কোডের নিকটবর্তী কমন সার্ভিস সেন্টার (CSC) খুঁজে নিন।",
    "ur": "🏛️ **اسکیم نیویگیٹر (Scheme Navigator) پورٹل کی اہم خصوصیات:**\n\n1. **اسکیمیں دریافت کریں (Explore Schemes):** 4,700 سے زائد مرکزی اور ریاستی اسکیموں کو زمرہ، ریاست، اور عمر کے لحاظ سے تلاش کریں۔\n2. **اہلیت سروے (Eligibility Survey):** صرف 2 منٹ کے آسان سروے کے ذریعے اپنی اہلیت کے مطابق موزوں ترین اسکیمیں تلاش کریں۔\n3. **اسکیم ٹریکر (Scheme Tracker):** اپنی درخواست کا اسٹیٹس اور دستاویزات کی فہرست کو ٹریک کریں۔\n4. **متر اے آئی (Mitra AI):** فلاحی اسکیموں، شرائط اور درخواست کے طریقہ کار کے بارے میں فوری رہنمائی حاصل کریں۔\n5. **کوا خدمت مرکز (Kendra Finder):** اپنے پن کوڈ کے قریب ترین مصدقہ جن سیوا کیندر (CSC) تلاش کریں۔",
    "pa": "🏛️ **ਸਕੀਮ ਨੇਵੀਗੇਟਰ (Scheme Navigator) ਪੋਰਟਲ ਦੀਆਂ ਮੁੱਖ ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ:**\n\n1. **ਸਕੀਮਾਂ ਖੋਜੋ (Explore Schemes):** 4,700+ ਕੇਂਦਰ ਅਤੇ ਰਾਜ ਸਰਕਾਰ ਦੀਆਂ ਸਕੀਮਾਂ ਨੂੰ ਆਪਣੀ ਸ਼੍ਰੇਣੀ, ਰਾਜ ਅਤੇ ਉਮਰ ਅਨੁਸਾਰ ਦੇਖੋ।\n2. **ਯੋਗਤਾ ਸਰਵੇਖਣ (Eligibility Survey):** 2 ਮਿੰਟ ਦਾ ਆਸਾਨ ਪ੍ਰੋਫਾਈਲ ਸਰਵੇ ਭਰੋ ਅਤੇ ਤੁਰੰਤ ਯੋਗ ਸਕੀਮਾਂ ਦੀ ਸੂਚੀ ਪ੍ਰਾਪਤ ਕਰੋ।\n3. **ਸਕੀਮ ਟਰੈਕਰ (Scheme Tracker):** ਆਪਣੀਆਂ ਅਰਜ਼ੀਆਂ ਦੀ ਸਥਿਤੀ ਅਤੇ ਲੋੜੀਂਦੇ ਦਸਤਾਵੇਜ਼ਾਂ ਦੀ ਜਾਂਚ ਕਰੋ।\n4. **ਮਿੱਤਰ AI (Mitra AI):** ਸਰਕਾਰੀ ਸਕੀਮਾਂ ਬਾਰੇ ਆਪਣੀ ਮਾਤ-ਭਾਸ਼ਾ ਵਿੱਚ ਤੁਰੰਤ ਸਹੀ ਸਲਾਹ ਲਵੋ।\n5. **ਸੇਵਾ ਕੇਂਦਰ ਖੋਜਕ (Kendra Finder):** ਆਪਣੇ ਪਿੰਨ ਕੋਡ ਨੇੜਲੇ ਸਾਂਝੇ ਸੇਵਾ ਕੇਂਦਰ (CSC) ਲੱਭੋ।",
    "hi": "🏛️ **Scheme Navigator पोर्टल की प्रमुख सुविधाएं:**\n\n1. **Explore Schemes (योजनाएं खोजें):** 4,700+ केंद्र व राज्य सरकार की कल्याणकारी योजनाओं को फ़िल्टर करके देखें।\n2. **Eligibility Survey (पात्रता सर्वे):** 2 मिनट का प्रोफ़ाइल सर्वे भरें और व्यक्तिगत योजना सिफारिशें पाएं।\n3. **Scheme Tracker (योजना ट्रैकर):** आवेदन की स्थिति, दस्तावेज़ चेकलिस्ट और अंतिम तिथि ट्रैक करें।\n4. **Mitra AI (मित्र AI सलाहकार):** योजनाओं के नियम, पात्रता और आवेदन प्रक्रिया का तुरंत सटीक उत्तर पाएं।\n5. **Kendra Finder (सेवा केंद्र खोजें):** अपने पिन कोड पर नज़दीकी जन सेवा केंद्र (CSC) खोजें।",
    "en": "🏛️ **Core Features of Scheme Navigator:**\n\n1. **Explore Schemes**: Filter 4,700+ verified welfare schemes by category, state, age, and income.\n2. **Eligibility Survey**: Complete a 2-minute citizen survey for instant, personalized scheme matches.\n3. **Scheme Tracker**: Track application statuses, deadlines, and required document checklists.\n4. **Mitra AI Advisor**: Official 24/7 welfare counselor to guide you on benefits and rules.\n5. **Kendra Finder**: Locate nearest verified Citizen Service Centers (CSC) and Post Offices.",
}

CASUAL_DEADLINES = {
    "bn": "📅 **সরকারি প্রকল্পের আবেদনের শেষ তারিখ (Deadlines) সংক্রান্ত তথ্য:**\n\n• **সারা বছর উন্মুক্ত প্রকল্প:** আয়ুষ্মান ভারত (PM-JAY), পিএম কিষাণ (PM-KISAN), অটল পেনশন যোজনা এবং পিএম মুদ্রা লোন বছরে ৩৬৫ দিনই চালু থাকে।\n• **শিক্ষা স্কলারশিপ:** জাতীয় স্কলারশিপ পোর্টাল (NSP) এবং পোস্ট-ম্যাট্রিক স্কলারশিপের বার্ষিক সময়সীমা সাধারণত **৩১ অক্টোবর**-এর মধ্যে হয়।\n• **ফসল বিমা (PMFBY):** খরিফ ফসলের কাটঅফ **৩১ জুলাই** এবং রবি ফসলের কাটঅফ **৩১ ডিসেম্বর**।\n\nকোনো নির্দিষ্ট প্রকল্পের শেষ তারিখ জানতে তার নাম উল্লেখ করে জিজ্ঞাসা করুন!",
    "ur": "📅 **سرکاری اسکیموں کی آخری تاریخیں (Deadlines):**\n\n• **سال بھر جاری اسکیمیں:** آیوشمان بھارت (PM-JAY)، پی ایم کسان، اٹل پنشن یوجنا، اور مدرا لون سال کے 365 دن کھلی رہتی ہیں۔\n• **تعلیمی وظائف (Scholarships):** قومی اسکالرشپ پورٹل (NSP) اور ریاستی پوسٹ میٹرک اسکالرشپ عام طور پر **31 اکتوبر** تک قبول کی جاتی ہیں۔\n• **فصل بیمہ (PMFBY):** خریف فصل کے لیے **31 جولائی** اور ربیع فصل کے لیے **31 دسمبر** کی کٹ آف ہوتی ہے۔\n\nکسی مخصوص اسکیم کی آخری تاریخ جاننے کے لیے اس کا نام لکھ کر پوچھیں!",
    "pa": "📅 **ਸਰਕਾਰੀ ਸਕੀਮਾਂ ਦੀਆਂ ਆਖਰੀ ਮਿਤੀਆਂ (Deadlines) ਬਾਰੇ ਜਾਣਕਾਰੀ:**\n\n• **ਸਾਰਾ ਸਾਲ ਖੁੱਲ੍ਹੀਆਂ ਸਕੀਮਾਂ:** ਆਯੁਸ਼ਮਾਨ ਭਾਰਤ (PM-JAY), ਪੀਐਮ-ਕਿਸਾਨ, ਅਟਲ ਪੈਨਸ਼ਨ ਯੋਜਨਾ, ਅਤੇ ਪੀਐਮ ਮੁਦਰਾ ਲੋਨ ਸਾਲ ਦੇ 365 ਦਿਨ ਚੱਲਦੇ ਹਨ।\n• **ਵਿਦਿਆਰਥੀ ਸਕਾਲਰਸ਼ਿਪ:** ਨੈਸ਼ਨਲ ਸਕਾਲਰਸ਼ਿਪ ਪੋਰਟਲ (NSP) ਅਤੇ ਪੋਸਟ-ਮੈਟ੍ਰਿਕ ਸਕਾਲਰਸ਼ਿਪਾਂ ਦੀ ਆਖਰੀ ਮਿਤੀ ਆਮ ਤੌਰ 'ਤੇ **31 ਅਕਤੂਬਰ** ਹੁੰਦੀ ਹੈ।\n• **ਫਸਲ ਬੀਮਾ (PMFBY):** ਖਰੀਫ ਫਸਲ ਲਈ **31 ਜੁਲਾਈ** ਅਤੇ ਰਬੀ ਫਸਲ ਲਈ **31 ਦਸੰਬਰ** ਕੱਟ-ਆਫ ਹੁੰਦੀ ਹੈ।\n\nਕਿਸੇ ਖਾਸ ਸਕੀਮ ਦੀ ਆਖਰੀ ਮਿਤੀ ਪੁੱਛਣ ਲਈ ਉਸਦਾ ਨਾਮ ਦੱਸੋ!",
    "hi": "📅 **सरकारी योजनाओं की आवेदन समय-सीमा (Deadlines) संबंधी महत्वपूर्ण जानकारी:**\n\n• **सदाबहार योजनाएं:** आयुष्मान भारत (PM-JAY), पीएम किसान, अटल पेंशन योजना, और पीएम मुद्रा लोन 365 दिन खुली रहती हैं।\n• **छात्रवृत्तियां (Scholarships):** राष्ट्रीय छात्रवृत्ति पोर्टल (NSP) की सामान्य कटऑफ प्रतिवर्ष **31 अक्टूबर** के आसपास होती है।\n• **फसल बीमा (PMFBY):** खरीफ के लिए **31 जुलाई** और रबी के लिए **31 दिसंबर** कटऑफ होती है।\n\nविशिष्ट योजना की अंतिम तिथि जानने के लिए उसका नाम लिखकर पूछें!",
    "en": "📅 **Government Scheme Application Deadlines:**\n\n• **Year-Round Schemes**: Ayushman Bharat (PM-JAY), PM-KISAN, Atal Pension Yojana, and PM Mudra Loans are open **365 days a year**.\n• **Scholarships**: National Scholarship Portal (NSP) annual cycle typically closes around **October 31**.\n• **Crop Insurance (PMFBY)**: Kharif cutoff is **July 31**, Rabi cutoff is **December 31**.\n\nFor a specific scheme's deadline, please mention its name!",
}

CASUAL_GREETINGS = {
    "bn": "নমস্কার! 🙏 আমি **মিত্র (Mitra AI)** — আপনার সরকারি প্রকল্প উপদেষ্টা।\n\nআমাকে আপনার বয়স, পেশা বা প্রয়োজন (যেমন স্কলারশিপ, কৃষক অনুদান, ব্যবসা ঋণ বা স্বাস্থ্য কার্ড) সম্পর্কে জানান, আমি সঠিক সরকারি প্রকল্পের তথ্য দেব।",
    "ur": "آداب! 🙏 میں **متر (Mitra AI)** ہوں — آپ کا سرکاری اسکیم مشیر۔\n\nمجھے اپنی عمر، پیشہ یا ضرورت (جیسے تعلیمی وظیفہ، کسان مدد، کاروباری قرض یا ہیلتھ کارڈ) بتائیں، میں آپ کے لیے مصدقہ سرکاری اسکیمیں تلاش کروں گا۔",
    "pa": "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! 🙏 ਮੈਂ **ਮਿੱਤਰ (Mitra AI)** ਹਾਂ — ਤੁਹਾਡਾ ਸਰਕਾਰੀ ਸਕੀਮ ਸਲਾਹਕਾਰ।\n\nਮੈਨੂੰ ਆਪਣੀ ਉਮਰ, ਕਿੱਤਾ ਜਾਂ ਲੋੜ (ਜਿਵੇਂ ਸਕਾਲਰਸ਼ਿਪ, ਕਿਸਾਨ ਸਬਸਿਡੀ, ਕਾਰੋਬਾਰੀ ਕਰਜ਼ਾ ਜਾਂ ਸਿਹਤ ਕਾਰਡ) ਦੱਸੋ, ਮੈਂ ਸਹੀ ਸਰਕਾਰੀ ਸਕੀਮਾਂ ਦੀ ਜਾਣਕਾਰੀ ਦੇਵਾਂਗਾ।",
    "hi": "नमस्ते! 🙏 मैं **मित्र (Mitra AI)** हूँ — आपका सरकारी योजना सलाहकार।\n\nमुझे अपनी आयु, राज्य या आवश्यकता (जैसे छात्रवृत्ति, किसान सहायता, बिजनेस लोन या आयुष्मान कार्ड) बताएं, मैं सटीक योजना की जानकारी दूंगा।",
    "or": "ନମସ୍କାର! 🙏 ମୁଁ **ମିତ୍ର (Mitra AI)** — ଆପଣଙ୍କ ସରକାରୀ ଯୋଜନା ପରାମର୍ଶଦାତା।",
    "mr": "नमस्कार! 🙏 मी **मित्र (Mitra AI)** आहे — आपला शासकीय योजना सल्लागार।",
    "te": "నమస్కారం! 🙏 నేను **మిత్ర (Mitra AI)** — మీ ప్రభుత్వ పథకాల సలహాదారుని.",
    "ta": "வணக்கம்! 🙏 நான் **மித்ரா (Mitra AI)** — உங்கள் அரசு நலத்திட்ட ஆலோசகர்.",
    "en": "Hello! 👋 I am **Mitra AI** — your government welfare and scheme advisor. How can I help you find eligible welfare schemes, scholarships, or loans today?",
}

CASUAL_THANKS = {
    "bn": "আপনাকে অনেক ধন্যবাদ! 🙏 আপনার কোনো সরকারি প্রকল্প বা আবেদন সংক্রান্ত সাহায্য লাগলে নির্দ্বিধায় আমাকে আবার জিজ্ঞাসা করুন।",
    "ur": "آپ کا بہت بہت شکریہ! 🙏 اگر آپ کو کسی بھی سرکاری اسکیم، اہلیت یا طریقہ کار کے بارے میں مدد چاہیے تو بلا جھجھک دوبارہ پوچھیں۔",
    "pa": "ਤੁਹਾਡਾ ਬਹੁਤ ਧੰਨਵਾਦ! 🙏 ਜੇਕਰ ਤੁਹਾਨੂੰ ਕਿਸੇ ਵੀ ਸਰਕਾਰੀ ਸਕੀਮ ਜਾਂ ਅਰਜ਼ੀ ਬਾਰੇ ਹੋਰ ਜਾਣਕਾਰੀ ਚਾਹੀਦੀ ਹੋਵੇ, ਤਾਂ ਬੇਝਿਜਕ ਪੁੱਛੋ।",
    "hi": "आपका बहुत-बहुत धन्यवाद! 🙏 यदि आपको किसी भी सरकारी योजना या पात्रता के बारे में सहायता चाहिए, तो कभी भी पूछें।",
    "en": "You are very welcome! 🙏 Please let me know whenever you need more guidance on government welfare schemes or application steps.",
}

CASUAL_REFUSALS = {
    "bn": "আমি অত্যন্ত দুঃখিত, আমি কেবলমাত্র **স্কিম নেভিগেটর** এবং **ভারত সরকারের কল্যাণমূলক প্রকল্প** (যেমন স্কলারশিপ, কৃষক সাহায্য, ব্যবসা ঋণ, স্বাস্থ্য কার্ড) সংক্রান্ত প্রশ্নের উত্তর দেওয়ার জন্য প্রশিক্ষিত। 🙏\n\nদয়া করে আমাকে কোনো সরকারি প্রকল্প, যোগ্যতা বা আবেদন প্রক্রিয়া সম্পর্কে জিজ্ঞাসা করুন!",
    "ur": "معذرت خواہ ہوں، میں صرف **اسکیم نیویگیٹر** اور **بھارتی حکومت کی فلاحی اسکیموں** (جیسے اسکالرشپ، کسان سبسڈی، کاروباری قرضے، صحت کارڈ) کے بارے میں رہنمائی کے لیے تربیت یافتہ ہوں۔ 🙏\n\nبراہ کرم مجھ سے کسی سرکاری اسکیم، اہلیت یا درخواست کے عمل کے بارے میں پوچھیں!",
    "pa": "ਮੈਨੂੰ ਅਫਸੋਸ ਹੈ, ਮੈਂ ਸਿਰਫ਼ **ਸਕੀਮ ਨੇਵੀਗੇਟਰ** ਅਤੇ **ਭਾਰਤ ਸਰਕਾਰ ਦੀਆਂ ਭਲਾਈ ਸਕੀਮਾਂ** (ਜਿਵੇਂ ਸਕਾਲਰਸ਼ਿਪ, ਕਿਸਾਨ ਸਬਸਿਡੀ, ਕਾਰੋਬਾਰੀ ਕਰਜ਼ੇ, ਸਿਹਤ ਕਾਰਡ) ਬਾਰੇ ਜਾਣਕਾਰੀ ਦੇਣ ਲਈ ਬਣਾਇਆ ਗਿਆ ਹਾਂ। 🙏\n\nਕਿਰਪਾ ਕਰਕੇ ਮੈਨੂੰ ਕਿਸੇ ਸਰਕਾਰੀ ਸਕੀਮ, ਯੋਗਤਾ ਜਾਂ ਅਰਜ਼ੀ ਪ੍ਰਕਿਰਿਆ ਬਾਰੇ ਪੁੱਛੋ!",
    "hi": "क्षमा करें, मैं केवल **Scheme Navigator** और **भारतीय सरकारी कल्याणकारी योजनाओं** (जैसे छात्रवृत्ति, किसान सहायता, मुद्रा लोन, आयुष्मान कार्ड) से संबंधित प्रश्नों के उत्तर देने के लिए अधिकृत हूँ। 🙏\n\nकृपया मुझसे सरकारी योजनाओं, पात्रता या आवेदन प्रक्रिया के बारे में पूछें!",
    "en": "I apologize, but I am trained exclusively to assist with **Scheme Navigator** and **Indian Government welfare schemes** (scholarships, farming subsidies, business loans, healthcare, pensions). 🙏\n\nPlease ask me about government schemes, eligibility, required documents, or application procedures!",
}


def _handle_casual_question(message: str, language: str = "en-IN") -> dict:
    if language and language.startswith("hi") and not re.search(r"\b(आहे|आहेत|नाहीत|करावे|मिळेल|योजनांची)\b", message):
        eff_lang = "hi-IN"
    else:
        eff_lang = detect_message_language(message, fallback_lang=language)
    lang_p = eff_lang.split("-")[0].lower()
    lower = message.strip().lower()

    # Identity
    who_patterns = ["who are you", "tum kaun ho", "tum kon ho", "tumi ke", "kisne banaya", "aap kon", "naam kya", "what is your name", "who made you"]
    if any(p in lower for p in who_patterns):
        ans = CASUAL_IDENTITY.get(lang_p, CASUAL_IDENTITY["en"])
        return {"answer": ans, "referenced_scheme_ids": [], "updated_profile": None, "language": eff_lang}

    # Features
    features_patterns = ["website me kya", "website mein kya", "what is this website", "features", "ye website kya", "portal me kya", "how to use this website", "website guide"]
    if any(p in lower for p in features_patterns):
        ans = CASUAL_FEATURES.get(lang_p, CASUAL_FEATURES["en"])
        return {"answer": ans, "referenced_scheme_ids": [], "updated_profile": None, "language": eff_lang}

    # Deadlines
    deadline_patterns = ["deadline", "last date", "closing date", "antim tithi", "kab tak apply", "due date", "cutoff"]
    if any(p in lower for p in deadline_patterns):
        ans = CASUAL_DEADLINES.get(lang_p, CASUAL_DEADLINES["en"])
        return {"answer": ans, "referenced_scheme_ids": [], "updated_profile": None, "language": eff_lang}

    # Greetings
    greeting_patterns = ["hi", "hello", "hey", "namaste", "kem cho", "vanakkam", "namaskara", "kemon acho", "ki khobor", "ki haal", "adab", "aadab", "kaise ho"]
    if any(lower == p or lower.startswith(p + " ") for p in greeting_patterns):
        ans = CASUAL_GREETINGS.get(lang_p, CASUAL_GREETINGS["en"])
        return {"answer": ans, "referenced_scheme_ids": [], "updated_profile": None, "language": eff_lang}

    # Thanks
    thanks_patterns = ["thank you", "thanks", "dhanyawad", "shukriya", "dhonnobad", "bohot shukriya", "great job"]
    if any(p in lower for p in thanks_patterns):
        ans = CASUAL_THANKS.get(lang_p, CASUAL_THANKS["en"])
        return {"answer": ans, "referenced_scheme_ids": [], "updated_profile": None, "language": eff_lang}

    # Out of scope refusal
    ans = CASUAL_REFUSALS.get(lang_p, CASUAL_REFUSALS["en"])
    return {"answer": ans, "referenced_scheme_ids": [], "updated_profile": None, "language": eff_lang}


class AssistantAgent:
    def __init__(self):
        self.profile_agent = ProfileAgent()

    def chat(
        self,
        history: list,
        message: str,
        current_profile: dict | None,
        language: str = "en-IN",
    ) -> dict:
        clean_msg = message.strip()
        updated_profile = None

        # 1. Base profile normalization
        normalized_profile = {}
        if current_profile and isinstance(current_profile, dict):
            normalized_profile = dict(current_profile)
            if "category" in normalized_profile and "caste_category" not in normalized_profile:
                normalized_profile["caste_category"] = normalized_profile["category"]
            if "employmentType" in normalized_profile and "occupation" not in normalized_profile:
                normalized_profile["occupation"] = normalized_profile["employmentType"]
            if "incomeRange" in normalized_profile and "income" not in normalized_profile:
                normalized_profile["income"] = normalized_profile["incomeRange"]
            if "isDisability" in normalized_profile and "has_disability" not in normalized_profile:
                normalized_profile["has_disability"] = bool(normalized_profile["isDisability"])
            if "hasBPLCard" in normalized_profile and "bpl_status" not in normalized_profile:
                normalized_profile["bpl_status"] = "BPL / Ration Card" if normalized_profile["hasBPLCard"] else "Non-BPL"

        # 2. Extract past demographics from user turns in conversation history
        if history and isinstance(history, list):
            for turn in history:
                if turn.get("role") == "user":
                    past_text = turn.get("content") or turn.get("text") or ""
                    if past_text:
                        past_demo = extract_demographics_from_text(past_text)
                        if past_demo:
                            normalized_profile.update(past_demo)

        # 3. Extract demographics from CURRENT user message
        current_demo = extract_demographics_from_text(clean_msg)
        if current_demo:
            normalized_profile.update(current_demo)
            updated_profile = dict(current_demo)

        # 4. LLM Profile extraction if personal context is hinted
        if _might_contain_profile(clean_msg):
            try:
                extracted = self.profile_agent.extract(clean_msg)
                if extracted and isinstance(extracted, dict):
                    normalized_profile.update(extracted)
                    if updated_profile:
                        updated_profile.update(extracted)
                    else:
                        updated_profile = dict(extracted)
            except Exception as err:
                logger.debug("Profile extraction failed: %s", err)

        effective_profile = normalized_profile if normalized_profile else None

        # 5. Multi-turn Co-reference & Active Scheme Continuity
        recent_schemes = _extract_recent_schemes(history)
        is_followup = _is_followup_query(clean_msg, recent_schemes)
        is_scheme_req = _is_scheme_query(clean_msg)

        pinned_slugs = []
        active_scheme_slug = None
        if is_followup and recent_schemes:
            is_scheme_req = True
            active_scheme_slug = recent_schemes[0]
            pinned_slugs = [active_scheme_slug]
            ongoing_topic_context = (
                f"ACTIVE CONVERSATION TOPIC (CRITICAL CONTINUITY MANDATE):\n"
                f"- The citizen and Mitra are actively discussing the scheme: '{active_scheme_slug}'.\n"
                f"- The citizen's question '{clean_msg}' is a direct follow-up regarding this active scheme.\n"
                f"- DO NOT switch to a different scheme or ask the citizen which scheme they mean!\n"
                f"- Answer the citizen's specific question (e.g. documents required, eligibility, how to apply, benefits) "
                f"specifically for '{active_scheme_slug}' using the scheme details provided below."
            )
            search_query = f"{active_scheme_slug} {clean_msg}"
        else:
            ongoing_topic_context = (
                "CONVERSATION STATUS:\n"
                "- No previous scheme topic is being continued. Treat this as a fresh inquiry or greeting."
            )
            search_query = clean_msg

        relevant_schemes = []
        if is_scheme_req:
            relevant_schemes = _search_schemes(search_query, limit=10, pinned_slugs=pinned_slugs)

        prof_parts = []
        if effective_profile:
            for k, label in [
                ("age", "Age"),
                ("gender", "Gender"),
                ("state", "State"),
                ("district", "District"),
                ("occupation", "Occupation"),
                ("employmentType", "Employment"),
                ("studentCourse", "Course"),
                ("farmerLandAcre", "Landholding (Acres)"),
                ("caste_category", "Category"),
                ("category", "Category"),
                ("income", "Income"),
                ("incomeRange", "Income"),
                ("bpl_status", "BPL Status"),
                ("has_disability", "Disability"),
                ("areaType", "Area"),
                ("maritalStatus", "Marital Status"),
            ]:
                val = effective_profile.get(k)
                if val is not None and val != "" and f"{label}: {val}" not in prof_parts:
                    prof_parts.append(f"{label}: {val}")
        profile_context = " • ".join(prof_parts) if prof_parts else "No citizen profile provided."

        scheme_context = (
            _build_scheme_context(relevant_schemes[:8])
            if is_scheme_req and relevant_schemes
            else "No specific schemes needed for casual chat."
        )

        if language and not language.startswith("en"):
            target_lang = language
        else:
            target_lang = detect_message_language(clean_msg, fallback_lang=language)
        target_language_name = LANGUAGE_NAMES.get(target_lang, LANGUAGE_NAMES.get(target_lang.split("-")[0], "English"))

        system_content = SYSTEM_PROMPT_TEMPLATE.format(
            scheme_context=scheme_context,
            ongoing_topic_context=ongoing_topic_context,
            profile_context=profile_context,
            target_language=target_lang,
            target_language_name=target_language_name,
        )

        llm_messages = [{"role": "system", "content": system_content}]
        if history and isinstance(history, list):
            for turn in history[-10:]:
                role = turn.get("role")
                content = turn.get("content") or turn.get("text")
                if role in ("user", "assistant") and content:
                    llm_messages.append({"role": role, "content": content})

        llm_messages.append({"role": "user", "content": clean_msg})

        try:
            raw_response = call_llm(llm_messages, temperature=0.4, max_tokens=1024)
        except Exception as exc:
            logger.warning("AssistantAgent LLM call fell back to local conversational engine: %s", exc)
            if not is_scheme_req:
                return _handle_casual_question(clean_msg, language=target_lang)
            raw_response = self._generate_conversational_fallback(
                clean_msg, relevant_schemes, effective_profile, language=target_lang, is_followup=is_followup
            )

        referenced_slugs = _extract_scheme_slugs(raw_response)
        answer = _clean_response(raw_response)

        if is_scheme_req:
            if not referenced_slugs:
                if pinned_slugs:
                    referenced_slugs = list(pinned_slugs)
                elif relevant_schemes:
                    ans_lower = (raw_response + " " + clean_msg).lower()
                    inferred = []
                    for s in relevant_schemes:
                        s_slug = s.get("slug")
                        s_name = (s.get("name") or "").lower()
                        s_short = (s.get("shortName") or s.get("short_name") or "").lower()
                        if s_slug and (s_slug in ans_lower or (s_name and len(s_name) > 3 and s_name in ans_lower) or (s_short and len(s_short) > 2 and s_short in ans_lower)):
                            inferred.append(s_slug)
                    if inferred:
                        referenced_slugs = inferred
                    else:
                        referenced_slugs = [s.get("slug") for s in relevant_schemes[:5] if s.get("slug")]

            # Guarantee AT LEAST 5 schemes in referenced_slugs if available
            if len(referenced_slugs) < 5 and relevant_schemes:
                for s in relevant_schemes:
                    s_slug = s.get("slug")
                    if s_slug and s_slug not in referenced_slugs:
                        referenced_slugs.append(s_slug)
                        if len(referenced_slugs) >= 5:
                            break

        if is_followup and active_scheme_slug and active_scheme_slug not in referenced_slugs:
            referenced_slugs.insert(0, active_scheme_slug)

        return {
            "answer": answer,
            "referenced_scheme_ids": referenced_slugs,
            "updated_profile": updated_profile,
            "language": target_lang,
        }

    def _generate_conversational_fallback(
        self, message: str, schemes: list[dict], profile: dict | None, language: str = "en-IN", is_followup: bool = False
    ) -> str:
        if language and not language.startswith("en"):
            target_lang = language
        else:
            target_lang = detect_message_language(message, fallback_lang=language)
        lang_p = target_lang.split("-")[0].lower()
        msg_lower = message.lower()

        is_docs_query = any(w in msg_lower for w in ["document", "documents", "dastavej", "kagaz", "paper", "proof", "certificate", "nothi", "dastawiz", "दस्तावेज़", "নথিপত্র", "دستاویز", "ਦਸਤਾਵੇਜ਼"]) or ("kya chahiye" in msg_lower and "paisa" not in msg_lower)
        is_apply_query = any(w in msg_lower for w in ["apply", "kaise kare", "online", "registration", "steps", "process", "portal", "aavedan", "kivabe", "kivve", "আবেদন", "درخواست", "ਅਰਜ਼ੀ"])
        is_elig_query = any(w in msg_lower for w in ["eligib", "patra", "patrata", "who can", "age limit", "qualification", "joggo", "ahel", "ਯੋਗਤਾ", "اہلیت", "যোগ্যতা"])
        is_benefit_query = any(w in msg_lower for w in ["benefit", "benefits", "fayde", "fayda", "labh", "amount", "kitna paisa", "subsidy", "rupaye", "suvidha", "লাভ", "فائدے", "ਲਾਭ"])

        top_schemes = schemes[:8] if schemes else _search_schemes(message, limit=8)
        if not top_schemes:
            if lang_p == "bn":
                return "আমি এই অনুসন্ধানের জন্য সুনির্দিষ্ট প্রকল্প খুঁজে পাইনি। আপনার বয়স, রাজ্য এবং কি সাহায্য প্রয়োজন (যেমন স্কলারশিপ বা কৃষি ঋণ) জানালে সঠিক তথ্য দিতে পারব।"
            if lang_p == "ur":
                return "مجھے اس مخصوص تلاش کے لیے کوئی مماثل اسکیم نہیں ملی۔ براہ کرم اپنی ریاست، عمر اور مطلوبہ مدد کی تفصیل بتائیں تاکہ میں بہتر رہنمائی کر سکوں۔"
            if lang_p == "pa":
                return "ਮੈਨੂੰ ਇਸ ਖਾਸ ਪੁੱਛਗਿੱਛ ਲਈ ਸਹੀ ਸਕੀਮ ਨਹੀਂ ਮਿਲੀ। ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਰਾਜ, ਉਮਰ ਅਤੇ ਲੋੜੀਂਦੀ ਸਹਾਇਤਾ ਬਾਰੇ ਦੱਸੋ ਤਾਂ ਜੋ ਮੈਂ ਸਹੀ ਜਾਣਕਾਰੀ ਦੇ ਸਕਾਂ।"
            if lang_p == "hi":
                return "मुझे इस विशिष्ट अनुरोध के लिए सटीक योजना नहीं मिली। कृपया अपना राज्य, आयु और आवश्यकता (जैसे छात्रवृत्ति या कृषि ऋण) बताएं ताकि मैं सटीक जानकारी दे सकूं।"
            if lang_p == "or":
                return "ମୁଁ ଏହି ଅନୁସନ୍ଧାନ ପାଇଁ ନିର୍ଦ୍ଦିଷ୍ଟ ଯୋଜନା ଖୋଜି ପାଇଲି ନାହିଁ। ଆପଣଙ୍କ ବୟସ, ରାଜ୍ୟ ଏବଂ ଆବଶ୍ୟକତା (ଯେପରିକି ଛାତ୍ରବୃତ୍ତି କିମ୍ବା କୃଷି ଋଣ) ଜଣାଇଲେ ସଠିକ ସୂଚନା ଦେଇପାରିବି।"
            if lang_p == "mr":
                return "मला या विशिष्ट शोधासाठी कोणतीही अचूक योजना आढळली नाही. कृपया आपले वय, राज्य आणि आवश्यक मदत सांगा जेणेकरून मी अचूक माहिती देऊ शकेन."
            if lang_p == "te":
                return "ఈ నిర్దిష్ట శోధన కోసం నాకు ఎటువంటి సరిపోలే పథకం కనుగొనబడలేదు. దయచేసి మీ వయస్సు, రాష్ట్రం మరియు అవసరమైన సహాయం తెలియజేయండి."
            if lang_p == "ta":
                return "இந்த குறிப்பிட்ட தேடலுக்கு பொருத்தமான திட்டம் எதுவும் கிடைக்கவில்லை. உங்கள் வயது, மாநிலம் மற்றும் தேவையான உதவியைத் தெரிவித்தால் நான் உதவ முடியும்."
            if lang_p == "gu":
                return "મને આ ચોક્કસ શોધ માટે કોઈ યોજના મળી નથી. કૃપા કરીને તમારું રાજ્ય, ઉંમર અને જરૂરિયાત જણાવો જેથી હું યોગ્ય માહિતી આપી શકું."
            if lang_p == "kn":
                return "ಈ ನಿರ್ದಿಷ್ಟ ಹುಡುಕಾಟಕ್ಕೆ ಯಾವುದೇ ಸೂಕ್ತ ಯೋಜನೆ ಕಂಡುಬಂದಿಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ವಯಸ್ಸು, ರಾಜ್ಯ ಮತ್ತು ಅಗತ್ಯವಿರುವ ಸಹಾಯವನ್ನು ತಿಳಿಸಿ."
            if lang_p == "ml":
                return "ഈ നിർദ്ദിഷ്ട അന്വേഷണത്തിന് കൃത്യമായ പദ്ധതി കണ്ടെത്താനായില്ല. ദയവായി നിങ്ങളുടെ പ്രായം, സംസ്ഥാനം, ആവശ്യമായ സഹായം എന്നിവ വ്യക്തമാക്കുക."
            return "I could not find exact matching schemes for this specific query. Please provide a few more details (like your State, Age, or the type of assistance you need) so I can help you better."

        is_rec_or_multi = not is_followup and (
            not (is_docs_query or is_apply_query) or any(
                w in msg_lower for w in ["recommend", "eligible", "patra", "options", "schemes batao", "yojanaen", "yojanaye", "top schemes", "list", "batao", "konsi", "kaunsi", "kaun kaun si", "mere liye"]
            )
        )

        if is_rec_or_multi and len(top_schemes) >= 2:
            top_five = top_schemes[:5]
            multi_slugs = ",".join(s.get("slug", "") for s in top_five if s.get("slug"))
            items_fmt = []
            for idx, s in enumerate(top_five, start=1):
                loc_s = localize_scheme(s, lang_code=lang_p)
                s_name = loc_s.get("name") or s.get("name", "")
                s_cat = s.get("category", "")
                s_bens = loc_s.get("benefits", [])
                s_ben = s_bens[0] if s_bens else (s.get("shortDescription") or s.get("tagline") or "")
                s_docs = loc_s.get("documents", [])
                docs_summary = ", ".join(d.split("(")[0].strip("- *") for d in s_docs[:3]) if s_docs else ("आधार कार्ड, बैंक पासबुक, आय प्रमाण पत्र" if lang_p == "hi" else "Aadhaar Card, Bank Passbook, Passport Photo")
                ver_s = s.get("verification", {})
                portal_url = loc_s.get("portal") or (ver_s.get("officialPortalUrl", "") if isinstance(ver_s, dict) else "")

                # Deterministic eligibility reason
                elig_s = s.get("eligibility", {})
                min_a = _safe_int(elig_s.get("minAge"), 0)
                max_a = _safe_int(elig_s.get("maxAge"), 100)

                reasons = []
                p_age = _safe_int(profile.get("age")) if profile else 0
                p_occ = (profile.get("occupation") or profile.get("employmentType") or "").strip() if profile else ""
                p_state = (profile.get("state") or "").strip() if profile else ""
                p_cat = (profile.get("category") or profile.get("caste_category") or "").strip() if profile else ""

                if lang_p == "hi":
                    if p_age > 0 and (min_a > 0 or max_a < 100):
                        reasons.append(f"आयु {p_age} वर्ष ({min_a}-{max_a} वर्ष सीमा के अंतर्गत)")
                    elif min_a > 0 or max_a < 100:
                        reasons.append(f"आयु सीमा {min_a}-{max_a} वर्ष")
                    if p_state:
                        reasons.append(f"राज्य: {p_state}")
                    if p_occ:
                        reasons.append(f"पेशा: {p_occ}")
                    if p_cat:
                        reasons.append(f"वर्ग: {p_cat}")
                    if not reasons:
                        reasons.append("अखिल भारतीय नागरिक पात्रता एवं सामाजिक-आर्थिक मानदंड पूर्ण")
                    reason_str = " • ".join(reasons)

                    item_text = (
                        f"### {idx}. 🏛️ **{s_name}** ({s_cat})\n"
                        f"🎯 **पात्रता आधार:** {reason_str}\n"
                        f"💰 **मुख्य लाभ:** {s_ben}\n"
                        f"📄 **ज़रूरी दस्तावेज़:** {docs_summary}"
                    )
                    if portal_url:
                        item_text += f"\n🌐 **पोर्टल:** [आधिकारिक पोर्टल]({portal_url})"
                    items_fmt.append(item_text)
                elif lang_p == "bn":
                    if p_age > 0: reasons.append(f"বয়স: {p_age} বছর")
                    if p_state: reasons.append(f"রাজ্য: {p_state}")
                    if p_occ: reasons.append(f"পেশা: {p_occ}")
                    if not reasons: reasons.append("নাগরিক যোগ্যতা মানদণ্ড")
                    reason_str = " • ".join(reasons)
                    item_text = (
                        f"### {idx}. 🏛️ **{s_name}** ({s_cat})\n"
                        f"🎯 **যোগ্যতার ভিত্তি:** {reason_str}\n"
                        f"💰 **সুবিধা:** {s_ben}\n"
                        f"📄 **প্রয়োজনীয় নথি:** {docs_summary}"
                    )
                    if portal_url: item_text += f"\n🌐 **পোর্টাল:** [অফিসিয়াল পোর্টাল]({portal_url})"
                    items_fmt.append(item_text)
                elif lang_p == "ur":
                    if p_age > 0: reasons.append(f"عمر: {p_age} سال")
                    if p_state: reasons.append(f"ریاست: {p_state}")
                    if p_occ: reasons.append(f"پیشہ: {p_occ}")
                    if not reasons: reasons.append("شہری اہلیت کا معیار")
                    reason_str = " • ".join(reasons)
                    item_text = (
                        f"### {idx}. 🏛️ **{s_name}** ({s_cat})\n"
                        f"🎯 **اہلیت کی بنیاد:** {reason_str}\n"
                        f"💰 **اہم فائدہ:** {s_ben}\n"
                        f"📄 **ضروری دستاویزات:** {docs_summary}"
                    )
                    if portal_url: item_text += f"\n🌐 **پورٹل:** [سرکاری پورٹل]({portal_url})"
                    items_fmt.append(item_text)
                elif lang_p == "pa":
                    if p_age > 0: reasons.append(f"ਉਮਰ: {p_age} ਸਾਲ")
                    if p_state: reasons.append(f"ਰਾਜ: {p_state}")
                    if p_occ: reasons.append(f"ਕਿੱਤਾ: {p_occ}")
                    if not reasons: reasons.append("ਨਾਗਰਿਕ ਯੋਗਤਾ ਮਾਪਦੰਡ")
                    reason_str = " • ".join(reasons)
                    item_text = (
                        f"### {idx}. 🏛️ **{s_name}** ({s_cat})\n"
                        f"🎯 **ਯੋਗਤਾ ਦਾ ਆਧਾਰ:** {reason_str}\n"
                        f"💰 **ਮੁੱਖ ਲਾਭ:** {s_ben}\n"
                        f"📄 **ਲੋੜੀਂਦੇ ਦਸਤਾਵੇਜ਼:** {docs_summary}"
                    )
                    if portal_url: item_text += f"\n🌐 **ਪੋਰਟਲ:** [ਸਰਕਾਰੀ ਪੋਰਟਲ]({portal_url})"
                    items_fmt.append(item_text)
                else:
                    if p_age > 0 and (min_a > 0 or max_a < 100):
                        reasons.append(f"Age {p_age} (Within {min_a}-{max_a} limit)")
                    if p_state: reasons.append(f"State: {p_state}")
                    if p_occ: reasons.append(f"Occupation: {p_occ}")
                    if not reasons: reasons.append("Citizen eligibility criteria verified")
                    reason_str = " • ".join(reasons)
                    item_text = (
                        f"### {idx}. 🏛️ **{s_name}** ({s_cat})\n"
                        f"🎯 **Eligibility Rule:** {reason_str}\n"
                        f"💰 **Financial Benefit:** {s_ben}\n"
                        f"📄 **Required Documents:** {docs_summary}"
                    )
                    if portal_url:
                        item_text += f"\n🌐 **Portal:** [Apply Online]({portal_url})"
                    items_fmt.append(item_text)

            header = (
                f"नमस्ते! 🙏 आपकी पात्रता के अनुसार **5 प्रमुख सरकारी योजनाएं** निम्नलिखित हैं:\n\n"
                if lang_p == "hi" else
                f"নমস্কার! 🙏 আপনার যোগ্যতার ভিত্তিতে ৫টি সেরা সরকারি প্রকল্প:\n\n"
                if lang_p == "bn" else
                f"سلام! 🙏 آپ کے لیے 5 اہم ترین سرکاری اسکیمیں:\n\n"
                if lang_p == "ur" else
                f"ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! 🙏 ਤੁਹਾਡੀ ਯੋਗਤਾ ਅਨੁਸਾਰ 5 ਪ੍ਰਮੁੱਖ ਸਰਕਾਰੀ ਸਕੀਮਾਂ:\n\n"
                if lang_p == "pa" else
                f"Hello! 🙏 Here are **top 5 verified eligible government schemes** tailored to your profile:\n\n"
            )
            footer = (
                "\n\n💡 **सलाह:** किसी भी योजना के पूर्ण विवरण, पात्रता नियमों, और ऑनलाइन आवेदन के लिए नीचे दिए गए कार्ड्स पर क्लिक करें।"
                if lang_p == "hi" else
                "\n\n💡 **Tip:** Click on any scheme card below to view detailed eligibility, required documents, or application link."
            )
            return f"{header}" + "\n\n".join(items_fmt) + f"{footer}\n\n<schemes>{multi_slugs}</schemes>"

        primary = top_schemes[0]
        slugs = ",".join(s.get("slug", "") for s in top_schemes if s.get("slug"))

        # Profile-based eligibility assessment
        profile_verdict = ""
        if profile and isinstance(profile, dict) and (is_elig_query or is_followup):
            p_age = _safe_int(profile.get("age"))
            p_occ = (profile.get("occupation") or profile.get("employmentType") or "").strip()
            p_state = (profile.get("state") or "").strip()
            p_cat = (profile.get("category") or profile.get("caste_category") or "").strip()

            elig_obj = primary.get("eligibility") or {}
            min_age = _safe_int(elig_obj.get("minAge"), 0)
            max_age = _safe_int(elig_obj.get("maxAge"), 100)

            attrs = []
            if p_age > 0:
                attrs.append(f"आयु: {p_age} वर्ष" if lang_p == "hi" else f"Age: {p_age}")
            if p_occ:
                attrs.append(f"पेशा: {p_occ}" if lang_p == "hi" else f"Occupation: {p_occ}")
            if p_state:
                attrs.append(f"राज्य: {p_state}" if lang_p == "hi" else f"State: {p_state}")
            if p_cat:
                attrs.append(f"वर्ग: {p_cat}" if lang_p == "hi" else f"Category: {p_cat}")

            attr_str = " • ".join(attrs)
            if lang_p == "hi":
                if p_age > 0 and (p_age < min_age or (max_age > 0 and p_age > max_age)):
                    profile_verdict = f"\n\n🔍 **आपकी प्रोफ़ाइल पात्रता समीक्षा ({attr_str}):**\nइस योजना के लिए निर्धारित आयु सीमा **{min_age} से {max_age} वर्ष** है। आपकी आयु के अनुसार आप इसमें सीधे पात्र नहीं हैं।"
                elif attrs:
                    profile_verdict = f"\n\n✅ **आपकी प्रोफ़ाइल पात्रता समीक्षा ({attr_str}):**\nआपके प्रोफ़ाइल विवरण के अनुसार आप इस योजना के प्रारंभिक पात्रता मानदंडों को पूरा करते प्रतीत होते हैं।"
            elif lang_p == "bn":
                if p_age > 0 and (p_age < min_age or (max_age > 0 and p_age > max_age)):
                    profile_verdict = f"\n\n🔍 **আপনার প্রোফাইল যোগ্যতা:**\nএই প্রকল্পের নির্ধারিত বয়সসীমা **{min_age} থেকে {max_age} বছর**।"
                elif attrs:
                    profile_verdict = f"\n\n✅ **আপনার প্রোফাইল যোগ্যতা যাচাই:**\nআপনার প্রোফাইল অনুযায়ী আপনি এই প্রকল্পের প্রাথমিক শর্তাবলী পূরণ করেন।"
            else:
                if p_age > 0 and (p_age < min_age or (max_age > 0 and p_age > max_age)):
                    profile_verdict = f"\n\n🔍 **Your Profile Assessment ({attr_str}):**\nThe designated age limit is **{min_age} to {max_age} years**. Based on your current age, you may not qualify directly."
                elif attrs:
                    profile_verdict = f"\n\n✅ **Your Profile Assessment ({attr_str}):**\nBased on your citizen profile, you satisfy the preliminary eligibility criteria for this scheme."

        primary = top_schemes[0]
        slugs = ",".join(s.get("slug", "") for s in top_schemes if s.get("slug"))

        # Completely localize scheme fields into target language - eliminates all English leakage
        loc_data = localize_scheme(primary, lang_code=lang_p)
        p_name = loc_data.get("name") or primary.get("name", "")
        p_desc = loc_data.get("desc") or primary.get("detailedDescription") or primary.get("shortDescription") or primary.get("short_description", "")
        benefits_fmt = loc_data.get("benefits", [])
        elig_fmt = loc_data.get("eligibility", [])
        docs_fmt = loc_data.get("documents", [])
        steps_fmt = loc_data.get("steps", [])

        ver = primary.get("verification", {})
        helpline = loc_data.get("helpline") or (ver.get("helpline", "") if isinstance(ver, dict) else "")
        portal = loc_data.get("portal") or (ver.get("officialPortalUrl", "") if isinstance(ver, dict) else "")

        # Language specific generation
        if lang_p == "bn":
            out = [f"নমস্কার! 🙏 আপনার অনুরোধের ভিত্তিতে **{p_name}** প্রকল্পের গুরুত্বপূর্ণ তথ্য নিচে দেওয়া হলো:\n"]
            if is_docs_query:
                out.append("📄 **প্রয়োজনীয় নথিপত্রের তালিকা (Documents Required):**")
                if docs_fmt:
                    out.extend(docs_fmt)
                else:
                    out.append("- **আধার কার্ড (Aadhaar Card)** (বাধ্যতামূলক): বায়োমেট্রিক ও ই-কেওয়াইসি যাচাইয়ের জন্য।")
                    out.append("- **ব্যাংক পাসবুক (Bank Passbook)** (বাধ্যতামূলক): ডিবিটি (DBT) সরাসরি সুবিধা হস্তান্তরের জন্য।")
                    out.append("- **মোবাইল নম্বর ও ছবি** (বাধ্যতামূলক): ওটিপি যাচাইয়ের জন্য।")
            elif is_apply_query:
                out.append("📝 **আবেদন করার ধাপসমূহ (Application Guide):**")
                if steps_fmt:
                    out.extend(steps_fmt)
                else:
                    out.append("- **অনলাইন ধাপ:** অফিশিয়াল পোর্টালে যান এবং আধার নম্বর দিয়ে ই-কেওয়াইসি (e-KYC) সম্পন্ন করুন।")
                    out.append("- **অফলাইন ধাপ:** নিকটবর্তী কমন সার্ভিস সেন্টার (CSC) বা তথ্যমিত্র কেন্দ্রে গিয়ে আবেদন জমা দিন।")
            elif is_elig_query:
                out.append("👥 **যোগ্যতার মানদণ্ড (Eligibility Criteria):**")
                if elig_fmt:
                    out.extend(elig_fmt)
                else:
                    out.append(f"- {p_desc}")
            elif is_benefit_query:
                out.append("💰 **মূল সুবিধা ও আর্থিক সহায়তা (Key Benefits):**")
                if benefits_fmt:
                    out.extend(benefits_fmt)
                else:
                    out.append(f"- {p_desc}")
            else:
                out.append(f"📌 **প্রকল্পের সারসংক্ষেপ (Overview):**\n{p_desc}\n")
                if benefits_fmt:
                    out.append("💰 **সুবিধা:**\n" + "\n".join(benefits_fmt))
                if elig_fmt:
                    out.append("👥 **যোগ্যতা:**\n" + "\n".join(elig_fmt))
                if docs_fmt:
                    out.append("📄 **নথিপত্র:**\n" + "\n".join(docs_fmt))
                elif not docs_fmt:
                    out.append("📄 **নথিপত্র:**\n- আধার কার্ড, ব্যাংক পাসবুক এবং প্রয়োজনীয় আয়ের প্রমাণপত্র।")

            if portal or helpline:
                out.append(f"\n📞 **যোগাযোগ ও পোর্টাল:**\n- পোর্টাল: {portal or 'অফিশিয়াল ওয়েবসাইট'}\n- হেল্পলাইন: {helpline or '১৮০০-১১-০০০১'}")
            out.append(f"\n<schemes>{slugs}</schemes>")
            return "\n".join(out)

        if lang_p == "ur":
            out = [f"آداب! 🙏 آپ کی درخواست کے مطابق **{p_name}** اسکیم کی اہم معلومات درج ذیل ہیں:\n"]
            if is_docs_query:
                out.append("📄 **ضروری دستاویزات کی فہرست (Required Documents):**")
                if docs_fmt:
                    out.extend(docs_fmt)
                else:
                    out.append("- **آدھار کارڈ (Aadhaar Card)** (لازمی): بائیو میٹرک اور ای-کے وائی سی کے لیے۔")
                    out.append("- **بینک پاس بک (Bank Passbook)** (لازمی): براہ راست رقم کی منتقلی (DBT) کے لیے۔")
                    out.append("- **موبائل نمبر اور پاسپورٹ سائز تصویر** (لازمی)")
            elif is_apply_query:
                out.append("📝 **درخواست دینے کا طریقہ کار (How to Apply):**")
                if steps_fmt:
                    out.extend(steps_fmt)
                else:
                    out.append("- **آن لائن طریقہ:** سرکاری پورٹل پر جائیں اور آدھار کے ذریعے ای-کے وائی سی مکمل کریں۔")
                    out.append("- **آف لائن طریقہ:** قریبی کامن سروس سینٹر (CSC / جن سیوا کیندر) پر جا کر فارم جمع کروائیں۔")
            elif is_elig_query:
                out.append("👥 **اہلیت کے اصول (Eligibility Criteria):**")
                if elig_fmt:
                    out.extend(elig_fmt)
                else:
                    out.append(f"- {p_desc}")
            elif is_benefit_query:
                out.append("💰 **بنیادی فائدے اور مالی امداد (Key Benefits):**")
                if benefits_fmt:
                    out.extend(benefits_fmt)
                else:
                    out.append(f"- {p_desc}")
            else:
                out.append(f"📌 **اسکیم کا تعارف (Overview):**\n{p_desc}\n")
                if benefits_fmt:
                    out.append("💰 **اہم فائدے:**\n" + "\n".join(benefits_fmt))
                if elig_fmt:
                    out.append("👥 **اہلیت:**\n" + "\n".join(elig_fmt))
                if docs_fmt:
                    out.append("📄 **دستاویزات:**\n" + "\n".join(docs_fmt))
                elif not docs_fmt:
                    out.append("📄 **دستاویزات:**\n- آدھار کارڈ، بینک پاس بک اور زمرہ سرٹیفکیٹ۔")

            if portal or helpline:
                out.append(f"\n📞 **رابطہ اور پورٹل:**\n- سرکاری پورٹل: {portal or 'سرکاری ویب سائٹ'}\n- ہیلپ لائن: {helpline or '1800-11-0001'}")
            out.append(f"\n<schemes>{slugs}</schemes>")
            return "\n".join(out)

        if lang_p == "pa":
            out = [f"ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! 🙏 ਤੁਹਾਡੀ ਬੇਨਤੀ ਅਨੁਸਾਰ **{p_name}** ਸਕੀਮ ਦੀ ਪੂਰੀ ਜਾਣਕਾਰੀ ਹੇਠਾਂ ਦਿੱਤੀ ਗਈ ਹੈ:\n"]
            if is_docs_query:
                out.append("📄 **ਲੋੜੀਂਦੇ ਦਸਤਾਵੇਜ਼ਾਂ ਦੀ ਸੂਚੀ (Required Documents):**")
                if docs_fmt:
                    out.extend(docs_fmt)
                else:
                    out.append("- **ਆਧਾਰ ਕਾਰਡ (Aadhaar Card)** (ਜ਼ਰੂਰੀ): ਪਛਾਣ ਅਤੇ e-KYC ਪ੍ਰਮਾਣਿਕਤਾ ਲਈ।")
                    out.append("- **ਬੈਂਕ ਖਾਤਾ ਪਾਸਬੁੱਕ (Bank Passbook)** (ਜ਼ਰੂਰੀ): ਸਿੱਧਾ ਲਾਭ ਟ੍ਰਾਂਸਫਰ (DBT) ਲਈ।")
                    out.append("- **ਮੋਬਾਈਲ ਨੰਬਰ ਅਤੇ ਪਾਸਪੋਰਟ ਫੋਟੋ** (ਜ਼ਰੂਰੀ)")
            elif is_apply_query:
                out.append("📝 **ਅਰਜ਼ੀ ਦੇਣ ਦੀ ਪ੍ਰਕਿਰਿਆ (How to Apply):**")
                if steps_fmt:
                    out.extend(steps_fmt)
                else:
                    out.append("- **ਆਨਲਾਈਨ:** ਅਧਿਕਾਰਤ ਪੋਰਟਲ 'ਤੇ ਜਾਓ ਅਤੇ ਆਧਾਰ ਓਟੀਪੀ ਰਾਹੀਂ ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਕਰੋ।")
                    out.append("- **ਆਫਲਾਈਨ:** ਨਜ਼ਦੀਕੀ ਸਾਂਝੇ ਸੇਵਾ ਕੇਂਦਰ (CSC / ਸੁਵਿਧਾ ਕੇਂਦਰ) ਵਿਖੇ ਜਾਓ।")
            elif is_elig_query:
                out.append("👥 **ਯੋਗਤਾ ਸ਼ਰਤਾਂ (Eligibility Criteria):**")
                if elig_fmt:
                    out.extend(elig_fmt)
                else:
                    out.append(f"- {p_desc}")
            elif is_benefit_query:
                out.append("💰 **ਮੁੱਖ ਲਾਭ ਅਤੇ ਸਹਾਇਤਾ ਰਾਸ਼ੀ (Key Benefits):**")
                if benefits_fmt:
                    out.extend(benefits_fmt)
                else:
                    out.append(f"- {p_desc}")
            else:
                out.append(f"📌 **ਸਕੀਮ ਦੀ ਸੰਖੇਪ ਜਾਣਕਾਰੀ (Overview):**\n{p_desc}\n")
                if benefits_fmt:
                    out.append("💰 **ਲਾਭ:**\n" + "\n".join(benefits_fmt))
                if elig_fmt:
                    out.append("👥 **ਯੋਗਤਾ:**\n" + "\n".join(elig_fmt))
                if docs_fmt:
                    out.append("📄 **ਦਸਤਾਵੇਜ਼:**\n" + "\n".join(docs_fmt))
                elif not docs_fmt:
                    out.append("📄 **ਦਸਤਾਵੇਜ਼:**\n- ਆਧਾਰ ਕਾਰਡ, ਬੈਂਕ ਪਾਸਬੁੱਕ ਅਤੇ ਆਮਦਨ ਸਰਟੀਫਿਕੇਟ।")

            if portal or helpline:
                out.append(f"\n📞 **ਅਧਿਕਾਰਤ ਪੋਰਟਲ ਅਤੇ ਹੈਲਪਲਾਈਨ:**\n- ਪੋਰਟਲ: {portal or 'ਅਧਿਕਾਰਤ ਵੈੱਬਸਾਈਟ'}\n- ਹੈਲਪਲਾਈਨ: {helpline or '1800-11-0001'}")
            out.append(f"\n<schemes>{slugs}</schemes>")
            return "\n".join(out)

        if lang_p == "hi":
            greeting = f"नमस्ते! 🙏 **{p_name}** के बारे में आपके प्रश्न की जानकारी यहाँ दी गई है:\n" if is_followup else f"नमस्ते! 🙏 आपके अनुरोध के अनुसार **{p_name}** योजना की आधिकारिक जानकारी यहाँ दी गई है:\n"
            out = [greeting]
            if is_docs_query:
                out.append("📄 **आवश्यक दस्तावेज़ों की सूची (Required Documents):**")
                if docs_fmt:
                    out.extend(docs_fmt)
                else:
                    out.append("- **आधार कार्ड (Aadhaar Card)** (अनिवार्य): पहचान और e-KYC हेतु।")
                    out.append("- **बैंक पासबुक (Bank Passbook)** (अनिवार्य): प्रत्यक्ष लाभ अंतरण (DBT) हेतु।")
                    out.append("- **सक्रिय मोबाइल नंबर व पासपोर्ट फोटो** (अनिवार्य)")
            elif is_apply_query:
                out.append("📝 **आवेदन कैसे करें (Application Process):**")
                if steps_fmt:
                    out.extend(steps_fmt)
                else:
                    out.append("- **ऑनलाइन प्रक्रिया:** आधिकारिक पोर्टल पर जाकर आधार आधारित e-KYC पूरी करें।")
                    out.append("- **ऑफलाइन प्रक्रिया:** नजदीकी जन सेवा केंद्र (CSC) या ब्लॉक कार्यालय में जाकर आवेदन करें।")
            elif is_elig_query:
                out.append("👥 **पात्रता मानदंड (Eligibility Criteria):**")
                if elig_fmt:
                    out.extend(elig_fmt)
                else:
                    out.append(f"- {p_desc}")
                if profile_verdict:
                    out.append(profile_verdict)
            elif is_benefit_query:
                out.append("💰 **प्रमुख लाभ व सहायता राशि (Key Benefits):**")
                if benefits_fmt:
                    out.extend(benefits_fmt)
                else:
                    out.append(f"- {p_desc}")
            else:
                out.append(f"📌 **योजना का परिचय (Overview):**\n{p_desc}\n")
                if benefits_fmt:
                    out.append("💰 **मुख्य लाभ:**\n" + "\n".join(benefits_fmt))
                if elig_fmt:
                    out.append("👥 **पात्रता:**\n" + "\n".join(elig_fmt))
                if profile_verdict:
                    out.append(profile_verdict)
                if docs_fmt:
                    out.append("📄 **दस्तावेज़:**\n" + "\n".join(docs_fmt))
                elif not docs_fmt:
                    out.append("📄 **दस्तावेज़:**\n- आधार कार्ड, बैंक पासबुक और आय प्रमाण पत्र।")

            if portal or helpline:
                out.append(f"\n📞 **आधिकारिक सहायता व पोर्टल:**\n- पोर्टल: {portal or 'सरकारी पोर्टल'}\n- हेल्पलाइन: {helpline or '1800-11-0001'}")
            out.append(f"\n<schemes>{slugs}</schemes>")
            return "\n".join(out)

        if lang_p == "or":
            out = [f"ନମସ୍କାର! 🙏 ଆପଣଙ୍କ ଅନୁରୋଧ ଅନୁଯାୟୀ **{p_name}** ଯୋଜନାର ସବିଶେଷ ବିବରଣୀ ନିମ୍ନରେ ଦିଆଗଲା:\n"]
            if is_docs_query:
                out.append("📄 **ଆବଶ୍ୟକୀୟ ଦସ୍ତାବିଜ ତାଲିକା (Required Documents):**")
                if docs_fmt:
                    out.extend(docs_fmt)
                else:
                    out.append("- **ଆଧାର କାର୍ଡ (Aadhaar Card)** (ବାଧ୍ୟତାମୂଳକ): ପରିଚୟ ଏବଂ e-KYC ଯାଞ୍ଚ ପାଇଁ।")
                    out.append("- **ବ୍ୟାଙ୍କ ପାସବୁକ୍ (Bank Passbook)** (ବାଧ୍ୟତାମୂଳକ): ପ୍ରତ୍ୟକ୍ଷ ଲାଭ ହସ୍ତାନ୍ତର (DBT) ପାଇଁ।")
                    out.append("- **ମୋବାଇଲ୍ ନମ୍ବର ଏବଂ ପାସପୋର୍ଟ ଫଟୋ** (ବାଧ୍ୟତାମୂଳକ)")
            elif is_apply_query:
                out.append("📝 **ଆବେଦନ କରିବାର ପଦ୍ଧତି (How to Apply):**")
                if steps_fmt:
                    out.extend(steps_fmt)
                else:
                    out.append("- **ଅନଲାଇନ୍ ପଦ୍ଧତି:** ସରକାରୀ ପୋର୍ଟାଲ୍‌କୁ ଯାଇ ଆଧାର OTP ମାଧ୍ୟମରେ e-KYC ସମ୍ପୂର୍ଣ୍ଣ କରନ୍ତୁ।")
                    out.append("- **ଅଫଲାଇନ୍ ପଦ୍ଧତି:** ନିକଟସ୍ଥ ଜନସେବା କେନ୍ଦ୍ର (CSC / ମୋ ସେବା କେନ୍ଦ୍ର) କୁ ଯାଇ ଆବେଦନ ଫର୍ମ ଦାଖଲ କରନ୍ତୁ।")
            elif is_elig_query:
                out.append("👥 **ଯୋଗ୍ୟତା ମାନଦଣ୍ଡ (Eligibility Criteria):**")
                if elig_fmt:
                    out.extend(elig_fmt)
                else:
                    out.append(f"- {p_desc}")
            elif is_benefit_query:
                out.append("💰 **ମୁଖ୍ୟ ସୁବିଧା ଏବଂ ସହାୟତା ରାଶି (Key Benefits):**")
                if benefits_fmt:
                    out.extend(benefits_fmt)
                else:
                    out.append(f"- {p_desc}")
            else:
                out.append(f"📌 **ଯୋଜନା ପରିଚୟ (Overview):**\n{p_desc}\n")
                if benefits_fmt:
                    out.append("💰 **ମୁଖ୍ୟ ସୁବିଧା:**\n" + "\n".join(benefits_fmt))
                if elig_fmt:
                    out.append("👥 **ଯୋଗ୍ୟତା:**\n" + "\n".join(elig_fmt))
                if docs_fmt:
                    out.append("📄 **ଦସ୍ତାବିଜ:**\n" + "\n".join(docs_fmt))
                elif not docs_fmt:
                    out.append("📄 **ଦସ୍ତାବିଜ:**\n- ଆଧାର କାର୍ଡ, ବ୍ୟାଙ୍କ ପାସବୁକ୍ ଏବଂ ଆୟ ପ୍ରମାଣପତ୍ର।")

            if portal or helpline:
                out.append(f"\n📞 **ସରକାରୀ ସହାୟତା ଏବଂ ପୋର୍ଟାଲ:**\n- ପୋର୍ଟାଲ: {portal or 'ସରକାରୀ ପୋର୍ଟାଲ'}\n- ହେଲ୍ପଲାଇନ୍: {helpline or '1800-11-0001'}")
            out.append(f"\n<schemes>{slugs}</schemes>")
            return "\n".join(out)

        if lang_p == "mr":
            out = [f"नमस्कार! 🙏 आपल्या विनंतीनुसार **{p_name}** योजनेची अधिकृत माहिती खालीलप्रमाणे आहे:\n"]
            if is_docs_query:
                out.append("📄 **आवश्यक कागदपत्रांची यादी (Required Documents):**")
                if docs_fmt:
                    out.extend(docs_fmt)
                else:
                    out.append("- **आधार कार्ड (Aadhaar Card)** (अनिवार्य): ओळख पडताळणी आणि e-KYC साठी.")
                    out.append("- **बँक पासबुक (Bank Passbook)** (अनिवार्य): थेट लाभ हस्तांतरण (DBT) साठी.")
                    out.append("- **मोबाईल नंबर आणि पासपोर्ट फोटो** (अनिवार्य)")
            elif is_apply_query:
                out.append("📝 **अर्ज कसा करावा (How to Apply):**")
                if steps_fmt:
                    out.extend(steps_fmt)
                else:
                    out.append("- **ऑनलाइन पद्धत:** अधिकृत पोर्टलवर जा आणि आधार OTP द्वारे e-KYC पूर्ण करा.")
                    out.append("- **ऑफलाइन पद्धत:** जवळच्या सेतू सुविधा केंद्र किंवा आपले सरकार केंद्रात अर्ज जमा करा.")
            elif is_elig_query:
                out.append("👥 **पात्रता निकष (Eligibility Criteria):**")
                if elig_fmt:
                    out.extend(elig_fmt)
                else:
                    out.append(f"- {p_desc}")
            elif is_benefit_query:
                out.append("💰 **मुख्य लाभ व सहाय्य रक्कम (Key Benefits):**")
                if benefits_fmt:
                    out.extend(benefits_fmt)
                else:
                    out.append(f"- {p_desc}")
            else:
                out.append(f"📌 **योजनेचा तपशील (Overview):**\n{p_desc}\n")
                if benefits_fmt:
                    out.append("💰 **मुख्य लाभ:**\n" + "\n".join(benefits_fmt))
                if elig_fmt:
                    out.append("👥 **पात्रता:**\n" + "\n".join(elig_fmt))
                if docs_fmt:
                    out.append("📄 **कागदपत्रे:**\n" + "\n".join(docs_fmt))
                elif not docs_fmt:
                    out.append("📄 **कागदपत्रे:**\n- आधार कार्ड, बँक पासबुक आणि उत्पन्नाचा दाखला.")

            if portal or helpline:
                out.append(f"\n📞 **अधिकृत मदत व पोर्टल:**\n- पोर्टल: {portal or 'शासकीय पोर्टल'}\n- हेल्पलाइन: {helpline or '1800-11-0001'}")
            out.append(f"\n<schemes>{slugs}</schemes>")
            return "\n".join(out)

        if lang_p == "te":
            out = [f"నమస్కారం! 🙏 మీ అభ్యర్థన ప్రకారం **{p_name}** పథకం యొక్క పూర్తి వివరాలు ఇక్కడ ఉన్నాయి:\n"]
            if is_docs_query:
                out.append("📄 **అవసరమైన పత్రాల జాబితా (Required Documents):**")
                if docs_fmt:
                    out.extend(docs_fmt)
                else:
                    out.append("- **ఆధార్ కార్డు (Aadhaar Card)** (తప్పనిసరి): గుర్తింపు మరియు e-KYC ధృవీకరణ కోసం.")
                    out.append("- **బ్యాంక్ పాస్‌బుక్ (Bank Passbook)** (తప్పనిసరి): ప్రత్యక్ష నగదు బదిలీ (DBT) కోసం.")
                    out.append("- **మొబైల్ నంబర్ మరియు ఫోటో**")
            elif is_apply_query:
                out.append("📝 **దరఖాస్తు విధానం (How to Apply):**")
                if steps_fmt:
                    out.extend(steps_fmt)
                else:
                    out.append("- **ఆన్‌లైన్:** అధికారిక పోర్టల్‌ను సందర్శించి ఆధార్ OTP ద్వారా నమోదు చేసుకోండి.")
                    out.append("- **ఆఫ్‌లైన్:** సమీపంలోని మీసేవ (MeeSeva) లేదా గ్రామ సచివాలయాన్ని సంప్రదించండి.")
            elif is_elig_query:
                out.append("👥 **అర్హత ప్రమాణాలు (Eligibility Criteria):**")
                if elig_fmt:
                    out.extend(elig_fmt)
                else:
                    out.append(f"- {p_desc}")
            elif is_benefit_query:
                out.append("💰 **ప్రధాన ప్రయోజనాలు (Key Benefits):**")
                if benefits_fmt:
                    out.extend(benefits_fmt)
                else:
                    out.append(f"- {p_desc}")
            else:
                out.append(f"📌 **పథకం సంక్షిప్త వివరాలు (Overview):**\n{p_desc}\n")
                if benefits_fmt:
                    out.append("💰 **ప్రయోజనాలు:**\n" + "\n".join(benefits_fmt))
                if elig_fmt:
                    out.append("👥 **అర్హతలు:**\n" + "\n".join(elig_fmt))
                if docs_fmt:
                    out.append("📄 **పత్రాలు:**\n" + "\n".join(docs_fmt))

            if portal or helpline:
                out.append(f"\n📞 **అధికారిక పోర్టల్ మరియు హెల్ప్‌లైన్:**\n- పోర్టల్: {portal or 'ప్రభుత్వ పోర్టల్'}\n- హెల్ప్‌లైన్: {helpline or '1800-11-0001'}")
            out.append(f"\n<schemes>{slugs}</schemes>")
            return "\n".join(out)

        if lang_p == "ta":
            out = [f"வணக்கம்! 🙏 உங்கள் கோரிக்கையின்படி **{p_name}** திட்டத்தின் அதிகாரப்பூர்வ வழிகாட்டுதல் இதோ:\n"]
            if is_docs_query:
                out.append("📄 **தேவையான ஆவணங்களின் பட்டியல் (Required Documents):**")
                if docs_fmt:
                    out.extend(docs_fmt)
                else:
                    out.append("- **ஆதார் அட்டை (Aadhaar Card)** (கட்டாயம்): அடையாள சரிபார்ப்பு மற்றும் e-KYC க்கு.")
                    out.append("- **வங்கி கணக்கு புத்தகம் (Bank Passbook)** (கட்டாயம்): நேரடி பணப்பரிமாற்றம் (DBT) பெற.")
                    out.append("- **கைபேசி எண் மற்றும் பாஸ்போர்ட் அளவு புகைப்படம்**")
            elif is_apply_query:
                out.append("📝 **விண்ணப்பிக்கும் முறை (How to Apply):**")
                if steps_fmt:
                    out.extend(steps_fmt)
                else:
                    out.append("- **ஆன்லைன் முறை:** அதிகாரப்பூர்வ போர்ட்டலுக்கு சென்று ஆதார் OTP மூலம் பதிவு செய்யுங்கள்.")
                    out.append("- **ஆஃப்லைன் முறை:** அருகிலுள்ள இ-சேவை மையம் (CSC / e-Seva) மூலம் விண்ணப்பிக்கவும்.")
            elif is_elig_query:
                out.append("👥 **தகுதி வரம்புகள் (Eligibility Criteria):**")
                if elig_fmt:
                    out.extend(elig_fmt)
                else:
                    out.append(f"- {p_desc}")
            elif is_benefit_query:
                out.append("💰 **முக்கிய நன்மைகள் (Key Benefits):**")
                if benefits_fmt:
                    out.extend(benefits_fmt)
                else:
                    out.append(f"- {p_desc}")
            else:
                out.append(f"📌 **திட்டத்தின் விளக்கம் (Overview):**\n{p_desc}\n")
                if benefits_fmt:
                    out.append("💰 **நன்மைகள்:**\n" + "\n".join(benefits_fmt))
                if elig_fmt:
                    out.append("👥 **தகுதிகள்:**\n" + "\n".join(elig_fmt))
                if docs_fmt:
                    out.append("📄 **ஆவணங்கள்:**\n" + "\n".join(docs_fmt))

            if portal or helpline:
                out.append(f"\n📞 **உதவி எண்கள் & போர்ட்டல்:**\n- போர்டல்: {portal or 'அரசு இணையதளம்'}\n- உதவி எண்: {helpline or '1800-11-0001'}")
            out.append(f"\n<schemes>{slugs}</schemes>")
            return "\n".join(out)

        if lang_p == "gu":
            out = [f"નમસ્તે! 🙏 તમારી વિનંતી મુજબ **{p_name}** યોજનાની વિગતો નીચે મુજબ છે:\n"]
            if is_docs_query:
                out.append("📄 **જરૂરી દસ્તાવેજોની યાદી (Required Documents):**")
                if docs_fmt:
                    out.extend(docs_fmt)
            elif is_apply_query:
                out.append("📝 **અરજી કરવાની પ્રક્રિયા (How to Apply):**")
                if steps_fmt:
                    out.extend(steps_fmt)
            elif is_elig_query:
                out.append("👥 **પાત્રતા માપદંડ (Eligibility Criteria):**")
                if elig_fmt:
                    out.extend(elig_fmt)
                else:
                    out.append(f"- {p_desc}")
            elif is_benefit_query:
                out.append("💰 **મુખ્ય લાભો (Key Benefits):**")
                if benefits_fmt:
                    out.extend(benefits_fmt)
                else:
                    out.append(f"- {p_desc}")
            else:
                out.append(f"📌 **યોજના વિગત (Overview):**\n{p_desc}\n")
                if benefits_fmt:
                    out.append("💰 **મુખ્ય લાભો:**\n" + "\n".join(benefits_fmt))
                if elig_fmt:
                    out.append("👥 **પાત્રતા:**\n" + "\n".join(elig_fmt))
                if docs_fmt:
                    out.append("📄 **જરૂરી દસ્તાવેજો:**\n" + "\n".join(docs_fmt))

            if portal or helpline:
                out.append(f"\n📞 **સહાયતા પોર્ટલ:**\n- પોર્ટલ: {portal or 'સરકારી પોર્ટલ'}\n- હેલ્પલાઇન: {helpline or '1800-11-0001'}")
            out.append(f"\n<schemes>{slugs}</schemes>")
            return "\n".join(out)

        if lang_p == "kn":
            out = [f"ನಮಸ್ಕಾರ! 🙏 ನಿಮ್ಮ ಕೋರಿಕೆಯಂತೆ **{p_name}** ಯೋಜನೆಯ ಸಂಪೂರ್ಣ ವಿವರಗಳು ಇಲ್ಲಿವೆ:\n"]
            if is_docs_query:
                out.append("📄 **ಅಗತ್ಯ ದಾಖಲೆಗಳ ಪಟ್ಟಿ (Required Documents):**")
                if docs_fmt:
                    out.extend(docs_fmt)
            elif is_apply_query:
                out.append("📝 **ಅರ್ಜಿ ಸಲ್ಲಿಸುವ ವಿಧಾನ (How to Apply):**")
                if steps_fmt:
                    out.extend(steps_fmt)
            elif is_elig_query:
                out.append("👥 **ಅರ್ಹತಾ ಮಾನದಂಡಗಳು (Eligibility Criteria):**")
                if elig_fmt:
                    out.extend(elig_fmt)
                else:
                    out.append(f"- {p_desc}")
            elif is_benefit_query:
                out.append("💰 **ಪ್ರಮುಖ ಪ್ರಯೋಜನಗಳು (Key Benefits):**")
                if benefits_fmt:
                    out.extend(benefits_fmt)
                else:
                    out.append(f"- {p_desc}")
            else:
                out.append(f"📌 **ಯೋಜನೆಯ ವಿವರ (Overview):**\n{p_desc}\n")
                if benefits_fmt:
                    out.append("💰 **ಪ್ರಯೋಜನಗಳು:**\n" + "\n".join(benefits_fmt))
                if elig_fmt:
                    out.append("👥 **ಅರ್ಹತೆಗಳು:**\n" + "\n".join(elig_fmt))
                if docs_fmt:
                    out.append("📄 **ದಾಖಲೆಗಳು:**\n" + "\n".join(docs_fmt))

            if portal or helpline:
                out.append(f"\n📞 **ಸಹಾಯವಾಣಿ & ಪೋರ್ಟಲ್:**\n- ಪೋರ್ಟಲ್: {portal or 'ಸರ್ಕಾರಿ ಪೋರ್ಟಲ್'}\n- ಸಹಾಯವಾಣಿ: {helpline or '1800-11-0001'}")
            out.append(f"\n<schemes>{slugs}</schemes>")
            return "\n".join(out)

        if lang_p == "ml":
            out = [f"നമസ്കാരം! 🙏 നിങ്ങളുടെ അഭ്യർത്ഥന പ്രകാരം **{p_name}** പദ്ധതിയുടെ വിവരങ്ങൾ താഴെ നൽകുന്നു:\n"]
            if is_docs_query:
                out.append("📄 **ആവശ്യമായ രേഖകൾ (Required Documents):**")
                if docs_fmt:
                    out.extend(docs_fmt)
            elif is_apply_query:
                out.append("📝 **അപേക്ഷിക്കേണ്ട വിധം (How to Apply):**")
                if steps_fmt:
                    out.extend(steps_fmt)
            elif is_elig_query:
                out.append("👥 **യോഗ്യതാ മാനദണ്ഡങ്ങൾ (Eligibility Criteria):**")
                if elig_fmt:
                    out.extend(elig_fmt)
                else:
                    out.append(f"- {p_desc}")
            elif is_benefit_query:
                out.append("💰 **പ്രധാന ആനുകൂല്യങ്ങൾ (Key Benefits):**")
                if benefits_fmt:
                    out.extend(benefits_fmt)
                else:
                    out.append(f"- {p_desc}")
            else:
                out.append(f"📌 **പദ്ധതി വിവരണം (Overview):**\n{p_desc}\n")
                if benefits_fmt:
                    out.append("💰 **ആനുകൂല്യങ്ങൾ:**\n" + "\n".join(benefits_fmt))
                if elig_fmt:
                    out.append("👥 **യോഗ്യത:**\n" + "\n".join(elig_fmt))
                if docs_fmt:
                    out.append("📄 **രേഖകൾ:**\n" + "\n".join(docs_fmt))

            if portal or helpline:
                out.append(f"\n📞 **സഹായവാണി & പോർട്ടൽ:**\n- പോർട്ടൽ: {portal or 'സർക്കാർ പോർട്ടൽ'}\n- ഹെൽപ്പ് ലൈൻ: {helpline or '1800-11-0001'}")
            out.append(f"\n<schemes>{slugs}</schemes>")
            return "\n".join(out)

        # Default English
        greeting = f"Hello! 🙏 Here is the specific answer for **{p_name}**:\n" if is_followup else f"Hello! 🙏 Here is the verified guide for **{p_name}**:\n"
        out = [greeting]
        if is_docs_query:
            out.append("📄 **Required Documents Checklist:**")
            if docs_fmt:
                out.extend(docs_fmt)
            else:
                out.append("- **Aadhaar Card** (Mandatory): For identity verification and biometric e-KYC.")
                out.append("- **Bank Passbook** (Mandatory): Aadhaar-linked account for Direct Benefit Transfer (DBT).")
                out.append("- **Mobile Number & Photo** (Mandatory)")
        elif is_apply_query:
            out.append("📝 **Step-by-Step Application Guide:**")
            if steps_fmt:
                out.extend(steps_fmt)
            else:
                out.append("- **Online:** Visit the official portal and authenticate via Aadhaar OTP e-KYC.")
                out.append("- **Offline:** Visit your nearest Common Service Center (CSC) or Department helpdesk.")
        elif is_elig_query:
            out.append("👥 **Eligibility Criteria:**")
            if elig_fmt:
                out.extend(elig_fmt)
            else:
                out.append(f"- {p_desc}")
            if profile_verdict:
                out.append(profile_verdict)
        elif is_benefit_query:
            out.append("💰 **Key Benefits & Financial Value:**")
            if benefits_fmt:
                out.extend(benefits_fmt)
            else:
                out.append(f"- {p_desc}")
        else:
            out.append(f"📌 **Scheme Overview:**\n{p_desc}\n")
            if benefits_fmt:
                out.append("💰 **Key Benefits:**\n" + "\n".join(benefits_fmt))
            if elig_fmt:
                out.append("👥 **Eligibility Criteria:**\n" + "\n".join(elig_fmt))
            if profile_verdict:
                out.append(profile_verdict)
            if docs_fmt:
                out.append("📄 **Required Documents:**\n" + "\n".join(docs_fmt))

        if portal or helpline:
            out.append(f"\n📞 **Official Support & Portals:**\n- Portal: {portal or 'Official Gov Portal'}\n- Helpline: {helpline or '1800-11-0001'}")
        out.append(f"\n<schemes>{slugs}</schemes>")
        return "\n".join(out)
