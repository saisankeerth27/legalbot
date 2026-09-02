# LegalBot

AI-powered legal information assistant for Indian law. Ask questions about IPC, Constitution, Cyber Laws, Consumer Rights, Women Safety Laws, and more — get instant, structured answers in English, Hindi, or Telugu.

**Live:** https://legalbot-delta.vercel.app
---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────────────┐  │
│  │  React   │   │   Gemini     │   │     Supabase Client    │  │
│  │   App    │──▶│   Streaming  │   │   (REST API for CRUD)  │  │
│  │          │   │     API      │   │                        │  │
│  └──────────┘   └──────────────┘   └────────────────────────┘  │
│       │                                             │           │
│       ▼                                             ▼           │
│  ┌─────────────────┐                    ┌────────────────────┐  │
│  │  LocalStorage    │                    │  Supabase Cloud    │  │
│  │  - session_id   │                    │  - conversations   │  │
│  │  - theme        │                    │  - messages        │  │
│  └─────────────────┘                    └────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Request Flow

```
User types message
        │
        ▼
┌───────────────────┐
│   Save to DB      │──── Supabase INSERT (conversation + message)
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  Build Gemini     │──── System prompt + language + chat history
│  Request          │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  Stream Response  │──── SSE (Server-Sent Events) chunks
│  (ReadableStream) │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  Render Chunks    │──── ReactMarkdown rendering in real-time
│  in Chat Bubble   │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  Save Complete    │──── Supabase INSERT (assistant message)
│  Response to DB   │
└───────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript |
| Build Tool | Vite 5 (SWC) |
| Styling | Tailwind CSS 3 + shadcn/ui |
| Routing | React Router v6 |
| State | TanStack React Query |
| Database | Supabase (PostgreSQL) |
| AI | Google Gemini 3.6 Flash |
| Icons | Lucide React |
| Toasts | Sonner + Radix Toast |

---

## Project Structure

```
legalbot/
├── src/
│   ├── components/
│   │   ├── ChatInput.tsx          # Text + voice input
│   │   ├── ChatMessages.tsx       # Message display + markdown
│   │   ├── ChatSidebar.tsx        # Conversation list
│   │   ├── LanguageSelector.tsx   # English/Hindi/Telugu
│   │   ├── ThemeToggle.tsx        # Dark/light mode
│   │   └── ui/                    # shadcn/ui primitives
│   │
│   ├── pages/
│   │   ├── Index.tsx              # Main chat page (all state)
│   │   └── NotFound.tsx           # 404 page
│   │
│   ├── lib/
│   │   ├── chat-service.ts        # Supabase CRUD + Gemini streaming
│   │   └── utils.ts               # cn() utility
│   │
│   ├── integrations/supabase/
│   │   ├── client.ts              # Supabase client init
│   │   └── types.ts               # Auto-generated DB types
│   │
│   ├── hooks/
│   │   └── use-toast.ts           # Toast state management
│   │
│   ├── App.tsx                    # Root + routing
│   ├── main.tsx                   # Entry point
│   ├── index.css                  # Theme variables + fonts
│   └── vite-env.d.ts              # TypeScript declarations
│
├── supabase/
│   ├── config.toml                # Project config
│   ├── functions/chat/index.ts    # Edge Function (alternative backend)
│   └── migrations/                # Database schema
│
├── public/
│   └── favicon.svg                # Scales of justice icon
│
└── Config Files
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── tsconfig.json
    └── eslint.config.js
```

---

## Database Schema

### conversations

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `session_id` | TEXT | Browser session identifier |
| `title` | TEXT | Auto-set from first message |
| `language` | TEXT | English / Hindi / Telugu |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Auto-updated on change |

### messages

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `conversation_id` | UUID | FK → conversations (CASCADE delete) |
| `role` | TEXT | "user" or "assistant" |
| `content` | TEXT | Message content |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

---

## Features

- **AI Chat** — Streaming responses from Google Gemini about Indian law
- **Multi-language** — English, Hindi, Telugu for responses and voice input
- **Dark/Light Theme** — System-aware with manual toggle
- **Voice Input** — Web Speech API with language-matched recognition
- **Persistent History** — All conversations saved to Supabase
- **Auto-titling** — First message becomes conversation title
- **Markdown Responses** — Rich formatting with legal structure
- **Responsive Design** — Mobile, tablet, desktop with sidebar overlay
- **Copy to Clipboard** — One-click copy on AI responses
- **Welcome Suggestions** — 4 pre-built legal question cards

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Google Gemini API key

### 1. Clone & Install

```bash
git clone https://github.com/saisankeerth27/legalbot.git
cd legalbot
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key
```

### 3. Setup Database

Run the migration SQL in Supabase SQL Editor:

```sql
-- Conversations table
CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  title TEXT DEFAULT 'New Chat',
  language TEXT DEFAULT 'English',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conversations_session ON conversations(session_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);

-- RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public" ON conversations FOR ALL USING (true);
CREATE POLICY "Public" ON messages FOR ALL USING (true);
```

### 4. Run

```bash
npm run dev
```

Open **http://localhost:8080**

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run tests |

---

## Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Go to https://vercel.com → Import Project
3. Select your GitHub repo
4. Configure:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Add Environment Variables:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your anon key
   - `VITE_API_URL` = your Render backend URL (e.g., `https://legalbot-api.onrender.com`)
6. Deploy

### Backend (Render)

1. Go to https://render.com → New Web Service
2. Connect your GitHub repo
3. Configure:
   - **Name:** `legalbot-api`
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. Add Environment Variable:
   - `GEMINI_API_KEY` = your Gemini API key
5. Deploy

### Update Frontend

After backend is deployed, update your Vercel env variable:
- `VITE_API_URL` = `https://legalbot-api.onrender.com`

---

## Environment Variables

### Frontend (.env)

| Variable | Description | Client |
|----------|-------------|--------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | Yes |
| `VITE_API_URL` | Backend API URL | Yes |

### Backend (server/.env)

| Variable | Description | Client |
|----------|-------------|--------|
| `GEMINI_API_KEY` | Google Gemini API key | No (server only) |
| `PORT` | Server port (default: 3001) | No |

---

## How It Works

### Chat Streaming

1. User sends message → saved to Supabase
2. System prompt + chat history sent to Gemini API
3. Response streams via Server-Sent Events (SSE)
4. Each chunk rendered in real-time with ReactMarkdown
5. Complete response saved back to Supabase

### Language Support

- Language selected per-conversation (stored in DB)
- System prompt appended with language instruction
- Voice input uses matching language (`en-IN`, `hi-IN`, `te-IN`)
- Legal terminology kept in English for accuracy

### Theme System

- CSS custom properties for all colors (HSL values)
- `dark` class toggle on `<html>` element
- System preference detected on first load
- Persisted in `localStorage`

---

## License

MIT
