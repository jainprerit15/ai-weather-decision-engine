# AI Weather Decision Engine

Action-oriented weather intelligence project focused on decisions, not only weather values.

## Features

- AI daily planner by weather (best 2-hour outdoor workout window)
- Umbrella decision with confidence score
- Smart clothing recommendation
- Travel/weather risk assistant (bike commute, running quality, heat alert)
- Natural-language weather Q&A (OpenAI optional)
- AI city comparison with comfort index

## Setup

1. Copy `.env.example` to `.env.local`
2. Add keys:
   - `NEXT_PUBLIC_OPENWEATHER_API_KEY` (required)
   - `NEXT_PUBLIC_OPENAI_API_KEY` (optional)
3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Notes

- Without OpenAI key, Q&A shows deterministic fallback guidance.
- City comparison supports up to 5 cities in one run.
