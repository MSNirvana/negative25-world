ALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_rating_check;
ALTER TABLE photos ADD CONSTRAINT photos_rating_check CHECK (rating IS NULL OR rating BETWEEN 0 AND 7);
