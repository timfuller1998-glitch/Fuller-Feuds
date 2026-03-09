-- Enable pgvector extension (Supabase has this by default)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add new score fields to opinions table
ALTER TABLE opinions ADD COLUMN IF NOT EXISTS taste_score integer;
ALTER TABLE opinions ADD COLUMN IF NOT EXISTS passion_score integer;
ALTER TABLE opinions ADD COLUMN IF NOT EXISTS analysis_confidence varchar(10);
ALTER TABLE opinions ADD COLUMN IF NOT EXISTS analyzed_at timestamp;

-- Add distribution fields to cumulative_opinions table
ALTER TABLE cumulative_opinions ADD COLUMN IF NOT EXISTS average_taste_score integer;
ALTER TABLE cumulative_opinions ADD COLUMN IF NOT EXISTS average_passion_score integer;
ALTER TABLE cumulative_opinions ADD COLUMN IF NOT EXISTS taste_distribution jsonb;
ALTER TABLE cumulative_opinions ADD COLUMN IF NOT EXISTS passion_distribution jsonb;
ALTER TABLE cumulative_opinions ADD COLUMN IF NOT EXISTS political_distribution jsonb;
ALTER TABLE cumulative_opinions ADD COLUMN IF NOT EXISTS taste_diversity integer;
ALTER TABLE cumulative_opinions ADD COLUMN IF NOT EXISTS passion_diversity integer;

-- Add vector column alongside existing JSONB embedding (nullable initially)
ALTER TABLE topics ADD COLUMN IF NOT EXISTS embedding_vec vector(1536);

-- Migrate existing JSONB embeddings to vector format
UPDATE topics 
SET embedding_vec = embedding::vector
WHERE embedding IS NOT NULL AND embedding_vec IS NULL;

-- Create HNSW index for fast similarity search with optimized parameters
CREATE INDEX IF NOT EXISTS topics_embedding_vec_idx ON topics 
  USING hnsw (embedding_vec vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Create full-text search index for hybrid search
CREATE INDEX IF NOT EXISTS topics_fts_idx ON topics 
  USING gin (to_tsvector('english', title || ' ' || description));

-- Index for batch processing queries (fetch unscored opinions)
CREATE INDEX IF NOT EXISTS opinions_unscored_idx ON opinions 
  (created_at DESC) 
  WHERE topic_economic_score IS NULL 
    AND status IN ('approved', 'pending');

-- Index for distribution calculations
CREATE INDEX IF NOT EXISTS opinions_topic_scores_idx ON opinions 
  (topic_id, topic_economic_score, topic_authoritarian_score, taste_score, passion_score)
  WHERE status IN ('approved', 'pending');

-- Index for summary threshold checks
CREATE INDEX IF NOT EXISTS opinions_topic_created_idx ON opinions 
  (topic_id, created_at DESC)
  WHERE status IN ('approved', 'pending');

