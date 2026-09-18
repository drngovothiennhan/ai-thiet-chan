-- A.I Thiệt Chẩn — continual contribution trigger INSERT/UPDATE safety patch v1

create or replace function public.ai_thiet_chan_continual_contribution_event_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare v_group text; v_holdout boolean; v_sha text; v_transition boolean:=false;
begin
  if tg_op='INSERT' then
    v_transition := new.status='approved';
  elsif tg_op='UPDATE' then
    v_transition := new.status='approved' and old.status is distinct from 'approved';
  end if;

  if v_transition then
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
