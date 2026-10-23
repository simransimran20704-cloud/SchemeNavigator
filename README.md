# 🧭 SchemeNavigator — AI-Powered Citizen Welfare Discovery & Guidance Platform

<div align="center">

[![GitHub Repo](https://img.shields.io/badge/GitHub-SchemeNavigator-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/simransimran20704-cloud/SchemeNavigator)
[![React 19](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite_8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Django REST](https://img.shields.io/badge/Django_REST-092E20?style=for-the-badge&logo=django&logoColor=white)](https://www.django-rest-framework.org/)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Sarvam AI](https://img.shields.io/badge/Powered_By-Sarvam_AI-FF6B6B?style=for-the-badge)](https://www.sarvam.ai/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

**DISCOVER → UNDERSTAND → APPLY**  
*A personalized, transparent, and privacy-first government welfare navigation platform connecting Indian citizens to 4,700+ Central and State welfare programs.*

[🚀 **Quick Start**](#-quick-start) • [✨ **Key Features**](#-key-features) • [🏛️ **Architecture**](#️-system-architecture) • [🔔 **Notification Service**](#-whatsapp--sms-notifications) • [🤖 **Mitra AI**](#-mitra-ai-conversational-advisor) • [📜 **Disclaimer**](#-official-disclaimer)

</div>

---

## 📖 About SchemeNavigator

Navigating government welfare schemes can often feel like an overwhelming maze of fragmented department websites, complex gazettes, and confusing eligibility rules.

**SchemeNavigator** acts as an intelligent navigational compass connecting citizens to authentic central and state public welfare programs:

- **Zero Scheme Knowledge Needed**: Start simply with *"Tell us about yourself"*.
- **100% Privacy-First**: No Aadhaar number, PAN card, or sensitive credentials required.
- **Explainable Match Scoring**: Deterministic rule-based compatibility engine (0–100%) with step-by-step criteria breakdowns.
- **Plain Language & Checklists**: Plain-language summaries, exact financial benefit estimates, required document checklists, and application milestones.
- **Authentic Redirection**: Safe pre-flight verification before routing to official `.gov.in` and `.nic.in` portals.
- **Inclusive Accessibility**: Voice-guided navigation, Speech-to-Text input, and native Text-to-Speech in 12+ Indian languages.

---

## ✨ Key Features

### 1. 🎯 Deterministic Fit Scoring Engine (`/recommendations`)
- Deterministic compatibility engine scoring across 100+ Central and State welfare programs.
- Real-time explainability breakdown showing which eligibility criteria matched and why.
- Direct filtering by category: Agriculture, Education & Scholarships, MSME & Business, Healthcare, Women & Child Welfare, Housing, Pensions & Social Security.

### 2. 🤖 Mitra AI — Voice & Multilingual Advisor (`/assistant`)
- **Conversational Scheme Guidance**: Grounded assistant answering natural language questions about eligibility, deadlines, and required certificates.
- **Sarvam AI Multi-Key Voice & Translation**:
  - Voice-to-Text (STT) for hands-free queries.
  - Text-to-Speech (TTS) voice narration across languages.
  - Real-time translation with multi-key automatic failover and seamless synchronization between homepage and assistant.

### 3. 🔔 Multi-Channel Citizen Alerts (WhatsApp & SMS)
- **Active Notification Service**: Dispatches timely, structured alerts to citizen mobiles:
  - 🎯 **New Matches**: Notifications when a relevant government scheme matching user profile is found.
  - ⏰ **Deadline Alerts**: Timely reminders before important application deadlines.
  - 📋 **Application Updates**: Status progress updates for tracked schemes.
- **Dual Channel Support**: SMS notifications + 1-Click WhatsApp deep-link (`wa.me`) with pre-formatted message cards.
- **Verified Indian Language Templates**: Supports English, Hindi, Odia, Bengali, Marathi, Telugu, Tamil, etc.

### 4. 📋 6-Step Citizen Eligibility Survey (`/survey`)
- **Step-by-step wizard**:
  - Personal Details (Age, Gender, Marital Status)
  - Location (State/UT and District mapping)
  - Social Background (Caste category, Divyangjan disability status, BPL/EWS status)
  - Occupation & Employment (Farmer, Student, MSME Entrepreneur, Daily Wage Worker, etc.)
  - Household Income bracket calibration
  - Live Review & instant editability before calculation
- **Voice Survey Mode**: Allows citizens to speak their profile parameters naturally.

### 5. 🗺️ Kendra Locator (`/kendras`)
- Interactive locator for Common Service Centers (CSC), e-Mitra kiosks, and government citizen facilitation centers.
- Dynamic district/state filtering, address details, and direct contact guides.

### 6. 📅 Yojana Calendar & Deadline Ticker (`/calendar`)
- Visual calendar showing upcoming application intake windows and cutoff dates.
- Filter by category and urgency (Critical, Closing Soon, Active).
- 1-Click calendar synchronization (.ics export & Google Calendar integration).

### 7. 📌 Citizen Locker & Application Tracker (`/dashboard`, `/tracker`)
- Bookmark and track schemes through 5 stages: *Exploring*, *Documents Needed*, *Ready to Apply*, *Applied Externally*, *Completed*.
- Custom status notes and progress tracking with real-time mobile notifications.

### 8. 🇮🇳 12+ Indian Language Support
- Instant localization across:
  - English (`en-IN`)
  - Hindi (`hi-IN`) — हिंदी
  - Bengali (`bn-IN`) — বাংলা
  - Telugu (`te-IN`) — తెలుగు
  - Marathi (`mr-IN`) — मराठी
  - Tamil (`ta-IN`) — தமிழ்
  - Gujarati (`gu-IN`) — ગુજરાતી
  - Urdu (`ur-IN`) — اردو
  - Kannada (`kn-IN`) — ಕನ್ನಡ
  - Odia (`or-IN`) — ଓଡ଼ିଆ
  - Malayalam (`ml-IN`) — മലയാളം
  - Punjabi (`pa-IN`) — ਪੰਜਾਬੀ

---

## 🛠️ System Architecture & Tech Stack

```
SchemeNavigator/
├── Frontend-Scheme-Navigator-main/    # React 19 + TypeScript + Vite 8 Client
│   ├── src/
│   │   ├── components/                # UI components (survey, dashboard, notifications, assistant)
│   │   ├── pages/                     # Application routes & views
│   │   ├── services/                  # API client, matching engine, Sarvam AI & Gemini integrations
│   │   ├── hooks/                     # Custom hooks (useTranslation, useVoiceReader, useVoiceRecognition)
│   │   ├── store/                     # Global React context store
│   │   └── utils/                     # Transliterator, calendar sync, scheme deadlines
│   └── package.json
│
├── backend/                           # Django 5 + Django REST Framework API
│   ├── config/                        # Django settings & URL routing
│   ├── schemes/                       # Scheme models, catalog loaders, filtering APIs
│   ├── notifications/                 # Multi-channel WhatsApp & SMS notification engine
│   ├── assistant/                     # Mitra AI endpoints, Sarvam AI TTS/STT services
│   ├── tracker/                       # Saved schemes & milestone tracker
│   ├── sessions_app/                  # Anonymous citizen session management
│   ├── agents/                        # Multi-agent profile & recommendation reasoning
│   └── requirements.txt
│
├── docker-compose.yml                 # Multi-container orchestration (PostgreSQL + Redis + Django)
└── README.md
```

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide React, Framer Motion |
| **Backend API** | Python 3.12, Django 5, Django REST Framework |
| **Database** | SQLite (Dev) / PostgreSQL (Production) with flexible JSONB schemas |
| **Voice & Speech AI** | Sarvam AI (Speech-to-Text `saaras:v2`, Text-to-Speech `bulbul:v1`, Translate) |
| **Chat & Reasoning** | Google Gemini (`gemini-2.0-flash` / `gemini-1.5-pro`) & LiteLLM |
| **Notifications** | WhatsApp Cloud API, `wa.me` 1-Click deep-linking, Twilio SMS / Simulator Gateway |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18 or higher) & **npm**
- **Python** (v3.10 or higher) & **pip**
- **Git**

---

### 1. Clone the Repository

```bash
git clone https://github.com/simransimran20704-cloud/SchemeNavigator.git
cd SchemeNavigator
```

---

### 2. Frontend Setup (React + Vite)

```bash
cd Frontend-Scheme-Navigator-main

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local

# Start Vite development server
npm run dev
```

The frontend will run at **`http://localhost:5173`**.

---

### 3. Backend Setup (Django REST Framework)

Open a new terminal window:

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Setup environment variables
cp .env.example .env

# Run database migrations
python manage.py migrate

# Start Django development server
python manage.py runserver 127.0.0.1:8000
```

The backend API will run at **`http://127.0.0.1:8000/`**.

---

### 4. Docker Deployment (Optional)

Run the full stack with PostgreSQL and Redis:

```bash
docker-compose up --build
```

---

## ⚙️ Environment Variables

### Frontend (`Frontend-Scheme-Navigator-main/.env.local`)
```env
VITE_API_URL=http://127.0.0.1:8000
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Sarvam AI Keys (STT, TTS, Translation)
VITE_SARVAM_MITRA_STT_KEY=your_sarvam_stt_key
VITE_SARVAM_HOMEPAGE_TTS_KEY=your_sarvam_tts_key
VITE_SARVAM_MITRA_TTS_KEY=your_sarvam_tts_key
VITE_SARVAM_HOMEPAGE_TRANSLATE_KEY=your_sarvam_translate_key
VITE_SARVAM_MITRA_TRANSLATE_KEY=your_sarvam_translate_key
```

### Backend (`backend/.env`)
```env
DJANGO_SECRET_KEY=your_django_secret_key
DJANGO_DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost

# Sarvam AI
SARVAM_MITRA_STT_KEY=your_sarvam_stt_key
SARVAM_HOMEPAGE_TTS_KEY=your_sarvam_tts_key
SARVAM_MITRA_TTS_KEY=your_sarvam_tts_key
SARVAM_HOMEPAGE_TRANSLATE_KEY=your_sarvam_translate_key
SARVAM_MITRA_TRANSLATE_KEY=your_sarvam_translate_key

# WhatsApp & SMS (Optional for live carrier dispatch)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_SMS_FROM=your_twilio_number
WHATSAPP_API_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_id
```

---

## 📜 Official Disclaimer

> **Transparency Notice:**  
> SchemeNavigator is an independent, open informational discovery and guidance platform created to assist Indian citizens in discovering public welfare programs.  
> SchemeNavigator is **not affiliated with, endorsed by, or an official department of any Government of India ministry or state administration**. SchemeNavigator does not collect official government applications, process approvals, or disburse funds. All final applications and verifications occur exclusively on designated official government portals (`.gov.in` / `.nic.in`).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">
Made with ❤️ by <b><a href="https://github.com/simransimran20704-cloud">Simran</a></b> to empower citizens across India with transparent, accessible welfare information.
</div>
