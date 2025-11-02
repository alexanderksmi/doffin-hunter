-- Delete duplicate tenders, keeping only the most recent one for each doffin_id
DELETE FROM tenders
WHERE id IN (
  SELECT t1.id
  FROM tenders t1
  INNER JOIN tenders t2 ON t1.doffin_id = t2.doffin_id
  WHERE t1.created_at < t2.created_at
);

-- Add unique constraint on doffin_id to prevent future duplicates
ALTER TABLE tenders ADD CONSTRAINT tenders_doffin_id_key UNIQUE (doffin_id);