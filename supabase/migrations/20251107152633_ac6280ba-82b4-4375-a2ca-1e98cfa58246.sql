-- Remove old admin email and add new ones
DELETE FROM public.allowed_admin_emails WHERE email = 'admin@bakesbymarie.com';

-- Add new admin emails
INSERT INTO public.allowed_admin_emails (email, is_active) VALUES
('vision@bakesbymarie.com', true),
('mariencarolyn2013@gmail.com', true);