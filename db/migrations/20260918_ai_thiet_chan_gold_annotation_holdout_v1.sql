-- A.I Thiệt Chẩn — independent gold annotation + locked holdout v1
-- Additive governance only. No production inference, training, model output, or automatic promotion is changed.
-- Design: blind independent annotation -> adjudication -> immutable gold -> predeclared group-hash holdout.

create table if not exists public.ai_thiet_chan_gold_pool_v1 (
  sample_id uuid primary key references public.ai_thiet_chan_cases(id) on delete restrict,
  group_hash text not null check (group_hash ~ '^[0-9a-f]{64}$'),
  source_integrity_sha256 text not null check (source_integrity_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'annotation_open' check (status in ('annotation_open','adjudicated','holdout_locked')),
  created_at timestamptz not null default now()
);
alter table public.ai_thiet_chan_gold_pool_v1 enable row level security;
revoke all on public.ai_thiet_chan_gold_pool_v1 from anon, authenticated;

create table if not exists public.ai_thiet_chan_gold_assignments_v1 (
  assignment_id bigint generated always as identity primary key,
  sample_id uuid not null references public.ai_thiet_chan_gold_pool_v1(sample_id) on delete restrict,
  annotator_hash text not null check (annotator_hash ~ '^[0-9a-f]{64}$'),
  blind_id uuid not null default gen_random_uuid() unique,
  round_id text not null default 'gold-v1',
  created_at timestamptz not null default now(),
  unique(sample_id,annotator_hash,round_id)
);
alter table public.ai_thiet_chan_gold_assignments_v1 enable row level security;
revoke all on public.ai_thiet_chan_gold_assignments_v1 from anon, authenticated;

create table if not exists public.ai_thiet_chan_gold_annotations_v1 (
  annotation_id bigint generated always as identity primary key,
  assignment_id bigint not null unique references public.ai_thiet_chan_gold_assignments_v1(assignment_id) on delete restrict,
  sample_id uuid not null references public.ai_thiet_chan_gold_pool_v1(sample_id) on delete restrict,
  annotator_hash text not null check (annotator_hash ~ '^[0-9a-f]{64}$'),
  schema_version text not null default 'aitc-gold-annotation-v1',
  annotation jsonb not null,
  annotation_sha256 text not null check (annotation_sha256 ~ '^[0-9a-f]{64}$'),
  submitted_at timestamptz not null default now()
);
alter table public.ai_thiet_chan_gold_annotations_v1 enable row level security;
revoke all on public.ai_thiet_chan_gold_annotations_v1 from anon, authenticated;

create table if not exists public.ai_thiet_chan_gold_adjudications_v1 (
  adjudication_id bigint generated always as identity primary key,
  sample_id uuid not null unique references public.ai_thiet_chan_gold_pool_v1(sample_id) on delete restrict,
  adjudicator_hash text not null check (adjudicator_hash ~ '^[0-9a-f]{64}$'),
  source_annotation_ids bigint[] not null,
  final_annotation jsonb not null,
  final_annotation_sha256 text not null check (final_annotation_sha256 ~ '^[0-9a-f]{64}$'),
  protocol_version text not null default 'aitc-gold-adjudication-v1',
  created_at timestamptz not null default now(),
  check (cardinality(source_annotation_ids) >= 2)
);
alter table public.ai_thiet_chan_gold_adjudications_v1 enable row level security;
revoke all on public.ai_thiet_chan_gold_adjudications_v1 from anon, authenticated;

create or replace function public.ai_thiet_chan_gold_immutable_v1()
returns trigger language plpgsql security definer set search_path to 'public','extensions','pg_temp'
as $function$
begin
  raise exception 'gold_evidence_is_immutable';
end;
$function$;

drop trigger if exists ai_thiet_chan_gold_annotations_immutable_v1 on public.ai_thiet_chan_gold_annotations_v1;
create trigger ai_thiet_chan_gold_annotations_immutable_v1 before update or delete
on public.ai_thiet_chan_gold_annotations_v1 for each row execute function public.ai_thiet_chan_gold_immutable_v1();

drop trigger if exists ai_thiet_chan_gold_adjudications_immutable_v1 on public.ai_thiet_chan_gold_adjudications_v1;
create trigger ai_thiet_chan_gold_adjudications_immutable_v1 before update or delete
on public.ai_thiet_chan_gold_adjudications_v1 for each row execute function public.ai_thiet_chan_gold_immutable_v1();

create or replace view public.ai_thiet_chan_gold_ready_v1 as
select
  p.sample_id,
  p.group_hash,
  p.source_integrity_sha256,
  a.adjudication_id,
  a.source_annotation_ids,
  a.final_annotation,
  a.final_annotation_sha256,
  a.protocol_version,
  a.created_at as adjudicated_at
from public.ai_thiet_chan_gold_pool_v1 p
join public.ai_thiet_chan_gold_adjudications_v1 a on a.sample_id=p.sample_id
where p.status in ('adjudicated','holdout_locked')
  and (
    select count(distinct ga.annotator_hash)
    from public.ai_thiet_chan_gold_annotations_v1 ga
    where ga.sample_id=p.sample_id and ga.annotation_id=any(a.source_annotation_ids)
  ) >= 2;
revoke all on public.ai_thiet_chan_gold_ready_v1 from anon, authenticated;

create or replace function public.ai_thiet_chan_admin_add_gold_pool_sample_v1(
  p_admin_token text,
  p_sample_id uuid,
  p_group_hash text
) returns jsonb
language plpgsql security definer set search_path to 'public','extensions','pg_temp'
as $function$
declare v_hash text; v_integrity text;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then raise exception 'unauthorized'; end if;
  if coalesce(p_group_hash,'') !~ '^[0-9a-f]{64}$' then raise exception 'group_hash_required'; end if;
  select integrity_sha256 into v_integrity from public.ai_thiet_chan_ml_samples where sample_id=p_sample_id;
  if v_integrity is null then raise exception 'ml_sample_not_found'; end if;
  insert into public.ai_thiet_chan_gold_pool_v1(sample_id,group_hash,source_integrity_sha256)
  values(p_sample_id,p_group_hash,v_integrity)
  on conflict(sample_id) do nothing;
  return jsonb_build_object('ok',true,'sampleId',p_sample_id,'status','annotation_open');
end;
$function$;

create or replace function public.ai_thiet_chan_admin_export_blind_gold_packet_v1(
  p_admin_token text,
  p_annotator_hash text,
  p_limit integer default 25
) returns setof jsonb
language plpgsql security definer set search_path to 'public','extensions','pg_temp'
as $function$
declare v_hash text;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then raise exception 'unauthorized'; end if;
  if coalesce(p_annotator_hash,'') !~ '^[0-9a-f]{64}$' then raise exception 'annotator_hash_invalid'; end if;

  insert into public.ai_thiet_chan_gold_assignments_v1(sample_id,annotator_hash)
  select p.sample_id,p_annotator_hash
  from public.ai_thiet_chan_gold_pool_v1 p
  where p.status='annotation_open'
    and not exists(select 1 from public.ai_thiet_chan_gold_annotations_v1 x where x.sample_id=p.sample_id and x.annotator_hash=p_annotator_hash)
  order by p.sample_id
  limit least(100,greatest(1,coalesce(p_limit,25)))
  on conflict(sample_id,annotator_hash,round_id) do nothing;

  return query
  select jsonb_build_object(
    'schema_version','aitc-gold-packet-v1',
    'blind_id',g.blind_id,
    'image',jsonb_build_object('top',c.image_data_url,'bottom',c.bottom_image_data_url),
    'qc',coalesce(c.qc,'{}'::jsonb),
    'annotation_contract',jsonb_build_object(
      'tongue_present','boolean',
      'roi_mask_rle','object-or-null',
      'image_quality','usable|uncertain|reject',
      'notes','optional'
    ),
    'blinding',jsonb_build_object(
      'model_output_included',false,
      'other_annotator_output_included',false,
      'clinical_diagnosis_requested',false
    )
  )
  from public.ai_thiet_chan_gold_assignments_v1 g
  join public.ai_thiet_chan_cases c on c.id=g.sample_id
  left join public.ai_thiet_chan_gold_annotations_v1 x on x.assignment_id=g.assignment_id
  where g.annotator_hash=p_annotator_hash and g.round_id='gold-v1' and x.annotation_id is null
  order by g.assignment_id
  limit least(100,greatest(1,coalesce(p_limit,25)));
end;
$function$;

create or replace function public.ai_thiet_chan_admin_submit_blind_gold_annotation_v1(
  p_admin_token text,
  p_annotator_hash text,
  p_blind_id uuid,
  p_annotation jsonb
) returns jsonb
language plpgsql security definer set search_path to 'public','extensions','pg_temp'
as $function$
declare v_hash text; v_assignment public.ai_thiet_chan_gold_assignments_v1%rowtype; v_sha text; v_id bigint;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then raise exception 'unauthorized'; end if;
  select * into v_assignment from public.ai_thiet_chan_gold_assignments_v1 where blind_id=p_blind_id and annotator_hash=p_annotator_hash;
  if not found then raise exception 'blind_assignment_not_found'; end if;
  if exists(select 1 from public.ai_thiet_chan_gold_annotations_v1 where assignment_id=v_assignment.assignment_id) then raise exception 'annotation_already_submitted'; end if;
  if jsonb_typeof(coalesce(p_annotation,'null'::jsonb)) <> 'object' then raise exception 'annotation_object_required'; end if;
  if jsonb_typeof(p_annotation->'tongue_present') <> 'boolean' then raise exception 'tongue_present_boolean_required'; end if;
  if coalesce(p_annotation->>'image_quality','') not in ('usable','uncertain','reject') then raise exception 'image_quality_invalid'; end if;
  if (p_annotation->>'tongue_present')::boolean and jsonb_typeof(p_annotation->'roi_mask_rle') <> 'object' then raise exception 'roi_mask_rle_required_when_tongue_present'; end if;
  v_sha:=encode(extensions.digest(convert_to(p_annotation::text,'UTF8'),'sha256'),'hex');
  insert into public.ai_thiet_chan_gold_annotations_v1(assignment_id,sample_id,annotator_hash,annotation,annotation_sha256)
  values(v_assignment.assignment_id,v_assignment.sample_id,p_annotator_hash,p_annotation,v_sha)
  returning annotation_id into v_id;
  return jsonb_build_object('ok',true,'annotationId',v_id,'blindId',p_blind_id,'immutable',true);
end;
$function$;

create or replace function public.ai_thiet_chan_admin_adjudicate_gold_v1(
  p_admin_token text,
  p_sample_id uuid,
  p_adjudicator_hash text,
  p_source_annotation_ids bigint[],
  p_final_annotation jsonb
) returns jsonb
language plpgsql security definer set search_path to 'public','extensions','pg_temp'
as $function$
declare v_hash text; v_distinct integer; v_sha text; v_id bigint;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then raise exception 'unauthorized'; end if;
  if coalesce(p_adjudicator_hash,'') !~ '^[0-9a-f]{64}$' then raise exception 'adjudicator_hash_invalid'; end if;
  if cardinality(p_source_annotation_ids) < 2 then raise exception 'two_independent_annotations_required'; end if;
  select count(distinct annotator_hash) into v_distinct
  from public.ai_thiet_chan_gold_annotations_v1
  where sample_id=p_sample_id and annotation_id=any(p_source_annotation_ids);
  if v_distinct < 2 then raise exception 'two_independent_annotators_required'; end if;
  if exists(
    select 1 from public.ai_thiet_chan_gold_annotations_v1
    where sample_id=p_sample_id and annotation_id=any(p_source_annotation_ids) and annotator_hash=p_adjudicator_hash
  ) then raise exception 'adjudicator_must_be_independent'; end if;
  if jsonb_typeof(coalesce(p_final_annotation,'null'::jsonb)) <> 'object' then raise exception 'final_annotation_required'; end if;
  if jsonb_typeof(p_final_annotation->'tongue_present') <> 'boolean' then raise exception 'final_tongue_present_boolean_required'; end if;
  if coalesce(p_final_annotation->>'image_quality','') not in ('usable','uncertain','reject') then raise exception 'final_image_quality_invalid'; end if;
  if (p_final_annotation->>'tongue_present')::boolean and jsonb_typeof(p_final_annotation->'roi_mask_rle') <> 'object' then raise exception 'final_roi_mask_rle_required_when_tongue_present'; end if;
  v_sha:=encode(extensions.digest(convert_to(p_final_annotation::text,'UTF8'),'sha256'),'hex');
  insert into public.ai_thiet_chan_gold_adjudications_v1(sample_id,adjudicator_hash,source_annotation_ids,final_annotation,final_annotation_sha256)
  values(p_sample_id,p_adjudicator_hash,p_source_annotation_ids,p_final_annotation,v_sha)
  returning adjudication_id into v_id;
  update public.ai_thiet_chan_gold_pool_v1 set status='adjudicated' where sample_id=p_sample_id and status='annotation_open';
  return jsonb_build_object('ok',true,'adjudicationId',v_id,'sampleId',p_sample_id,'status','adjudicated_gold');
end;
$function$;

create table if not exists public.ai_thiet_chan_gold_holdout_versions_v1 (
  holdout_version text primary key,
  protocol_version text not null default 'aitc-gold-holdout-v1',
  selection_policy text not null default 'group_sha256_mod5_bucket0',
  manifest_sha256 text not null unique check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  sample_count integer not null check (sample_count > 0),
  group_count integer not null check (group_count > 0),
  locked boolean not null default true check (locked=true),
  created_at timestamptz not null default now()
);
alter table public.ai_thiet_chan_gold_holdout_versions_v1 enable row level security;
revoke all on public.ai_thiet_chan_gold_holdout_versions_v1 from anon, authenticated;

create table if not exists public.ai_thiet_chan_gold_holdout_members_v1 (
  holdout_version text not null references public.ai_thiet_chan_gold_holdout_versions_v1(holdout_version) on delete restrict,
  sample_id uuid not null references public.ai_thiet_chan_gold_pool_v1(sample_id) on delete restrict,
  group_hash text not null check (group_hash ~ '^[0-9a-f]{64}$'),
  final_annotation_sha256 text not null check (final_annotation_sha256 ~ '^[0-9a-f]{64}$'),
  primary key(holdout_version,sample_id)
);
alter table public.ai_thiet_chan_gold_holdout_members_v1 enable row level security;
revoke all on public.ai_thiet_chan_gold_holdout_members_v1 from anon, authenticated;

drop trigger if exists ai_thiet_chan_gold_holdout_versions_immutable_v1 on public.ai_thiet_chan_gold_holdout_versions_v1;
create trigger ai_thiet_chan_gold_holdout_versions_immutable_v1 before update or delete
on public.ai_thiet_chan_gold_holdout_versions_v1 for each row execute function public.ai_thiet_chan_gold_immutable_v1();
drop trigger if exists ai_thiet_chan_gold_holdout_members_immutable_v1 on public.ai_thiet_chan_gold_holdout_members_v1;
create trigger ai_thiet_chan_gold_holdout_members_immutable_v1 before update or delete
on public.ai_thiet_chan_gold_holdout_members_v1 for each row execute function public.ai_thiet_chan_gold_immutable_v1();

create or replace function public.ai_thiet_chan_admin_lock_gold_holdout_v1(p_admin_token text)
returns jsonb
language plpgsql security definer set search_path to 'public','extensions','pg_temp'
as $function$
declare v_hash text; v_manifest text; v_sha text; v_version text; v_count integer; v_groups integer;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then raise exception 'unauthorized'; end if;

  with selected as (
    select *
    from public.ai_thiet_chan_gold_ready_v1
    where (('x'||substr(group_hash,1,8))::bit(32)::bigint % 5)=0
  )
  select count(*),count(distinct group_hash),
         coalesce(string_agg(sample_id::text||':'||group_hash||':'||final_annotation_sha256,E'\n' order by sample_id),'')
  into v_count,v_groups,v_manifest from selected;
  if v_count=0 then raise exception 'gold_holdout_empty'; end if;

  v_sha:=encode(extensions.digest(convert_to(v_manifest,'UTF8'),'sha256'),'hex');
  v_version:='gold-holdout-'||substr(v_sha,1,16);
  insert into public.ai_thiet_chan_gold_holdout_versions_v1(holdout_version,manifest_sha256,sample_count,group_count)
  values(v_version,v_sha,v_count,v_groups) on conflict(holdout_version) do nothing;

  insert into public.ai_thiet_chan_gold_holdout_members_v1(holdout_version,sample_id,group_hash,final_annotation_sha256)
  select v_version,sample_id,group_hash,final_annotation_sha256
  from public.ai_thiet_chan_gold_ready_v1
  where (('x'||substr(group_hash,1,8))::bit(32)::bigint % 5)=0
  on conflict do nothing;

  update public.ai_thiet_chan_gold_pool_v1 p set status='holdout_locked'
  where exists(select 1 from public.ai_thiet_chan_gold_holdout_members_v1 m where m.holdout_version=v_version and m.sample_id=p.sample_id);

  return jsonb_build_object('ok',true,'holdoutVersion',v_version,'manifestSha256',v_sha,'sampleCount',v_count,'groupCount',v_groups,'selectionPolicy','group_sha256_mod5_bucket0','immutable',true);
end;
$function$;

revoke all on function public.ai_thiet_chan_admin_add_gold_pool_sample_v1(text,uuid,text) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_export_blind_gold_packet_v1(text,text,integer) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_submit_blind_gold_annotation_v1(text,text,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_adjudicate_gold_v1(text,uuid,text,bigint[],jsonb) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_lock_gold_holdout_v1(text) from public, anon, authenticated;

grant execute on function public.ai_thiet_chan_admin_add_gold_pool_sample_v1(text,uuid,text) to service_role;
grant execute on function public.ai_thiet_chan_admin_export_blind_gold_packet_v1(text,text,integer) to service_role;
grant execute on function public.ai_thiet_chan_admin_submit_blind_gold_annotation_v1(text,text,uuid,jsonb) to service_role;
grant execute on function public.ai_thiet_chan_admin_adjudicate_gold_v1(text,uuid,text,bigint[],jsonb) to service_role;
grant execute on function public.ai_thiet_chan_admin_lock_gold_holdout_v1(text) to service_role;
