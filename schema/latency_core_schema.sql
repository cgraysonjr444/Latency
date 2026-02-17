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