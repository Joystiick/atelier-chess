-- Wave C / Tablecast P2 schema extensions (safe to re-run)
ALTER TABLE games ADD COLUMN IF NOT EXISTS variant text NOT NULL DEFAULT 'standard';
ALTER TABLE games ADD COLUMN IF NOT EXISTS lan_mode boolean NOT NULL DEFAULT false;
ALTER TABLE salon_nights ADD COLUMN IF NOT EXISTS featured_game_code text;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS house_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS atelier_pass boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pass_cosmetics text NOT NULL DEFAULT '[]';
