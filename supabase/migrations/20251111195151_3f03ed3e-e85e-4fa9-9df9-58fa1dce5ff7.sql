-- Extend stylepacks table for NanoBanana integration
ALTER TABLE public.stylepacks
  ADD COLUMN IF NOT EXISTS reference_stats jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS generator_provider text DEFAULT 'nanobanana' 
    CHECK (generator_provider IN ('nanobanana', 'gemini'));

COMMENT ON COLUMN public.stylepacks.reference_stats IS 
  'Auto-analyzed reference image stats: palette, textures, safety flags';
COMMENT ON COLUMN public.stylepacks.generator_provider IS 
  'AI provider for generation: nanobanana or gemini';

-- Extend proposals table
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS generator_request jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS generator_response jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS seed integer DEFAULT NULL;

COMMENT ON COLUMN public.proposals.generator_request IS 
  'Exact parameters sent to NanoBanana API (prompt, images, cfg, etc)';
COMMENT ON COLUMN public.proposals.generator_response IS 
  'Raw response from NanoBanana (model info, latency, safety)';
COMMENT ON COLUMN public.proposals.seed IS 
  'Generation seed for reproducibility';

-- Add indexes for query performance
CREATE INDEX IF NOT EXISTS idx_stylepacks_generator_provider 
  ON public.stylepacks(generator_provider) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_proposals_seed 
  ON public.proposals(seed) WHERE seed IS NOT NULL;

-- Create stylepack-ref storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stylepack-ref',
  'stylepack-ref',
  true,
  20971520,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for stylepack-ref bucket
CREATE POLICY "Admin upload to stylepack-ref"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'stylepack-ref' 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admin delete from stylepack-ref"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'stylepack-ref'
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Public read from stylepack-ref"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'stylepack-ref');