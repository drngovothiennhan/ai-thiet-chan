-- A.I Thiệt Chẩn — continual learning dual-lane v1
-- Serving stays stable while verified/adjudicated non-holdout evidence builds immutable
-- learning snapshots and candidate-training jobs in parallel.
-- No online mutation of the serving model and no automatic promotion.

create table if not exists public.ai_thiet_chan_continual_learning_events_v1 (
  event_id bigint generated always as identity primary key,
  sample_id uuid not null references public.ai_thiet_chan_cases(id) on delete restrict,
  contribution_id uuid references public.ai_thiet_chan_verified_clinical_contributions_v1(id) on delete restrict,
  event_type text not null check (event_type in ('verified_contribution_approved','adjudicated_training_ready')),
  event_sha256 text not null unique check (event_sha256 ~ '^[0-9a-f]{64}$'),
  prospective_holdout boolean not null default false,
  status text not null default 'queued' check (status in ('queued','blocked_holdout','snapshotted')),
  snapshot_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_thiet_chan_continual_learning_events_v1 enable row level security;
revoke all on public.ai_thiet_chan_continual_learning_events_v1 from anon, authenticated;
create index if not exists ai_thiet_chan_continual_learning_events_status_idx
  on public.ai_thiet_chan_continual_learning_events_v1(status,created_at);

create table if not exists public.ai_thiet_chan_continual_snapshots_v1 (
  snapshot_version text primary key,
  schema_version text not null default 'aitc-continual-snapshot-v1',
  manifest_sha256 text not null unique check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  supervised_count integer not null check (supervised_count > 0),
  train_count integer not null check (train_count >= 0),
  validation_count integer not null check (validation_count >= 0),
  replay_dataset_version text not null default 'silver-textbook-teacher-v1',
  replay_policy jsonb not null default '{"strategy":"fixed-silver-replay","purpose":"catastrophic-forgetting-control"}'::jsonb,
  gold_source_policy text not null default 'verified-clinical-contributions-only',
  holdout_policy text not null default 'prospective-group-mod5-bucket0-excluded-before-training',
  locked boolean not null default true check (locked=true),
  created_at timestamptz not null default now()
);
alter table public.ai_thiet_chan_continual_snapshots_v1 enable row level security;
revoke all on public.ai_thiet_chan_continual_snapshots_v1 from anon, authenticated;

create table if not exists public.ai_thiet_chan_continual_snapshot_members_v1 (
  snapshot_version text not null references public.ai_thiet_chan_continual_snapshots_v1(snapshot_version) on delete restrict,
  sample_id uuid not null references public.ai_thiet_chan_cases(id) on delete restrict,
  group_hash text not null check (group_hash ~ '^[0-9a-f]{64}$'),
  final_annotation_sha256 text not null check (final_annotation_sha256 ~ '^[0-9a-f]{64}$'),
  internal_split text not null check (internal_split in ('train','validation')),
  primary key(snapshot_version,sample_id)
);
alter table public.ai_thiet_chan_continual_snapshot_members_v1 enable row level security;
revoke all on public.ai_thiet_chan_continual_snapshot_members_v1 from anon, authenticated;

create table if not exists public.ai_thiet_chan_continual_training_jobs_v1 (
  job_id uuid primary key default gen_random_uuid(),
  snapshot_version text not null unique references public.ai_thiet_chan_continual_snapshots_v1(snapshot_version) on delete restrict,
  base_model_version text not null default 'aitc-tongue-roi-mlp-bootstrap-v1',
  strategy text not null default 'replay-finetune-v1',
  status text not null default 'pending' check (status in ('pending','running','artifact_ready','failed','superseded')),
  candidate_model_version text,
  artifact_uri text,
  artifact_sha256 text check (artifact_sha256 is null or artifact_sha256 ~ '^[0-9a-f]{64}$'),
  internal_metrics jsonb not null default '{}'::jsonb,
  error_text text not null default '',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
alter table public.ai_thiet_chan_continual_training_jobs_v1 enable row level security;
revoke all on public.ai_thiet_chan_continual_training_jobs_v1 from anon, authenticated;
create index if not exists ai_thiet_chan_continual_training_jobs_status_idx
  on public.ai_thiet_chan_continual_training_jobs_v1(status,created_at);

create or replace function public.ai_thiet_chan_continual_immutable_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
begin
  raise exception 'continual_learning_snapshot_is_immutable';
end;
$function$;

drop trigger if exists ai_thiet_chan_continual_snapshots_immutable_v1 on public.ai_thiet_chan_continual_snapshots_v1;
create trigger ai_thiet_chan_continual_snapshots_immutable_v1
before update or delete on public.ai_thiet_chan_continual_snapshots_v1
for each row execute function public.ai_thiet_chan_continual_immutable_v1();

drop trigger if exists ai_thiet_chan_continual_snapshot_members_immutable_v1 on public.ai_thiet_chan_continual_snapshot_members_v1;
create trigger ai_thiet_chan_continual_snapshot_members_immutable_v1
before update or delete on public.ai_thiet_chan_continual_snapshot_members_v1
for each row execute function public.ai_thiet_chan_continual_immutable_v1();

-- Preserve structured verified-clinician annotations across later case resyncs.
create or replace function public.ai_thiet_chan_sync_ml_case_v1(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  c public.ai_thiet_chan_cases%rowtype;
  v_split text;
  v_bucket int;
  v_input jsonb;
  v_human jsonb;
  v_label_status text := 'model_generated_unverified';
  v_provenance jsonb;
  v_canonical jsonb;
  v_integrity text;
begin
  select * into c from public.ai_thiet_chan_cases where id=p_case_id;
  if not found then return; end if;

  begin
    v_bucket := (('x' || substr(c.image_hash,1,2))::bit(8)::int);
  exception when others then
    v_bucket := abs(hashtext(coalesce(c.image_hash,c.id::text))) % 256;
  end;
  v_split := case when v_bucket < 205 then 'train' when v_bucket < 230 then 'validation' else 'test' end;

  v_input := jsonb_build_object(
    'mode',coalesce(c.assessment_mode,'normal'),
    'top',jsonb_build_object('sha256',coalesce(c.top_image_hash,c.image_hash),'mime_type',coalesce(c.mime_type,'image/jpeg'),'storage_ref','aitc://case/'||c.id::text||'/top'),
    'bottom',case when c.bottom_image_hash is null then null else jsonb_build_object('sha256',c.bottom_image_hash,'mime_type',coalesce(c.bottom_mime_type,'image/jpeg'),'storage_ref','aitc://case/'||c.id::text||'/bottom') end,
    'qc',coalesce(c.qc,'{}'::jsonb)
  );

  select jsonb_build_object(
      'status','clinician_feedback_approved',
      'source','verified_clinical_contribution_v1',
      'contribution_id',x.id,
      'professional_title',x.professional_title,
      'contributor_hash',x.contributor_hash,
      'verification_basis',x.verification_basis,
      'clinical_note',x.clinical_note,
      'structured_annotation',x.annotation,
      'approved_at',x.reviewed_at
    )
  into v_human
  from public.ai_thiet_chan_verified_clinical_contributions_v1 x
  where x.case_id=c.id and x.status='approved'
  order by x.reviewed_at desc,x.created_at desc
  limit 1;

  if v_human is null then
    select jsonb_build_object(
        'status','clinician_feedback_approved',
        'source_feedback_id',lk.source_feedback_id,
        'knowledge_revision',lk.knowledge_revision,
        'approved_at',lk.approved_at,
        'professional_title',lk.professional_title,
        'contributor_name',lk.contributor_name,
        'clinical_note',lk.clinical_note
      )
    into v_human
    from public.ai_thiet_chan_learned_knowledge lk
    where lk.case_id=c.id and lk.active
    order by lk.knowledge_revision desc
    limit 1;
  end if;

  if v_human is not null then v_label_status := 'clinician_feedback_approved'; end if;

  v_provenance := jsonb_build_object(
    'source_table','ai_thiet_chan_cases',
    'source_case_id',c.id,
    'source',coalesce(c.source,'automatic'),
    'model',coalesce(c.model,''),
    'knowledge_version',coalesce(c.knowledge_version,''),
    'case_status',coalesce(c.status,''),
    'created_at',c.created_at,
    'last_seen_at',c.last_seen_at,
    'training_policy','model_observation_is_not_ground_truth'
  );
  if coalesce(v_human->>'source','')='verified_clinical_contribution_v1' then
    v_provenance:=v_provenance||jsonb_build_object(
      'human_label_source','verified_clinical_contribution_v1',
      'professional_attestation',true,
      'admin_reviewed',true
    );
  end if;

  v_canonical := jsonb_build_object(
    'schema_version','aitc-ml-jsonl-v1',
    'sample_id',c.id,
    'case_hash',c.image_hash,
    'split',v_split,
    'label_status',v_label_status,
    'inputs',v_input,
    'features',coalesce(c.feature_vector,'{}'::jsonb),
    'model_observation',coalesce(c.analysis,'{}'::jsonb),
    'human_annotation',v_human,
    'provenance',v_provenance
  );
  v_integrity := encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');

  insert into public.ai_thiet_chan_ml_samples(
    sample_id,case_hash,schema_version,split,label_status,input_manifest,feature_vector,model_observation,human_annotation,provenance,integrity_sha256,created_at,updated_at
  ) values(
    c.id,c.image_hash,'aitc-ml-jsonl-v1',v_split,v_label_status,v_input,coalesce(c.feature_vector,'{}'::jsonb),coalesce(c.analysis,'{}'::jsonb),v_human,v_provenance,v_integrity,c.created_at,now()
  )
  on conflict (sample_id) do update set
    case_hash=excluded.case_hash,
    schema_version=excluded.schema_version,
    split=excluded.split,
    label_status=excluded.label_status,
    input_manifest=excluded.input_manifest,
    feature_vector=excluded.feature_vector,
    model_observation=excluded.model_observation,
    human_annotation=excluded.human_annotation,
    provenance=excluded.provenance,
    integrity_sha256=excluded.integrity_sha256,
    updated_at=now();
end;
$function$;

create or replace function public.ai_thiet_chan_continual_build_snapshot_v1()
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_manifest text;
  v_sha text;
  v_version text;
  v_count integer;
  v_train integer;
  v_validation integer;
begin
  with eligible as (
    select
      g.sample_id,g.group_hash,g.final_annotation_sha256,
      case when ((('x'||substr(g.group_hash,1,8))::bit(32)::bigint % 10) in (1,6))
           then 'validation' else 'train' end as internal_split
    from public.ai_thiet_chan_gold_ready_v1 g
    where coalesce(g.final_annotation->>'image_quality','')='usable'
      and ((('x'||substr(g.group_hash,1,8))::bit(32)::bigint % 5)<>0)
  )
  select
    count(*),
    count(*) filter(where internal_split='train'),
    count(*) filter(where internal_split='validation'),
    coalesce(string_agg(sample_id::text||':'||group_hash||':'||final_annotation_sha256||':'||internal_split,E'\n' order by sample_id),'')
  into v_count,v_train,v_validation,v_manifest
  from eligible;

  if coalesce(v_count,0)=0 then
    return jsonb_build_object('ok',true,'created',false,'reason','no_adjudicated_non_holdout_usable_gold');
  end if;

  v_manifest:='silverReplay=silver-textbook-teacher-v1'||E'\n'||v_manifest;
  v_sha:=encode(extensions.digest(convert_to(v_manifest,'UTF8'),'sha256'),'hex');
  v_version:='continual-'||substr(v_sha,1,16);

  if exists(select 1 from public.ai_thiet_chan_continual_snapshots_v1 where snapshot_version=v_version) then
    return jsonb_build_object('ok',true,'created',false,'snapshotVersion',v_version,'reason','snapshot_already_exists');
  end if;

  insert into public.ai_thiet_chan_continual_snapshots_v1(
    snapshot_version,manifest_sha256,supervised_count,train_count,validation_count
  ) values(v_version,v_sha,v_count,v_train,v_validation);

  insert into public.ai_thiet_chan_continual_snapshot_members_v1(
    snapshot_version,sample_id,group_hash,final_annotation_sha256,internal_split
  )
  select
    v_version,g.sample_id,g.group_hash,g.final_annotation_sha256,
    case when ((('x'||substr(g.group_hash,1,8))::bit(32)::bigint % 10) in (1,6))
         then 'validation' else 'train' end
  from public.ai_thiet_chan_gold_ready_v1 g
  where coalesce(g.final_annotation->>'image_quality','')='usable'
    and ((('x'||substr(g.group_hash,1,8))::bit(32)::bigint % 5)<>0);

  insert into public.ai_thiet_chan_ml_dataset_versions(
    dataset_version,manifest_sha256,training_ready_count,train_count,validation_count,test_count,
    source_schema,provenance,locked,created_by
  ) values(
    v_version,v_sha,v_count,v_train,v_validation,0,
    'aitc-continual-snapshot-v1',
    jsonb_build_object(
      'goldSource','verified-clinical-contributions-only',
      'labelSource','independent-adjudication',
      'prospectiveHoldoutExcluded',true,
      'holdoutSelectionPolicy','group_sha256_mod5_bucket0',
      'silverReplayDataset','silver-textbook-teacher-v1',
      'servingModelMutation',false,
      'automaticPromotion',false
    ),
    true,'continual-learning-v1'
  );

  insert into public.ai_thiet_chan_continual_training_jobs_v1(snapshot_version)
  values(v_version)
  on conflict(snapshot_version) do nothing;

  update public.ai_thiet_chan_continual_learning_events_v1 e
  set status='snapshotted',snapshot_version=v_version,updated_at=now()
  where e.status='queued'
    and exists(
      select 1 from public.ai_thiet_chan_continual_snapshot_members_v1 m
      where m.snapshot_version=v_version and m.sample_id=e.sample_id
    );

  return jsonb_build_object(
    'ok',true,'created',true,'snapshotVersion',v_version,'manifestSha256',v_sha,
    'supervisedCount',v_count,'train',v_train,'validation',v_validation,
    'replayDataset','silver-textbook-teacher-v1',
    'servingModelChanged',false,'trainingJobQueued',true
  );
end;
$function$;

create or replace function public.ai_thiet_chan_continual_contribution_event_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare v_group text; v_holdout boolean; v_sha text;
begin
  if new.status='approved' and (tg_op='INSERT' or coalesce(old.status,'')<>'approved') then
    select group_hash into v_group from public.ai_thiet_chan_gold_pool_v1 where sample_id=new.case_id;
    v_holdout:=case when v_group is null then false else ((('x'||substr(v_group,1,8))::bit(32)::bigint % 5)=0) end;
    v_sha:=encode(extensions.digest(convert_to('verified_contribution_approved|'||new.id::text,'UTF8'),'sha256'),'hex');
    insert into public.ai_thiet_chan_continual_learning_events_v1(
      sample_id,contribution_id,event_type,event_sha256,prospective_holdout,status
    ) values(
      new.case_id,new.id,'verified_contribution_approved',v_sha,v_holdout,
      case when v_holdout then 'blocked_holdout' else 'queued' end
    ) on conflict(event_sha256) do nothing;
  end if;
  return new;
end;
$function$;

drop trigger if exists ai_thiet_chan_continual_contribution_event_v1 on public.ai_thiet_chan_verified_clinical_contributions_v1;
create trigger ai_thiet_chan_continual_contribution_event_v1
after insert or update of status on public.ai_thiet_chan_verified_clinical_contributions_v1
for each row execute function public.ai_thiet_chan_continual_contribution_event_v1();

create or replace function public.ai_thiet_chan_continual_adjudicated_event_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare v_holdout boolean; v_sha text;
begin
  if new.status='adjudicated' and coalesce(old.status,'')<>'adjudicated' then
    v_holdout:=((('x'||substr(new.group_hash,1,8))::bit(32)::bigint % 5)=0);
    v_sha:=encode(extensions.digest(convert_to('adjudicated_training_ready|'||new.sample_id::text||'|'||new.group_hash,'UTF8'),'sha256'),'hex');
    insert into public.ai_thiet_chan_continual_learning_events_v1(
      sample_id,event_type,event_sha256,prospective_holdout,status
    ) values(
      new.sample_id,'adjudicated_training_ready',v_sha,v_holdout,
      case when v_holdout then 'blocked_holdout' else 'queued' end
    ) on conflict(event_sha256) do nothing;

    if not v_holdout then
      perform public.ai_thiet_chan_continual_build_snapshot_v1();
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists ai_thiet_chan_continual_adjudicated_event_v1 on public.ai_thiet_chan_gold_pool_v1;
create trigger ai_thiet_chan_continual_adjudicated_event_v1
after update of status on public.ai_thiet_chan_gold_pool_v1
for each row execute function public.ai_thiet_chan_continual_adjudicated_event_v1();

create or replace function public.ai_thiet_chan_admin_continual_learning_status_v1(p_admin_token text)
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
    'mode','serve-and-learn-dual-lane-v1',
    'servingLane',jsonb_build_object(
      'runtimeMutationFromLearning',false,
      'automaticModelSwap',false,
      'availabilityIndependentFromTraining',true
    ),
    'learningLane',jsonb_build_object(
      'sourcePolicy','verified-clinical-contributions -> two independent experts -> independent adjudication',
      'prospectiveHoldoutExcludedBeforeTraining',true,
      'replayDataset','silver-textbook-teacher-v1',
      'queuedEvents',(select count(*) from public.ai_thiet_chan_continual_learning_events_v1 where status='queued'),
      'blockedHoldoutEvents',(select count(*) from public.ai_thiet_chan_continual_learning_events_v1 where status='blocked_holdout'),
      'snapshots',(select count(*) from public.ai_thiet_chan_continual_snapshots_v1),
      'pendingTrainingJobs',(select count(*) from public.ai_thiet_chan_continual_training_jobs_v1 where status='pending'),
      'artifactReadyJobs',(select count(*) from public.ai_thiet_chan_continual_training_jobs_v1 where status='artifact_ready')
    ),
    'promotion',jsonb_build_object(
      'automatic',false,
      'requiresGoldMetrics',true,
      'requiresPhysicalShadow',true,
      'requiresManualReview',true
    ),
    'latestSnapshot',(
      select jsonb_build_object(
        'snapshotVersion',s.snapshot_version,'supervisedCount',s.supervised_count,
        'train',s.train_count,'validation',s.validation_count,'createdAt',s.created_at
      )
      from public.ai_thiet_chan_continual_snapshots_v1 s order by s.created_at desc limit 1
    )
  );
end;
$function$;

create or replace function public.ai_thiet_chan_admin_export_continual_snapshot_v1(
  p_admin_token text,
  p_snapshot_version text,
  p_include_images boolean default false
) returns setof jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare v_hash text;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex')<>v_hash then raise exception 'unauthorized'; end if;
  if not exists(select 1 from public.ai_thiet_chan_continual_snapshots_v1 where snapshot_version=p_snapshot_version) then raise exception 'snapshot_not_found'; end if;

  return query
  select jsonb_build_object(
    'schema_version','aitc-continual-training-row-v1',
    'snapshot_version',m.snapshot_version,
    'sample_id',m.sample_id,
    'group_hash',m.group_hash,
    'split',m.internal_split,
    'final_annotation_sha256',m.final_annotation_sha256,
    'annotation',g.final_annotation,
    'inputs',jsonb_build_object(
      'top_sha256',c.top_image_hash,
      'bottom_sha256',c.bottom_image_hash,
      'top_data_url',case when p_include_images then c.image_data_url else null end,
      'bottom_data_url',case when p_include_images then c.bottom_image_data_url else null end
    ),
    'provenance',jsonb_build_object(
      'labelSource','independent-adjudication',
      'goldSourcePolicy','verified-clinical-contributions-only',
      'prospectiveGoldHoldout',false,
      'replayDataset','silver-textbook-teacher-v1'
    )
  )
  from public.ai_thiet_chan_continual_snapshot_members_v1 m
  join public.ai_thiet_chan_cases c on c.id=m.sample_id
  join public.ai_thiet_chan_gold_ready_v1 g on g.sample_id=m.sample_id
  where m.snapshot_version=p_snapshot_version
  order by m.internal_split,m.sample_id;
end;
$function$;

revoke all on function public.ai_thiet_chan_continual_build_snapshot_v1() from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_continual_immutable_v1() from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_continual_learning_status_v1(text) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_export_continual_snapshot_v1(text,text,boolean) from public, anon, authenticated;

grant execute on function public.ai_thiet_chan_admin_continual_learning_status_v1(text) to anon, authenticated;
grant execute on function public.ai_thiet_chan_admin_export_continual_snapshot_v1(text,text,boolean) to service_role;
