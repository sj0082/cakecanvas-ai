-- Create trend_categories table
CREATE TABLE IF NOT EXISTS trend_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  source_type TEXT CHECK (source_type IN ('instagram','pinterest','luxury_brand','manual')) DEFAULT 'manual',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create trend_keywords table
CREATE TABLE IF NOT EXISTS trend_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES trend_categories(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  description TEXT,
  visual_examples JSONB,
  palette_preset JSONB,
  popularity_score NUMERIC DEFAULT 0.5 CHECK (popularity_score >= 0 AND popularity_score <= 1),
  trend_period DATERANGE,
  related_keywords JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create trend_stylepack_mappings table
CREATE TABLE IF NOT EXISTS trend_stylepack_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_keyword_id UUID REFERENCES trend_keywords(id) ON DELETE CASCADE,
  stylepack_id UUID REFERENCES stylepacks(id) ON DELETE CASCADE,
  relevance_score NUMERIC DEFAULT 0.5 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(trend_keyword_id, stylepack_id)
);

-- Create indexes for performance
CREATE INDEX idx_trend_keywords_category ON trend_keywords(category_id);
CREATE INDEX idx_trend_keywords_popularity ON trend_keywords(popularity_score DESC);
CREATE INDEX idx_trend_stylepack_mappings_trend ON trend_stylepack_mappings(trend_keyword_id);
CREATE INDEX idx_trend_stylepack_mappings_style ON trend_stylepack_mappings(stylepack_id);

-- Enable RLS
ALTER TABLE trend_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_stylepack_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trend_categories
CREATE POLICY "Anyone can view active trend categories"
  ON trend_categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage trend categories"
  ON trend_categories FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for trend_keywords
CREATE POLICY "Anyone can view trend keywords"
  ON trend_keywords FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage trend keywords"
  ON trend_keywords FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for trend_stylepack_mappings
CREATE POLICY "Anyone can view trend stylepack mappings"
  ON trend_stylepack_mappings FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage trend stylepack mappings"
  ON trend_stylepack_mappings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create stage1_cache table for caching
CREATE TABLE IF NOT EXISTS stage1_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stylepack_id UUID NOT NULL REFERENCES stylepacks(id) ON DELETE CASCADE,
  user_text_hash TEXT NOT NULL,
  size_category_id UUID NOT NULL REFERENCES size_categories(id) ON DELETE CASCADE,
  result JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(stylepack_id, user_text_hash, size_category_id)
);

-- Index for cache expiration cleanup
CREATE INDEX idx_stage1_cache_expires ON stage1_cache(expires_at);

-- Enable RLS for cache table
ALTER TABLE stage1_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policy for cache (service role only)
CREATE POLICY "Service role can manage cache"
  ON stage1_cache FOR ALL
  USING (true);