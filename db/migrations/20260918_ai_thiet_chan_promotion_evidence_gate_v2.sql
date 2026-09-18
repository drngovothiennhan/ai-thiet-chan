-- A.I Thiệt Chẩn — promotion evidence gate v2
-- Requires locked gold metrics + physical-device shadow evidence + explicit manual review.
-- This migration does not connect any candidate to production inference.

create table if not exists public.ai_thiet_chan_gold_evaluations_v1 (
  gold_evaluation_id bigint generated always as identity primary key,
  model_version text not null references public.ai_thiet_chan_ml_model_registry(model_version) on delete restrict,
  holdout_version text not null references public.ai_thiet_chan_gold_holdout_versions_v1(holdout_version) on delete restrict,
  model_sha256 text not null check (model_sha256 ~ '^[0-9a-f]{64}$'),
  metric_schema text not null default 'aitc-gold-holdout-metrics-v1',
  metric_results jsonb not null,
  created_at timestamptz not null default now(),
  unique(model_version,holdout_version,model_sha256)
);
alter table public.ai_thiet_chan_gold_evaluations_v1 enable row level security;
revoke all on public.ai_thiet_chan_gold_evaluations_v1 from anon, authenticated;

create table if not exists public.ai_thiet_chan_device_shadow_evidence_v1 (
  shadow_evidence_id bigint generated always as identity primary key,
  model_version text not null references public.ai_thiet_chan_ml_model_registry(model_version) on delete restrict,
  model_sha256 text not null check (model_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_schema text not null default 'aitc-physical-shadow-evidence-v1',
  evidence jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.ai_thiet_chan_device_shadow_evidence_v1 enable row level security;
revoke all on public.ai_thiet_chan_device_shadow_evidence_v1 from anon, authenticated;

create table if not exists public.ai_thiet_chan_promotion_reviews_v2 (
  promotion_review_id bigint generated always as identity primary key,
  model_version text not null references public.ai_thiet_chan_ml_model_registry(model_version) on delete restrict,
  gold_evaluation_id bigint not null references public.ai_thiet_chan_gold_evaluations_v1(gold_evaluation_id) on delete restrict,
  shadow_evidence_id bigint not null references public.ai_thiet_chan_device_shadow_evidence_v1(shadow_evidence_id) on delete restrict,
  reviewer_hash text not null check (reviewer_hash ~ '^[0-9a-f]{64}$'),
  decision text not null check (decision in ('approve','reject')),
  review_note text not null,
  created_at timestamptz not null default now()
);
alter table public.ai_thiet_chan_promotion_reviews_v2 enable row level security;
revoke all on public.ai_thiet_chan_promotion_reviews_v2 from anon, authenticated;

drop trigger if exists ai_thiet_chan_gold_evaluations_immutable_v1 on public.ai_thiet_chan_gold_evaluations_v1;
create trigger ai_thiet_chan_gold_evaluations_immutable_v1 before update or delete
on public.ai_thiet_chan_gold_evaluations_v1 for each row execute function public.ai_thiet_chan_gold_immutable_v1();
drop trigger if exists ai_thiet_chan_shadow_evidence_immutable_v1 on public.ai_thiet_chan_device_shadow_evidence_v1;
create trigger ai_thiet_chan_shadow_evidence_immutable_v1 before update or delete
on public.ai_thiet_chan_device_shadow_evidence_v1 for each row execute function public.ai_thiet_chan_gold_immutable_v1();
drop trigger if exists ai_thiet_chan_promotion_reviews_immutable_v2 on public.ai_thiet_chan_promotion_reviews_v2;
create trigger ai_thiet_chan_promotion_reviews_immutable_v2 before update or delete
on public.ai_thiet_chan_promotion_reviews_v2 for each row execute function public.ai_thiet_chan_gold_immutable_v1();

create or replace function public.ai_thiet_chan_admin_record_gold_evaluation_v1(
  p_admin_token text,
  p_model_version text,
  p_holdout_version text,
  p_metric_results jsonb
) returns jsonb
language plpgsql security definer set search_path to 'public','extensions','pg_temp'
as $function$
declare v_hash text; v_model public.ai_thiet_chan_ml_model_registry%rowtype; v_holdout public.ai_thiet_chan_gold_holdout_versions_v1%rowtype; v_id bigint;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then raise exception 'unauthorized'; end if;
  select * into v_model from public.ai_thiet_chan_ml_model_registry where model_version=p_model_version;
  if not found then raise exception 'model_version_not_found'; end if;
  if v_model.status <> 'candidate' then raise exception 'gold_evaluation_candidate_only'; end if;
  select * into v_holdout from public.ai_thiet_chan_gold_holdout_versions_v1 where holdout_version=p_holdout_version;
  if not found or v_holdout.locked is not true then raise exception 'locked_gold_holdout_required'; end if;
  if jsonb_typeof(coalesce(p_metric_results,'null'::jsonb)) <> 'object' then raise exception 'metric_results_required'; end if;
  if p_metric_results->>'schemaVersion' <> 'aitc-gold-holdout-metrics-v1' then raise exception 'gold_metric_schema_invalid'; end if;
  if p_metric_results->>'holdoutVersion' <> p_holdout_version then raise exception 'gold_metric_holdout_mismatch'; end if;
  if lower(coalesce(p_metric_results->>'modelSha256','')) <> lower(v_model.artifact_sha256) then raise exception 'gold_metric_model_hash_mismatch'; end if;
  if coalesce((p_metric_results->>'sampleCount')::integer,0) <> v_holdout.sample_count then raise exception 'gold_metric_sample_count_mismatch'; end if;
  if p_metric_results->>'promotionDecision' <> 'none' then raise exception 'metric_evaluator_must_not_promote'; end if;

  insert into public.ai_thiet_chan_gold_evaluations_v1(model_version,holdout_version,model_sha256,metric_results)
  values(v_model.model_version,v_holdout.holdout_version,v_model.artifact_sha256,p_metric_results)
  returning gold_evaluation_id into v_id;
  return jsonb_build_object('ok',true,'goldEvaluationId',v_id,'promotionDecision','none','runtimeActivation','none');
end;
$function$;

create or replace function public.ai_thiet_chan_admin_record_device_shadow_evidence_v1(
  p_admin_token text,
  p_model_version text,
  p_evidence jsonb
) returns jsonb
language plpgsql security definer set search_path to 'public','extensions','pg_temp'
as $function$
declare v_hash text; v_model public.ai_thiet_chan_ml_model_registry%rowtype; v_id bigint; v_runs integer;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then raise exception 'unauthorized'; end if;
  select * into v_model from public.ai_thiet_chan_ml_model_registry where model_version=p_model_version;
  if not found then raise exception 'model_version_not_found'; end if;
  if v_model.status <> 'candidate' then raise exception 'shadow_evidence_candidate_only'; end if;
  if p_evidence->>'schemaVersion' <> 'aitc-physical-shadow-evidence-v1' then raise exception 'shadow_evidence_schema_invalid'; end if;
  if coalesce((p_evidence->>'noSyntheticData')::boolean,false) is not true then raise exception 'real_device_evidence_required'; end if;
  if coalesce((p_evidence#>>'{manual,physicalDeviceConfirmed}')::boolean,false) is not true then raise exception 'physical_device_confirmation_required'; end if;
  if coalesce((p_evidence#>>'{execution,evidenceCollected}')::boolean,false) is not true then raise exception 'complete_shadow_runs_required'; end if;
  if p_evidence#>>'{execution,qualityPassNotAssessed}' <> 'true' then raise exception 'shadow_harness_must_not_self_approve_quality'; end if;
  v_runs:=jsonb_array_length(coalesce(p_evidence->'runs','[]'::jsonb));
  if v_runs < 5 then raise exception 'five_physical_shadow_runs_required'; end if;
  if exists(
    select 1 from jsonb_array_elements(p_evidence->'runs') r
    where lower(coalesce(r->>'modelSha256','')) <> lower(v_model.artifact_sha256)
       or coalesce(r->>'status','') <> 'complete'
  ) then raise exception 'shadow_run_model_or_status_mismatch'; end if;

  insert into public.ai_thiet_chan_device_shadow_evidence_v1(model_version,model_sha256,evidence)
  values(v_model.model_version,v_model.artifact_sha256,p_evidence)
  returning shadow_evidence_id into v_id;
  return jsonb_build_object('ok',true,'shadowEvidenceId',v_id,'promotionDecision','none','runtimeActivation','none');
end;
$function$;

create or replace function public.ai_thiet_chan_admin_review_promotion_gate_v2(
  p_admin_token text,
  p_model_version text,
  p_gold_evaluation_id bigint,
  p_shadow_evidence_id bigint,
  p_reviewer_hash text,
  p_decision text,
  p_review_note text
) returns jsonb
language plpgsql security definer set search_path to 'public','extensions','pg_temp'
as $function$
declare v_hash text; v_gold public.ai_thiet_chan_gold_evaluations_v1%rowtype; v_shadow public.ai_thiet_chan_device_shadow_evidence_v1%rowtype; v_id bigint;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then raise exception 'unauthorized'; end if;
  if coalesce(p_reviewer_hash,'') !~ '^[0-9a-f]{64}$' then raise exception 'reviewer_hash_invalid'; end if;
  if p_decision not in ('approve','reject') then raise exception 'promotion_review_decision_invalid'; end if;
  if nullif(trim(coalesce(p_review_note,'')),'') is null then raise exception 'promotion_review_note_required'; end if;
  select * into v_gold from public.ai_thiet_chan_gold_evaluations_v1 where gold_evaluation_id=p_gold_evaluation_id;
  if not found or v_gold.model_version<>p_model_version then raise exception 'gold_evaluation_model_mismatch'; end if;
  select * into v_shadow from public.ai_thiet_chan_device_shadow_evidence_v1 where shadow_evidence_id=p_shadow_evidence_id;
  if not found or v_shadow.model_version<>p_model_version then raise exception 'shadow_evidence_model_mismatch'; end if;
  if lower(v_gold.model_sha256)<>lower(v_shadow.model_sha256) then raise exception 'evidence_model_hash_mismatch'; end if;

  insert into public.ai_thiet_chan_promotion_reviews_v2(model_version,gold_evaluation_id,shadow_evidence_id,reviewer_hash,decision,review_note)
  values(p_model_version,p_gold_evaluation_id,p_shadow_evidence_id,p_reviewer_hash,p_decision,trim(p_review_note))
  returning promotion_review_id into v_id;
  return jsonb_build_object('ok',true,'promotionReviewId',v_id,'decision',p_decision,'runtimeActivation','none');
end;
$function$;

-- Harden the existing manual promotion function: manual admin is necessary but no longer sufficient.
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
  v_review public.ai_thiet_chan_promotion_reviews_v2%rowtype;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then raise exception 'unauthorized'; end if;

  select * into v_target from public.ai_thiet_chan_ml_model_registry where model_version=p_model_version;
  if not found then raise exception 'model_version_not_found'; end if;
  if v_target.status <> 'candidate' then raise exception 'only_candidate_can_be_promoted'; end if;

  select * into v_review
  from public.ai_thiet_chan_promotion_reviews_v2
  where model_version=p_model_version and decision='approve'
  order by created_at desc
  limit 1;
  if not found then raise exception 'promotion_evidence_gate_not_approved'; end if;

  if not exists(select 1 from public.ai_thiet_chan_gold_evaluations_v1 where gold_evaluation_id=v_review.gold_evaluation_id and model_version=p_model_version and lower(model_sha256)=lower(v_target.artifact_sha256))
    then raise exception 'promotion_gold_evidence_invalid'; end if;
  if not exists(select 1 from public.ai_thiet_chan_device_shadow_evidence_v1 where shadow_evidence_id=v_review.shadow_evidence_id and model_version=p_model_version and lower(model_sha256)=lower(v_target.artifact_sha256))
    then raise exception 'promotion_shadow_evidence_invalid'; end if;

  lock table public.ai_thiet_chan_ml_model_registry in row exclusive mode;
  select model_version into v_previous from public.ai_thiet_chan_ml_model_registry
  where model_family=v_target.model_family and status='champion' limit 1;

  update public.ai_thiet_chan_ml_model_registry set status='retired',retired_at=now()
  where model_family=v_target.model_family and status='champion';
  update public.ai_thiet_chan_ml_model_registry set status='champion',promoted_at=now(),retired_at=null
  where model_version=v_target.model_version;

  insert into public.ai_thiet_chan_ml_model_events(model_family,event_type,from_model_version,to_model_version,dataset_version,note)
  values(v_target.model_family,'promote',v_previous,v_target.model_version,v_target.dataset_version,
    concat_ws(' | ',nullif(trim(coalesce(p_note,'')),''),'promotion_review_id='||v_review.promotion_review_id::text));

  return jsonb_build_object(
    'ok',true,'modelVersion',v_target.model_version,'status','champion','previousChampion',v_previous,
    'promotionPolicy','gold-metrics + physical-shadow + explicit-manual-review',
    'promotionReviewId',v_review.promotion_review_id,
    'runtimeActivation','not-connected-to-production-inference'
  );
end;
$function$;

revoke all on function public.ai_thiet_chan_admin_record_gold_evaluation_v1(text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_record_device_shadow_evidence_v1(text,text,jsonb) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_review_promotion_gate_v2(text,text,bigint,bigint,text,text,text) from public, anon, authenticated;
grant execute on function public.ai_thiet_chan_admin_record_gold_evaluation_v1(text,text,text,jsonb) to service_role;
grant execute on function public.ai_thiet_chan_admin_record_device_shadow_evidence_v1(text,text,jsonb) to service_role;
grant execute on function public.ai_thiet_chan_admin_review_promotion_gate_v2(text,text,bigint,bigint,text,text,text) to service_role;
