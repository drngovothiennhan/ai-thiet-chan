-- A.I Thiệt Chan — verified clinical contribution -> gold bridge v1
-- Purpose: allow doctor/medical-practitioner confirmed clinical contributions submitted inside the app
-- to become gold-eligible evidence only after explicit professional attestation + admin approval.
-- This migration does NOT auto-create a holdout, metric, shadow PASS or promotion.

create table if not exists public.ai_thiet_chan_verified_clinical_contributions_v1 (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  case_id uuid not null references public.ai_thiet_chan_cases(id) on delete restrict,
  case_hash text not null,
  top_image_hash text not null,
  bottom_image_hash text not null default '',
  contributor_name text not null,
  professional_title text not null check (professional_title in ('bac_si','y_si')),
  professional_id_hash text not null check (professional_id_hash ~ '^[0-9a-f]{64}$'),
  contributor_hash text not null check (contributor_hash ~ '^[0-9a-f]{64}$'),
  attestation_version text not null default 'aitc-clinician-attestation-v1',
  professional_attested boolean not null check (professional_attested=true),
  annotation jsonb not null,
  clinical_note text not null default '',
  verification_basis text not null default 'app_professional_attestation_admin_approved',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text not null default '',
  reviewed_at timestamptz,
  gold_annotation_id bigint references public.ai_thiet_chan_gold_annotations_v1(annotation_id) on delete restrict,
  submission_hash text not null unique check (submission_hash ~ '^[0-9a-f]{64}$')
);

alter table public.ai_thiet_chan_verified_clinical_contributions_v1 enable row level security;
revoke all on public.ai_thiet_chan_verified_clinical_contributions_v1 from anon, authenticated;

create index if not exists ai_thiet_chan_verified_clinical_contributions_case_idx
  on public.ai_thiet_chan_verified_clinical_contributions_v1(case_id,status,created_at);
create index if not exists ai_thiet_chan_verified_clinical_contributions_contributor_idx
  on public.ai_thiet_chan_verified_clinical_contributions_v1(contributor_hash,status,created_at);

