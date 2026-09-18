-- A.I Thiệt Chẩn — verified clinical gold source enforcement v2
-- After policy change, only Admin-approved Bác sĩ/Y sĩ contributions submitted through
-- the app may count as independent gold source annotations. Textbook/silver labels and
-- legacy arbitrary reviewer annotations cannot unlock holdout/promotion.

create or replace view public.ai_thiet_chan_verified_gold_annotations_v1 as
select
  a.annotation_id,
  a.assignment_id,
  a.sample_id,
  a.annotator_hash,
  a.schema_version,
  a.annotation,
  a.annotation_sha256,
  a.submitted_at,
  x.id as contribution_id,
  x.professional_title,
  x.verification_basis,
  x.reviewed_at
from public.ai_thiet_chan_gold_annotations_v1 a
join public.ai_thiet_chan_verified_clinical_contributions_v1 x
  on x.gold_annotation_id=a.annotation_id
 and x.case_id=a.sample_id
 and x.contributor_hash=a.annotator_hash
where x.status='approved'
  and x.professional_attested is true
  and x.professional_title in ('bac_si','y_si')
  and x.verification_basis='app_professional_attestation_admin_approved';

revoke all on public.ai_thiet_chan_verified_gold_annotations_v1 from anon, authenticated;

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
    from public.ai_thiet_chan_verified_gold_annotations_v1 ga
    where ga.sample_id=p.sample_id and ga.annotation_id=any(a.source_annotation_ids)
  ) >= 2
  and not exists(
    select 1
    from unnest(a.source_annotation_ids) u(annotation_id)
    where not exists(
      select 1 from public.ai_thiet_chan_verified_gold_annotations_v1 ga
      where ga.sample_id=p.sample_id and ga.annotation_id=u.annotation_id
    )
  );

revoke all on public.ai_thiet_chan_gold_ready_v1 from anon, authenticated;

create or replace view public.ai_thiet_chan_gold_progress_v2 as
select
  p.sample_id,
  p.status,
  count(distinct a.annotator_hash) as independent_expert_annotations,
  (count(distinct a.annotator_hash)>=2) as adjudication_eligible,
  exists(
    select 1 from public.ai_thiet_chan_gold_adjudications_v1 z
    where z.sample_id=p.sample_id
      and (
        select count(distinct v.annotator_hash)
        from public.ai_thiet_chan_verified_gold_annotations_v1 v
        where v.sample_id=p.sample_id and v.annotation_id=any(z.source_annotation_ids)
      )>=2
  ) as adjudicated,
  exists(select 1 from public.ai_thiet_chan_gold_holdout_members_v1 h where h.sample_id=p.sample_id) as in_locked_holdout
from public.ai_thiet_chan_gold_pool_v1 p
left join public.ai_thiet_chan_verified_gold_annotations_v1 a on a.sample_id=p.sample_id
group by p.sample_id,p.status;

revoke all on public.ai_thiet_chan_gold_progress_v2 from anon, authenticated;

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
  from public.ai_thiet_chan_verified_gold_annotations_v1
  where sample_id=p_sample_id and annotation_id=any(p_source_annotation_ids);
  if v_distinct < 2 then raise exception 'two_verified_clinical_contributors_required'; end if;
  if exists(
    select 1 from unnest(p_source_annotation_ids) u(annotation_id)
    where not exists(
      select 1 from public.ai_thiet_chan_verified_gold_annotations_v1 v
      where v.sample_id=p_sample_id and v.annotation_id=u.annotation_id
    )
  ) then raise exception 'unverified_source_annotation_forbidden'; end if;
  if exists(
    select 1 from public.ai_thiet_chan_verified_gold_annotations_v1
    where sample_id=p_sample_id and annotation_id=any(p_source_annotation_ids) and annotator_hash=p_adjudicator_hash
  ) then raise exception 'adjudicator_must_be_independent'; end if;
  if not exists(
    select 1 from public.ai_thiet_chan_verified_gold_experts_v1 e where e.contributor_hash=p_adjudicator_hash
  ) then raise exception 'verified_clinical_adjudicator_required'; end if;

  perform public.ai_thiet_chan_gold_validate_roi_v1(p_final_annotation);
  v_sha:=encode(extensions.digest(convert_to(p_final_annotation::text,'UTF8'),'sha256'),'hex');

  insert into public.ai_thiet_chan_gold_adjudications_v1(sample_id,adjudicator_hash,source_annotation_ids,final_annotation,final_annotation_sha256)
  values(p_sample_id,p_adjudicator_hash,p_source_annotation_ids,p_final_annotation,v_sha)
  returning adjudication_id into v_id;

  update public.ai_thiet_chan_gold_pool_v1 set status='adjudicated'
  where sample_id=p_sample_id and status='annotation_open';

  return jsonb_build_object('ok',true,'adjudicationId',v_id,'sampleId',p_sample_id,'status','adjudicated_gold','sourcePolicy','verified-clinical-contributions-only');
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
  d public.ai_thiet_chan_gold_adjudication_assignments_v1%rowtype;
  v_sample uuid;
  v_ann jsonb;
  v_done integer;
  v_total integer;
