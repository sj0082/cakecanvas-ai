-- Create storage bucket for user cake images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cake-inspiration',
  'cake-inspiration',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);

-- RLS policies for cake-inspiration bucket
CREATE POLICY "Anyone can upload cake images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'cake-inspiration');

CREATE POLICY "Anyone can view cake images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'cake-inspiration');

CREATE POLICY "Anyone can update their uploaded images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'cake-inspiration');

CREATE POLICY "Anyone can delete cake images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'cake-inspiration');