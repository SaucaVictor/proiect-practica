-- 011_autotranscribe_rag.sql
-- 1. Drop NOT NULL constraint on resource_id in document_chunks table.
-- This allows indexing automatic transcripts without polluting the user's personal documents tree.
ALTER TABLE public.document_chunks ALTER COLUMN resource_id DROP NOT NULL;

-- Drop function if it already exists to allow changing return type from UUID to VOID
DROP FUNCTION IF EXISTS public.register_and_index_transcript(text, text, text, text, integer, text[], jsonb);

-- 2. Create SECURITY DEFINER RPC to allow the audio server (acting as anonymous role)
-- to index transcripts directly in document_chunks bypassing RLS.
CREATE OR REPLACE FUNCTION public.register_and_index_transcript(
    p_subject_name TEXT,
    p_session_date TEXT,
    p_file_name TEXT,
    p_file_path TEXT,
    p_file_size INT,
    p_chunks TEXT[],
    p_embeddings JSONB -- JSON array of vector(1024) float arrays
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    i INT;
    v_chunk TEXT;
    v_emb_json JSONB;
    v_emb_vector VECTOR(1024);
BEGIN
    -- Resolve a default user to assign the chunks to.
    SELECT id INTO v_user_id FROM public.profiles LIMIT 1;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No user profiles found in the system';
    END IF;

    -- Clear out any previous chunks indexed for this specific file path to avoid duplicates
    DELETE FROM public.document_chunks
    WHERE user_id = v_user_id
      AND metadata->>'file_path' = p_file_path;

    -- Insert chunks and embeddings
    IF p_chunks IS NOT NULL AND array_length(p_chunks, 1) > 0 THEN
        FOR i IN 1..array_length(p_chunks, 1) LOOP
            v_chunk := p_chunks[i];
            -- Extract the matching index array from the JSON list of embeddings
            v_emb_json := p_embeddings -> (i - 1);
            
            IF v_emb_json IS NOT NULL AND jsonb_typeof(v_emb_json) = 'array' THEN
                v_emb_vector := v_emb_json::text::vector;
            ELSE
                v_emb_vector := NULL;
            END IF;

            INSERT INTO public.document_chunks (
                resource_id, -- NULL for autotranscripts (keeps them out of the user resources tree)
                user_id,
                content,
                embedding,
                metadata
            ) VALUES (
                NULL,
                v_user_id,
                v_chunk,
                v_emb_vector,
                jsonb_build_object(
                    'chunk_index', i - 1, 
                    'total_chunks', array_length(p_chunks, 1),
                    'subject_name', p_subject_name,
                    'session_date', p_session_date,
                    'file_name', p_file_name,
                    'file_path', p_file_path
                )
            );
        END LOOP;
    END IF;
END;
$$;

-- 3. Create SECURITY DEFINER RPC to allow the audio server (acting as anonymous role)
-- to resolve the active schedule slot bypassing RLS.
CREATE OR REPLACE FUNCTION public.resolve_schedule_slot(
    p_day_of_week INT,
    p_time TIME
)
RETURNS TABLE (
    id UUID,
    subject_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.subject_name
    FROM public.schedule s
    WHERE s.day_of_week = p_day_of_week
      AND s.start_time <= p_time
      AND s.end_time >= p_time
    LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.debug_get_db_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profiles JSONB;
    v_chunks JSONB;
BEGIN
    SELECT jsonb_agg(jsonb_build_object('id', id, 'display_name', display_name)) INTO v_profiles FROM public.profiles;
    SELECT jsonb_agg(jsonb_build_object('id', id, 'user_id', user_id, 'content', substring(content from 1 for 40))) INTO v_chunks FROM public.document_chunks WHERE content LIKE '%sinumim%';
    RETURN jsonb_build_object('profiles', v_profiles, 'chunks', v_chunks);
END;
$$;
