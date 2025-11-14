-- Fix security warning: Function search_path mutable
-- Drop trigger, recreate function with proper search_path, then recreate trigger

DROP TRIGGER IF EXISTS trigger_update_ref_image_count ON public.stylepack_ref_images;

CREATE OR REPLACE FUNCTION update_stylepack_ref_image_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.stylepacks
    SET ref_image_count = (
      SELECT COUNT(*) 
      FROM public.stylepack_ref_images 
      WHERE stylepack_id = NEW.stylepack_id
    )
    WHERE id = NEW.stylepack_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.stylepacks
    SET ref_image_count = (
      SELECT COUNT(*) 
      FROM public.stylepack_ref_images 
      WHERE stylepack_id = OLD.stylepack_id
    )
    WHERE id = OLD.stylepack_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Recreate trigger
CREATE TRIGGER trigger_update_ref_image_count
AFTER INSERT OR DELETE ON public.stylepack_ref_images
FOR EACH ROW
EXECUTE FUNCTION update_stylepack_ref_image_count();