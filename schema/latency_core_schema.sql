-- 1. Table: users
CREATE TABLE users (
    user_id UUID PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    bio_hardware JSONB,
    git_handle VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table: commits (Fitness Pillar)
CREATE TABLE commits (
    commit_id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(user_id),
    timestamp TIMESTAMP NOT NULL,
    branch VARCHAR NOT NULL,
    total_volume INTEGER,
    duration_ms BIGINT,
    heart_rate_avg INTEGER
);

-- 3. Table: grooves (Vinyl Pillar)
CREATE TABLE grooves (
    groove_id UUID PRIMARY KEY,
    commit_id UUID REFERENCES commits(commit_id) ON DELETE SET NULL,
    album_title VARCHAR NOT NULL,
    artist VARCHAR NOT NULL,
    bpm_range INT4RANGE,
    discogs_id INTEGER,
    tonality VARCHAR
);

-- 4. Table: frames (Photography Pillar)
CREATE TABLE frames (
    frame_id UUID PRIMARY KEY,
    commit_id UUID REFERENCES commits(commit_id),
    image_url TEXT NOT NULL,
    film_stock_emulation VARCHAR,
    exif_data JSONB
);

-- 5. Table: set_logs
CREATE TABLE set_logs (
    set_id UUID PRIMARY KEY,
    commit_id UUID REFERENCES commits(commit_id)
);

-- The Photography Table
CREATE TABLE media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_path TEXT NOT NULL,
    camera_model TEXT,
    iso INTEGER,
    shutter_speed TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- The Vinyl Table
CREATE TABLE vinyl_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discogs_id INTEGER UNIQUE,
    artist TEXT NOT NULL,
    album_title TEXT NOT NULL,
    matrix_number TEXT, -- The IT/OCR target
    market_value DECIMAL(10,2)
);

-- The Bridge: Linking a specific photo to a specific record
CREATE TABLE archive_links (
    id SERIAL PRIMARY KEY,
    vinyl_id UUID REFERENCES vinyl_records(id),
    asset_id UUID REFERENCES media_assets(id),
    is_cover_art BOOLEAN DEFAULT false
);