-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- StylePack table
CREATE TABLE IF NOT EXISTS public.stylepacks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  images TEXT[] NOT NULL DEFAULT '{}',
  palette_range JSONB NOT NULL DEFAULT '{}',
  shape_template TEXT NOT NULL,
  allowed_accents TEXT[] NOT NULL DEFAULT '{}',
  banned_terms TEXT[] NOT NULL DEFAULT '{}',
  lora_ref TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- SizeCategory table
CREATE TABLE IF NOT EXISTS public.size_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tiers_spec JSONB NOT NULL,
  serving_min INTEGER NOT NULL,
  serving_max INTEGER NOT NULL,
  base_price_min DECIMAL(10,2) NOT NULL,
  base_price_max DECIMAL(10,2) NOT NULL,
  lead_time_days INTEGER NOT NULL,
  delivery_radius_miles INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Request table
CREATE TABLE IF NOT EXISTS public.requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  size_category_id UUID NOT NULL REFERENCES public.size_categories(id),
  stylepack_id UUID NOT NULL REFERENCES public.stylepacks(id),
  user_text TEXT,
  parsed_slots JSONB,
  user_images TEXT[] DEFAULT '{}',
  contact_email TEXT,
  contact_phone TEXT,
  consent_marketing BOOLEAN DEFAULT false,
  consent_terms BOOLEAN DEFAULT true,
  payment_status TEXT NOT NULL DEFAULT 'PENDING',
  payment_provider TEXT,
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Proposal table
CREATE TABLE IF NOT EXISTS public.proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  variant TEXT NOT NULL CHECK (variant IN ('conservative', 'standard', 'bold')),
  image_url TEXT NOT NULL,
  spec_json JSONB NOT NULL,
  price_range_min DECIMAL(10,2) NOT NULL,
  price_range_max DECIMAL(10,2) NOT NULL,
  badges TEXT[] DEFAULT '{}',
  is_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RulesReality table
CREATE TABLE IF NOT EXISTS public.rules_reality (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  threshold_value TEXT,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- LogsAudit table
CREATE TABLE IF NOT EXISTS public.logs_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.rules_reality(id),
  action TEXT NOT NULL CHECK (action IN ('block', 'replace', 'warn')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Profiles table for admin users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stylepacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.size_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules_reality ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stylepacks (public read, admin write)
CREATE POLICY "Anyone can view active stylepacks"
  ON public.stylepacks FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage stylepacks"
  ON public.stylepacks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- RLS Policies for size_categories (public read, admin write)
CREATE POLICY "Anyone can view active size categories"
  ON public.size_categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage size categories"
  ON public.size_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- RLS Policies for requests (anyone can create, view own)
CREATE POLICY "Anyone can create requests"
  ON public.requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view their own requests"
  ON public.requests FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update their own requests"
  ON public.requests FOR UPDATE
  USING (true);

CREATE POLICY "Admins can view all requests"
  ON public.requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- RLS Policies for proposals (linked to requests)
CREATE POLICY "Anyone can view proposals"
  ON public.proposals FOR SELECT
  USING (true);

CREATE POLICY "System can create proposals"
  ON public.proposals FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update proposals"
  ON public.proposals FOR UPDATE
  USING (true);

-- RLS Policies for rules_reality (public read, admin write)
CREATE POLICY "Anyone can view active rules"
  ON public.rules_reality FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage rules"
  ON public.rules_reality FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- RLS Policies for logs_audit (admin only)
CREATE POLICY "Admins can view logs"
  ON public.logs_audit FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can create logs"
  ON public.logs_audit FOR INSERT
  WITH CHECK (true);

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_stylepacks_updated_at BEFORE UPDATE ON public.stylepacks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_size_categories_updated_at BEFORE UPDATE ON public.size_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data for size categories
INSERT INTO public.size_categories (code, name, tiers_spec, serving_min, serving_max, base_price_min, base_price_max, lead_time_days, delivery_radius_miles) VALUES
  ('S', 'Small (1 Tier)', '{"tiers": 1, "diameter": "6\"", "height": "4\""}', 8, 10, 85, 110, 3, 25),
  ('M', 'Medium (2 Tiers)', '{"tiers": 2, "diameter": "6\"+8\"", "height": "4\" each"}', 26, 30, 220, 280, 5, 25),
  ('L', 'Large (3 Tiers)', '{"tiers": 3, "diameter": "6\"+8\"+10\"", "height": "4\" each"}', 50, 60, 420, 520, 7, 25)
ON CONFLICT (code) DO NOTHING;

-- Insert sample stylepacks
INSERT INTO public.stylepacks (name, description, images, palette_range, shape_template, allowed_accents, banned_terms) VALUES
  (
    'Modern Minimalist',
    'Clean lines, simple elegance, monochromatic palettes',
    ARRAY['https://images.unsplash.com/photo-1558636508-e0db3814bd1d?w=800'],
    '{"hue": [0, 30], "saturation": [0, 20], "lightness": [85, 100]}',
    '2T',
    ARRAY['smooth frosting', 'geometric shapes', 'single flower'],
    ARRAY['character', 'logo', 'excessive decoration']
  ),
  (
    'Romantic Floral',
    'Soft pastels, delicate flowers, feminine touches',
    ARRAY['https://images.unsplash.com/photo-1535254973040-607b474cb50d?w=800'],
    '{"hue": [300, 360], "saturation": [30, 60], "lightness": [80, 95]}',
    '2T',
    ARRAY['roses', 'peonies', 'ruffles', 'pearls'],
    ARRAY['character', 'logo', 'dark colors']
  ),
  (
    'Vintage Elegance',
    'Classic designs, gold accents, traditional piping',
    ARRAY['https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800'],
    '{"hue": [30, 50], "saturation": [40, 70], "lightness": [90, 98]}',
    '3T',
    ARRAY['gold leaf', 'piped borders', 'sugar flowers'],
    ARRAY['character', 'logo', 'modern shapes']
  )
ON CONFLICT DO NOTHING;

-- Insert sample rules
INSERT INTO public.rules_reality (key, threshold_value, message, severity) VALUES
  ('support_required', '{"tiers": 2, "height": 5}', 'Support dowel required for stability', 'warning'),
  ('transport_risk', '{"distance": 25, "temp": 28}', 'Transport risk due to distance or temperature', 'warning'),
  ('decoration_density', '{"max_elements": 10}', 'Too many decoration elements may affect stability', 'info')
ON CONFLICT (key) DO NOTHING;