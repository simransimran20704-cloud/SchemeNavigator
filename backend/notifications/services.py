import os
import re
import logging
import urllib.parse
import requests
from django.conf import settings
from .models import NotificationLog

logger = logging.getLogger(__name__)


def clean_phone_number(raw_phone: str) -> str:
    """
    Standardize Indian & international phone numbers into E.164-compatible format: +91XXXXXXXXXX.
    """
    if not raw_phone:
        return ""
    digits = re.sub(r"[^\d+]", "", str(raw_phone).strip())
    if digits.startswith("+"):
        return digits
    if digits.startswith("91") and len(digits) == 12:
        return f"+{digits}"
    if len(digits) == 10:
        return f"+91{digits}"
    return f"+{digits}"


def generate_whatsapp_web_url(phone_number: str, message: str) -> str:
    """
    Generates a 1-click deep-link to WhatsApp Web / mobile app with the pre-filled message.
    """
    clean_digits = re.sub(r"[^\d]", "", phone_number)
    encoded_text = urllib.parse.quote(message)
    return f"https://wa.me/{clean_digits}?text={encoded_text}"


TEMPLATES = {
    "test": {
        "hi-IN": (
            "SchemeNavigator — अलर्ट सेवा सक्रिय",
            "🏛️ *SchemeNavigator — नागरिक कल्याण सूचना सेवा* 🇮🇳\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "नमस्ते! 🙏\n\n"
            "*SchemeNavigator* में आपका स्वागत है — 4,700+ केंद्र व राज्य सरकार की कल्याणकारी योजनाओं का आपका भरोसेमंद साथी।\n\n"
            "आपके मोबाइल नंबर पर WhatsApp और SMS अलर्ट सेवा सफलतापूर्वक सक्रिय कर दी गई है! 📲\n\n"
            "*आपको प्राप्त होने वाले प्रमुख लाभ:*\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "📋 *आवेदन स्थिति ट्रैकिंग* — दस्तावेज़ जमा से लेकर लाभ वितरण तक हर चरण का लाइव अपडेट\n"
            "⏰ *अंतिम तिथि अनुस्मारक* — योजनाओं की अंतिम तारीख से पहले जरूरी अलर्ट ताकि कोई अवसर न छूटे\n"
            "🎯 *सटीक योजनाएं* — आपकी पात्रता और श्रेणी के आधार पर नई सरकारी योजनाओं की तत्काल जानकारी\n"
            "📂 *दस्तावेज़ चेकलिस्ट* — आवेदन के लिए जरूरी प्रमाण पत्रों और नजदीकी केंद्र (CSC/e-Mitra) की जानकारी\n\n"
            "🔗 *आधिकारिक पोर्टल देखें:*\n"
            "https://schemenavigator.gov.in\n\n"
            "_हर नागरिक तक सरकारी योजनाओं का सीधा और पारदर्शी लाभ पहुंचाना ही हमारा संकल्प है।_ 🇮🇳\n\n"
            "सादर,\n"
            "*टीम SchemeNavigator* | डिजिटल भारत पहल"
        ),
        "en-IN": (
            "🔔 Your SchemeNavigator Alerts Are Active",
            "🔔 Your SchemeNavigator Alerts Are Active\n\n"
            "You’ll now receive timely updates about your government-scheme journey:\n\n"
            "🎯 New Matches\n"
            "Get notified when a government scheme relevant to your profile is found.\n\n"
            "⏰ Deadline Alerts\n"
            "Receive timely reminders before important application deadlines.\n\n"
            "📋 Application Updates\n"
            "Get updates related to government schemes you are tracking.\n\n"
            "📱 Notifications will be sent through WhatsApp and SMS.\n\n"
            "Stay informed. Never miss an opportunity.\n"
            "— Team SchemeNavigator"
        ),
        "or-IN": (
            "SchemeNavigator — ସୂଚନା ସେବା ସକ୍ରିୟ",
            "🏛️ *SchemeNavigator — ନାଗରିକ କଲ୍ୟାଣ ସୂଚନା ସେବା* 🇮🇳\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "ନମସ୍କାର! 🙏\n\n"
            "*SchemeNavigator* କୁ ଆପଣଙ୍କୁ ସ୍ୱାଗତ — ୪,୭୦୦+ କେନ୍ଦ୍ର ଓ ରାଜ୍ୟ ସରକାରୀ ଯୋଜନାର ଆପଣଙ୍କ ବିଶ୍ୱସ୍ତ ସାଥୀ।\n\n"
            "ଆପଣଙ୍କ ମୋବାଇଲ୍ ନମ୍ବରରେ WhatsApp ଏବଂ SMS ସତର୍କତା ସେବା ସଫଳତାର ସହିତ ସକ୍ରିୟ ହୋଇଛି! 📲\n\n"
            "*ଆପଣଙ୍କୁ ମିଳିବାକୁ ଥିବା ସୁବିଧା:*\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "📋 *ଆବେଦନ ସ୍ଥିତି ଟ୍ରାକିଂ* — ଦସ୍ତାବିଜ ଜମାଠାରୁ ଲାଭ ମିଳିବା ପର୍ଯ୍ୟନ୍ତ ପ୍ରତ୍ୟେକ ପର୍ଯ୍ୟାୟର ଲାଇଭ୍ ଅପଡେଟ୍\n"
            "⏰ *ଜରୁରୀ ଶେଷ ତାରିଖ ସୂଚନା* — ସମୟ ସରିବା ପୂର୍ବରୁ ସତର୍କତା ଯାହାଦ୍ୱାରା କୌଣସି ସୁଯୋଗ ହାତଛଡ଼ା ନହୁଏ\n"
            "🎯 *ଯୋଗ୍ୟ ଯୋଜନା ସୁପାରିଶ* — ଆପଣଙ୍କ ପ୍ରୋଫାଇଲ୍ ଅନୁଯାୟୀ ନୂଆ ସରକାରୀ ଯୋଜନାର ତଥ୍ୟ\n"
            "📂 *ଦସ୍ତାବିଜ ମାର୍ଗଦର୍ଶିକା* — ଆବଶ୍ୟକୀୟ କାଗଜପତ୍ର ଏବଂ ନିକଟସ୍ଥ ସେବା କେନ୍ଦ୍ରର ସୂଚନା\n\n"
            "🔗 *ଅଫିସିଆଲ୍ ପୋର୍ଟାଲ୍ ଭିଜିଟ୍ କରନ୍ତୁ:*\n"
            "https://schemenavigator.gov.in\n\n"
            "_ପ୍ରତ୍ୟେକ ନାଗରିକଙ୍କ ନିକଟରେ ସରକାରୀ ସୁବିଧା ପହଞ୍ଚାଇବା ଆମର ଲକ୍ଷ୍ୟ।_ 🇮🇳\n\n"
            "ଧନ୍ୟବାଦ,\n"
            "*SchemeNavigator ଟିମ୍* | ଡିଜିଟାଲ୍ ଇଣ୍ଡିଆ"
        ),
        "bn-IN": (
            "SchemeNavigator — বিজ্ঞপ্তি পরিষেবা সক্রিয়",
            "🏛️ *SchemeNavigator — নাগরিক কল্যাণ বিজ্ঞপ্তি সেবা* 🇮🇳\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "নমস্কার! 🙏\n\n"
            "*SchemeNavigator*-এ আপনাকে স্বাগতম — ৪,৭০০+ কেন্দ্রীয় ও রাজ্য সরকারি জনকল্যাণমূলক প্রকল্পের নির্ভরযোগ্য পথপ্রদর্শক।\n\n"
            "আপনার মোবাইল নম্বরে WhatsApp এবং SMS অ্যালার্ট পরিষেবা সফলভাবে সক্রিয় করা হয়েছে! 📲\n\n"
            "*আপনি যে সুবিধাগুলি সরাসরি পাবেন:*\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "📋 *আবেদন ট্র্যাকিং* — নথি জমা থেকে সরাসরি সুবিধা প্রদান পর্যন্ত প্রতিটি ধাপের লাইভ আপডেট\n"
            "⏰ *শেষ তারিখের সতর্কতা* — সময় শেষ হওয়ার আগে জরুরি রিমাইন্ডার যাতে কোনো সুযোগ হাতছাড়া না হয়\n"
            "🎯 *উপযুক্ত প্রকল্পের সন্ধান* — আপনার যোগ্যতা অনুযায়ী নতুন সরকারি প্রকল্পের তাৎক্ষণিক তথ্য\n"
            "📂 *নথিপত্র নির্দেশিকা* — প্রয়োজনীয় সার্টিফিকেটের তালিকা এবং নিকটস্থ সেবা কেন্দ্রের বিবরণ\n\n"
            "🔗 *অফিসিয়াল পোর্টাল দেখুন:*\n"
            "https://schemenavigator.gov.in\n\n"
            "_প্রতিটি নাগরিকের কাছে সরকারি অধিকার পৌঁছে দিতে আমরা প্রতিশ্রুতিবদ্ধ।_ 🇮🇳\n\n"
            "শ্রদ্ধা ও শুভেচ্ছাসহ,\n"
            "*টিম SchemeNavigator* | ডিজিটাল ভারত উদ্যোগ"
        ),
        "mr-IN": (
            "SchemeNavigator — सूचना सेवा सक्रिय",
            "🏛️ *SchemeNavigator — नागरिक कल्याण सूचना सेवा* 🇮🇳\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "नमस्कार! 🙏\n\n"
            "*SchemeNavigator* मध्ये आपले सहर्ष स्वागत — ४,७००+ केंद्र व राज्य सरकारी कल्याणकारी योजनांचे आपले मार्गदर्शक व्यासपीठ।\n\n"
            "आपल्या मोबाईल नंबरवर WhatsApp आणि SMS अलर्ट सेवा यशस्वीरीत्या सुरू करण्यात आली आहे! 📲\n\n"
            "*आपणास मिळणाऱ्या प्रमुख सुविधा:*\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "📋 *अर्ज स्थिती ट्रॅकिंग* — कागदपत्रे जमा करण्यापासून ते थेट लाभ मिळेपर्यंत प्रत्येक टप्प्याचे लाईव्ह अपडेट\n"
            "⏰ *अंतिम मुदत स्मरणपत्र* — योजनेची मुदत संपण्यापूर्वी वेळेत सूचना जेणेकरून कोणताही लाभ चुकणार नाही\n"
            "🎯 *वैयक्तिकृत योजना* — आपल्या पात्रता आणि श्रेणीनुसार नवीन सरकारी योजनांची माहिती\n"
            "📂 *कागदपत्र मार्गदर्शक* — आवश्यक प्रमाणपत्रांची यादी आणि जवळच्या मदत केंद्राची माहिती\n\n"
            "🔗 *अधिकृत पोर्टलला भेट द्या:*\n"
            "https://schemenavigator.gov.in\n\n"
            "_प्रत्येक नागरिकापर्यंत शासकीय योजनांचा लाभ पोहोचवणे हाच आमचा ध्यास._ 🇮🇳\n\n"
            "सस्नेह,\n"
            "*टीम SchemeNavigator* | डिजिटल भारत पुढाकार"
        ),
        "te-IN": (
            "SchemeNavigator — అలర్ట్ సేవ సక్రియం చేయబడింది",
            "🏛️ *SchemeNavigator — పౌర సంక్షేమ సమాచార సేవ* 🇮🇳\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "నమస్కారం! 🙏\n\n"
            "*SchemeNavigator* కు స్వాగతం — 4,700+ కేంద్ర, రాష్ట్ర ప్రభుత్వ సంక్షేమ పథకాల విశ్వసనీయ సమాచార వేదిక.\n\n"
            "మీ మొబైల్ నంబర్‌కు WhatsApp మరియు SMS అలర్ట్ సేవ విజయవంతంగా ప్రారంభించబడింది! 📲\n\n"
            "*మీకు లభించే ముఖ్య ప్రయోజనాలు:*\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "📋 *దరఖాస్తు స్థితి ట్రాకింగ్* — పత్రాల సమర్పణ నుండి పథకం ప్రయోజనం అందే వరకు ప్రత్యక్ష సమాచారం\n"
            "⏰ *చివరి తేదీ హెచ్చరికలు* — గడువు ముగియక ముందే సకాలంలో రిమైండర్‌లు\n"
            "🎯 *అర్హత కలిగిన పథకాలు* — మీ ప్రొఫైల్‌కు అనువైన కొత్త ప్రభుత్వ పథకాల వివరాలు\n"
            "📂 *పత్రాల మార్గదర్శకత్వం* — దరఖాస్తుకు అవసరమైన సర్టిఫికెట్ల జాబితా మరియు కేంద్రాల వివరాలు\n\n"
            "🔗 *అధికారిక పోర్టల్‌ను సందర్శించండి:*\n"
            "https://schemenavigator.gov.in\n\n"
            "_ప్రతి పౌరుడికి ప్రభుత్వ పథకాల ప్రయోజనాలను చేరవేయడమే మా సంకల్పం._ 🇮🇳\n\n"
            "ధన్యవాదాలతో,\n"
            "*టీమ్ SchemeNavigator* | డిజిటల్ ఇండియా"
        ),
        "ta-IN": (
            "SchemeNavigator — எச்சரிக்கை சேவை செயல்படுத்தப்பட்டது",
            "🏛️ *SchemeNavigator — குடிமக்கள் நல தகவல் சேவை* 🇮🇳\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "வணக்கம்! 🙏\n\n"
            "*SchemeNavigator* தளத்திற்கு தங்களை அன்புடன் வரவேற்கிறோம் — 4,700+ மத்திய மற்றும் மாநில அரசு நலத்திட்டங்களின் நம்பகமான வழிகாட்டி.\n\n"
            "உங்கள் மொபைல் எண்ணில் WhatsApp மற்றும் SMS எச்சரிக்கை சேவை வெற்றிகரமாக செயல்படுத்தப்பட்டுள்ளது! 📲\n\n"
            "*நீங்கள் நேரடியாகப் பெறும் பயன்கள்:*\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "📋 *விண்ணப்ப நிலை கண்காணிப்பு* — ஆவண சமர்ப்பிப்பு முதல் பலன்கள் கிடைக்கும் வரை நிகழ்நேர தகவல்கள்\n"
            "⏰ *இறுதி தேதி நினைவூட்டல்* — காலக்கெடு முடிவதற்கு முன்பே முக்கிய எச்சரிக்கைகள்\n"
            "🎯 *பொருத்தமான அரசு திட்டங்கள்* — உங்கள் தகுதிக்கு ஏற்ற புதிய திட்டங்களின் உடனடி அறிவிப்புகள்\n"
            "📂 *ஆவண வழிகாட்டுதல்* — தேவையான சான்றிதழ்களின் பட்டியல் மற்றும் அருகிலுள்ள சேவை மையங்கள்\n\n"
            "🔗 *அதிகாரப்பூர்வ இணையதளம்:*\n"
            "https://schemenavigator.gov.in\n\n"
            "_அரசு நலத்திட்டங்கள் ஒவ்வொரு குடிமகனையும் சென்றடைவதே எங்கள் நோக்கம்._ 🇮🇳\n\n"
            "அன்புடன்,\n"
            "*SchemeNavigator குழு* | டிஜிட்டல் இந்தியா"
        ),
    },
    "tracker_update": {
        "hi-IN": (
            "योजना आवेदन स्थिति अपडेट — {scheme_name}",
            "🏛️ *SchemeNavigator — आवेदन स्थिति अपडेट* 🇮🇳\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "योजना: *{scheme_name}*\n"
            "📊 वर्तमान स्थिति: *{status}*\n"
            "📝 आगामी चरण / विवरण: {notes}\n\n"
            "🔗 *आधिकारिक पोर्टल व आवेदन लिंक:*\n{portal_url}\n\n"
            "💡 अपनी आवेदन यात्रा को SchemeNavigator Guidance Tracker पर ट्रैक करते रहें।\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "टीम SchemeNavigator 🇮🇳"
        ),
        "en-IN": (
            "Scheme Application Status Update — {scheme_name}",
            "🏛️ *SchemeNavigator — Application Status Update* 🇮🇳\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Scheme: *{scheme_name}*\n"
            "📊 Current Status: *{status}*\n"
            "📝 Next Step / Notes: {notes}\n\n"
            "🔗 *Official Portal & Application Link:*\n{portal_url}\n\n"
            "💡 Track your milestones on SchemeNavigator Application Tracker.\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Team SchemeNavigator 🇮🇳"
        ),
        "or-IN": (
            "ଯୋଜନା ଆବେଦନ ସ୍ଥିତି ଅପଡେଟ୍ — {scheme_name}",
            "🏛️ *SchemeNavigator — ଯୋଜନା ଆବେଦନ ସ୍ଥିତି ଅପଡେଟ୍* 🇮🇳\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "ଯୋଜନା: *{scheme_name}*\n"
            "📊 ବର୍ତ୍ତମାନ ସ୍ଥିତି: *{status}*\n"
            "📝 ବିବରଣୀ: {notes}\n\n"
            "🔗 *ସରକାରୀ ପୋର୍ଟାଲ୍:*\n{portal_url}\n\n"
            "SchemeNavigator ରେ ନିଜ ପ୍ରଗତି ଯାଞ୍ଚ କରନ୍ତୁ।\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "SchemeNavigator ଟିମ୍ 🇮🇳"
        ),
    },
    "scheme_deadline": {
        "hi-IN": (
            "⚠️ अंतिम तिथि अनुस्मारक — {scheme_name}",
            "⏰ *SchemeNavigator — योजना अंतिम तिथि अलर्ट* 🇮🇳\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "योजना: *{scheme_name}*\n"
            "⏳ अंतिम तिथि: *{deadline_date}* (केवल *{days_left} दिन शेष*)\n\n"
            "कृपया समय रहते अपने आवश्यक दस्तावेज़ तैयार कर आधिकारिक पोर्टल पर आवेदन पूर्ण करें:\n"
            "🔗 *पोर्टल लिंक:* {portal_url}\n\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "समय पर आवेदन करें, सरकारी लाभ सुनिश्चित करें • टीम SchemeNavigator 🇮🇳"
        ),
        "en-IN": (
            "⚠️ Application Deadline Alert — {scheme_name}",
            "⏰ *SchemeNavigator — Scheme Deadline Reminder* 🇮🇳\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Scheme: *{scheme_name}*\n"
            "⏳ Cutoff Date: *{deadline_date}* (Only *{days_left} days left*)\n\n"
            "Please ensure your documentation is verified and submit your application on the official portal:\n"
            "🔗 *Portal Link:* {portal_url}\n\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Submit on time to secure your benefits • Team SchemeNavigator 🇮🇳"
        ),
        "or-IN": (
            "⚠️ ଶେଷ ତାରିଖ ସତର୍କତା — {scheme_name}",
            "⏰ *SchemeNavigator — ଯୋଜନା ଶେଷ ତାରିଖ ସତର୍କତା* 🇮🇳\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "ଯୋଜନା: *{scheme_name}*\n"
            "⏳ ଶେଷ ତାରିଖ: *{deadline_date}* (କେବଳ *{days_left} ଦିନ ବାକି*)\n\n"
            "ଦୟାକରି ଠିକ୍ ସମୟରେ ଆବେଦନ କରନ୍ତୁ:\n"
            "🔗 *ସରକାରୀ ପୋର୍ଟାଲ୍:* {portal_url}\n\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "SchemeNavigator ଟିମ୍ 🇮🇳"
        ),
    },
    "scheme_summary": {
        "hi-IN": (
            "सरकारी योजना गाइड — {scheme_name}",
            "🏛️ *सरकारी योजना विवरण (Scheme Guide)* 🇮🇳\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "योजना: *{scheme_name}*\n"
            "🏢 मंत्रालय / विभाग: {ministry}\n"
            "💰 मुख्य लाभ: *{benefit}*\n"
            "📞 आधिकारिक हेल्पलाइन: {helpline}\n\n"
            "🔗 *ऑनलाइन आवेदन एवं आधिकारिक पोर्टल लिंक:*\n{portal_url}\n\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "SchemeNavigator नागरिक सेवा द्वारा प्रेषित 🇮🇳"
        ),
        "en-IN": (
            "Government Scheme Guide — {scheme_name}",
            "🏛️ *Government Scheme Guide (SchemeNavigator)* 🇮🇳\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Scheme: *{scheme_name}*\n"
            "🏢 Ministry / Department: {ministry}\n"
            "💰 Key Benefit: *{benefit}*\n"
            "📞 Official Helpline: {helpline}\n\n"
            "🔗 *Online Application & Official Portal:*\n{portal_url}\n\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "Shared via SchemeNavigator Citizen Services 🇮🇳"
        ),
        "or-IN": (
            "ସରକାରୀ ଯୋଜନା ବିବରଣୀ — {scheme_name}",
            "🏛️ *ସରକାରୀ ଯୋଜନା ବିବରଣୀ (Scheme Guide)* 🇮🇳\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "ଯୋଜନା: *{scheme_name}*\n"
            "🏢 ମନ୍ତ୍ରଣାଳୟ: {ministry}\n"
            "💰 ମୁଖ୍ୟ ଲାଭ: *{benefit}*\n"
            "📞 ହେଲ୍ପଲାଇନ୍: {helpline}\n\n"
            "🔗 *ସରକାରୀ ପୋର୍ଟାଲ୍ ଲିଙ୍କ୍:*\n{portal_url}\n\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "SchemeNavigator ଦ୍ୱାରା ପ୍ରେରିତ 🇮🇳"
        ),
    },
}

