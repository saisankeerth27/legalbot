# LegalBot

AI-powered legal information assistant for Indian law. Get instant answers about IPC, Constitution, Cyber Laws, Consumer Rights, and more.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + shadcn/ui
- **Backend:** Supabase Edge Functions
- **AI:** Google Gemini 2.0 Flash
- **Database:** Supabase (PostgreSQL)

## Features

- Multi-language support (English, Hindi, Telugu)
- Dark/light theme toggle
- Voice input (Web Speech API)
- Markdown rendering for legal responses
- Conversation history with Supabase
- Response caching for common queries

## Setup

### Prerequisites

- Node.js 18+
- Supabase project
- Google Gemini API key

### Environment Variables

Create a `.env` file:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

Set in Supabase Edge Function secrets:

```
GEMINI_API_KEY=your_gemini_api_key
```

### Install & Run

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

## Project Structure

```
legalbot/
├── src/
│   ├── components/       # React components
│   ├── lib/              # Utilities and services
│   ├── pages/            # Route pages
│   └── integrations/     # Supabase client
├── supabase/
│   └── functions/        # Edge Functions (AI backend)
└── public/               # Static assets
```

## License

MIT
