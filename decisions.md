# decisions.md

## Brief

**Problem**: A founder reviewing vendor contracts without a lawyer faces PDF documents full of nested clauses, cross-references, defined terms, and inconsistent formatting. The documents are dense enough that critical obligations are buried and easy to miss.

**Who it's for**: Non-technical founders and operators who need to understand what they're signing — quickly and without paying $500/hr for a lawyer on every contract.

**Hard part**: A clause extracted in isolation is often meaningless. "Termination may occur pursuant to Section 3.1(b) subject to the Minimum Commitment defined in Exhibit A" tells you nothing if you don't know what Section 3.1(b) says and what the Minimum Commitment is. A naive approach (chunk text → embed → search) fails here because the embeddings don't carry the meaning of unresolved references.

**The slice shipped**: Upload a PDF → 3-pass extraction pipeline → query all contracts in plain English. The hard case handled is cross-reference resolution: clauses store their context with all referenced sections inlined.

**Why this over option 2 (schema versioning)**: Option 1 has a harder sub-problem that I find more interesting — the cross-reference problem forces you to think about document structure, semantic meaning, and retrieval quality simultaneously. Option 2 is mostly a known problem (Flyway/Liquibase territory) with a clear reference implementation.

---

## Decisions

### 1. 3-pass pipeline instead of single-pass chunking

**Decision**: Three separate LLM calls: (1) structure analysis → (2) clause extraction → (3) reference resolution using output from pass 1.

**Alternatives considered**:
- Single-pass chunking and embedding (naive RAG): fast but clauses lose cross-reference context, making many extracted clauses semantically incomplete
- Two-pass (extract + embed): skips cross-reference resolution; queries work on keywords but miss the "full picture" meaning

**Reasoning**: The cross-reference problem is the core hard part of this project. A clause about termination that references a payment threshold elsewhere in the document is useless without that threshold. By running structure analysis first, we build a section map that the resolver uses to inline referenced content before embedding. The embeddings then encode the *resolved* meaning, not just the raw clause text.

**Tradeoff accepted**: Three LLM calls means higher latency (30–120 seconds per contract depending on length). We mitigate with SSE streaming so the user sees progress in real time.

---

### 2. Model Selection: Gemini 2.5 Flash vs. Claude Sonnet 4.x vs. GPT-4o

**Decision**: Gemini 2.5 Flash as the primary extraction and structuring engine, with gemini-2.0-flash as automatic fallback, benchmarked against frontier alternatives (Claude Sonnet 4.x and GPT-4o).

**Alternatives considered**:
- **Claude Sonnet 4.x (Anthropic)**: Best-in-class for nuanced legal reasoning and multi-step instruction adherence. Recognized gold standard for legal document comprehension.
  - *Why not chosen as primary*: Claude's API requires a paid Anthropic account and the free-tier limits made reliable demo operation impossible. More critically, in a 3-pass pipeline Claude's 15–30s generation latency per pass pushes total processing time over 90+ seconds — past Vercel's function timeout threshold on hobby tier. Cost ($3.00–$15.00 per MTok) makes demo-scale operation expensive. Claude would be the right choice for a production enterprise deployment where quality takes priority over latency/cost, and is explicitly documented as the recommendation for high-risk clause routing in a hybrid architecture.
  - *Key tradeoff accepted*: Gemini Flash produces slightly more generic risk summaries on subtle legal edge-cases (e.g., IP carve-outs in indemnification clauses) compared to Claude. This is mitigated with strict few-shot prompting and rigid clause taxonomies.
- **GPT-4o**: Strong multimodal comprehension and structured JSON output.
  - *Why not chosen*: 128k context window is insufficient for full enterprise contracts (MSAs + exhibits + schedules) without chunking. Chunking breaks Pass 1 (global section map and defined-term registry must be built from the full document, not fragments). Slower token generation degrades SSE streaming responsiveness.
- **Gemini 1.5 / 2.0 Pro**: Better legal synthesis than Flash but 3–4x higher latency and cost without meaningful quality improvement for standard clause segmentation.
- **Gemini 2.0 Flash**: Previous generation Flash model. Kept as automatic fallback in the model cascade.

