-- Enable pgcrypto extension if not already enabled, for uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

-- Table for shot groups
CREATE TABLE shots (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name        TEXT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table for images within a shot group
CREATE TABLE shot_images (
  shot_id     UUID REFERENCES shots(id) ON DELETE CASCADE,
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  position    INTEGER, -- optional ordering
  PRIMARY KEY (shot_id, generation_id)
); 