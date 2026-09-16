-- A.I Thiệt Chẩn — ML training readiness v2
-- Goal: never treat model-generated observations as supervised ground truth.

create index if not exists ai_thiet_chan_feedback_case_id_idx
  on public.ai_thiet_chan_feedback(case_id)
  where case_id is not null;

create index if not exists ai_thiet_chan_learned_knowledge_case_id_idx
  on public.ai_thiet_chan_learned_knowledge(case_id)
  where case_id is not null;

create or replace view public.ai_thiet_chan_ml_training_ready_v2 as
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
  and nullif(trim(coalesce(m.human_annotation->>'clinical_note','')),'') is not null
  and nullif(trim(coalesce(m.integrity_sha256,'')),'') is not null;

revoke all on public.ai_thiet_chan_ml_training_ready_v2 from anon, authenticated;

create or replace function public.ai_thiet_chan_admin_ml_training_status_v2(p_admin_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_hash text;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then
    raise exception 'unauthorized';
  end if;

  return jsonb_build_object(
    'ok',true,
    'schemaVersion','aitc-ml-jsonl-v2-training-ready',
    'policy','supervised training/evaluation exports contain clinician-approved human annotations only',
    'totalSamples',(select count(*) from public.ai_thiet_chan_ml_samples),
    'modelGeneratedUnverified',(select count(*) from public.ai_thiet_chan_ml_samples where label_status='model_generated_unverified'),
    'clinicianReviewed',(select count(*) from public.ai_thiet_chan_ml_samples where label_status='clinician_feedback_approved'),
    'trainingReady',(select count(*) from public.ai_thiet_chan_ml_training_ready_v2),
    'trainingReadyTrain',(select count(*) from public.ai_thiet_chan_ml_training_ready_v2 where split='train'),
    'trainingReadyValidation',(select count(*) from public.ai_thiet_chan_ml_training_ready_v2 where split='validation'),
    'trainingReadyTest',(select count(*) from public.ai_thiet_chan_ml_training_ready_v2 where split='test')
  );
end;
$function$;

create or replace function public.ai_thiet_chan_admin_export_ml_training_jsonl_v2(
  p_admin_token text,
  p_limit integer default 1000,
  p_split text default null,
  p_include_images boolean default false
)
returns setof jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_hash text;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then
    raise exception 'unauthorized';
  end if;
  if p_split is not null and p_split not in ('train','validation','test') then
    raise exception 'invalid split';
  end if;

  return query
  select jsonb_build_object(
    'schema_version','aitc-ml-jsonl-v2-training-ready',
    'sample_id',m.sample_id,
    'case_hash',m.case_hash,
    'split',m.split,
    'inputs',m.input_manifest || case when p_include_images then jsonb_build_object(
      'raw_images',jsonb_build_object('top',c.image_data_url,'bottom',c.bottom_image_data_url)
    ) else '{}'::jsonb end,
    'features',m.feature_vector,
    'annotations',jsonb_build_object(
      'status','clinician_feedback_approved',
      'human_annotation',m.human_annotation,
      'model_observation_reference',jsonb_build_object('present',m.model_observation is not null)
    ),
    'provenance',m.provenance || jsonb_build_object('training_export_policy','clinician_approved_only'),
    'integrity',jsonb_build_object('algorithm','sha256','digest',m.integrity_sha256)
  )
  from public.ai_thiet_chan_ml_training_ready_v2 m
  join public.ai_thiet_chan_cases c on c.id=m.sample_id
  where p_split is null or m.split=p_split
  order by m.created_at,m.sample_id
  limit least(5000,greatest(1,coalesce(p_limit,1000)));
end;
$function$;

revoke all on function public.ai_thiet_chan_admin_ml_training_status_v2(text) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_export_ml_training_jsonl_v2(text,integer,text,boolean) from public, anon, authenticated;
