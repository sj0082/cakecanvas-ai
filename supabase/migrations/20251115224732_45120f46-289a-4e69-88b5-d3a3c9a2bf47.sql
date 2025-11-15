-- Fix uploaded_by to allow NULL for service role operations
ALTER TABLE public.stylepack_ref_images 
ALTER COLUMN uploaded_by DROP NOT NULL;