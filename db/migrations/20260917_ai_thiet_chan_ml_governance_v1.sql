-- A.I Thiệt Chẩn — ML governance v1
-- Governance only: dataset snapshots, model registry, manual champion promotion and rollback.
-- This migration does not train models and does not connect registry state to production inference.

create table if not exists public.ai_thiet_chan_ml_dataset_versions (
  dataset_version text primary key,
  schema_version text not null default 'aitc-ml-dataset-governance-v1',
  manifest_sha256 text not null unique check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  training_ready_count integer not null check (training_ready_count >= 0),
  train_count integer not null check (train_count >= 0),
  validation_count integer not null check (validation_count >= 0),
  test_count integer not null check (test_count >= 0),
  source_schema text not null default 'aitc-ml-jsonl-v2-training-ready',
  provenance jsonb not null default '{}'::jsonb,
  locked boolean not null default true check (locked = true),
  created_at timestamptz not null default now(),
  created_by text not null default 'admin'
);

alter table public.ai_thiet_chan_ml_dataset_versions enable row level security;
revoke all on public.ai_thiet_chan_ml_dataset_versions from anon, authenticated;

create or replace function public.ai_thiet_chan_ml_dataset_version_immutable_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
begin
  raise exception 'ml_dataset_version_is_immutable';
end;
$function$;

drop trigger if exists ai_thiet_chan_ml_dataset_versions_immutable_v1 on public.ai_thiet_chan_ml_dataset_versions;
create trigger ai_thiet_chan_ml_dataset_versions_immutable_v1
before update or delete on public.ai_thiet_chan_ml_dataset_versions
for each row execute function public.ai_thiet_chan_ml_dataset_version_immutable_v1();