def format_multilingual_notification(template_type: str, data: dict, lang_code: str = "hi-IN") -> tuple[str, str]:
    """
    Returns (title, formatted_message) for a given template type, data payload, and language.
    """
    category = TEMPLATES.get(template_type, TEMPLATES["test"])
    lang_key = lang_code if lang_code in category else ("hi-IN" if "hi-IN" in category else "en-IN")
    tpl_title, tpl_body = category.get(lang_key, category.get("en-IN", ("Scheme Notification", "{message}")))

    safe_data = {
        "scheme_name": data.get("scheme_name") or data.get("schemeName") or "सरकारी योजना",
        "status": data.get("status") or "प्रगति पर",
        "notes": data.get("notes") or data.get("nextStep") or "आवेदन प्रक्रिया सक्रिय है।",
        "portal_url": data.get("portal_url") or data.get("portalUrl") or "https://www.myscheme.gov.in",
        "deadline_date": data.get("deadline_date") or data.get("deadline") or "निकट भविष्य",
        "days_left": data.get("days_left") or data.get("daysLeft") or "कुछ",
        "ministry": data.get("ministry") or "भारत सरकार",
        "benefit": data.get("benefit") or data.get("amountOrValue") or "प्रत्यक्ष सरकारी कल्याण सहायता",
        "helpline": data.get("helpline") or "1800-11-0001",
    }

    try:
        title = tpl_title.format(**safe_data)
        body = tpl_body.format(**safe_data)
    except Exception:
        title = tpl_title
        body = tpl_body

    # If custom message provided
    if data.get("custom_message"):
        body += f"\n\n{data['custom_message']}"

    return title, body


