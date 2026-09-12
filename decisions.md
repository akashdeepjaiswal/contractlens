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

### 2. Gemini 1.5 Flash over GPT-4 / Claude

**Decision**: Gemini 1.5 Flash as the primary LLM.

**Alternatives considered**:
- GPT-4o: excellent quality, but 128k context window means longer contracts (>200 pages) may need chunking
- Claude 3.5 Sonnet: 200k context, excellent at instruction following, but Google API access is what I have set up
- Gemini 1.5 Pro: higher quality than Flash, same 1M context, but slower and more expensive

**Reasoning**: Gemini 1.5 Flash has a 1 million token context window, which means the entire contract (even 50-100 pages) fits in a single prompt. This is crucial for structure analysis where we need to see the whole document to build an accurate section map. Flash is fast enough (8–15 second responses) and cheap enough for this prototype. The `responseMimeType: 'application/json'` feature also lets us reliably get structured JSON without brittle regex parsing.

**Tradeoff accepted**: Flash occasionally hallucinates section numbers for very long contracts. We handle this with strict normalization and validation of LLM outputs before storing.

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