create table if not exists public.ai_thiet_chan_ml_model_registry (
  model_version text primary key,
  model_family text not null,
  dataset_version text not null references public.ai_thiet_chan_ml_dataset_versions(dataset_version) on delete restrict,
  artifact_uri text not null,
  artifact_sha256 text not null check (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  metrics jsonb not null default '{}'::jsonb,
  status text not null default 'candidate' check (status in ('candidate','champion','retired')),
  created_at timestamptz not null default now(),
  promoted_at timestamptz,
  retired_at timestamptz
);

alter table public.ai_thiet_chan_ml_model_registry enable row level security;
revoke all on public.ai_thiet_chan_ml_model_registry from anon, authenticated;

create unique index if not exists ai_thiet_chan_ml_one_champion_per_family_v1
  on public.ai_thiet_chan_ml_model_registry(model_family)
  where status='champion';

create table if not exists public.ai_thiet_chan_ml_model_events (
  event_id bigint generated always as identity primary key,
  model_family text not null,
  event_type text not null check (event_type in ('promote','rollback')),
  from_model_version text,
  to_model_version text not null,
  dataset_version text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.ai_thiet_chan_ml_model_events enable row level security;
revoke all on public.ai_thiet_chan_ml_model_events from anon, authenticated;

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

  insert into public.ai_thiet_chan_ml_dataset_versions(
    dataset_version,manifest_sha256,training_ready_count,train_count,validation_count,test_count,provenance,created_by
  ) values(
    v_version,v_manifest_sha,v_total,v_train,v_validation,v_test,
    jsonb_build_object(
      'source_view','ai_thiet_chan_ml_training_ready_v2',
      'split_policy','stable-content-hash',
      'label_policy','clinician_approved_only',
      'manifest_policy','ordered sample_id + integrity_sha256 + split'
    ),
    'admin'
  )
  on conflict (dataset_version) do nothing;

  return jsonb_build_object(
    'ok',true,
    'datasetVersion',v_version,
    'manifestSha256',v_manifest_sha,
    'trainingReady',v_total,
    'train',v_train,
    'validation',v_validation,
    'test',v_test,
    'immutable',true
  );
end;
$function$;

create or replace function public.ai_thiet_chan_admin_register_ml_model_candidate_v1(
  p_admin_token text,
  p_model_version text,
  p_model_family text,
  p_dataset_version text,
  p_artifact_uri text,
  p_artifact_sha256 text,
  p_metrics jsonb default '{}'::jsonb
)
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
  if nullif(trim(coalesce(p_model_version,'')),'') is null or nullif(trim(coalesce(p_model_family,'')),'') is null then
    raise exception 'model_identity_required';
  end if;
  if nullif(trim(coalesce(p_artifact_uri,'')),'') is null then raise exception 'artifact_uri_required'; end if;
  if coalesce(p_artifact_sha256,'') !~ '^[0-9a-f]{64}$' then raise exception 'artifact_sha256_invalid'; end if;
  if not exists(select 1 from public.ai_thiet_chan_ml_dataset_versions where dataset_version=p_dataset_version) then
    raise exception 'dataset_version_not_found';
  end if;

  insert into public.ai_thiet_chan_ml_model_registry(
    model_version,model_family,dataset_version,artifact_uri,artifact_sha256,metrics,status
  ) values(
    trim(p_model_version),trim(p_model_family),p_dataset_version,trim(p_artifact_uri),p_artifact_sha256,coalesce(p_metrics,'{}'::jsonb),'candidate'
  );

  return jsonb_build_object('ok',true,'modelVersion',trim(p_model_version),'status','candidate','promotionPolicy','manual-admin-only');
end;
$function$;

create or replace function public.ai_thiet_chan_admin_promote_ml_champion_v1(
  p_admin_token text,
  p_model_version text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_hash text;
  v_target public.ai_thiet_chan_ml_model_registry%rowtype;
  v_previous text;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then
    raise exception 'unauthorized';
  end if;

  lock table public.ai_thiet_chan_ml_model_registry in row exclusive mode;
  select * into v_target from public.ai_thiet_chan_ml_model_registry where model_version=p_model_version;
  if not found then raise exception 'model_version_not_found'; end if;
  if v_target.status <> 'candidate' then raise exception 'only_candidate_can_be_promoted'; end if;

  select model_version into v_previous
  from public.ai_thiet_chan_ml_model_registry
  where model_family=v_target.model_family and status='champion'
  limit 1;

  update public.ai_thiet_chan_ml_model_registry
  set status='retired',retired_at=now()
  where model_family=v_target.model_family and status='champion';

  update public.ai_thiet_chan_ml_model_registry
  set status='champion',promoted_at=now(),retired_at=null
  where model_version=v_target.model_version;

  insert into public.ai_thiet_chan_ml_model_events(model_family,event_type,from_model_version,to_model_version,dataset_version,note)
  values(v_target.model_family,'promote',v_previous,v_target.model_version,v_target.dataset_version,p_note);

  return jsonb_build_object('ok',true,'modelVersion',v_target.model_version,'status','champion','previousChampion',v_previous,'promotionPolicy','manual-admin-only');
end;
$function$;

create or replace function public.ai_thiet_chan_admin_rollback_ml_champion_v1(
  p_admin_token text,
  p_target_model_version text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_hash text;
  v_target public.ai_thiet_chan_ml_model_registry%rowtype;
  v_current text;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then
    raise exception 'unauthorized';
  end if;

  lock table public.ai_thiet_chan_ml_model_registry in row exclusive mode;
  select * into v_target from public.ai_thiet_chan_ml_model_registry where model_version=p_target_model_version;
  if not found then raise exception 'model_version_not_found'; end if;
  if v_target.status <> 'retired' then raise exception 'rollback_target_must_be_retired'; end if;
  if not exists(
    select 1 from public.ai_thiet_chan_ml_model_events
    where model_family=v_target.model_family and to_model_version=v_target.model_version and event_type='promote'
  ) then raise exception 'rollback_target_was_never_champion'; end if;

  select model_version into v_current
  from public.ai_thiet_chan_ml_model_registry
  where model_family=v_target.model_family and status='champion'
  limit 1;
  if v_current is null then raise exception 'current_champion_not_found'; end if;

  update public.ai_thiet_chan_ml_model_registry
  set status='retired',retired_at=now()
  where model_version=v_current;

  update public.ai_thiet_chan_ml_model_registry
  set status='champion',promoted_at=now(),retired_at=null
  where model_version=v_target.model_version;

  insert into public.ai_thiet_chan_ml_model_events(model_family,event_type,from_model_version,to_model_version,dataset_version,note)
  values(v_target.model_family,'rollback',v_current,v_target.model_version,v_target.dataset_version,p_note);

  return jsonb_build_object('ok',true,'modelVersion',v_target.model_version,'status','champion','rolledBackFrom',v_current,'promotionPolicy','manual-admin-only');
end;
$function$;

create or replace function public.ai_thiet_chan_admin_ml_governance_status_v1(p_admin_token text)
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
    'governanceVersion','aitc-ml-governance-v1',
    'promotionPolicy','manual-admin-only',
    'runtimeActivation','not-connected-to-production-inference',
    'datasetVersions',(select count(*) from public.ai_thiet_chan_ml_dataset_versions),
    'modelCandidates',(select count(*) from public.ai_thiet_chan_ml_model_registry where status='candidate'),
    'champions',(select count(*) from public.ai_thiet_chan_ml_model_registry where status='champion'),
    'retired',(select count(*) from public.ai_thiet_chan_ml_model_registry where status='retired'),
    'events',(select count(*) from public.ai_thiet_chan_ml_model_events)
  );
end;
$function$;

revoke all on function public.ai_thiet_chan_admin_register_ml_dataset_version_v1(text) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_register_ml_model_candidate_v1(text,text,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_promote_ml_champion_v1(text,text,text) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_rollback_ml_champion_v1(text,text,text) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_ml_governance_status_v1(text) from public, anon, authenticated;

grant execute on function public.ai_thiet_chan_admin_register_ml_dataset_version_v1(text) to service_role;
grant execute on function public.ai_thiet_chan_admin_register_ml_model_candidate_v1(text,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.ai_thiet_chan_admin_promote_ml_champion_v1(text,text,text) to service_role;
grant execute on function public.ai_thiet_chan_admin_rollback_ml_champion_v1(text,text,text) to service_role;
grant execute on function public.ai_thiet_chan_admin_ml_governance_status_v1(text) to service_role;
