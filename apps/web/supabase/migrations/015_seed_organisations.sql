-- 015: Seed default organisations
-- Rollback: DELETE FROM public.organisations WHERE university_type IN ('wbuhs', 'ssuhs');

INSERT INTO public.organisations (name, university_type, cls_config_json, logo_urls) VALUES
(
  'The West Bengal University of Health Sciences',
  'wbuhs',
  '{"cls_file": "sskm-thesis", "page_numbers": "bottom-centre", "references_heading": "REFERENCES", "head_title": "Director"}',
  '{"primary": "/images/wbuhs-logo.png"}'
),
(
  'Sri Siddhartha University of Health Sciences',
  'ssuhs',
  '{"cls_file": "ssuhs-thesis", "page_numbers": "bottom-right", "references_heading": "BIBLIOGRAPHY", "head_title": "Principal"}',
  '{"primary": "/images/ssuhs-logo.png"}'
);
