-- A.I Thiệt Chẩn full disaster-recovery backup contract v3.
-- Captures all A.I Thiệt Chẩn public/private data rows, including raw images,
-- full analysis, ML samples, feature vectors, benchmark data, config and access data.

alter table public.ai_thiet_chan_backups
  add column if not exists schema_version text not null default 'ai-thiet-chan-backup-v1',
  add column if not exists checksum_sha256 text,
  add column if not exists verified_at timestamptz,
  add column if not exists verification jsonb not null default '{}'::jsonb;

create or replace function public.ai_thiet_chan_collect_full_snapshot_v3(p_source_commit text default '')
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','extensions','pg_temp'
as $$
declare
  r record;
  v_rows jsonb;
  v_public jsonb := '{}'::jsonb;
  v_private jsonb := '{}'::jsonb;
  v_counts jsonb := '{}'::jsonb;
  v_cols jsonb := '{}'::jsonb;
  v_count bigint;
begin
  for r in
    select table_schema, table_name
    from information_schema.tables
    where (table_schema='public' and left(table_name,14)='ai_thiet_chan_' and table_name <> 'ai_thiet_chan_backups')
       or (table_schema='private' and left(table_name,14)='ai_thiet_chan_')
    order by table_schema, table_name
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb), count(*) from %I.%I t', r.table_schema, r.table_name)
      into v_rows, v_count;
    if r.table_schema='public' then
      v_public := v_public || jsonb_build_object(r.table_name, v_rows);
    else
      v_private := v_private || jsonb_build_object(r.table_name, v_rows);
    end if;
    v_counts := v_counts || jsonb_build_object(r.table_schema||'.'||r.table_name, v_count);
    v_cols := v_cols || jsonb_build_object(
      r.table_schema||'.'||r.table_name,
      coalesce((select jsonb_agg(c.column_name order by c.ordinal_position)
                from information_schema.columns c
                where c.table_schema=r.table_schema and c.table_name=r.table_name),'[]'::jsonb)
    );
  end loop;

  return jsonb_build_object(
    'schemaVersion','ai-thiet-chan-full-backup-v3',
    'createdAt',now(),
    'project','A.I Thiệt Chẩn',
    'projectRef','gzmpnsrwqjpsbklyflqr',
    'sourceRepository','drngovothiennhan/ai-thiet-chan',
    'sourceCommit',coalesce(p_source_commit,''),
    'coverage',jsonb_build_object(
      'rawImagesIncluded',true,
      'mlSamplesIncluded',true,
      'analysisIncluded',true,
      'featureVectorsIncluded',true,
      'feedbackIncluded',true,
      'learnedKnowledgeIncluded',true,
      'benchmarkIncluded',true,
      'configurationIncluded',true,
      'accessControlIncluded',true
    ),
    'tableCounts',v_counts,
    'tableColumns',v_cols,
    'public',v_public,
    'private',v_private
  );
end;
$$;
revoke all on function public.ai_thiet_chan_collect_full_snapshot_v3(text) from public, anon, authenticated;

create or replace function public.ai_thiet_chan_system_create_full_backup_v3(
  p_source text default 'system-full-backup',
  p_label text default '',
  p_source_commit text default '',
  p_drive_file_id text default '',
  p_drive_web_view_link text default ''
)
returns uuid
language plpgsql
security definer
set search_path to 'public','private','extensions','pg_temp'
as $$
declare
  v_snapshot jsonb;
  v_id uuid;
  v_checksum text;
  v_cases int;
  v_feedback int;
  v_learned int;
