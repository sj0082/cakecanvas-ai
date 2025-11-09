-- Add parent_id column to create hierarchical structure
ALTER TABLE public.stylepacks 
ADD COLUMN parent_id uuid REFERENCES public.stylepacks(id) ON DELETE CASCADE;

-- Add is_category flag to distinguish between categories and actual style packs
ALTER TABLE public.stylepacks 
ADD COLUMN is_category boolean NOT NULL DEFAULT false;

-- Make certain fields optional for categories (they only need name and description)
ALTER TABLE public.stylepacks 
ALTER COLUMN images DROP NOT NULL,
ALTER COLUMN shape_template DROP NOT NULL,
ALTER COLUMN allowed_accents DROP NOT NULL,
ALTER COLUMN banned_terms DROP NOT NULL,
ALTER COLUMN palette_range DROP NOT NULL;

-- Set default values for optional fields
ALTER TABLE public.stylepacks 
ALTER COLUMN images SET DEFAULT '{}',
ALTER COLUMN allowed_accents SET DEFAULT '{}',
ALTER COLUMN banned_terms SET DEFAULT '{}',
ALTER COLUMN palette_range SET DEFAULT '{}';

-- Add index for better query performance
CREATE INDEX idx_stylepacks_parent_id ON public.stylepacks(parent_id);

-- Create function to validate max 2 levels
CREATE OR REPLACE FUNCTION public.validate_stylepack_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If this has a parent, check that the parent doesn't have a parent
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.stylepacks 
      WHERE id = NEW.parent_id AND parent_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Style packs can only have 2 levels (category and style pack)';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce hierarchy validation
CREATE TRIGGER enforce_stylepack_hierarchy
  BEFORE INSERT OR UPDATE ON public.stylepacks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_stylepack_hierarchy();