-- A.I Thiệt Chẩn — storage token handshake hardening v2
-- Scope: make ai_thiet_chan_register_secret truthfully report whether the supplied
-- token matches the already-registered storage token. Do not rotate or replace an
-- existing token from an anonymous call.

create or replace function public.ai_thiet_chan_register_secret(p_token text)
returns boolean
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $function$
declare
  v_candidate_hash text;
  v_existing_hash text;
begin
  if p_token is null or length(p_token) < 16 then
    return false;
  end if;

  v_candidate_hash := encode(extensions.digest(p_token,'sha256'),'hex');

  select value_hash
    into v_existing_hash
    from public.ai_thiet_chan_config
   where key='training_store_token';

  if v_existing_hash is null then
    insert into public.ai_thiet_chan_config(key,value_hash)
    values ('training_store_token',v_candidate_hash)
    on conflict (key) do nothing;

    select value_hash
      into v_existing_hash
      from public.ai_thiet_chan_config
     where key='training_store_token';
  end if;

  return v_existing_hash = v_candidate_hash;
end;
$function$;

revoke all on function public.ai_thiet_chan_register_secret(text) from public, authenticated;
grant execute on function public.ai_thiet_chan_register_secret(text) to anon, service_role;
