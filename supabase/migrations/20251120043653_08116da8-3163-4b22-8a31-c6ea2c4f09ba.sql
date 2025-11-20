-- Fix search_path security issue for match_stylepacks function
DROP FUNCTION IF EXISTS match_stylepacks(vector, float, int);

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
SECURITY DEFINER
SET search_path = public
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