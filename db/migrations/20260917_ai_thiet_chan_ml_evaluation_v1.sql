-- A.I Thiệt Chẩn — ML evaluation contract v1
-- Evaluation governance only: materialized dataset membership, locked test snapshots,
-- immutable candidate evaluation evidence, calibration/error metrics and baseline regression.
-- This migration does not train, auto-promote, activate, or replace any production model.

create table if not exists public.ai_thiet_chan_ml_dataset_members_v1 (
  dataset_version text not null references public.ai_thiet_chan_ml_dataset_versions(dataset_version) on delete restrict,
  sample_id uuid not null references public.ai_thiet_chan_ml_samples(sample_id) on delete restrict,
  split text not null check (split in ('train','validation','test')),
  integrity_sha256 text not null check (integrity_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key(dataset_version,sample_id)
);

alter table public.ai_thiet_chan_ml_dataset_members_v1 enable row level security;
revoke all on public.ai_thiet_chan_ml_dataset_members_v1 from anon, authenticated;
create index if not exists ai_thiet_chan_ml_dataset_members_split_v1
  on public.ai_thiet_chan_ml_dataset_members_v1(dataset_version,split,sample_id);

create or replace function public.ai_thiet_chan_ml_dataset_member_immutable_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
begin
  raise exception 'ml_dataset_member_is_immutable';
end;
$function$;

drop trigger if exists ai_thiet_chan_ml_dataset_members_immutable_v1 on public.ai_thiet_chan_ml_dataset_members_v1;
create trigger ai_thiet_chan_ml_dataset_members_immutable_v1
before update or delete on public.ai_thiet_chan_ml_dataset_members_v1
for each row execute function public.ai_thiet_chan_ml_dataset_member_immutable_v1();

-- Replace the v1 dataset registration implementation so new immutable dataset versions
-- also materialize exact member identities, integrity digests and locked splits.
create or replace function public.ai_thiet_chan_admin_register_ml_dataset_version_v1(p_admin_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_hash text;
  v_manifest text;
  v_manifest_sha text;
  v_version text;
  v_total integer;
  v_train integer;
  v_validation integer;
  v_test integer;
  v_existing_manifest text;
  v_member_count integer;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then
    raise exception 'unauthorized';
  end if;

  select
    count(*),
    count(*) filter (where split='train'),
    count(*) filter (where split='validation'),
    count(*) filter (where split='test'),
    coalesce(string_agg(sample_id::text || ':' || integrity_sha256 || ':' || split, E'\n' order by sample_id),'')
  into v_total,v_train,v_validation,v_test,v_manifest
  from public.ai_thiet_chan_ml_training_ready_v2;

  v_manifest_sha := encode(extensions.digest(convert_to(v_manifest,'UTF8'),'sha256'),'hex');
  v_version := 'dataset-' || substr(v_manifest_sha,1,16);

  select manifest_sha256 into v_existing_manifest
  from public.ai_thiet_chan_ml_dataset_versions
  where dataset_version=v_version;
  if v_existing_manifest is not null and v_existing_manifest <> v_manifest_sha then
    raise exception 'dataset_version_hash_collision';
  end if;

  insert into public.ai_thiet_chan_ml_dataset_versions(
    dataset_version,manifest_sha256,training_ready_count,train_count,validation_count,test_count,provenance,created_by
  ) values(
    v_version,v_manifest_sha,v_total,v_train,v_validation,v_test,
    jsonb_build_object(
      'source_view','ai_thiet_chan_ml_training_ready_v2',
      'split_policy','stable-content-hash',
      'label_policy','clinician_approved_only',
      'manifest_policy','ordered sample_id + integrity_sha256 + split',
      'membership_policy','materialized-immutable-v1'
    ),
    'admin'
  )
  on conflict (dataset_version) do nothing;

  insert into public.ai_thiet_chan_ml_dataset_members_v1(dataset_version,sample_id,split,integrity_sha256)
  select v_version,sample_id,split,integrity_sha256
  from public.ai_thiet_chan_ml_training_ready_v2
  on conflict (dataset_version,sample_id) do nothing;

  select count(*) into v_member_count
  from public.ai_thiet_chan_ml_dataset_members_v1
  where dataset_version=v_version;
  if v_member_count <> v_total then
    raise exception 'dataset_snapshot_membership_mismatch';
  end if;

  return jsonb_build_object(
    'ok',true,
    'datasetVersion',v_version,
    'manifestSha256',v_manifest_sha,
    'trainingReady',v_total,
    'train',v_train,
    'validation',v_validation,
    'test',v_test,
    'materializedMembers',v_member_count,
    'immutable',true
  );
end;
$function$;

create table if not exists public.ai_thiet_chan_ml_evaluations_v1 (
  evaluation_id bigint generated always as identity primary key,
  protocol_version text not null default 'aitc-ml-evaluation-v1',
  model_version text not null references public.ai_thiet_chan_ml_model_registry(model_version) on delete restrict,
  model_family text not null,
  dataset_version text not null references public.ai_thiet_chan_ml_dataset_versions(dataset_version) on delete restrict,
  test_manifest_sha256 text not null check (test_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  test_count integer not null check (test_count > 0),
  baseline_ref text not null,
  metric_results jsonb not null,
  calibration_results jsonb not null,
  baseline_metrics jsonb not null,
  regression_results jsonb not null,
  provenance jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.ai_thiet_chan_ml_evaluations_v1 enable row level security;
revoke all on public.ai_thiet_chan_ml_evaluations_v1 from anon, authenticated;
create index if not exists ai_thiet_chan_ml_evaluations_model_v1
  on public.ai_thiet_chan_ml_evaluations_v1(model_version,created_at desc);

create or replace function public.ai_thiet_chan_ml_evaluation_immutable_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
begin
  raise exception 'ml_evaluation_is_immutable';
end;
$function$;

drop trigger if exists ai_thiet_chan_ml_evaluations_immutable_v1 on public.ai_thiet_chan_ml_evaluations_v1;
create trigger ai_thiet_chan_ml_evaluations_immutable_v1
before update or delete on public.ai_thiet_chan_ml_evaluations_v1
for each row execute function public.ai_thiet_chan_ml_evaluation_immutable_v1();

create or replace function public.ai_thiet_chan_admin_export_ml_evaluation_test_v1(
  p_admin_token text,
  p_dataset_version text,
  p_include_images boolean default false
)
returns setof jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_hash text;
  v_expected integer;
  v_actual integer;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then
    raise exception 'unauthorized';
  end if;

  select test_count into v_expected
  from public.ai_thiet_chan_ml_dataset_versions
  where dataset_version=p_dataset_version;
  if v_expected is null then raise exception 'dataset_version_not_found'; end if;
  if v_expected <= 0 then raise exception 'locked_test_split_is_empty'; end if;

  select count(*) into v_actual
  from public.ai_thiet_chan_ml_dataset_members_v1
  where dataset_version=p_dataset_version and split='test';
  if v_actual <> v_expected then raise exception 'dataset_test_membership_not_materialized'; end if;

  if exists(
    select 1
    from public.ai_thiet_chan_ml_dataset_members_v1 d
    left join public.ai_thiet_chan_ml_training_ready_v2 m on m.sample_id=d.sample_id
    where d.dataset_version=p_dataset_version
      and d.split='test'
      and (m.sample_id is null or m.split <> 'test' or m.integrity_sha256 <> d.integrity_sha256)
  ) then
    raise exception 'dataset_snapshot_drift_detected';
  end if;

  return query
  select jsonb_build_object(
    'schema_version','aitc-ml-evaluation-test-v1',
    'dataset_version',d.dataset_version,
    'sample_id',m.sample_id,
    'case_hash',m.case_hash,
    'split','test',
    'inputs',m.input_manifest || case when p_include_images then jsonb_build_object(
      'raw_images',jsonb_build_object('top',c.image_data_url,'bottom',c.bottom_image_data_url)
    ) else '{}'::jsonb end,
    'features',m.feature_vector,
    'human_annotation',m.human_annotation,
    'provenance',m.provenance,
    'integrity',jsonb_build_object('algorithm','sha256','digest',d.integrity_sha256)
  )
  from public.ai_thiet_chan_ml_dataset_members_v1 d
  join public.ai_thiet_chan_ml_training_ready_v2 m on m.sample_id=d.sample_id and m.integrity_sha256=d.integrity_sha256
  join public.ai_thiet_chan_cases c on c.id=m.sample_id
  where d.dataset_version=p_dataset_version and d.split='test'
  order by d.sample_id;
end;
$function$;

create or replace function public.ai_thiet_chan_admin_record_ml_evaluation_v1(
  p_admin_token text,
  p_model_version text,
  p_baseline_ref text,
  p_metric_results jsonb,
  p_calibration_results jsonb,
  p_baseline_metrics jsonb,
  p_regression_results jsonb,
  p_provenance jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_hash text;
  v_model public.ai_thiet_chan_ml_model_registry%rowtype;
  v_dataset public.ai_thiet_chan_ml_dataset_versions%rowtype;
  v_test_manifest text;
  v_test_manifest_sha text;
  v_test_count integer;
  v_member_count integer;
  v_evaluation_id bigint;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then
    raise exception 'unauthorized';
  end if;

  select * into v_model from public.ai_thiet_chan_ml_model_registry where model_version=p_model_version;
  if not found then raise exception 'model_version_not_found'; end if;
  if v_model.status <> 'candidate' then raise exception 'only_candidate_can_be_evaluated'; end if;

  select * into v_dataset from public.ai_thiet_chan_ml_dataset_versions where dataset_version=v_model.dataset_version;
  if not found then raise exception 'dataset_version_not_found'; end if;
  if v_dataset.test_count <= 0 then raise exception 'locked_test_split_is_empty'; end if;

  select count(*) into v_member_count
  from public.ai_thiet_chan_ml_dataset_members_v1
  where dataset_version=v_dataset.dataset_version;
  if v_member_count <> v_dataset.training_ready_count then
    raise exception 'dataset_snapshot_membership_not_materialized';
  end if;

  select
    count(*),
    coalesce(string_agg(sample_id::text || ':' || integrity_sha256, E'\n' order by sample_id),'')
  into v_test_count,v_test_manifest
  from public.ai_thiet_chan_ml_dataset_members_v1
  where dataset_version=v_dataset.dataset_version and split='test';
  if v_test_count <> v_dataset.test_count then raise exception 'dataset_test_membership_not_materialized'; end if;

  if exists(
    select 1
    from public.ai_thiet_chan_ml_dataset_members_v1 d
    left join public.ai_thiet_chan_ml_training_ready_v2 m on m.sample_id=d.sample_id
    where d.dataset_version=v_dataset.dataset_version
      and d.split='test'
      and (m.sample_id is null or m.split <> 'test' or m.integrity_sha256 <> d.integrity_sha256)
  ) then
    raise exception 'dataset_snapshot_drift_detected';
  end if;

  if nullif(trim(coalesce(p_baseline_ref,'')),'') is null then raise exception 'baseline_ref_required'; end if;
  if jsonb_typeof(coalesce(p_metric_results,'null'::jsonb)) <> 'object' or p_metric_results='{}'::jsonb then raise exception 'metric_results_required'; end if;
  if jsonb_typeof(coalesce(p_calibration_results,'null'::jsonb)) <> 'object' or p_calibration_results='{}'::jsonb then raise exception 'calibration_results_required'; end if;
  if jsonb_typeof(coalesce(p_baseline_metrics,'null'::jsonb)) <> 'object' or p_baseline_metrics='{}'::jsonb then raise exception 'baseline_metrics_required'; end if;
  if jsonb_typeof(coalesce(p_regression_results,'null'::jsonb)) <> 'object' or p_regression_results='{}'::jsonb then raise exception 'regression_results_required'; end if;
  if jsonb_typeof(coalesce(p_provenance,'null'::jsonb)) <> 'object' or p_provenance='{}'::jsonb then raise exception 'evaluation_provenance_required'; end if;
  if not (p_metric_results ? 'errorMetrics') or jsonb_typeof(p_metric_results->'errorMetrics') <> 'object' then raise exception 'error_metrics_required'; end if;
  if not (p_metric_results ? 'taskMetrics') or jsonb_typeof(p_metric_results->'taskMetrics') <> 'object' then raise exception 'task_metrics_required'; end if;
  if not (p_calibration_results ? 'method') or not (p_calibration_results ? 'calibrationMetrics') or jsonb_typeof(p_calibration_results->'calibrationMetrics') <> 'object' then raise exception 'calibration_contract_invalid'; end if;
  if not (p_regression_results ? 'comparison') or jsonb_typeof(p_regression_results->'comparison') <> 'object' then raise exception 'regression_comparison_required'; end if;

  v_test_manifest_sha := encode(extensions.digest(convert_to(v_test_manifest,'UTF8'),'sha256'),'hex');

  insert into public.ai_thiet_chan_ml_evaluations_v1(
    model_version,model_family,dataset_version,test_manifest_sha256,test_count,baseline_ref,
    metric_results,calibration_results,baseline_metrics,regression_results,provenance
  ) values(
    v_model.model_version,v_model.model_family,v_dataset.dataset_version,v_test_manifest_sha,v_test_count,trim(p_baseline_ref),
    p_metric_results,p_calibration_results,p_baseline_metrics,p_regression_results,
    p_provenance || jsonb_build_object(
      'evaluation_policy','locked-test-split-only',
      'comparison_scope','candidate-and-baseline-on-same-locked-test-snapshot',
      'promotion_policy','evidence-only-manual-review-required',
      'runtime_activation','none'
    )
  ) returning evaluation_id into v_evaluation_id;

  return jsonb_build_object(
    'ok',true,
    'evaluationId',v_evaluation_id,
    'protocolVersion','aitc-ml-evaluation-v1',
    'modelVersion',v_model.model_version,
    'datasetVersion',v_dataset.dataset_version,
    'testManifestSha256',v_test_manifest_sha,
    'testCount',v_test_count,
    'baselineRef',trim(p_baseline_ref),
    'promotionDecision','none',
    'manualReviewRequired',true,
    'runtimeActivation','none'
  );
end;
$function$;

create or replace function public.ai_thiet_chan_admin_ml_evaluation_status_v1(p_admin_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare v_hash text;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then
    raise exception 'unauthorized';
  end if;
  return jsonb_build_object(
    'ok',true,
    'protocolVersion','aitc-ml-evaluation-v1',
    'policy','locked-test-split + measured evidence + manual review only',
    'datasetMembershipSnapshots',(select count(distinct dataset_version) from public.ai_thiet_chan_ml_dataset_members_v1),
    'evaluations',(select count(*) from public.ai_thiet_chan_ml_evaluations_v1),
    'runtimeActivation','none',
    'autoPromotion',false
  );
end;
$function$;

revoke all on function public.ai_thiet_chan_admin_export_ml_evaluation_test_v1(text,text,boolean) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_record_ml_evaluation_v1(text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_ml_evaluation_status_v1(text) from public, anon, authenticated;

grant execute on function public.ai_thiet_chan_admin_export_ml_evaluation_test_v1(text,text,boolean) to service_role;
grant execute on function public.ai_thiet_chan_admin_record_ml_evaluation_v1(text,text,text,jsonb,jsonb,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.ai_thiet_chan_admin_ml_evaluation_status_v1(text) to service_role;
