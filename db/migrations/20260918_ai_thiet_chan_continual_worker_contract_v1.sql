-- A.I Thiệt Chẩn — continual learning worker contract v1
-- Worker may train shadow candidates from immutable snapshots, but cannot promote or mutate serving runtime.

create or replace function public.ai_thiet_chan_worker_claim_continual_job_v1()
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare j public.ai_thiet_chan_continual_training_jobs_v1%rowtype;
begin
  select * into j
  from public.ai_thiet_chan_continual_training_jobs_v1
  where status='pending'
  order by created_at
  for update skip locked
  limit 1;

  if not found then
    return jsonb_build_object('ok',true,'job',null);
  end if;

  update public.ai_thiet_chan_continual_training_jobs_v1
  set status='running',started_at=now(),error_text=''
  where job_id=j.job_id;

  return jsonb_build_object(
    'ok',true,
    'job',jsonb_build_object(
      'jobId',j.job_id,
      'snapshotVersion',j.snapshot_version,
      'baseModelVersion',j.base_model_version,
      'strategy',j.strategy,
      'exportRpc','ai_thiet_chan_admin_export_continual_snapshot_v1',
      'activation','shadow-only'
    )
  );
end;
$function$;

create or replace function public.ai_thiet_chan_worker_complete_continual_job_v1(
  p_job_id uuid,
  p_candidate_model_version text,
  p_artifact_uri text,
  p_artifact_sha256 text,
  p_internal_metrics jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare j public.ai_thiet_chan_continual_training_jobs_v1%rowtype;
begin
  if nullif(trim(coalesce(p_candidate_model_version,'')),'') is null then raise exception 'candidate_model_version_required'; end if;
  if nullif(trim(coalesce(p_artifact_uri,'')),'') is null then raise exception 'artifact_uri_required'; end if;
  if coalesce(p_artifact_sha256,'') !~ '^[0-9a-f]{64}$' then raise exception 'artifact_sha256_invalid'; end if;

  select * into j from public.ai_thiet_chan_continual_training_jobs_v1 where job_id=p_job_id for update;
  if not found then raise exception 'training_job_not_found'; end if;
  if j.status<>'running' then raise exception 'training_job_must_be_running'; end if;

  insert into public.ai_thiet_chan_ml_model_registry(
    model_version,model_family,dataset_version,artifact_uri,artifact_sha256,metrics,status
  ) values(
    trim(p_candidate_model_version),'tongue-roi',j.snapshot_version,trim(p_artifact_uri),p_artifact_sha256,
    coalesce(p_internal_metrics,'{}'::jsonb) || jsonb_build_object(
      'metricSemantics','internal continual-training metrics only; not gold-holdout clinical accuracy',
      'activation','shadow-only',
      'automaticPromotion',false,
      'sourceSnapshot',j.snapshot_version
    ),
    'candidate'
  );

  update public.ai_thiet_chan_continual_training_jobs_v1
  set status='artifact_ready',
      candidate_model_version=trim(p_candidate_model_version),
      artifact_uri=trim(p_artifact_uri),
      artifact_sha256=p_artifact_sha256,
      internal_metrics=coalesce(p_internal_metrics,'{}'::jsonb),
      finished_at=now()
  where job_id=p_job_id;

  return jsonb_build_object(
    'ok',true,'jobId',p_job_id,'status','artifact_ready',
    'candidateModelVersion',trim(p_candidate_model_version),
    'activation','shadow-only','servingModelChanged',false,'promotionAutomatic',false
  );
end;
$function$;

create or replace function public.ai_thiet_chan_worker_fail_continual_job_v1(
  p_job_id uuid,
  p_error_text text
) returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
begin
  update public.ai_thiet_chan_continual_training_jobs_v1
  set status='failed',error_text=left(coalesce(p_error_text,''),4000),finished_at=now()
  where job_id=p_job_id and status='running';
  if not found then raise exception 'running_training_job_not_found'; end if;
  return jsonb_build_object('ok',true,'jobId',p_job_id,'status','failed');
end;
$function$;

revoke all on function public.ai_thiet_chan_worker_claim_continual_job_v1() from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_worker_complete_continual_job_v1(uuid,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_worker_fail_continual_job_v1(uuid,text) from public, anon, authenticated;

grant execute on function public.ai_thiet_chan_worker_claim_continual_job_v1() to service_role;
grant execute on function public.ai_thiet_chan_worker_complete_continual_job_v1(uuid,text,text,text,jsonb) to service_role;
grant execute on function public.ai_thiet_chan_worker_fail_continual_job_v1(uuid,text) to service_role;
