CREATE TABLE IF NOT EXISTS album_photos (
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (album_id, photo_id)
);
CREATE INDEX IF NOT EXISTS album_photos_photo_id_idx ON album_photos (photo_id);
