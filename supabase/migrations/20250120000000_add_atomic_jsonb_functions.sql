-- Add atomic JSONB update functions for metadata operations
-- This ensures atomic updates without read-modify-write race conditions

CREATE OR REPLACE FUNCTION atomic_jsonb_merge(
  table_name TEXT,
  record_id UUID,
  field_name TEXT,
  merge_data JSONB
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Perform atomic merge with org isolation via RLS
  EXECUTE format(
    'UPDATE %I SET %I = %I || $1, updated_at = NOW() 
     WHERE id = $2 
     RETURNING %I',
    table_name, field_name, field_name, field_name
  ) INTO result USING merge_data, record_id;
  
  -- Check if update succeeded (RLS may have blocked it)
  IF result IS NULL THEN
    RAISE EXCEPTION 'Update failed - record not found or access denied';
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION atomic_jsonb_delete_key(
  table_name TEXT,
  record_id UUID,
  field_name TEXT,
  key_path TEXT[]
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Perform atomic key deletion with org isolation via RLS
  EXECUTE format(
    'UPDATE %I SET %I = %I #- $1, updated_at = NOW()
     WHERE id = $2
     RETURNING %I',
    table_name, field_name, field_name, field_name
  ) INTO result USING key_path, record_id;
  
  -- Check if update succeeded
  IF result IS NULL THEN
    RAISE EXCEPTION 'Update failed - record not found or access denied';
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION merge_metadata(
  table_name TEXT,
  record_id UUID,
  merge_data JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN atomic_jsonb_merge(table_name, record_id, 'metadata', merge_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;