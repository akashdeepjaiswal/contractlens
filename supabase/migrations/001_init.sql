-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- CONTRACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  file_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_message TEXT,
  raw_text TEXT,
  page_count INTEGER,
  metadata JSONB DEFAULT '{}',  -- { parties, date, governing_law, contract_type }
  clause_count INTEGER DEFAULT 0,
  risk_summary JSONB DEFAULT '{}', -- { high: N, medium: N, low: N }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DEFINED TERMS  (e.g. "Services" means …, "Agreement" means …)
-- ============================================================
CREATE TABLE IF NOT EXISTS defined_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  section_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_defined_terms_contract ON defined_terms(contract_id);
CREATE INDEX IF NOT EXISTS idx_defined_terms_term ON defined_terms(contract_id, term);

-- ============================================================
-- SECTION MAP  (section number → full text slice for x-ref resolution)
-- ============================================================
CREATE TABLE IF NOT EXISTS section_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  section_number TEXT NOT NULL,  -- "3.1", "3.1(b)", "Exhibit A"
  title TEXT,
  content TEXT NOT NULL,
  depth INTEGER DEFAULT 0,       -- 0=top-level, 1=sub, 2=sub-sub
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_section_map_contract ON section_map(contract_id);
CREATE INDEX IF NOT EXISTS idx_section_map_number ON section_map(contract_id, section_number);

-- ============================================================
-- CLAUSES
-- ============================================================
CREATE TABLE IF NOT EXISTS clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  section_number TEXT,
  title TEXT,
  clause_type TEXT NOT NULL DEFAULT 'other',
  content TEXT NOT NULL,
  resolved_context TEXT,          -- content + all cross-refs inlined
  risk_level TEXT NOT NULL DEFAULT 'low'
    CHECK (risk_level IN ('low', 'medium', 'high')),
  flags TEXT[] DEFAULT '{}',      -- ["auto-renewal", "uncapped-liability", ...]
  raw_references TEXT[] DEFAULT '{}',  -- ["Section 3.1(b)", "Exhibit A"]
  unresolved_references TEXT[] DEFAULT '{}',  -- refs we couldn't resolve
  embedding VECTOR(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clauses_contract ON clauses(contract_id);
CREATE INDEX IF NOT EXISTS idx_clauses_type ON clauses(clause_type);
CREATE INDEX IF NOT EXISTS idx_clauses_risk ON clauses(risk_level);
CREATE INDEX IF NOT EXISTS idx_clauses_flags ON clauses USING gin(flags);

-- Vector similarity index (IVFFlat - good for up to ~1M rows)
CREATE INDEX IF NOT EXISTS idx_clauses_embedding
  ON clauses USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- HELPER: updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEMANTIC SEARCH FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION search_clauses(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 20,
  filter_contract_id UUID DEFAULT NULL,
  filter_clause_type TEXT DEFAULT NULL,
  filter_risk_level TEXT DEFAULT NULL,
  filter_flag TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  contract_id UUID,
  section_number TEXT,
  title TEXT,
  clause_type TEXT,
  content TEXT,
  resolved_context TEXT,
  risk_level TEXT,
  flags TEXT[],
  raw_references TEXT[],
  unresolved_references TEXT[],
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.contract_id,
    c.section_number,
    c.title,
    c.clause_type,
    c.content,
    c.resolved_context,
    c.risk_level,
    c.flags,
    c.raw_references,
    c.unresolved_references,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM clauses c
  WHERE
    c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
    AND (filter_contract_id IS NULL OR c.contract_id = filter_contract_id)
    AND (filter_clause_type IS NULL OR c.clause_type = filter_clause_type)
    AND (filter_risk_level IS NULL OR c.risk_level = filter_risk_level)
    AND (filter_flag IS NULL OR filter_flag = ANY(c.flags))
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