def send_sms(phone_number: str, message: str, notification_type: str = "general", title: str = "", user=None) -> dict:
    """
    Sends SMS via configured provider (Twilio / Fast2SMS / generic SMS API) or simulated gateway.
    """
    clean_phone = clean_phone_number(phone_number)
    if not clean_phone:
        return {"success": False, "error": "Invalid phone number"}

    twilio_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    twilio_token = os.environ.get("TWILIO_AUTH_TOKEN")
    twilio_from = os.environ.get("TWILIO_SMS_FROM")

    status_val = "simulated"
    gateway_resp = {}

    if twilio_sid and twilio_token and twilio_from:
        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{twilio_sid}/Messages.json"
            res = requests.post(
                url,
                data={"From": twilio_from, "To": clean_phone, "Body": message},
                auth=(twilio_sid, twilio_token),
                timeout=8,
            )
            gateway_resp = res.json() if res.headers.get("content-type", "").startswith("application/json") else {"text": res.text}
            if res.status_code in (200, 201):
                status_val = "delivered"
            else:
                status_val = "failed"
        except Exception as e:
            logger.error("Twilio SMS send failed: %s", e)
            status_val = "failed"
            gateway_resp = {"error": str(e)}
    else:
        # Development / Simulation mode
        logger.info("[SMS SIMULATOR] To: %s | Message: %s", clean_phone, message[:80])
        gateway_resp = {
            "mode": "simulation",
            "message": "SMS simulated successfully (configure TWILIO_ACCOUNT_SID & TWILIO_AUTH_TOKEN for live carrier delivery)",
        }

    log_entry = NotificationLog.objects.create(
        user=user,
        recipient=clean_phone,
        channel="sms",
        notification_type=notification_type,
        title=title or "SMS Notification",
        message=message,
        status=status_val,
        gateway_response=gateway_resp,
    )

    return {
        "success": status_val in ("sent", "delivered", "simulated"),
        "channel": "sms",
        "recipient": clean_phone,
        "status": status_val,
        "log_id": log_entry.id,
        "created_at": log_entry.created_at.isoformat(),
    }