create or replace function public.ai_thiet_chan_submit_verified_clinical_contribution_v1(
  p_top_image_data_url text,
  p_bottom_image_data_url text,
  p_top_mime_type text,
  p_bottom_mime_type text,
  p_contributor_name text,
  p_professional_title text,
  p_professional_id_hash text,
  p_professional_attested boolean,
  p_annotation jsonb,
  p_clinical_note text default ''
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_name text:=trim(coalesce(p_contributor_name,''));
  v_title text:=lower(trim(coalesce(p_professional_title,'')));
  v_pid text:=lower(trim(coalesce(p_professional_id_hash,'')));
  v_note text:=left(trim(coalesce(p_clinical_note,'')),5000);
  v_top_data text:=coalesce(p_top_image_data_url,'');
  v_bottom_data text:=coalesce(p_bottom_image_data_url,'');
  v_top_base64 text;
  v_bottom_base64 text;
  v_top_hash text;
  v_bottom_hash text:='';
  v_case_hash text;
  v_case_id uuid;
  v_contributor_hash text;
  v_submission_hash text;
  v_id uuid;
begin
  if length(v_name)<2 or length(v_name)>160 then raise exception 'contributor_name_invalid'; end if;
  if v_title not in ('bac_si','y_si') then raise exception 'professional_title_invalid'; end if;
  if v_pid !~ '^[0-9a-f]{64}$' then raise exception 'professional_id_hash_invalid'; end if;
  if coalesce(p_professional_attested,false) is not true then raise exception 'professional_attestation_required'; end if;
  if length(v_top_data)<100 then raise exception 'top_image_required'; end if;
  if length(v_top_data)>19000000 or length(v_bottom_data)>19000000 then raise exception 'image_too_large'; end if;

  perform public.ai_thiet_chan_gold_validate_roi_v1(p_annotation);

  v_top_base64:=case when position(',' in v_top_data)>0 then split_part(v_top_data,',',2) else v_top_data end;
  v_top_hash:=encode(extensions.digest(convert_to(v_top_base64,'UTF8'),'sha256'),'hex');
  if length(v_bottom_data)>=100 then
    v_bottom_base64:=case when position(',' in v_bottom_data)>0 then split_part(v_bottom_data,',',2) else v_bottom_data end;
    v_bottom_hash:=encode(extensions.digest(convert_to(v_bottom_base64,'UTF8'),'sha256'),'hex');
  end if;
  v_case_hash:=encode(extensions.digest(convert_to('normal:'||v_top_hash||':'||v_bottom_hash,'UTF8'),'sha256'),'hex');
  v_contributor_hash:=encode(extensions.digest(convert_to('verified-clinician-v1|'||v_title||'|'||v_pid,'UTF8'),'sha256'),'hex');

  select id into v_case_id from public.ai_thiet_chan_cases where image_hash=v_case_hash limit 1;
  if v_case_id is null then
    insert into public.ai_thiet_chan_cases(
      image_hash,image_data_url,mime_type,qc,analysis,feature_vector,model,knowledge_version,source,status,assessment_mode,
      top_image_hash,bottom_image_hash,bottom_image_data_url,bottom_mime_type
    ) values(
      v_case_hash,v_top_data,coalesce(nullif(trim(p_top_mime_type),''),'image/jpeg'),
      '{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'human-clinical-contribution','',
      'verified-clinical-contribution','collected','normal',
      v_top_hash,nullif(v_bottom_hash,''),nullif(v_bottom_data,''),case when v_bottom_hash<>'' then coalesce(nullif(trim(p_bottom_mime_type),''),'image/jpeg') else null end
    ) returning id into v_case_id;
  end if;

  v_submission_hash:=encode(extensions.digest(convert_to(
    v_case_id::text||'|'||v_contributor_hash||'|'||p_annotation::text||'|'||v_note,
    'UTF8'),'sha256'),'hex');

  insert into public.ai_thiet_chan_verified_clinical_contributions_v1(
    case_id,case_hash,top_image_hash,bottom_image_hash,contributor_name,professional_title,
    professional_id_hash,contributor_hash,professional_attested,annotation,clinical_note,submission_hash
  ) values(
    v_case_id,v_case_hash,v_top_hash,v_bottom_hash,v_name,v_title,v_pid,v_contributor_hash,true,p_annotation,v_note,v_submission_hash
  )
  on conflict(submission_hash) do update set updated_at=now()
  returning id into v_id;

  return jsonb_build_object(
    'ok',true,'id',v_id,'caseId',v_case_id,'status','pending',
    'goldEligibleAfterAdminApproval',true,
    'verificationBasis','app_professional_attestation_admin_approved',
    'modelOutputUsedForAnnotation',false
  );
end;
$function$;

create or replace function public.ai_thiet_chan_admin_list_verified_clinical_contributions_v1(
  p_admin_token text,
  p_limit integer default 100
) returns setof jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare v_hash text;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex')<>v_hash then raise exception 'unauthorized'; end if;

  return query
  select jsonb_build_object(
    'id',x.id,'created_at',x.created_at,'case_id',x.case_id,'status',x.status,
    'contributor_name',x.contributor_name,'professional_title',x.professional_title,
    'contributor_hash',x.contributor_hash,'professional_id_hash',x.professional_id_hash,
    'professional_attested',x.professional_attested,'attestation_version',x.attestation_version,
    'verification_basis',x.verification_basis,'annotation',x.annotation,'clinical_note',x.clinical_note,
    'top_image_hash',x.top_image_hash,'bottom_image_hash',x.bottom_image_hash,
    'gold_annotation_id',x.gold_annotation_id
  )
  from public.ai_thiet_chan_verified_clinical_contributions_v1 x
  order by (x.status='pending') desc,x.created_at desc
  limit least(500,greatest(1,coalesce(p_limit,100)));
end;
$function$;

create or replace function public.ai_thiet_chan_admin_review_verified_clinical_contribution_v1(
  p_admin_token text,
  p_contribution_id uuid,
  p_decision text,
  p_admin_note text default ''
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_hash text;
  v_decision text:=lower(trim(coalesce(p_decision,'')));
  x public.ai_thiet_chan_verified_clinical_contributions_v1%rowtype;
  m public.ai_thiet_chan_ml_samples%rowtype;
  v_group_hash text;
  v_integrity text;
  v_assignment_id bigint;
  v_annotation_id bigint;
  v_annotation_sha text;
  v_existing bigint;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex')<>v_hash then raise exception 'unauthorized'; end if;
  if v_decision not in ('approved','rejected') then raise exception 'decision_invalid'; end if;

  select * into x from public.ai_thiet_chan_verified_clinical_contributions_v1 where id=p_contribution_id for update;
  if not found then raise exception 'contribution_not_found'; end if;
  if x.status<>'pending' then
    return jsonb_build_object('ok',true,'id',x.id,'status',x.status,'goldAnnotationId',x.gold_annotation_id,'alreadyReviewed',true);
  end if;

  if v_decision='rejected' then
    update public.ai_thiet_chan_verified_clinical_contributions_v1
    set status='rejected',admin_note=left(coalesce(p_admin_note,''),2000),reviewed_at=now(),updated_at=now()
    where id=x.id;
    return jsonb_build_object('ok',true,'id',x.id,'status','rejected','goldEligible',false);
  end if;

  if x.professional_attested is not true or x.professional_title not in ('bac_si','y_si') then raise exception 'professional_attestation_invalid'; end if;
  perform public.ai_thiet_chan_gold_validate_roi_v1(x.annotation);

  perform public.ai_thiet_chan_sync_ml_case_v1(x.case_id);
  select * into m from public.ai_thiet_chan_ml_samples where sample_id=x.case_id;
  if not found then raise exception 'ml_sample_sync_failed'; end if;
  v_integrity:=m.integrity_sha256;
  v_group_hash:=encode(extensions.digest(convert_to('gold-group-v2:'||coalesce(x.top_image_hash,x.case_hash),'UTF8'),'sha256'),'hex');

  insert into public.ai_thiet_chan_gold_pool_v1(sample_id,group_hash,source_integrity_sha256,status)
  values(x.case_id,v_group_hash,v_integrity,'annotation_open')
  on conflict(sample_id) do nothing;

  select annotation_id into v_existing
  from public.ai_thiet_chan_gold_annotations_v1
  where sample_id=x.case_id and annotator_hash=x.contributor_hash
  order by annotation_id limit 1;

  if v_existing is null then
    insert into public.ai_thiet_chan_gold_assignments_v1(sample_id,annotator_hash,round_id)
    values(x.case_id,x.contributor_hash,'clinical-contribution-v1')
    on conflict(sample_id,annotator_hash,round_id) do update set annotator_hash=excluded.annotator_hash
    returning assignment_id into v_assignment_id;

    v_annotation_sha:=encode(extensions.digest(convert_to(x.annotation::text,'UTF8'),'sha256'),'hex');
    insert into public.ai_thiet_chan_gold_annotations_v1(
      assignment_id,sample_id,annotator_hash,schema_version,annotation,annotation_sha256
    ) values(
      v_assignment_id,x.case_id,x.contributor_hash,'aitc-gold-annotation-v1',x.annotation,v_annotation_sha
    ) returning annotation_id into v_annotation_id;
  else
    v_annotation_id:=v_existing;
  end if;

  update public.ai_thiet_chan_verified_clinical_contributions_v1
  set status='approved',admin_note=left(coalesce(p_admin_note,''),2000),reviewed_at=now(),updated_at=now(),gold_annotation_id=v_annotation_id
  where id=x.id;

  update public.ai_thiet_chan_ml_samples
  set label_status='clinician_feedback_approved',
      human_annotation=jsonb_build_object(
        'status','clinician_feedback_approved',
        'source','verified_clinical_contribution_v1',
        'contribution_id',x.id,
        'professional_title',x.professional_title,
        'contributor_hash',x.contributor_hash,
        'verification_basis',x.verification_basis,
        'clinical_note',x.clinical_note,
        'structured_annotation',x.annotation,
        'approved_at',now()
      ),
      provenance=coalesce(provenance,'{}'::jsonb)||jsonb_build_object(
        'human_label_source','verified_clinical_contribution_v1',
        'professional_attestation',true,
        'admin_reviewed',true,
        'model_output_used_for_annotation',false
      ),
      updated_at=now()
  where sample_id=x.case_id;

  return jsonb_build_object(
    'ok',true,'id',x.id,'status','approved','caseId',x.case_id,
    'goldAnnotationId',v_annotation_id,'goldEligible',true,
    'distinctExpertKey',x.contributor_hash,
    'independentGoldCount',(
      select count(distinct annotator_hash) from public.ai_thiet_chan_gold_annotations_v1 where sample_id=x.case_id
    ),
    'adjudicationEligible',(
      select count(distinct annotator_hash)>=2 from public.ai_thiet_chan_gold_annotations_v1 where sample_id=x.case_id
    )
  );
end;
$function$;

create or replace view public.ai_thiet_chan_gold_progress_v2 as
select
  p.sample_id,
  p.status,
  count(distinct a.annotator_hash) as independent_expert_annotations,
  (count(distinct a.annotator_hash)>=2) as adjudication_eligible,
  exists(select 1 from public.ai_thiet_chan_gold_adjudications_v1 z where z.sample_id=p.sample_id) as adjudicated,
  exists(select 1 from public.ai_thiet_chan_gold_holdout_members_v1 h where h.sample_id=p.sample_id) as in_locked_holdout
from public.ai_thiet_chan_gold_pool_v1 p
left join public.ai_thiet_chan_gold_annotations_v1 a on a.sample_id=p.sample_id
group by p.sample_id,p.status;
revoke all on public.ai_thiet_chan_gold_progress_v2 from anon, authenticated;

create or replace function public.ai_thiet_chan_admin_gold_progress_v2(p_admin_token text)
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
    'policy','verified clinical contributions may supply independent expert annotations only after app attestation + admin approval; two distinct contributor hashes still required before adjudication',
    'goldPool',(select count(*) from public.ai_thiet_chan_gold_pool_v1),
    'withOneExpert',(select count(*) from public.ai_thiet_chan_gold_progress_v2 where independent_expert_annotations>=1),
    'withTwoIndependentExperts',(select count(*) from public.ai_thiet_chan_gold_progress_v2 where independent_expert_annotations>=2),
    'adjudicated',(select count(*) from public.ai_thiet_chan_gold_progress_v2 where adjudicated),
    'lockedHoldout',(select count(*) from public.ai_thiet_chan_gold_holdout_members_v1),
    'pendingVerifiedContributions',(select count(*) from public.ai_thiet_chan_verified_clinical_contributions_v1 where status='pending'),
    'approvedVerifiedContributions',(select count(*) from public.ai_thiet_chan_verified_clinical_contributions_v1 where status='approved')
  );
end;
$function$;

revoke all on function public.ai_thiet_chan_submit_verified_clinical_contribution_v1(text,text,text,text,text,text,text,boolean,jsonb,text) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_list_verified_clinical_contributions_v1(text,integer) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_review_verified_clinical_contribution_v1(text,uuid,text,text) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_gold_progress_v2(text) from public, anon, authenticated;

grant execute on function public.ai_thiet_chan_submit_verified_clinical_contribution_v1(text,text,text,text,text,text,text,boolean,jsonb,text) to anon, authenticated;
grant execute on function public.ai_thiet_chan_admin_list_verified_clinical_contributions_v1(text,integer) to service_role;
grant execute on function public.ai_thiet_chan_admin_review_verified_clinical_contribution_v1(text,uuid,text,text) to service_role;
grant execute on function public.ai_thiet_chan_admin_gold_progress_v2(text) to service_role;