begin
  v_snapshot := public.ai_thiet_chan_collect_full_snapshot_v3(p_source_commit);
  v_checksum := encode(extensions.digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),'hex');
  select count(*) into v_cases from public.ai_thiet_chan_cases;
  select count(*) into v_feedback from public.ai_thiet_chan_feedback;
  select count(*) into v_learned from public.ai_thiet_chan_learned_knowledge;
  insert into public.ai_thiet_chan_backups(
    source,label,snapshot,case_count,feedback_count,learned_count,
    drive_file_id,drive_web_view_link,schema_version,checksum_sha256,verification
  ) values(
    left(coalesce(p_source,'system-full-backup'),80),left(coalesce(p_label,''),240),v_snapshot,
    v_cases,v_feedback,v_learned,left(coalesce(p_drive_file_id,''),300),left(coalesce(p_drive_web_view_link,''),1000),
    'ai-thiet-chan-full-backup-v3',v_checksum,
    jsonb_build_object('databaseSnapshotCreated',true,'driveUploaded',false,'checksumVerified',false)
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.ai_thiet_chan_system_create_full_backup_v3(text,text,text,text,text) from public, anon, authenticated;

create or replace function public.ai_thiet_chan_system_export_full_backup_text_v3(p_backup_id uuid)
returns text
language sql
security definer
set search_path to 'public','pg_temp'
as $$
  select snapshot::text from public.ai_thiet_chan_backups
  where id=p_backup_id and schema_version='ai-thiet-chan-full-backup-v3';
$$;
revoke all on function public.ai_thiet_chan_system_export_full_backup_text_v3(uuid) from public, anon, authenticated;
grant execute on function public.ai_thiet_chan_system_export_full_backup_text_v3(uuid) to service_role;

create or replace function public.ai_thiet_chan_system_backup_status_v3(p_backup_id uuid)
returns jsonb
language sql
security definer
set search_path to 'public','pg_temp'
as $$
  select jsonb_build_object(
    'id',id,'createdAt',created_at,'schemaVersion',schema_version,'checksumSha256',checksum_sha256,
    'caseCount',case_count,'feedbackCount',feedback_count,'learnedCount',learned_count,
    'driveFileId',drive_file_id,'driveWebViewLink',drive_web_view_link,
    'verifiedAt',verified_at,'verification',verification,
    'snapshotBytes',octet_length(snapshot::text),
    'tableCounts',snapshot->'tableCounts','coverage',snapshot->'coverage'
  )
  from public.ai_thiet_chan_backups where id=p_backup_id;
$$;
revoke all on function public.ai_thiet_chan_system_backup_status_v3(uuid) from public, anon, authenticated;

grant select on public.ai_thiet_chan_backups to service_role;
grant select on public.ai_thiet_chan_config to service_role;

create or replace function public.ai_thiet_chan_system_mark_encrypted_drive_verified_v3(
  p_backup_id uuid,
  p_drive_file_id text,
  p_drive_web_view_link text,
  p_recovery_key_drive_file_id text,
  p_plaintext_sha256 text,
  p_encrypted_sha256 text,
  p_encrypted_md5 text,
  p_encrypted_bytes bigint,
  p_recovery_key_sha256 text
)
returns boolean
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare v_expected text;
begin
  select checksum_sha256 into v_expected from public.ai_thiet_chan_backups where id=p_backup_id;
  if v_expected is null or v_expected <> lower(coalesce(p_plaintext_sha256,'')) then raise exception 'plaintext_checksum_mismatch'; end if;
  if coalesce(p_drive_file_id,'')='' or coalesce(p_recovery_key_drive_file_id,'')='' then raise exception 'drive_artifacts_required'; end if;
  update public.ai_thiet_chan_backups
  set drive_file_id=left(p_drive_file_id,300),
      drive_web_view_link=left(coalesce(p_drive_web_view_link,''),1000),
      verified_at=now(),
      verification=jsonb_build_object(
        'databaseSnapshotCreated',true,'driveUploaded',true,'checksumVerified',true,
        'transportEncrypted',true,'encryption','AES-256-GCM',
        'plaintextSha256',v_expected,'encryptedSha256',lower(p_encrypted_sha256),
        'encryptedMd5',lower(p_encrypted_md5),'encryptedBytes',p_encrypted_bytes,
        'driveFileId',p_drive_file_id,'recoveryKeyDriveFileId',p_recovery_key_drive_file_id,
        'recoveryKeySha256',lower(p_recovery_key_sha256),'verifiedAt',now(),
        'verificationMethod','Drive redownload byte-size + MD5 + SHA-256; AES-GCM decrypt + plaintext SHA-256 + JSON/table-count validation'
      )
  where id=p_backup_id;
  return found;
end;
$$;
revoke all on function public.ai_thiet_chan_system_mark_encrypted_drive_verified_v3(uuid,text,text,text,text,text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.ai_thiet_chan_system_mark_encrypted_drive_verified_v3(uuid,text,text,text,text,text,text,bigint,text) to service_role;