def send_whatsapp(phone_number: str, message: str, notification_type: str = "general", title: str = "", user=None) -> dict:
    """
    Sends WhatsApp message via Cloud API / Twilio or generates a direct 1-click wa.me link.
    """
    clean_phone = clean_phone_number(phone_number)
    if not clean_phone:
        return {"success": False, "error": "Invalid phone number"}

    wa_web_url = generate_whatsapp_web_url(clean_phone, message)

    wa_token = os.environ.get("WHATSAPP_API_TOKEN")
    wa_phone_id = os.environ.get("WHATSAPP_PHONE_NUMBER_ID")

    status_val = "simulated"
    gateway_resp = {}

    if wa_token and wa_phone_id:
        try:
            url = f"https://graph.facebook.com/v18.0/{wa_phone_id}/messages"
            headers = {
                "Authorization": f"Bearer {wa_token}",
                "Content-Type": "application/json",
            }
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": clean_phone.replace("+", ""),
                "type": "text",
                "text": {"body": message},
            }
            res = requests.post(url, json=payload, headers=headers, timeout=8)
            gateway_resp = res.json()
            if res.status_code in (200, 201):
                status_val = "delivered"
            else:
                status_val = "failed"
        except Exception as e:
            logger.error("WhatsApp Cloud API send failed: %s", e)
            status_val = "failed"
            gateway_resp = {"error": str(e)}
    else:
        # Development / Simulation mode with direct wa.me link
        logger.info("[WHATSAPP SIMULATOR] To: %s | Link: %s", clean_phone, wa_web_url)
        gateway_resp = {
            "mode": "simulation",
            "whatsapp_web_url": wa_web_url,
            "message": "WhatsApp message simulated successfully. Click whatsapp_web_url to open in WhatsApp Web/App.",
        }

    log_entry = NotificationLog.objects.create(
        user=user,
        recipient=clean_phone,
        channel="whatsapp",
        notification_type=notification_type,
        title=title or "WhatsApp Notification",
        message=message,
        status=status_val,
        gateway_response=gateway_resp,
    )

    return {
        "success": status_val in ("sent", "delivered", "simulated"),
        "channel": "whatsapp",
        "recipient": clean_phone,
        "status": status_val,
        "whatsapp_web_url": wa_web_url,
        "log_id": log_entry.id,
        "created_at": log_entry.created_at.isoformat(),
    }


def send_notification(
    phone_number: str,
    channels: list[str] | None = None,
    template_type: str = "test",
    data: dict | None = None,
    lang_code: str = "hi-IN",
    user=None,
) -> dict:
    """
    High-level orchestrator: Formats and dispatches notification across WhatsApp and/or SMS.
    """
    if channels is None:
        channels = ["whatsapp", "sms"]

    if data is None:
        data = {}

    title, message = format_multilingual_notification(template_type, data, lang_code)
    results = {}

    if "whatsapp" in channels:
        results["whatsapp"] = send_whatsapp(
            phone_number=phone_number,
            message=message,
            notification_type=template_type,
            title=title,
            user=user,
        )

    if "sms" in channels:
        results["sms"] = send_sms(
            phone_number=phone_number,
            message=message,
            notification_type=template_type,
            title=title,
            user=user,
        )

    overall_success = any(r.get("success") for r in results.values())
    wa_url = results.get("whatsapp", {}).get("whatsapp_web_url") or generate_whatsapp_web_url(phone_number, message)

    return {
        "success": overall_success,
        "recipient": clean_phone_number(phone_number),
        "title": title,
        "message": message,
        "whatsapp_web_url": wa_url,
        "results": results,
    }
