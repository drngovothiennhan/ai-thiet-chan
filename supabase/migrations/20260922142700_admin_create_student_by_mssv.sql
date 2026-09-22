-- Admin Center: create a student user from MSSV only.
-- Missing profile fields are explicit placeholders and are replaced by later Excel import.
create or replace function public.ai_thiet_chan_admin_create_student_v1(
  p_admin_token text,
  p_mssv text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','extensions','pg_temp'
as $function$
declare
  v_mssv text := upper(trim(coalesce(p_mssv,'')));
begin
  perform private.ai_thiet_chan_assert_admin_v1(p_admin_token);

  if v_mssv = ''
     or length(v_mssv) < 3
     or length(v_mssv) > 40
     or v_mssv !~ '^[A-Z0-9._-]+$'
  then
    raise exception 'invalid_mssv';
  end if;

  if exists (
    select 1
    from private.ai_thiet_chan_students_v1
    where mssv = v_mssv
  ) then
    raise exception 'student_exists';
  end if;

  insert into private.ai_thiet_chan_students_v1(
    mssv,stt,full_name,birth_year,faculty,class_name,
    password_hash,must_change_password,active,created_at,updated_at
  )
  values(
    v_mssv,null,'Chưa cập nhật',null,'Chưa cập nhật','Chưa cập nhật',
    extensions.crypt(v_mssv,extensions.gen_salt('bf',10)),true,true,now(),now()
  );

  return jsonb_build_object(
    'ok',true,
    'mssv',v_mssv,
    'temporaryPassword','MSSV',
    'mustChangePassword',true,
    'profileIncomplete',true
  );
end;
$function$;