**Why Gemini 2.5 Flash**:
1. **1M–2M Token Context Window**: The cross-reference resolution problem demands seeing the whole document at once. A termination clause referencing definitions 40 pages earlier cannot be reliably structured from a chunked fragment. Gemini is the only model at this price point with a context window large enough for multi-hundred-page contracts.
2. **Improved Reasoning over 2.0 Flash**: Gemini 2.5 Flash adds significantly better multi-step instruction following, more accurate structured JSON schema compliance, and better clause classification on ambiguous legal text (e.g., distinguishing liability limitation from indemnification when both appear in the same section).
3. **Fast TTFT for SSE Streaming**: Structure mapping completes in ~4–8s, clause extraction in ~10–15s, allowing the SSE stream to deliver real-time feedback under Vercel's 300s max duration.
4. **Native JSON Schema Enforcement**: `responseMimeType: 'application/json'` guarantees schema compliance without brittle post-processing.
5. **Cost-to-Performance Ratio**: Fraction of Claude/GPT-4o cost, keeping high-volume ingestion economically viable.

**Production Recommendation (Hybrid Architecture)**:
- **Pass 1 & 2 (structure + bulk clause extraction)**: Gemini 2.5 Flash — whole-document ingestion at low cost and low latency.
- **Pass 3 (high-risk legal synthesis)**: Ambiguous, high-risk clauses (IP assignment, uncapped indemnification, non-solicitation) conditionally routed to Claude Sonnet for deep legal nuance and negotiation guidance.

**Tradeoff accepted**: Gemini 2.5 Flash can produce slightly less nuanced risk rationale on edge-case legal clauses compared to Claude Sonnet. Mitigated by rigid few-shot prompts, strict clause taxonomies, and deterministic code for reference resolution.

---

### 3. Supabase (Postgres + pgvector) over a dedicated vector DB

**Decision**: Supabase with the pgvector extension for both relational data and vector search.

**Alternatives considered**:
- Pinecone: excellent vector search, but requires a second datastore for relational data (clauses, contracts, terms) and adds operational complexity
- Weaviate: combined vector + relational, but heavy to self-host and over-engineered for a 5-day build
- SQLite + local embeddings: works locally but not deployable; no built-in vector search

**Reasoning**: The clause data is inherently relational (contracts → clauses → defined_terms → section_map), and we need both structured queries (filter by type/risk/flag) and semantic search. Combining both in Supabase eliminates a second datastore while keeping the project deployable in minutes. pgvector's IVFFlat index handles semantic search adequately at this scale. If traffic grew to millions of clauses, we'd consider a dedicated vector DB.

**Tradeoff accepted**: pgvector's vector search quality is slightly lower than purpose-built vector DBs at scale, but is entirely adequate for our target use case (hundreds to low thousands of clauses per deployment).

---

### 4. SSE (Server-Sent Events) for processing progress instead of polling

**Decision**: The `/api/contracts/[id]/process` endpoint streams SSE events as the pipeline progresses.

**Alternatives considered**:
- Polling (client hits `/api/contracts/[id]` every 2 seconds): works but wasteful, laggy UX
- WebSockets: bidirectional overkill for a one-directional progress stream
- Background job + status endpoint (e.g. BullMQ): operationally heavy, requires Redis; hard to deploy on Vercel

**Reasoning**: SSE is HTTP/1.1 compatible, unidirectional, perfect for streaming progress events, and works natively in Next.js API routes without any extra infrastructure. The processing loop runs in the same request lifecycle and streams events at each stage checkpoint. On Vercel, this works within the 300s max duration limit.

**Tradeoff accepted**: If processing exceeds ~5 minutes (very long contracts), the SSE connection may time out on Vercel's hobby tier. For the demo scale (contracts <50 MB), this is not an issue.

---

### 5. Resolving references locally (not via LLM)

**Decision**: The reference resolver is deterministic code, not a third LLM call.

**Alternatives considered**:
- LLM-based resolution: ask Gemini "here is clause X and here is the full document, resolve all references" → more flexible but expensive, slow, and harder to test
- Pure regex: parse the document text directly → brittle against inconsistent formatting

**Reasoning**: Since Pass 1 already builds a complete section map and defined-terms registry, we can look up any reference in O(1) with a deterministic algorithm. This is much cheaper and more reliable than another LLM call. The resolver handles: exact matches, case-insensitive matches, parent section fallback (3.1(b) → try 3.1 if not found), defined-term stripping of "the" prefix, and exhibit/schedule normalization. Circular references are guarded with a depth limit of 2.

**Tradeoff accepted**: Complex cross-document references (e.g., "the Master Agreement signed on January 1, 2024") cannot be resolved since we only have the current document's context. These are flagged as `[UNRESOLVED: ...]` in the UI.

---

### 6. Embed resolved_context instead of raw clause content

**Decision**: Embeddings are generated from `resolved_context` (clause content + inlined cross-references) rather than the raw clause text.

