-- A.I Thiệt Chẩn — structured morphology labels v1
-- Collect expert/adjudicated morphology needed for future dedicated local models.
-- Median sulcus is explicitly distinct from fissure; no depth label is collected from 2D images.

create or replace function public.ai_thiet_chan_validate_morphology_label_v1(p_annotation jsonb)
returns void
language plpgsql immutable
set search_path to 'public','pg_temp'
as $function$
declare
  m jsonb;
  v text;
begin
  if jsonb_typeof(coalesce(p_annotation,'null'::jsonb)) <> 'object' then raise exception 'annotation_object_required'; end if;
  if coalesce((p_annotation->>'tongue_present')::boolean,false) is not true then return; end if;

  m:=p_annotation->'morphology';
  if jsonb_typeof(m) <> 'object' then raise exception 'morphology_object_required_when_tongue_present'; end if;
  if coalesce(m->>'schemaVersion','') <> 'tongue-morphology-label-v1' then raise exception 'morphology_schema_invalid'; end if;

  v:=coalesce(m#>>'{medianSulcus,prominence}','');
  if v not in ('none','mild','prominent','uncertain','not_visible') then raise exception 'median_sulcus_prominence_invalid'; end if;

  v:=coalesce(m#>>'{fissure,visualStatus}','');
  if v not in ('absent','possible','present','uncertain') then raise exception 'fissure_visual_status_invalid'; end if;

  v:=coalesce(m#>>'{fissure,branching}','');
  if v not in ('absent','present','uncertain','not_applicable') then raise exception 'fissure_branching_invalid'; end if;

  v:=coalesce(m#>>'{fissure,pattern}','');
  if v not in ('midline_only','branched','multiple','network','other','uncertain','not_applicable') then raise exception 'fissure_pattern_invalid'; end if;

  v:=coalesce(m#>>'{toothmarks,status}','');
  if v not in ('absent','present','uncertain') then raise exception 'toothmarks_status_invalid'; end if;

  v:=coalesce(m#>>'{bodyShape,status}','');
  if v not in ('normal','swollen','thin','uncertain') then raise exception 'body_shape_status_invalid'; end if;

  if coalesce(m#>>'{fissure,depth}','') <> 'not_collected_from_2d' then raise exception 'fissure_depth_must_not_be_inferred_from_2d'; end if;
end;
$function$;

create or replace function public.ai_thiet_chan_verified_contribution_morphology_guard_v1()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  perform public.ai_thiet_chan_validate_morphology_label_v1(new.annotation);
  return new;
end;
$function$;

drop trigger if exists ai_thiet_chan_verified_contribution_morphology_guard_v1
on public.ai_thiet_chan_verified_clinical_contributions_v1;
create trigger ai_thiet_chan_verified_contribution_morphology_guard_v1
before insert or update of annotation
on public.ai_thiet_chan_verified_clinical_contributions_v1
for each row execute function public.ai_thiet_chan_verified_contribution_morphology_guard_v1();

create or replace function public.ai_thiet_chan_gold_adjudication_morphology_guard_v1()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  perform public.ai_thiet_chan_validate_morphology_label_v1(new.final_annotation);
  return new;
end;
$function$;

drop trigger if exists ai_thiet_chan_gold_adjudication_morphology_guard_v1
on public.ai_thiet_chan_gold_adjudications_v1;
create trigger ai_thiet_chan_gold_adjudication_morphology_guard_v1
before insert or update of final_annotation
on public.ai_thiet_chan_gold_adjudications_v1
for each row execute function public.ai_thiet_chan_gold_adjudication_morphology_guard_v1();

revoke all on function public.ai_thiet_chan_validate_morphology_label_v1(jsonb) from public, anon, authenticated;
