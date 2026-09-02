CREATE INDEX IF NOT EXISTS import_items_completed_checksum_idx
  ON import_items (checksum, batch_id, created_at, source_key, id)
  WHERE status = 'completed' AND checksum IS NOT NULL;