**Alternatives considered**:
- Embed raw clause content: fast, simple, but semantically incomplete for clauses with references
- Embed clause + metadata tags: slightly richer but still misses referenced content

**Reasoning**: The whole point of resolving cross-references is to capture the full meaning of a clause. Embedding the resolved context means the semantic search reflects the actual meaning, not just the surface words. A query for "auto-renewal with 30 day notice" will match even if the 30 days is defined in a different section that gets inlined into the resolved context.

**Tradeoff accepted**: Resolved contexts are longer, so each embedding call costs slightly more tokens. We mitigate with a truncation ceiling at 8,000 chars.

---

### 7. Rate limiting embeddings (200ms delay)

**Decision**: 200ms sequential delay between embedding API calls.

**Alternatives considered**:
- Parallel batching: faster but hits Gemini rate limits (60 RPM on free tier) for contracts with many clauses
- Batch API: Gemini's batch API has latency that doesn't suit the real-time SSE experience

**Reasoning**: At 200ms per clause, a contract with 40 clauses takes ~8 seconds for embeddings. This is acceptable and well within Vercel's timeout. More importantly, it keeps us reliably under rate limits without complex retry logic.

---

### 8. No authentication for the demo

**Decision**: No user accounts, login, or multi-tenancy for this submission.

**Alternatives considered**:
- Supabase Auth + Row Level Security: correct approach for production, adds ~1 day of setup
- Clerk auth: fast to add, still adds complexity without evaluation value

**Reasoning**: Authentication is orthogonal to the evaluation criteria. The Supabase schema is designed with `contract_id` foreign keys on all tables so adding RLS later is trivial. For a demo evaluated by reviewers running it themselves, a shared workspace is simpler and avoids "I can't log in" friction.

---

### 9. Vanilla CSS over Tailwind

**Decision**: Custom CSS with design tokens in `:root` CSS variables.

**Alternatives considered**:
- Tailwind CSS v4: fast to prototype, but creates inline-style noise and tight coupling to class names in component logic
- CSS Modules: good for scoping but adds file overhead for a project this size

**Reasoning**: Project guidelines specify vanilla CSS. Additionally, a design token system in CSS variables gives us theme-ability (changing `--color-primary` changes the whole app) and clean separation between design decisions and component markup.

---

### 10. What was deliberately cut

| Feature | Why cut |
|---------|---------|
| PDF viewer with clause highlighting | Requires pdfjs rendering in canvas + coordinate mapping — significant complexity without adding evaluation value over the clause text view |
| DOCX / HTML support | Parsing quality matters; adding more parsers risks lower quality across all formats. PDF is the universal contract format |
| Contract comparison (diff) | Data model supports it (all clauses are typed and structured) but the UI and query layer would take another day |
| Export (PDF report, CSV) | Nice-to-have, not core |
| Suggested edits / negotiation tips | Would require a fine-tuned model or complex prompting; out of scope for 5 days |
| Deployment CI/CD | Out of scope for a demo |

---

### 11. pdf-parse Turbopack bundling — serverExternalPackages fix

**Decision**: Added `serverExternalPackages: ['pdf-parse']` to `next.config.ts`.

