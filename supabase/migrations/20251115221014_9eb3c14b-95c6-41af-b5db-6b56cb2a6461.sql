-- Phase 1: Wedding StylePack 이미지를 stylepack_ref_images로 마이그레이션
-- stylepacks.images 배열의 URL들을 stylepack_ref_images 테이블에 INSERT

INSERT INTO public.stylepack_ref_images (
  stylepack_id,
  key,
  url,
  mime,
  size_bytes,
  uploaded_by
)
SELECT 
  sp.id as stylepack_id,
  -- URL에서 key 추출 (예: org/default/stylepacks/.../ref/.../xxx.jpg)
  regexp_replace(img_url, '^.*/stylepack-ref/', '') as key,
  img_url as url,
  CASE 
    WHEN img_url LIKE '%.jpg' OR img_url LIKE '%.jpeg' THEN 'image/jpeg'
    WHEN img_url LIKE '%.png' THEN 'image/png'
    WHEN img_url LIKE '%.webp' THEN 'image/webp'
    ELSE 'image/jpeg'
  END as mime,
  100000 as size_bytes,
  (SELECT id FROM auth.users LIMIT 1) as uploaded_by
FROM public.stylepacks sp,
LATERAL unnest(sp.images) as img_url
WHERE sp.name = 'Wedding'
  AND NOT EXISTS (
    SELECT 1 FROM public.stylepack_ref_images sri 
    WHERE sri.stylepack_id = sp.id 
    AND sri.url = img_url
  );

-- ref_image_count 업데이트 (Wedding StylePack)
UPDATE public.stylepacks
SET ref_image_count = (
  SELECT COUNT(*) FROM public.stylepack_ref_images 
  WHERE stylepack_id = stylepacks.id
)
WHERE name = 'Wedding';

-- 모든 StylePack의 ref_image_count 동기화 (안전장치)
UPDATE public.stylepacks
SET ref_image_count = (
  SELECT COUNT(*) FROM public.stylepack_ref_images 
  WHERE stylepack_id = stylepacks.id
)
WHERE ref_image_count != (
  SELECT COUNT(*) FROM public.stylepack_ref_images 
  WHERE stylepack_id = stylepacks.id
);