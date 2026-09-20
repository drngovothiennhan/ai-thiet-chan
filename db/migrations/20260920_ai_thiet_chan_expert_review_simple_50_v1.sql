-- A.I Thiệt Chẩn — simple expert review invite v1
-- One admin-created link per verified clinician. Expert confirms identity once,
-- then reviews existing cases blind to model output. Target is capped at 50 cases.
-- Submissions remain pending verified clinical contributions and require Admin approval
-- before they count as independent gold annotations.

create table if not exists public.ai_thiet_chan_expert_review_invites_v1 (
  invite_id uuid primary key default gen_random_uuid(),
  contributor_name text not null,
  professional_title text not null check (professional_title in ('bac_si','y_si')),
  professional_id_hash text not null check (professional_id_hash ~ '^[0-9a-f]{64}$'),
  contributor_hash text not null unique check (contributor_hash ~ '^[0-9a-f]{64}$'),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  target_cases integer not null default 50 check (target_cases between 1 and 50),
  active boolean not null default true,
  attested_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_thiet_chan_expert_review_invites_v1 enable row level security;
revoke all on public.ai_thiet_chan_expert_review_invites_v1 from anon, authenticated;

create table if not exists public.ai_thiet_chan_expert_review_assignments_v1 (
  assignment_id bigint generated always as identity primary key,
  invite_id uuid not null references public.ai_thiet_chan_expert_review_invites_v1(invite_id) on delete cascade,
  sample_id uuid not null references public.ai_thiet_chan_cases(id) on delete restrict,
  blind_id uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  unique(invite_id,sample_id)
);
alter table public.ai_thiet_chan_expert_review_assignments_v1 enable row level security;
revoke all on public.ai_thiet_chan_expert_review_assignments_v1 from anon, authenticated;

create or replace function public.ai_thiet_chan_expert_review_session_v1(p_token text)
returns public.ai_thiet_chan_expert_review_invites_v1
language plpgsql security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare s public.ai_thiet_chan_expert_review_invites_v1%rowtype;
begin
  select * into s
  from public.ai_thiet_chan_expert_review_invites_v1
  where token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex')
    and active and expires_at>now();
  if not found then raise exception 'expert_review_invite_invalid_or_expired'; end if;
  return s;
end;
$function$;

create or replace function public.ai_thiet_chan_admin_create_expert_review_invite_v1(
  p_admin_token text,
  p_contributor_name text,
  p_professional_title text,
  p_professional_id text,
  p_days integer default 14,
  p_target_cases integer default 50
) returns jsonb
language plpgsql security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_admin_hash text;
  v_name text:=trim(coalesce(p_contributor_name,''));
  v_title text:=lower(trim(coalesce(p_professional_title,'')));
  v_pid text:=lower(trim(coalesce(p_professional_id,'')));
  v_pid_hash text;
  v_contributor_hash text;
  v_token text;
  v_token_hash text;
  v_expires timestamptz;
  v_target integer:=least(50,greatest(1,coalesce(p_target_cases,50)));
begin
  select value_hash into v_admin_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_admin_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex')<>v_admin_hash then raise exception 'unauthorized'; end if;
  if length(v_name)<2 or length(v_name)>160 then raise exception 'contributor_name_invalid'; end if;
  if v_title not in ('bac_si','y_si') then raise exception 'professional_title_invalid'; end if;
  if length(v_pid)<4 then raise exception 'professional_id_required'; end if;

  v_pid_hash:=encode(extensions.digest(v_title||'|'||v_pid,'sha256'),'hex');
  v_contributor_hash:=encode(extensions.digest('verified-clinician-v1|'||v_title||'|'||v_pid_hash,'sha256'),'hex');
  v_token:='aitc-expert-'||encode(extensions.gen_random_bytes(24),'hex');
  v_token_hash:=encode(extensions.digest(v_token,'sha256'),'hex');
  v_expires:=now()+make_interval(days=>least(30,greatest(1,coalesce(p_days,14))));

  insert into public.ai_thiet_chan_expert_review_invites_v1(
    contributor_name,professional_title,professional_id_hash,contributor_hash,
    token_hash,target_cases,active,attested_at,expires_at
  ) values(
    v_name,v_title,v_pid_hash,v_contributor_hash,
    v_token_hash,v_target,true,null,v_expires
  )
  on conflict(contributor_hash) do update set
    contributor_name=excluded.contributor_name,
    professional_title=excluded.professional_title,
    professional_id_hash=excluded.professional_id_hash,
    token_hash=excluded.token_hash,
    target_cases=excluded.target_cases,
    active=true,
    attested_at=null,
    expires_at=excluded.expires_at,
    updated_at=now();

  return jsonb_build_object(
    'ok',true,'contributorName',v_name,'professionalTitle',v_title,
    'reviewerToken',v_token,'expiresAt',v_expires,'targetCases',v_target,
    'reviewUrl','/expert-review-v1.html?t='||v_token,
    'policy','model-blind verified clinician review; Admin approval required before gold'
  );
end;
$function$;

create or replace function public.ai_thiet_chan_admin_list_expert_review_invites_v1(p_admin_token text)
returns setof jsonb
language plpgsql security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare v_admin_hash text;
begin
  select value_hash into v_admin_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_admin_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex')<>v_admin_hash then raise exception 'unauthorized'; end if;
  return query
  select jsonb_build_object(
    'invite_id',i.invite_id,
    'contributor_name',i.contributor_name,
    'professional_title',i.professional_title,
    'target_cases',i.target_cases,
    'active',i.active,
    'attested',i.attested_at is not null,
    'expires_at',i.expires_at,
    'submitted',(
      select count(distinct x.case_id)
      from public.ai_thiet_chan_verified_clinical_contributions_v1 x
      where x.contributor_hash=i.contributor_hash
    ),
    'pending',(
      select count(*) from public.ai_thiet_chan_verified_clinical_contributions_v1 x
      where x.contributor_hash=i.contributor_hash and x.status='pending'
    )
  )
  from public.ai_thiet_chan_expert_review_invites_v1 i
  order by i.created_at desc;
end;
$function$;

create or replace function public.ai_thiet_chan_expert_review_info_v1(p_token text)
returns jsonb
language plpgsql security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare s public.ai_thiet_chan_expert_review_invites_v1%rowtype; v_available integer;
begin
  s:=public.ai_thiet_chan_expert_review_session_v1(p_token);
  select count(*) into v_available
  from public.ai_thiet_chan_cases c
  where c.image_data_url is not null and length(c.image_data_url)>100;
  return jsonb_build_object(
    'ok',true,'name',s.contributor_name,'professionalTitle',s.professional_title,
    'targetCases',s.target_cases,'attested',s.attested_at is not null,
    'expiresAt',s.expires_at,'availableCases',v_available,'modelOutputIncluded',false
  );
end;
$function$;

create or replace function public.ai_thiet_chan_expert_review_accept_v1(p_token text)
returns jsonb
language plpgsql security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare s public.ai_thiet_chan_expert_review_invites_v1%rowtype;
begin
  s:=public.ai_thiet_chan_expert_review_session_v1(p_token);
  update public.ai_thiet_chan_expert_review_invites_v1
  set attested_at=coalesce(attested_at,now()),updated_at=now()
  where invite_id=s.invite_id;
  return jsonb_build_object('ok',true,'attested',true,'name',s.contributor_name,'professionalTitle',s.professional_title);
end;
$function$;

create or replace function public.ai_thiet_chan_expert_review_next_v1(p_token text)
returns jsonb
language plpgsql security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  s public.ai_thiet_chan_expert_review_invites_v1%rowtype;
  a public.ai_thiet_chan_expert_review_assignments_v1%rowtype;
  v_sample uuid;
  v_done integer;
  v_available integer;
begin
  s:=public.ai_thiet_chan_expert_review_session_v1(p_token);
  if s.attested_at is null then raise exception 'expert_attestation_required'; end if;

  select count(distinct x.case_id) into v_done
  from public.ai_thiet_chan_verified_clinical_contributions_v1 x
  where x.contributor_hash=s.contributor_hash;

  select count(*) into v_available
  from public.ai_thiet_chan_cases c
  where c.image_data_url is not null and length(c.image_data_url)>100;

  if v_done>=s.target_cases then
    return jsonb_build_object('ok',true,'complete',true,'done',v_done,'target',s.target_cases,'availableCases',v_available);
  end if;

  select q.* into a
  from public.ai_thiet_chan_expert_review_assignments_v1 q
  where q.invite_id=s.invite_id
    and not exists(
      select 1 from public.ai_thiet_chan_verified_clinical_contributions_v1 x
      where x.case_id=q.sample_id and x.contributor_hash=s.contributor_hash
    )
  order by q.assignment_id
  limit 1;

  if a.assignment_id is null then
    select c.id into v_sample
    from public.ai_thiet_chan_cases c
    where c.image_data_url is not null and length(c.image_data_url)>100
      and not exists(
        select 1 from public.ai_thiet_chan_verified_clinical_contributions_v1 x
        where x.case_id=c.id and x.contributor_hash=s.contributor_hash
      )
      and not exists(
        select 1 from public.ai_thiet_chan_expert_review_assignments_v1 q
        where q.invite_id=s.invite_id and q.sample_id=c.id
      )
    order by c.created_at,c.id
    limit 1;

    if v_sample is not null then
      insert into public.ai_thiet_chan_expert_review_assignments_v1(invite_id,sample_id)
      values(s.invite_id,v_sample)
      returning * into a;
    end if;
  end if;

  if a.assignment_id is null then
    return jsonb_build_object(
      'ok',true,'complete',false,'waitingForCases',true,
      'done',v_done,'target',s.target_cases,'availableCases',v_available,
      'remainingTarget',greatest(0,s.target_cases-v_done)
    );
  end if;

  return (
    select jsonb_build_object(
      'ok',true,'complete',false,'waitingForCases',false,
      'blind_id',a.blind_id,
      'expert',jsonb_build_object('name',s.contributor_name,'professionalTitle',s.professional_title),
      'image',jsonb_build_object('top',c.image_data_url,'bottom',c.bottom_image_data_url),
      'coordinate_space',jsonb_build_object('width',160,'height',160,'order','row-major'),
      'progress',jsonb_build_object('done',v_done,'target',s.target_cases,'availableCases',v_available),
      'blinding',jsonb_build_object('model_output_included',false,'other_expert_output_included',false)
    )
    from public.ai_thiet_chan_cases c where c.id=a.sample_id
  );
end;
$function$;

create or replace function public.ai_thiet_chan_expert_review_submit_v1(
  p_token text,
  p_blind_id uuid,
  p_annotation jsonb
) returns jsonb
language plpgsql security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  s public.ai_thiet_chan_expert_review_invites_v1%rowtype;
  a public.ai_thiet_chan_expert_review_assignments_v1%rowtype;
  c public.ai_thiet_chan_cases%rowtype;
  v_note text;
  v_submission_hash text;
  v_id uuid;
  v_existing uuid;
begin
  s:=public.ai_thiet_chan_expert_review_session_v1(p_token);
  if s.attested_at is null then raise exception 'expert_attestation_required'; end if;
  perform public.ai_thiet_chan_gold_validate_roi_v1(p_annotation);

  select * into a
  from public.ai_thiet_chan_expert_review_assignments_v1
  where blind_id=p_blind_id and invite_id=s.invite_id;
  if not found then raise exception 'expert_review_assignment_not_found'; end if;

  select * into c from public.ai_thiet_chan_cases where id=a.sample_id;
  if not found then raise exception 'expert_review_case_not_found'; end if;

  select id into v_existing
  from public.ai_thiet_chan_verified_clinical_contributions_v1
  where case_id=c.id and contributor_hash=s.contributor_hash
  order by created_at limit 1;
  if v_existing is not null then
    return jsonb_build_object('ok',true,'id',v_existing,'alreadySubmitted',true,'status','pending_or_reviewed');
  end if;

  v_note:=left(trim(coalesce(p_annotation->>'notes','')),5000);
  v_submission_hash:=encode(extensions.digest(
    c.id::text||'|'||s.contributor_hash||'|'||p_annotation::text||'|'||v_note,
    'sha256'),'hex');

  insert into public.ai_thiet_chan_verified_clinical_contributions_v1(
    case_id,case_hash,top_image_hash,bottom_image_hash,
    contributor_name,professional_title,professional_id_hash,contributor_hash,
    professional_attested,annotation,clinical_note,verification_basis,status,submission_hash
  ) values(
    c.id,c.image_hash,coalesce(c.top_image_hash,''),coalesce(c.bottom_image_hash,''),
    s.contributor_name,s.professional_title,s.professional_id_hash,s.contributor_hash,
    true,p_annotation,v_note,'app_professional_attestation_admin_approved','pending',v_submission_hash
  )
  returning id into v_id;

  return jsonb_build_object(
    'ok',true,'id',v_id,'status','pending','adminApprovalRequired',true,
    'modelOutputUsedForAnnotation',false,'targetCases',s.target_cases
  );
end;
$function$;

revoke all on function public.ai_thiet_chan_expert_review_session_v1(text) from public,anon,authenticated;
grant execute on function public.ai_thiet_chan_admin_create_expert_review_invite_v1(text,text,text,text,integer,integer) to anon,authenticated;
grant execute on function public.ai_thiet_chan_admin_list_expert_review_invites_v1(text) to anon,authenticated;
grant execute on function public.ai_thiet_chan_expert_review_info_v1(text) to anon,authenticated;
grant execute on function public.ai_thiet_chan_expert_review_accept_v1(text) to anon,authenticated;
grant execute on function public.ai_thiet_chan_expert_review_next_v1(text) to anon,authenticated;
grant execute on function public.ai_thiet_chan_expert_review_submit_v1(text,uuid,jsonb) to anon,authenticated;
