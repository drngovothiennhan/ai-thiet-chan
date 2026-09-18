-- A.I Thiệt Chẩn — supervised training readiness v3
-- Accepts either legacy admin-approved clinical-note feedback or the new structured
-- verified-clinician contribution. Structured ROI labels do not need a free-text note.

create or replace view public.ai_thiet_chan_ml_training_ready_v3 as
select
  m.sample_id,
  m.case_hash,
  m.schema_version,
  m.split,
  m.input_manifest,
  m.feature_vector,
  m.model_observation,
  m.human_annotation,
  m.provenance,
  m.integrity_sha256,
  m.created_at,
  m.updated_at
from public.ai_thiet_chan_ml_samples m
where m.label_status='clinician_feedback_approved'
  and m.human_annotation is not null
  and jsonb_typeof(m.human_annotation)='object'
  and nullif(trim(coalesce(m.integrity_sha256,'')),'') is not null
  and (
    (
      m.human_annotation->>'source'='verified_clinical_contribution_v1'
      and jsonb_typeof(m.human_annotation->'structured_annotation')='object'
      and jsonb_typeof(m.human_annotation#>'{structured_annotation,tongue_present}')='boolean'
      and coalesce(m.human_annotation->>'verification_basis','')='app_professional_attestation_admin_approved'
    )
    or nullif(trim(coalesce(m.human_annotation->>'clinical_note','')),'') is not null
  );

revoke all on public.ai_thiet_chan_ml_training_ready_v3 from anon, authenticated;

create or replace function public.ai_thiet_chan_admin_ml_training_status_v3(p_admin_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare v_hash text;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex')<>v_hash then raise exception 'unauthorized'; end if;
  return jsonb_build_object(
    'ok',true,
    'schemaVersion','aitc-ml-jsonl-v3-training-ready',
    'policy','supervised exports contain only admin-approved human evidence; structured verified-clinician ROI labels are accepted without requiring a narrative note',
    'trainingReady',(select count(*) from public.ai_thiet_chan_ml_training_ready_v3),
    'verifiedClinicalContributions',(select count(*) from public.ai_thiet_chan_ml_training_ready_v3 where human_annotation->>'source'='verified_clinical_contribution_v1'),
    'legacyClinicalFeedback',(select count(*) from public.ai_thiet_chan_ml_training_ready_v3 where coalesce(human_annotation->>'source','')<>'verified_clinical_contribution_v1')
  );
end;
$function$;

revoke all on function public.ai_thiet_chan_admin_ml_training_status_v3(text) from public, anon, authenticated;
grant execute on function public.ai_thiet_chan_admin_ml_training_status_v3(text) to service_role;
