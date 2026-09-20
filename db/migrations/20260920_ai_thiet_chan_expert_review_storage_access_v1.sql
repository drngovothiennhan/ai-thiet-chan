-- A.I Thiệt Chẩn — expert review private Storage access v1
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
  where (c.image_data_url is not null and length(c.image_data_url)>100)
     or c.top_image_storage_path is not null;

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
    where ((c.image_data_url is not null and length(c.image_data_url)>100)
       or c.top_image_storage_path is not null)
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
    return jsonb_build_object('ok',true,'complete',false,'waitingForCases',true,'done',v_done,'target',s.target_cases,'availableCases',v_available,'remainingTarget',greatest(0,s.target_cases-v_done));
  end if;

  return (
    select jsonb_build_object(
      'ok',true,'complete',false,'waitingForCases',false,
      'blind_id',a.blind_id,
      'expert',jsonb_build_object('name',s.contributor_name,'professionalTitle',s.professional_title),
      'image',jsonb_build_object(
        'top',case when c.image_data_url is not null and length(c.image_data_url)>100 then c.image_data_url else null end,
        'top_storage_path',c.top_image_storage_path,
        'bottom',case when c.bottom_image_data_url is not null and length(c.bottom_image_data_url)>100 then c.bottom_image_data_url else null end,
        'bottom_storage_path',c.bottom_image_storage_path
      ),
      'coordinate_space',jsonb_build_object('width',160,'height',160,'order','row-major'),
      'progress',jsonb_build_object('done',v_done,'target',s.target_cases,'availableCases',v_available),
      'blinding',jsonb_build_object('model_output_included',false,'other_expert_output_included',false)
    )
    from public.ai_thiet_chan_cases c where c.id=a.sample_id
  );
end;
$function$;

create or replace function public.ai_thiet_chan_expert_review_image_ref_v1(p_token text,p_blind_id uuid)
returns jsonb
language plpgsql security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  s public.ai_thiet_chan_expert_review_invites_v1%rowtype;
  a public.ai_thiet_chan_expert_review_assignments_v1%rowtype;
  c public.ai_thiet_chan_cases%rowtype;
begin
  s:=public.ai_thiet_chan_expert_review_session_v1(p_token);
  if s.attested_at is null then raise exception 'expert_attestation_required'; end if;
  select * into a from public.ai_thiet_chan_expert_review_assignments_v1
  where blind_id=p_blind_id and invite_id=s.invite_id;
  if not found then raise exception 'expert_review_assignment_not_found'; end if;
  select * into c from public.ai_thiet_chan_cases where id=a.sample_id;
  if not found then raise exception 'expert_review_case_not_found'; end if;
  return jsonb_build_object('ok',true,'bucket','aitc-case-images','storagePath',c.top_image_storage_path,'inlineAvailable',c.image_data_url is not null and length(c.image_data_url)>100);
end;
$function$;

revoke all on function public.ai_thiet_chan_expert_review_image_ref_v1(text,uuid) from public,anon,authenticated;
grant execute on function public.ai_thiet_chan_expert_review_image_ref_v1(text,uuid) to service_role;
