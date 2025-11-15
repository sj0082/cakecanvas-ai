-- Phase 1: Add unique constraint for UPSERT operations in stylepack-analyze
-- This fixes the "there is no unique or exclusion constraint" error

-- Add unique constraint on (stylepack_id, key) combination
ALTER TABLE public.stylepack_ref_images
ADD CONSTRAINT stylepack_ref_images_stylepack_id_key_unique 
UNIQUE (stylepack_id, key);

-- Add index for performance optimization
CREATE INDEX IF NOT EXISTS idx_stylepack_ref_images_stylepack_key 
ON public.stylepack_ref_images(stylepack_id, key);