**Problem discovered**: pdf-parse v2 uses dynamic `require()` expressions internally to load its PDF.js worker. Turbopack (Next.js 16's bundler) cannot statically analyze dynamic `require` calls and throws `Setting up fake worker failed: "Cannot find module as expression is too dynamic"`. This silently swallowed the v2 path and fell all the way back to the regex fallback, producing `Commercial Agreement Document` instead of the actual contract text.

**Fix**: `serverExternalPackages` instructs Turbopack to leave `pdf-parse` unbundled and let Node.js resolve it natively at runtime. This is the correct solution — pdf-parse is a Node-only CJS module with platform-native dependencies and was never intended to be bundled.

**Alternatives considered**:
- Webpack config override to `externalize` pdf-parse: works but couples config to Webpack, not forward-compatible with Turbopack
- Downgrade to Next.js 14 with Webpack: avoided; Turbopack is faster and is the future
- Replace pdf-parse with a pure-JS PDF library: not worth the quality tradeoff for a 5-day build

**Why it matters**: Without this fix, every contract uploaded to the Vercel/Turbopack deployment extracted 29 characters of fallback text instead of the full document. The 3-pass pipeline would then run on effectively empty content. This was the most critical production bug and is worth documenting because it's a non-obvious interaction between a bundler and a native module.

---

### 12. Theme Architecture — Light as Default with Dark Toggle

**Decision**: Implemented dual light/dark theme support with **light theme as the default**, powered entirely by CSS Custom Properties (`:root, [data-theme="light"]` and `[data-theme="dark"]`), persisted in `localStorage`, and initialized before first paint via an inline `<head>` script to prevent theme flashing (FOUC).

**Why Light as default**:
- **Legibility for long-form legal text**: Contract review involves dense legal paragraphs. Contrast studies demonstrate higher reading speeds and comprehension in positive polarity (dark text on light backgrounds) for dense analytical reading.
- **Enterprise & SaaS alignment**: Standard contract and procurement tools (Ironclad, DocuSign, Carta) default to light mode for executive review during daylight business hours.
- **Dark mode option**: Users who review contracts late or prefer low eye-strain environments can switch with a single click in the topbar.

**Zero-FOUC Implementation**:
- Rather than a React-only `useEffect` state switch (which causes a visible dark-to-light flash on load), an inline `<script>` runs synchronously in `<head>` before the DOM renders. It sets `document.documentElement.setAttribute('data-theme', savedTheme || 'light')`.
- All design tokens (`--color-bg`, `--color-surface`, `--color-text-*`, `--color-border`, `--shadow-*`, `--highlight-*`) adapt instantaneously without re-rendering component trees or shipping third-party theming libraries.

---

### 13. Mobile-First Responsiveness & Progressive Web App (PWA) Architecture

**Decision**: Transformed ContractLens into an installable, mobile-optimized Progressive Web Application (PWA) supporting offline shell caching, standalone window presentation, and an ergonomic mobile UX architecture.

**Key Technical Components**:
1. **PWA Manifest & Next.js App Router Integration**:
   - `public/manifest.json` and `src/app/manifest.ts` define app name, orientation, standalone display mode, background/theme colors, navigation shortcuts, and multi-size high-res icons (192x192, 512x512, apple-touch-icon, and vector SVG).
   - `export const viewport: Viewport` in `src/app/layout.tsx` sets `viewportFit: 'cover'`, `themeColor`, and scaling limits for notch/pill safe areas on modern mobile devices (iOS Safari and Android Chrome).

2. **Offline-Capable Service Worker (`/sw.js`)**:
   - Pre-caches core app shell routes (`/`, `/contracts`, `/query`, icons, and manifest).
   - Implements **Stale-While-Revalidate** caching for HTML pages and static assets to ensure near-instant load times on high-latency mobile connections.
   - Implements **Network-First** caching for API endpoints (`/api/*`), gracefully falling back to cached responses when offline.
   - Listens for `beforeinstallprompt` via `<PWARegistration />` to provide a non-intrusive one-click install banner on supported devices.

3. **Mobile Navigation & Adaptive Layout Hierarchy**:
   - **Bottom Navigation Bar (`.mobile-bottom-nav`)**: Since the desktop sidebar is hidden on small screens (`<= 768px`), mobile users receive an ergonomically placed bottom navigation bar with 48px+ touch targets and active state indicators for Upload, Contracts, and Search.
   - **Contract Detail Auto-Collapse (`.contract-detail-grid`)**: The desktop 2-column layout (`1fr 280px`) collapses to a single column on screens `<= 960px`, unsticking the metadata/risk sidebar so it neatly stacks below the clauses without squishing text.
   - **Adaptive Summary Stats Grid (`.summary-stats-grid`)**: Interactive metric cards wrap smoothly from 6 columns into a 2-column grid on mobile screens `<= 640px` with proper border division.
   - **Touch Target Accessibility**: All interactive elements (filter pills, buttons, tabs) implement `touch-action: manipulation; -webkit-tap-highlight-color: transparent;` and meet WCAG touch target guidelines.

---

### 14. Clause Cards Collapsed by Default with Granular & Global Expansion

**Decision**: Reconfigured the bottom clause breakdown section to be **collapsed by default** across all states (initial load, risk filtering, and category selection), with click-to-expand interactivity and a global "Expand all / Collapse all" toggle control.

**Why Collapsed by Default**:
- **Information Density & Scannability**: Full-length legal clauses frequently span multiple lengthy paragraphs. When multiple clauses match a filter (e.g. 5-10 medium-risk provisions), expanding all cards automatically creates an overwhelming wall of text, pushing lower clauses out of view.
- **Progressive Disclosure**: By keeping cards collapsed by default, users immediately see a clean, compact overview of every matched clause (type badge, risk level, title, detected flags, and filter reasoning).
- **Interactive Control**: Users click individual cards to expand the exact clause they want to examine (revealing highlighted in-paragraph sentences and cross-references), or click the global **"Expand all / Collapse all"** toggle to inspect all clauses simultaneously.