begin
  s:=public.ai_thiet_chan_gold_session_v1(p_token);
  if s.role<>'adjudication' then raise exception 'direct_gold_annotation_sessions_disabled_use_verified_clinical_contribution_flow'; end if;
  if not exists(select 1 from public.ai_thiet_chan_verified_gold_experts_v1 e where e.contributor_hash=s.reviewer_hash)
    then raise exception 'verified_clinical_adjudicator_required'; end if;

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
        from public.ai_thiet_chan_verified_gold_annotations_v1 x
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
    from public.ai_thiet_chan_verified_gold_annotations_v1 x
    where x.sample_id=p.sample_id and x.annotator_hash<>s.reviewer_hash
  )>=2;

  if d.assignment_id is null then
    return jsonb_build_object('ok',true,'role','adjudication','complete',v_done>=v_total and v_total>0,'waitingForIndependentAnnotations',v_total=0 or v_done<v_total,'progress',jsonb_build_object('done',v_done,'eligible',v_total));
  end if;

  select jsonb_agg(jsonb_build_object('annotation_id',annotation_id,'annotation',annotation) order by annotation_id)
  into v_ann
  from (
    select annotation_id,annotation
    from public.ai_thiet_chan_verified_gold_annotations_v1
    where sample_id=d.sample_id and annotator_hash<>s.reviewer_hash
    order by annotation_id
    limit 2
  ) q;

  return (
    select jsonb_build_object(
      'ok',true,'role','adjudication','complete',false,'blind_id',d.blind_id,
      'image',jsonb_build_object('top',c.image_data_url,'bottom',c.bottom_image_data_url),
      'qc',coalesce(c.qc,'{}'::jsonb),
      'coordinate_space',jsonb_build_object('width',160,'height',160,'order','row-major'),
      'source_annotations',coalesce(v_ann,'[]'::jsonb),
      'blinding',jsonb_build_object('model_output_included',false,'annotator_identity_included',false,'source_policy','verified-clinical-contributions-only'),
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
  d public.ai_thiet_chan_gold_adjudication_assignments_v1%rowtype;
  v_sha text;
  v_id bigint;
  v_source_ids bigint[];
  v_distinct integer;
begin
  s:=public.ai_thiet_chan_gold_session_v1(p_token);
  if s.role<>'adjudication' then raise exception 'direct_gold_annotation_sessions_disabled_use_verified_clinical_contribution_flow'; end if;
  if not exists(select 1 from public.ai_thiet_chan_verified_gold_experts_v1 e where e.contributor_hash=s.reviewer_hash)
    then raise exception 'verified_clinical_adjudicator_required'; end if;

  perform public.ai_thiet_chan_gold_validate_roi_v1(p_annotation);
  select * into d
  from public.ai_thiet_chan_gold_adjudication_assignments_v1
  where blind_id=p_blind_id and adjudicator_hash=s.reviewer_hash;
  if not found then raise exception 'blind_adjudication_assignment_not_found'; end if;
  if exists(select 1 from public.ai_thiet_chan_gold_adjudications_v1 where sample_id=d.sample_id) then raise exception 'adjudication_already_submitted'; end if;

  select array_agg(annotation_id order by annotation_id),count(distinct annotator_hash)
  into v_source_ids,v_distinct
  from (
    select annotation_id,annotator_hash
    from public.ai_thiet_chan_verified_gold_annotations_v1
    where sample_id=d.sample_id and annotator_hash<>s.reviewer_hash
    order by annotation_id
    limit 2
  ) q;
  if coalesce(v_distinct,0)<2 then raise exception 'two_verified_clinical_contributors_required'; end if;

  v_sha:=encode(extensions.digest(convert_to(p_annotation::text,'UTF8'),'sha256'),'hex');
  insert into public.ai_thiet_chan_gold_adjudications_v1(sample_id,adjudicator_hash,source_annotation_ids,final_annotation,final_annotation_sha256)
  values(d.sample_id,s.reviewer_hash,v_source_ids,p_annotation,v_sha)
  returning adjudication_id into v_id;

  update public.ai_thiet_chan_gold_pool_v1 set status='adjudicated'
  where sample_id=d.sample_id and status='annotation_open';

  return jsonb_build_object('ok',true,'role','adjudication','adjudicationId',v_id,'status','adjudicated_gold','immutable',true,'sourcePolicy','verified-clinical-contributions-only');
end;
$function$;
