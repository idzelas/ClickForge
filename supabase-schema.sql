-- ClickForge Database Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ============================================================================
-- TABLES
-- ============================================================================

-- Projects table (fidget toy projects)
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  svg_data TEXT NOT NULL,
  extrude_depth REAL NOT NULL DEFAULT 4,
  keycap_size REAL NOT NULL DEFAULT 14,
  peg_radius REAL NOT NULL DEFAULT 3.5,
  settings JSONB,
  export_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SVG Designs table (saved SVG library)
CREATE TABLE IF NOT EXISTS svg_designs (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  svg_data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User Preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  sidebar_mode TEXT NOT NULL DEFAULT 'simple',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_svg_designs_user_id ON svg_designs(user_id);
CREATE INDEX IF NOT EXISTS idx_svg_designs_updated_at ON svg_designs(updated_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE svg_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Projects: users can only access their own projects
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can create own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid()::text = user_id);

-- SVG Designs: users can only access their own designs
CREATE POLICY "Users can view own designs"
  ON svg_designs FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can create own designs"
  ON svg_designs FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own designs"
  ON svg_designs FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own designs"
  ON svg_designs FOR DELETE
  USING (auth.uid()::text = user_id);

-- User Preferences: users can only access their own preferences
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can create own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
