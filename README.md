# ContractLens

> Review contracts like a lawyer. Without one.

ContractLens is an AI-powered web app that extracts and structures every clause from vendor contracts (PDFs), resolves cross-references so each clause has its full context, flags risk, and lets founders query across all their contracts in plain English.

**Live demo**: [contractlens-taupe.vercel.app](https://contractlens-taupe.vercel.app)

---

## What it does

1. **Upload** any vendor contract PDF (up to 50 MB)
2. **Extracts** every clause with type classification (termination, payment, IP, liability, auto-renewal, etc.)
3. **Resolves cross-references** — when a clause says "see Section 3.1(b)", ContractLens shows you what Section 3.1(b) actually says, inline
4. **Flags risk** — marks clauses as high/medium/low risk, detects flags like `auto-renewal`, `uncapped-liability`, `one-sided-termination`
5. **Query** across all contracts: "show me termination clauses", "which contracts have auto-renewal?", or any natural language question

---

## Quick Setup (< 5 minutes)

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)
- A [Google AI Studio](https://makersuite.google.com/app/apikey) Gemini API key

### 1. Clone and install

```bash
git clone https://github.com/akashdeepjaiswal/contractlens.git
cd contractlens
npm install
```

### 2. Set up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. In **SQL Editor**, run the migration:
   ```sql
   -- Copy contents of supabase/migrations/001_init.sql and run
   ```
3. In **Storage**, create a bucket named `contracts` (set to private)
4. Copy your project URL and keys from **Project Settings → API**

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — upload a contract and start exploring.

---

## Running Tests

```bash
npm test                 # Run all tests
npm run test:coverage    # Run with coverage report
npm run test:watch       # Watch mode
```

Tests cover:
- `referenceResolver` — cross-reference resolution, unresolvable tracking, case-insensitive matching
- `structureAnalyzer` — section depth inference
- `ClauseCard` component — rendering, expansion, cross-reference toggle, risk display

---

## Architecture

### 3-Pass Extraction Pipeline

The core innovation. See [decisions.md](./decisions.md) for the detailed rationale.

```
PDF Buffer
    │
    ▼
[Pass 1: Structure Analysis]
  Gemini → Section map + Defined terms registry + Contract metadata
    │
    ▼
[Pass 2: Clause Extraction]
  Gemini → Raw clauses (type, risk, flags, raw_references[])
    │
    ▼
[Pass 3: Reference Resolution]
  Deterministic lookup → resolved_context (clause + inlined references)
    │
    ▼
[Embeddings]
  text-embedding-004 → 768-dim vectors on resolved_context
    │
    ▼
[Supabase (Postgres + pgvector)]
```

### Why resolved_context matters

A clause like:
> "Termination may occur pursuant to Section 3.1(b) subject to the Minimum Commitment defined in Exhibit A."

Is stored with `resolved_context`:
> "Termination may occur pursuant to Section 3.1(b) subject to the Minimum Commitment defined in Exhibit A.
>
> **Section 3.1(b):** Late payments shall accrue interest at 1.5% per month.
> **Minimum Commitment:** USD 50,000 per year for the Initial Term."

The embedding encodes the *resolved meaning*, so semantic search for "payment threshold for termination" actually works.

### Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Vanilla CSS with design tokens |
| LLM | Google Gemini 2.5 Flash (latest, benchmarked against Claude Sonnet 4.x & GPT-4o) |
| Embeddings | Gemini text-embedding-004 (768d) |
| Database | Supabase (PostgreSQL + pgvector) |
| Storage | Supabase Storage |
| Testing | Vitest + @testing-library/react |
| Deployment | Vercel |

---

## Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add GEMINI_API_KEY

# Deploy to production
vercel --prod
```

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Landing / upload
│   ├── contracts/page.tsx          # Contract list
│   ├── contracts/[id]/page.tsx     # Contract detail + clauses
│   ├── query/page.tsx              # Cross-contract query
│   └── api/
│       ├── upload/route.ts
│       ├── contracts/route.ts
│       ├── contracts/[id]/route.ts
│       ├── contracts/[id]/process/route.ts  ← SSE pipeline
│       └── query/route.ts
├── components/
│   ├── AppShell.tsx
│   ├── UploadZone.tsx
│   ├── ContractCard.tsx
│   ├── ClauseCard.tsx              ← Cross-ref toggle lives here
│   └── ProcessingStatus.tsx       ← SSE progress stream
├── lib/
│   ├── types.ts
│   ├── gemini.ts
│   ├── db/ (client, contracts, clauses)
│   └── pipeline/
│       ├── extractor.ts
│       ├── structureAnalyzer.ts   ← Pass 1
│       ├── clauseExtractor.ts     ← Pass 2
│       ├── referenceResolver.ts   ← Pass 3 (the hard part)
│       └── embedder.ts
└── __tests__/
    ├── pipeline/ (referenceResolver, structureAnalyzer)
    └── components/ (ClauseCard)
```

---

## See Also

- [decisions.md](./decisions.md) — every major technical and product decision, with alternatives and tradeoffs
- [supabase/migrations/001_init.sql](./supabase/migrations/001_init.sql) — full database schema
