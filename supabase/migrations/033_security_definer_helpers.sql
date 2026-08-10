-- Harden helper RPCs to service-only execution.
-- No signature/body changes: ACL + execution context only.

ALTER FUNCTION public.record_webhook_failure(uuid, int) SECURITY INVOKER;
ALTER FUNCTION public.record_webhook_failure(uuid, int) SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.record_webhook_failure(uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_webhook_failure(uuid, int) FROM anon;
REVOKE ALL ON FUNCTION public.record_webhook_failure(uuid, int) FROM authenticated;
REVOKE ALL ON FUNCTION public.record_webhook_failure(uuid, int) FROM service_role;
GRANT EXECUTE ON FUNCTION public.record_webhook_failure(uuid, int) TO service_role;

ALTER FUNCTION public.claim_ai_reply_slot(uuid, integer) SECURITY INVOKER;
ALTER FUNCTION public.claim_ai_reply_slot(uuid, integer) SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.claim_ai_reply_slot(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_ai_reply_slot(uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.claim_ai_reply_slot(uuid, integer) FROM authenticated;
REVOKE ALL ON FUNCTION public.claim_ai_reply_slot(uuid, integer) FROM service_role;
GRANT EXECUTE ON FUNCTION public.claim_ai_reply_slot(uuid, integer) TO service_role;