-- ============================================================
-- 031_ai_knowledge_security.sql — Transitional split for F-03
--
-- Goals:
-- 1. Convert user-facing RPCs to SECURITY INVOKER so RLS becomes the
--    real tenant boundary.
-- 2. Immediately block PUBLIC and anon direct execution.
-- 3. Keep authenticated on the user RPCs.
-- 4. Keep service_role temporarily on the user RPCs for backward
--    compatibility with the currently deployed application.
-- 5. Introduce separate server-only *_service RPCs for the new code.
-- ============================================================

-- ---- USER PATH (transitional compatibility) ------------------
CREATE OR REPLACE FUNCTION public.match_ai_knowledge_fts(
	p_account_id  uuid,
	p_query       text,
	p_match_count integer
)
RETURNS TABLE (id uuid, content text, rank real) AS $$
	SELECT c.id,
				 c.content,
				 ts_rank(c.fts, plainto_tsquery('simple', p_query)) AS rank
	FROM public.ai_knowledge_chunks AS c
	WHERE c.account_id = p_account_id
		AND c.fts @@ plainto_tsquery('simple', p_query)
	ORDER BY rank DESC
	LIMIT GREATEST(p_match_count, 0);
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public;

CREATE OR REPLACE FUNCTION public.match_ai_knowledge_semantic(
	p_account_id      uuid,
	p_query_embedding text,
	p_match_count     integer
)
RETURNS TABLE (id uuid, content text, distance real) AS $$
	SELECT c.id,
				 c.content,
				 (c.embedding <=> p_query_embedding::vector(1536)) AS distance
	FROM public.ai_knowledge_chunks AS c
	WHERE c.account_id = p_account_id
		AND c.embedding IS NOT NULL
	ORDER BY c.embedding <=> p_query_embedding::vector(1536)
	LIMIT GREATEST(p_match_count, 0);
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public;

REVOKE ALL ON FUNCTION public.match_ai_knowledge_fts(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_ai_knowledge_fts(uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_ai_knowledge_fts(uuid, text, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.match_ai_knowledge_semantic(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_ai_knowledge_semantic(uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_ai_knowledge_semantic(uuid, text, integer) TO authenticated, service_role;

-- ---- SERVICE PATH (new code target) --------------------------
CREATE OR REPLACE FUNCTION public.match_ai_knowledge_fts_service(
	p_account_id  uuid,
	p_query       text,
	p_match_count integer
)
RETURNS TABLE (id uuid, content text, rank real) AS $$
	SELECT c.id,
				 c.content,
				 ts_rank(c.fts, plainto_tsquery('simple', p_query)) AS rank
	FROM public.ai_knowledge_chunks AS c
	WHERE c.account_id = p_account_id
		AND c.fts @@ plainto_tsquery('simple', p_query)
	ORDER BY rank DESC
	LIMIT GREATEST(p_match_count, 0);
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public;

CREATE OR REPLACE FUNCTION public.match_ai_knowledge_semantic_service(
	p_account_id      uuid,
	p_query_embedding text,
	p_match_count     integer
)
RETURNS TABLE (id uuid, content text, distance real) AS $$
	SELECT c.id,
				 c.content,
				 (c.embedding <=> p_query_embedding::vector(1536)) AS distance
	FROM public.ai_knowledge_chunks AS c
	WHERE c.account_id = p_account_id
		AND c.embedding IS NOT NULL
	ORDER BY c.embedding <=> p_query_embedding::vector(1536)
	LIMIT GREATEST(p_match_count, 0);
$$ LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public;

REVOKE ALL ON FUNCTION public.match_ai_knowledge_fts_service(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_ai_knowledge_fts_service(uuid, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.match_ai_knowledge_fts_service(uuid, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.match_ai_knowledge_fts_service(uuid, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.match_ai_knowledge_semantic_service(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_ai_knowledge_semantic_service(uuid, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.match_ai_knowledge_semantic_service(uuid, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.match_ai_knowledge_semantic_service(uuid, text, integer) TO service_role;