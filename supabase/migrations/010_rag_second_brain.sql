-- 010_rag_second_brain.sql
-- Activare pgvector si creare tabela + functie RPC pentru RAG

-- 1. Extensia pgvector (de obicei deja activa in Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Tabela pentru chunk-uri de documente indexate semantic
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Legatura la resursa din user_resources (cascade delete automat)
    resource_id uuid        NOT NULL REFERENCES public.user_resources(id) ON DELETE CASCADE,
    user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Continutul textual al chunk-ului
    content     text        NOT NULL,
    -- Vectorul semantic produs de nvidia/nv-embedqa-e5-v5 (1024 dimensiuni)
    embedding   vector(1024),
    -- Metadate optionale: index chunk, pagina PDF, etc.
    metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. Index HNSW pentru cautari rapide de similaritate cosina
--    (suportat pe planul gratuit Supabase cu dim <= 2000)
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
    ON public.document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 4. Index conventional pentru filtrare rapida pe user_id si resource_id
CREATE INDEX IF NOT EXISTS document_chunks_user_id_idx    ON public.document_chunks (user_id);
CREATE INDEX IF NOT EXISTS document_chunks_resource_id_idx ON public.document_chunks (resource_id);

-- 5. RLS: utilizatorii vad si scriu doar propriile chunk-uri
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own chunks"
    ON public.document_chunks
    FOR ALL
    USING  (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 6. Functia RPC de cautare semantica (apelata din frontend cu supabase.rpc)
CREATE OR REPLACE FUNCTION public.match_document_chunks(
    query_embedding   vector(1024),
    match_threshold   float           DEFAULT 0.5,
    match_count       int             DEFAULT 5,
    filter_user_id    uuid            DEFAULT NULL,
    filter_resource_ids uuid[]        DEFAULT NULL
)
RETURNS TABLE (
    id          uuid,
    resource_id uuid,
    content     text,
    metadata    jsonb,
    similarity  float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.resource_id,
        dc.content,
        dc.metadata,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM public.document_chunks dc
    WHERE
        -- Filtru optional pe user
        (filter_user_id IS NULL OR dc.user_id = filter_user_id)
        -- Filtru optional pe documente specifice
        AND (filter_resource_ids IS NULL OR dc.resource_id = ANY(filter_resource_ids))
        -- Prag minim de relevanta
        AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    ORDER BY
        dc.embedding <=> query_embedding   -- crescator = cel mai similar primul
    LIMIT match_count;
END;
$$;
