-- A.I Thiệt Chẩn — gold reviewer sessions v1
-- Secure blind expert collection without exposing the clinical admin credential.
-- No model output is returned to annotators or adjudicators.

create table if not exists public.ai_thiet_chan_gold_reviewer_sessions_v1 (
  session_id uuid primary key default gen_random_uuid(),
  reviewer_hash text not null check (reviewer_hash ~ '^[0-9a-f]{64}$'),
  role text not null check (role in ('annotation','adjudication')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label text,
  active boolean not null default true,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(reviewer_hash,role)
);
alter table public.ai_thiet_chan_gold_reviewer_sessions_v1 enable row level security;
revoke all on public.ai_thiet_chan_gold_reviewer_sessions_v1 from anon, authenticated;

create table if not exists public.ai_thiet_chan_gold_adjudication_assignments_v1 (
  assignment_id bigint generated always as identity primary key,
  sample_id uuid not null references public.ai_thiet_chan_gold_pool_v1(sample_id) on delete restrict,
  adjudicator_hash text not null check (adjudicator_hash ~ '^[0-9a-f]{64}$'),
  blind_id uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  unique(sample_id,adjudicator_hash)
);
alter table public.ai_thiet_chan_gold_adjudication_assignments_v1 enable row level security;
revoke all on public.ai_thiet_chan_gold_adjudication_assignments_v1 from anon, authenticated;

create or replace function public.ai_thiet_chan_gold_validate_roi_v1(p_annotation jsonb)
returns void
language plpgsql immutable
set search_path to 'public','extensions','pg_temp'
as $function$
declare v_present boolean; v_size jsonb; v_counts jsonb;
begin
  if jsonb_typeof(coalesce(p_annotation,'null'::jsonb)) <> 'object' then raise exception 'annotation_object_required'; end if;
  if jsonb_typeof(p_annotation->'tongue_present') <> 'boolean' then raise exception 'tongue_present_boolean_required'; end if;
  if coalesce(p_annotation->>'image_quality','') not in ('usable','uncertain','reject') then raise exception 'image_quality_invalid'; end if;
  v_present := (p_annotation->>'tongue_present')::boolean;
  if v_present then
    if jsonb_typeof(p_annotation->'roi_mask_rle') <> 'object' then raise exception 'roi_mask_rle_required_when_tongue_present'; end if;
    v_size := p_annotation#>'{roi_mask_rle,size}';
    v_counts := p_annotation#>'{roi_mask_rle,counts}';
    if v_size <> '[160,160]'::jsonb then raise exception 'roi_mask_size_must_be_160x160'; end if;
    if jsonb_typeof(v_counts) <> 'array' or jsonb_array_length(v_counts)=0 then raise exception 'roi_mask_counts_required'; end if;
  end if;
end;
$function$;

create or replace function public.ai_thiet_chan_gold_session_v1(p_token text)
returns public.ai_thiet_chan_gold_reviewer_sessions_v1
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare s public.ai_thiet_chan_gold_reviewer_sessions_v1%rowtype;
begin
  select * into s
  from public.ai_thiet_chan_gold_reviewer_sessions_v1
  where token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex')
    and active and expires_at>now();
  if not found then raise exception 'gold_reviewer_session_invalid_or_expired'; end if;
  return s;
end;
$function$;

create or replace function public.ai_thiet_chan_gold_reviewer_next_v1(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  s public.ai_thiet_chan_gold_reviewer_sessions_v1%rowtype;
  a public.ai_thiet_chan_gold_assignments_v1%rowtype;
  d public.ai_thiet_chan_gold_adjudication_assignments_v1%rowtype;
  v_sample uuid;
  v_ann jsonb;
  v_done integer;
  v_total integer;
begin
  s:=public.ai_thiet_chan_gold_session_v1(p_token);

  if s.role='annotation' then
    select g.* into a
    from public.ai_thiet_chan_gold_assignments_v1 g
    left join public.ai_thiet_chan_gold_annotations_v1 x on x.assignment_id=g.assignment_id
    where g.annotator_hash=s.reviewer_hash and g.round_id='gold-v1' and x.annotation_id is null
    order by g.assignment_id
    limit 1;

    if not found then
      select p.sample_id into v_sample
      from public.ai_thiet_chan_gold_pool_v1 p
      where p.status='annotation_open'
        and not exists(
          select 1 from public.ai_thiet_chan_gold_annotations_v1 x
          where x.sample_id=p.sample_id and x.annotator_hash=s.reviewer_hash
        )
        and not exists(
          select 1 from public.ai_thiet_chan_gold_assignments_v1 g
          where g.sample_id=p.sample_id and g.annotator_hash=s.reviewer_hash and g.round_id='gold-v1'
        )
      order by p.sample_id
      limit 1;

      if v_sample is not null then
        insert into public.ai_thiet_chan_gold_assignments_v1(sample_id,annotator_hash)
        values(v_sample,s.reviewer_hash)
        returning * into a;
      end if;
    end if;

    select count(*) into v_done from public.ai_thiet_chan_gold_annotations_v1 where annotator_hash=s.reviewer_hash;
    select count(*) into v_total from public.ai_thiet_chan_gold_pool_v1;

    if a.assignment_id is null then
      return jsonb_build_object('ok',true,'role','annotation','complete',true,'progress',jsonb_build_object('done',v_done,'total',v_total));
    end if;

    return (
      select jsonb_build_object(
        'ok',true,
        'role','annotation',
        'complete',false,
        'blind_id',a.blind_id,
        'image',jsonb_build_object('top',c.image_data_url,'bottom',c.bottom_image_data_url),
        'qc',coalesce(c.qc,'{}'::jsonb),
        'coordinate_space',jsonb_build_object('width',160,'height',160,'order','row-major'),
        'annotation_contract',jsonb_build_object(
          'tongue_present','boolean',
          'roi_mask_rle','required object at 160x160 when tongue_present=true',
          'image_quality','usable|uncertain|reject',
          'notes','optional'
        ),
        'blinding',jsonb_build_object(
          'model_output_included',false,
          'other_annotator_output_included',false,
          'clinical_diagnosis_requested',false
        ),
        'progress',jsonb_build_object('done',v_done,'total',v_total)
      )
      from public.ai_thiet_chan_cases c where c.id=a.sample_id
    );
  end if;

  -- adjudication: source annotations are visible only after two independent submissions exist.
  select g.* into d
  from public.ai_thiet_chan_gold_adjudication_assignments_v1 g
  left join public.ai_thiet_chan_gold_adjudications_v1 x on x.sample_id=g.sample_id
  where g.adjudicator_hash=s.reviewer_hash and x.adjudication_id is null
  order by g.assignment_id
  limit 1;

  if not found then
    select p.sample_id into v_sample
    from public.ai_thiet_chan_gold_pool_v1 p
    where p.status='annotation_open'
      and not exists(select 1 from public.ai_thiet_chan_gold_adjudications_v1 z where z.sample_id=p.sample_id)
      and (
        select count(distinct x.annotator_hash)
        from public.ai_thiet_chan_gold_annotations_v1 x
        where x.sample_id=p.sample_id and x.annotator_hash<>s.reviewer_hash
      )>=2
      and not exists(
        select 1 from public.ai_thiet_chan_gold_adjudication_assignments_v1 q
        where q.sample_id=p.sample_id and q.adjudicator_hash=s.reviewer_hash
      )
    order by p.sample_id
    limit 1;

    if v_sample is not null then
      insert into public.ai_thiet_chan_gold_adjudication_assignments_v1(sample_id,adjudicator_hash)
      values(v_sample,s.reviewer_hash)
      returning * into d;
    end if;
  end if;

  select count(*) into v_done from public.ai_thiet_chan_gold_adjudications_v1 where adjudicator_hash=s.reviewer_hash;
  select count(*) into v_total
  from public.ai_thiet_chan_gold_pool_v1 p
  where (
    select count(distinct x.annotator_hash)
    from public.ai_thiet_chan_gold_annotations_v1 x
    where x.sample_id=p.sample_id
  )>=2;

  if d.assignment_id is null then
    return jsonb_build_object('ok',true,'role','adjudication','complete',v_done>=v_total and v_total>0,'waitingForIndependentAnnotations',v_total=0 or v_done<v_total,'progress',jsonb_build_object('done',v_done,'eligible',v_total));
  end if;

  select jsonb_agg(jsonb_build_object('annotation_id',annotation_id,'annotation',annotation) order by annotation_id)
  into v_ann
  from (
    select annotation_id,annotation
    from public.ai_thiet_chan_gold_annotations_v1
    where sample_id=d.sample_id and annotator_hash<>s.reviewer_hash
    order by annotation_id
    limit 2
  ) q;

  return (
    select jsonb_build_object(
      'ok',true,
      'role','adjudication',
      'complete',false,
      'blind_id',d.blind_id,
      'image',jsonb_build_object('top',c.image_data_url,'bottom',c.bottom_image_data_url),
      'qc',coalesce(c.qc,'{}'::jsonb),
      'coordinate_space',jsonb_build_object('width',160,'height',160,'order','row-major'),
      'source_annotations',coalesce(v_ann,'[]'::jsonb),
      'blinding',jsonb_build_object('model_output_included',false,'annotator_identity_included',false),
      'progress',jsonb_build_object('done',v_done,'eligible',v_total)
    )
    from public.ai_thiet_chan_cases c where c.id=d.sample_id
  );
end;
$function$;

create or replace function public.ai_thiet_chan_gold_reviewer_submit_v1(
  p_token text,
  p_blind_id uuid,
  p_annotation jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  s public.ai_thiet_chan_gold_reviewer_sessions_v1%rowtype;
  a public.ai_thiet_chan_gold_assignments_v1%rowtype;
  d public.ai_thiet_chan_gold_adjudication_assignments_v1%rowtype;
  v_sha text;
  v_id bigint;
  v_source_ids bigint[];
  v_distinct integer;
begin
  s:=public.ai_thiet_chan_gold_session_v1(p_token);
  perform public.ai_thiet_chan_gold_validate_roi_v1(p_annotation);
  v_sha:=encode(extensions.digest(convert_to(p_annotation::text,'UTF8'),'sha256'),'hex');

  if s.role='annotation' then
    select * into a
    from public.ai_thiet_chan_gold_assignments_v1
    where blind_id=p_blind_id and annotator_hash=s.reviewer_hash and round_id='gold-v1';
    if not found then raise exception 'blind_assignment_not_found'; end if;
    if exists(select 1 from public.ai_thiet_chan_gold_annotations_v1 where assignment_id=a.assignment_id) then raise exception 'annotation_already_submitted'; end if;

    insert into public.ai_thiet_chan_gold_annotations_v1(assignment_id,sample_id,annotator_hash,annotation,annotation_sha256)
    values(a.assignment_id,a.sample_id,s.reviewer_hash,p_annotation,v_sha)
    returning annotation_id into v_id;
    return jsonb_build_object('ok',true,'role','annotation','annotationId',v_id,'immutable',true);
  end if;

  select * into d
  from public.ai_thiet_chan_gold_adjudication_assignments_v1
  where blind_id=p_blind_id and adjudicator_hash=s.reviewer_hash;
  if not found then raise exception 'blind_adjudication_assignment_not_found'; end if;
  if exists(select 1 from public.ai_thiet_chan_gold_adjudications_v1 where sample_id=d.sample_id) then raise exception 'adjudication_already_submitted'; end if;

  select array_agg(annotation_id order by annotation_id),count(distinct annotator_hash)
  into v_source_ids,v_distinct
  from (
    select annotation_id,annotator_hash
    from public.ai_thiet_chan_gold_annotations_v1
    where sample_id=d.sample_id and annotator_hash<>s.reviewer_hash
    order by annotation_id
    limit 2
  ) q;
  if coalesce(v_distinct,0)<2 then raise exception 'two_independent_annotators_required'; end if;

  insert into public.ai_thiet_chan_gold_adjudications_v1(sample_id,adjudicator_hash,source_annotation_ids,final_annotation,final_annotation_sha256)
  values(d.sample_id,s.reviewer_hash,v_source_ids,p_annotation,v_sha)
  returning adjudication_id into v_id;

  update public.ai_thiet_chan_gold_pool_v1 set status='adjudicated'
  where sample_id=d.sample_id and status='annotation_open';

  return jsonb_build_object('ok',true,'role','adjudication','adjudicationId',v_id,'status','adjudicated_gold','immutable',true);
end;
$function$;

create or replace function public.ai_thiet_chan_gold_reviewer_progress_v1(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare s public.ai_thiet_chan_gold_reviewer_sessions_v1%rowtype; v_done integer; v_total integer;
begin
  s:=public.ai_thiet_chan_gold_session_v1(p_token);
  if s.role='annotation' then
    select count(*) into v_done from public.ai_thiet_chan_gold_annotations_v1 where annotator_hash=s.reviewer_hash;
    select count(*) into v_total from public.ai_thiet_chan_gold_pool_v1;
  else
    select count(*) into v_done from public.ai_thiet_chan_gold_adjudications_v1 where adjudicator_hash=s.reviewer_hash;
    select count(*) into v_total from public.ai_thiet_chan_gold_pool_v1 p where (select count(distinct x.annotator_hash) from public.ai_thiet_chan_gold_annotations_v1 x where x.sample_id=p.sample_id)>=2;
  end if;
  return jsonb_build_object('ok',true,'role',s.role,'done',v_done,'total',v_total,'expiresAt',s.expires_at);
end;
$function$;

revoke all on function public.ai_thiet_chan_gold_session_v1(text) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_gold_validate_roi_v1(jsonb) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_gold_reviewer_next_v1(text) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_gold_reviewer_submit_v1(text,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_gold_reviewer_progress_v1(text) from public, anon, authenticated;

grant execute on function public.ai_thiet_chan_gold_reviewer_next_v1(text) to anon, authenticated;
grant execute on function public.ai_thiet_chan_gold_reviewer_submit_v1(text,uuid,jsonb) to anon, authenticated;
grant execute on function public.ai_thiet_chan_gold_reviewer_progress_v1(text) to anon, authenticated;
