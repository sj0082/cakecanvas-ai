-- Storage policies for stylepack-ref bucket
CREATE POLICY "Public read access for stylepack-ref"
ON storage.objects
FOR SELECT
USING (bucket_id = 'stylepack-ref');

CREATE POLICY "Admin can insert to stylepack-ref"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'stylepack-ref' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can update stylepack-ref"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'stylepack-ref' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admin can delete from stylepack-ref"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'stylepack-ref' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Create stylepack_ref_images table
CREATE TABLE IF NOT EXISTS public.stylepack_ref_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stylepack_id UUID NOT NULL REFERENCES public.stylepacks(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  url TEXT NOT NULL,
  mime TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on stylepack_ref_images
ALTER TABLE public.stylepack_ref_images ENABLE ROW LEVEL SECURITY;

-- RLS policies for stylepack_ref_images
CREATE POLICY "Admin can view all stylepack_ref_images"
ON public.stylepack_ref_images
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can insert stylepack_ref_images"
ON public.stylepack_ref_images
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND uploaded_by = auth.uid()
);

CREATE POLICY "Admin can delete stylepack_ref_images"
ON public.stylepack_ref_images
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));