-- ============================================================
-- 032_ai_knowledge_remove_service_role_from_user_rpcs.sql
--
-- Finalize F-03 after the application is deployed and validated:
-- user RPCs stay available only to authenticated callers;
-- service_role remains only on the dedicated *_service RPCs.
-- ============================================================

REVOKE ALL ON FUNCTION public.match_ai_knowledge_fts(uuid, text, integer) FROM service_role;
REVOKE ALL ON FUNCTION public.match_ai_knowledge_semantic(uuid, text, integer) FROM service_role;

REVOKE ALL ON FUNCTION public.match_ai_knowledge_fts(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_ai_knowledge_fts(uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_ai_knowledge_fts(uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.match_ai_knowledge_semantic(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_ai_knowledge_semantic(uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_ai_knowledge_semantic(uuid, text, integer) TO authenticated;
