CREATE TABLE IF NOT EXISTS user_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    username VARCHAR(100), -- User's Orbix username or email identifier
    portal VARCHAR(50) NOT NULL, -- e.g., 'interviewbit', 'leetcode', 'codeforces'
    portal_username VARCHAR(100) NOT NULL, -- Extracted platform username (e.g. '_211_938', 'vineet-chandel')
    link TEXT NOT NULL, -- Full canonical profile URL (e.g. 'https://www.interviewbit.com/profile/_211_938/')
    raw_input TEXT, -- The raw link or handle entered by the user
    verified BOOLEAN DEFAULT true,
    display_name VARCHAR(150),
    avatar_url TEXT,
    stats JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_portal UNIQUE (username, portal)
);

CREATE INDEX IF NOT EXISTS idx_user_links_username ON user_links(username);
CREATE INDEX IF NOT EXISTS idx_user_links_portal ON user_links(portal);
