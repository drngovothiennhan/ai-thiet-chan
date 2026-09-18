-- A.I Thiệt Chẩn — verified clinician adjudicator session bridge v1
-- A contributor becomes eligible to adjudicate only after at least one of their clinical contributions
-- has been explicitly approved by Admin. The adjudicator must still be independent of both source annotators.

create or replace view public.ai_thiet_chan_verified_gold_experts_v1 as
select
  contributor_hash,
  max(contributor_name) as contributor_name,
  max(professional_title) as professional_title,
  count(*) filter (where status='approved') as approved_contributions,
  max(reviewed_at) filter (where status='approved') as last_approved_at
from public.ai_thiet_chan_verified_clinical_contributions_v1
group by contributor_hash
having count(*) filter (where status='approved') > 0;

revoke all on public.ai_thiet_chan_verified_gold_experts_v1 from anon, authenticated;

create or replace function public.ai_thiet_chan_admin_list_verified_gold_experts_v1(p_admin_token text)
returns setof jsonb
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
    'contributor_hash',e.contributor_hash,
    'contributor_name',e.contributor_name,
    'professional_title',e.professional_title,
    'approved_contributions',e.approved_contributions,
    'last_approved_at',e.last_approved_at,
    'adjudicator_session_active',exists(
      select 1 from public.ai_thiet_chan_gold_reviewer_sessions_v1 s
      where s.reviewer_hash=e.contributor_hash and s.role='adjudication' and s.active and s.expires_at>now()
    )
  )
  from public.ai_thiet_chan_verified_gold_experts_v1 e
  order by e.last_approved_at desc,e.contributor_name;
end;
$function$;

create or replace function public.ai_thiet_chan_admin_create_verified_adjudicator_session_v1(
  p_admin_token text,
  p_contributor_hash text,
  p_hours integer default 72
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_hash text;
  e public.ai_thiet_chan_verified_gold_experts_v1%rowtype;
  v_token text;
  v_token_hash text;
  v_expires timestamptz;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex')<>v_hash then raise exception 'unauthorized'; end if;
  if coalesce(p_contributor_hash,'') !~ '^[0-9a-f]{64}$' then raise exception 'contributor_hash_invalid'; end if;

  select * into e from public.ai_thiet_chan_verified_gold_experts_v1 where contributor_hash=p_contributor_hash;
  if not found then raise exception 'approved_verified_expert_required'; end if;

  v_token:='aitc-gold-adj-'||encode(extensions.gen_random_bytes(24),'hex');
  v_token_hash:=encode(extensions.digest(v_token,'sha256'),'hex');
  v_expires:=now()+make_interval(hours=>least(336,greatest(1,coalesce(p_hours,72))));

  insert into public.ai_thiet_chan_gold_reviewer_sessions_v1(
    reviewer_hash,role,token_hash,label,active,expires_at
  ) values(
    e.contributor_hash,'adjudication',v_token_hash,
    'Verified adjudicator · '||e.professional_title||' · '||e.contributor_name,
    true,v_expires
  )
  on conflict(reviewer_hash,role) do update set
    token_hash=excluded.token_hash,label=excluded.label,active=true,expires_at=excluded.expires_at;

  return jsonb_build_object(
    'ok',true,
    'reviewerHash',e.contributor_hash,
    'professionalTitle',e.professional_title,
    'contributorName',e.contributor_name,
    'reviewerToken',v_token,
    'expiresAt',v_expires,
    'reviewUrl','/gold-review-v1.html',
    'policy','adjudicator must be an Admin-approved verified clinical contributor and distinct from both source annotators'
  );
end;
$function$;

revoke all on function public.ai_thiet_chan_admin_list_verified_gold_experts_v1(text) from public, anon, authenticated;
revoke all on function public.ai_thiet_chan_admin_create_verified_adjudicator_session_v1(text,text,integer) from public, anon, authenticated;
grant execute on function public.ai_thiet_chan_admin_list_verified_gold_experts_v1(text) to service_role;
grant execute on function public.ai_thiet_chan_admin_create_verified_adjudicator_session_v1(text,text,integer) to service_role;
