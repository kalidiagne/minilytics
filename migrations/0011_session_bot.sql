-- Why a session looks like a bot, decided when it arrives. NULL: looks human.
--   'burst':      one of 3+ blank sessions (1 pageview, 0 s, no referrer, no UTM, no goal) on the site within a minute.
--                 Hidden only while it stays blank, so a flagged visit that goes on to read or click counts again.
--   'datacenter': sent from a cloud or hosting network (see src/worker/lib/networks.ts). Hidden unless it completes a goal.
ALTER TABLE sessions ADD COLUMN bot TEXT;

-- Flag bursts in data recorded before this column existed, with the same rule ingest uses:
-- a blank session is a burst when some 60-second span that contains it holds 3+ blank sessions.
UPDATE sessions SET bot = 'burst'
WHERE pageviews = 1 AND duration = 0 AND referrer IS NULL AND utm_source IS NULL AND goals = 0
  AND EXISTS (
    SELECT 1 FROM sessions e
    WHERE e.site_id = sessions.site_id AND e.started_at BETWEEN sessions.started_at AND sessions.started_at + 60000
      AND e.pageviews = 1 AND e.duration = 0 AND e.referrer IS NULL AND e.utm_source IS NULL AND e.goals = 0
      AND (SELECT COUNT(*) FROM sessions bb
           WHERE bb.site_id = e.site_id AND bb.started_at BETWEEN e.started_at - 60000 AND e.started_at
             AND bb.pageviews = 1 AND bb.duration = 0 AND bb.referrer IS NULL AND bb.utm_source IS NULL AND bb.goals = 0) >= 3
  );
