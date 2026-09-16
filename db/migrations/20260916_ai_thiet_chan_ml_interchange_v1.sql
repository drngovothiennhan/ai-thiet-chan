create table if not exists public.ai_thiet_chan_ml_samples (
  sample_id uuid primary key references public.ai_thiet_chan_cases(id) on delete cascade,
  case_hash text not null unique,
  schema_version text not null default 'aitc-ml-jsonl-v1',
  split text not null check (split in ('train','validation','test')),
  label_status text not null default 'model_generated_unverified',
  input_manifest jsonb not null default '{}'::jsonb,
  feature_vector jsonb not null default '{}'::jsonb,
  model_observation jsonb not null default '{}'::jsonb,
  human_annotation jsonb,
  provenance jsonb not null default '{}'::jsonb,
  integrity_sha256 text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.ai_thiet_chan_ml_samples enable row level security;
revoke all on public.ai_thiet_chan_ml_samples from anon, authenticated;

create index if not exists ai_thiet_chan_ml_samples_split_idx on public.ai_thiet_chan_ml_samples(split, created_at);
create index if not exists ai_thiet_chan_ml_samples_label_status_idx on public.ai_thiet_chan_ml_samples(label_status, created_at);
create index if not exists ai_thiet_chan_ml_samples_schema_idx on public.ai_thiet_chan_ml_samples(schema_version);

create or replace function public.ai_thiet_chan_sync_ml_case_v1(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $$
declare
  c public.ai_thiet_chan_cases%rowtype;
  v_split text;
  v_bucket int;
  v_input jsonb;
  v_human jsonb;
  v_label_status text := 'model_generated_unverified';
  v_provenance jsonb;
  v_canonical jsonb;
  v_integrity text;
begin
  select * into c from public.ai_thiet_chan_cases where id=p_case_id;
  if not found then return; end if;

  begin
    v_bucket := (('x' || substr(c.image_hash,1,2))::bit(8)::int);
  exception when others then
    v_bucket := abs(hashtext(coalesce(c.image_hash,c.id::text))) % 256;
  end;
  v_split := case when v_bucket < 205 then 'train' when v_bucket < 230 then 'validation' else 'test' end;

  v_input := jsonb_build_object(
    'mode',coalesce(c.assessment_mode,'normal'),
    'top',jsonb_build_object('sha256',coalesce(c.top_image_hash,c.image_hash),'mime_type',coalesce(c.mime_type,'image/jpeg'),'storage_ref','aitc://case/'||c.id::text||'/top'),
    'bottom',case when c.bottom_image_hash is null then null else jsonb_build_object('sha256',c.bottom_image_hash,'mime_type',coalesce(c.bottom_mime_type,'image/jpeg'),'storage_ref','aitc://case/'||c.id::text||'/bottom') end,
    'qc',coalesce(c.qc,'{}'::jsonb)
  );

  select jsonb_build_object(
      'status','clinician_feedback_approved',
      'source_feedback_id',lk.source_feedback_id,
      'knowledge_revision',lk.knowledge_revision,
      'approved_at',lk.approved_at,
      'professional_title',lk.professional_title,
      'contributor_name',lk.contributor_name,
      'clinical_note',lk.clinical_note
    )
  into v_human
  from public.ai_thiet_chan_learned_knowledge lk
  where lk.case_id=c.id and lk.active
  order by lk.knowledge_revision desc
  limit 1;

  if v_human is not null then v_label_status := 'clinician_feedback_approved'; end if;

  v_provenance := jsonb_build_object(
    'source_table','ai_thiet_chan_cases',
    'source_case_id',c.id,
    'source',coalesce(c.source,'automatic'),
    'model',coalesce(c.model,''),
    'knowledge_version',coalesce(c.knowledge_version,''),
    'case_status',coalesce(c.status,''),
    'created_at',c.created_at,
    'last_seen_at',c.last_seen_at,
    'training_policy','model_observation_is_not_ground_truth'
  );

  v_canonical := jsonb_build_object(
    'schema_version','aitc-ml-jsonl-v1',
    'sample_id',c.id,
    'case_hash',c.image_hash,
    'split',v_split,
    'label_status',v_label_status,
    'inputs',v_input,
    'features',coalesce(c.feature_vector,'{}'::jsonb),
    'model_observation',coalesce(c.analysis,'{}'::jsonb),
    'human_annotation',v_human,
    'provenance',v_provenance
  );
  v_integrity := encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');

  insert into public.ai_thiet_chan_ml_samples(
    sample_id,case_hash,schema_version,split,label_status,input_manifest,feature_vector,model_observation,human_annotation,provenance,integrity_sha256,created_at,updated_at
  ) values(
    c.id,c.image_hash,'aitc-ml-jsonl-v1',v_split,v_label_status,v_input,coalesce(c.feature_vector,'{}'::jsonb),coalesce(c.analysis,'{}'::jsonb),v_human,v_provenance,v_integrity,c.created_at,now()
  )
  on conflict (sample_id) do update set
    case_hash=excluded.case_hash,
    schema_version=excluded.schema_version,
    split=excluded.split,
    label_status=excluded.label_status,
    input_manifest=excluded.input_manifest,
    feature_vector=excluded.feature_vector,
    model_observation=excluded.model_observation,
    human_annotation=excluded.human_annotation,
    provenance=excluded.provenance,
    integrity_sha256=excluded.integrity_sha256,
    updated_at=now();
end;
$$;

create or replace function public.ai_thiet_chan_ml_case_trigger_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $$
begin
  perform public.ai_thiet_chan_sync_ml_case_v1(new.id);
  return new;
end;
$$;

drop trigger if exists ai_thiet_chan_cases_ml_sync_v1 on public.ai_thiet_chan_cases;
create trigger ai_thiet_chan_cases_ml_sync_v1
after insert or update of image_hash,assessment_mode,top_image_hash,bottom_image_hash,mime_type,bottom_mime_type,qc,analysis,feature_vector,model,knowledge_version,status,last_seen_at
on public.ai_thiet_chan_cases
for each row execute function public.ai_thiet_chan_ml_case_trigger_v1();

create or replace function public.ai_thiet_chan_ml_learned_trigger_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $$
begin
  perform public.ai_thiet_chan_sync_ml_case_v1(coalesce(new.case_id,old.case_id));
  return coalesce(new,old);
end;
$$;

drop trigger if exists ai_thiet_chan_learned_ml_sync_v1 on public.ai_thiet_chan_learned_knowledge;
create trigger ai_thiet_chan_learned_ml_sync_v1
after insert or update or delete on public.ai_thiet_chan_learned_knowledge
for each row execute function public.ai_thiet_chan_ml_learned_trigger_v1();

do $$
declare r record;
begin
  for r in select id from public.ai_thiet_chan_cases loop
    perform public.ai_thiet_chan_sync_ml_case_v1(r.id);
  end loop;
end $$;

create or replace function public.ai_thiet_chan_admin_ml_dataset_status_v1(p_admin_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $$
declare v_hash text;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then raise exception 'unauthorized'; end if;
  return jsonb_build_object(
    'ok',true,
    'schemaVersion','aitc-ml-jsonl-v1',
    'canonicalFormat','JSONL',
    'imageRepresentation','content-addressed references; raw images joined only for authorized export',
    'labelPolicy','model observations and clinician-approved annotations are stored separately',
    'integrity','SHA-256 per sample',
    'samples',(select count(*) from public.ai_thiet_chan_ml_samples),
    'train',(select count(*) from public.ai_thiet_chan_ml_samples where split='train'),
    'validation',(select count(*) from public.ai_thiet_chan_ml_samples where split='validation'),
    'test',(select count(*) from public.ai_thiet_chan_ml_samples where split='test'),
    'clinicianReviewed',(select count(*) from public.ai_thiet_chan_ml_samples where label_status='clinician_feedback_approved')
  );
end;
$$;

create or replace function public.ai_thiet_chan_admin_export_ml_jsonl_v1(
  p_admin_token text,
  p_limit integer default 1000,
  p_split text default null,
  p_include_images boolean default false
)
returns setof jsonb
language plpgsql
security definer
set search_path to 'public','extensions','pg_temp'
as $$
declare v_hash text;
begin
  select value_hash into v_hash from public.ai_thiet_chan_config where key='clinical_admin_token';
  if v_hash is null or encode(extensions.digest(coalesce(p_admin_token,''),'sha256'),'hex') <> v_hash then raise exception 'unauthorized'; end if;
  if p_split is not null and p_split not in ('train','validation','test') then raise exception 'invalid split'; end if;
  return query
  select jsonb_build_object(
    'schema_version',m.schema_version,
    'sample_id',m.sample_id,
    'case_hash',m.case_hash,
    'split',m.split,
    'inputs',m.input_manifest || case when p_include_images then jsonb_build_object('raw_images',jsonb_build_object('top',c.image_data_url,'bottom',c.bottom_image_data_url)) else '{}'::jsonb end,
    'features',m.feature_vector,
    'annotations',jsonb_build_object('status',m.label_status,'model_observation',m.model_observation,'human_annotation',m.human_annotation),
    'provenance',m.provenance,
    'integrity',jsonb_build_object('algorithm','sha256','digest',m.integrity_sha256)
  )
  from public.ai_thiet_chan_ml_samples m
  join public.ai_thiet_chan_cases c on c.id=m.sample_id
  where p_split is null or m.split=p_split
  order by m.created_at,m.sample_id
  limit least(5000,greatest(1,coalesce(p_limit,1000)));
end;
$$;

grant execute on function public.ai_thiet_chan_admin_ml_dataset_status_v1(text) to anon, authenticated;
grant execute on function public.ai_thiet_chan_admin_export_ml_jsonl_v1(text,integer,text,boolean) to anon, authenticated;
