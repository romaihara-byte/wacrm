-- ============================================================
-- 034_normalize_uuid_defaults.sql
--
-- Rolling-forward normalization of UUID defaults for environments
-- that were created with legacy uuid defaults.
--
-- This migration only updates column default expressions and does
-- not modify data, types, constraints, policies, or triggers.
-- ============================================================

ALTER TABLE profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE contacts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE tags ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE contact_tags ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE custom_fields ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE contact_custom_values ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE contact_notes ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE conversations ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE messages ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE whatsapp_config ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE message_templates ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE pipelines ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE pipeline_stages ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE deals ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE broadcasts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE broadcast_recipients ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE automations ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE automation_steps ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE automation_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE automation_pending_executions ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE message_reactions ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE flows ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE flow_nodes ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE flow_runs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE flow_run_events ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE accounts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE account_invitations ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE notifications ALTER COLUMN id SET DEFAULT gen_random_uuid();
