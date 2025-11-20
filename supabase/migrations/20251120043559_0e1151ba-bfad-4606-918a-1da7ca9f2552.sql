-- Create trend sources table
CREATE TABLE trend_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('instagram', 'pinterest', 'website', 'manual')),
  account_handle TEXT,
  follower_count BIGINT,
  credibility_score NUMERIC DEFAULT 0.8,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- Create trend images table
CREATE TABLE trend_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES trend_sources(id),
  image_path TEXT NOT NULL,
  original_url TEXT,
  caption TEXT,
  posted_at TIMESTAMPTZ,
  engagement_score NUMERIC,
  embedding vector(512),
  palette JSONB,
  texture_tags TEXT[],
  density TEXT,
  category_suggestions JSONB,
  is_approved BOOLEAN DEFAULT false,
  approved_for_stylepack_id UUID REFERENCES stylepacks(id),
  copyright_status TEXT DEFAULT 'inspiration_only',
  attribution_required BOOLEAN DEFAULT false,
  attribution_text TEXT,
  copyright_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create trend image stylepack mappings table
CREATE TABLE trend_image_stylepack_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_image_id UUID REFERENCES trend_images(id) ON DELETE CASCADE,
  stylepack_id UUID REFERENCES stylepacks(id) ON DELETE CASCADE,
  weight NUMERIC DEFAULT 0.3 CHECK (weight >= 0 AND weight <= 1),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(trend_image_id, stylepack_id)
);

-- Create indexes
CREATE INDEX idx_trend_images_stylepack ON trend_images(approved_for_stylepack_id);
CREATE INDEX idx_trend_images_approved ON trend_images(is_approved);
CREATE INDEX idx_trend_images_embedding ON trend_images USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_trend_mappings_stylepack ON trend_image_stylepack_mappings(stylepack_id);
CREATE INDEX idx_trend_sources_active ON trend_sources(is_active);

-- Create trigger for updated_at
CREATE TRIGGER update_trend_images_updated_at
  BEFORE UPDATE ON trend_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE trend_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE trend_image_stylepack_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trend_sources
CREATE POLICY "Admin full access on trend_sources" 
  ON trend_sources FOR ALL 
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for trend_images
CREATE POLICY "Admin full access on trend_images" 
  ON trend_images FOR ALL 
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read approved trend_images" 
  ON trend_images FOR SELECT 
  USING (is_approved = true);

-- RLS Policies for trend_image_stylepack_mappings
CREATE POLICY "Admin full access on trend_mappings" 
  ON trend_image_stylepack_mappings FOR ALL 
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read active trend_mappings" 
  ON trend_image_stylepack_mappings FOR SELECT 
  USING (is_active = true);

-- Create pgvector function for stylepack matching
CREATE OR REPLACE FUNCTION match_stylepacks(
  query_embedding vector(512),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  name text,
  similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    (1 - (avg_emb.avg_embedding <=> query_embedding))::float as similarity
  FROM stylepacks s
  CROSS JOIN LATERAL (
    SELECT AVG(embedding)::vector(512) as avg_embedding
    FROM stylepack_ref_images
    WHERE stylepack_id = s.id
    AND embedding IS NOT NULL
  ) avg_emb
  WHERE avg_emb.avg_embedding IS NOT NULL
  AND (1 - (avg_emb.avg_embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;