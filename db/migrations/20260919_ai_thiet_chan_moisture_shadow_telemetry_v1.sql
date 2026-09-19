alter table public.ai_thiet_chan_vision_shadow_events_v2
  add column if not exists candidate_moisture_label text,
  add column if not exists candidate_moisture_gloss_ratio double precision check (candidate_moisture_gloss_ratio is null or candidate_moisture_gloss_ratio between 0 and 1),
  add column if not exists candidate_moisture_strict_gloss_ratio double precision check (candidate_moisture_strict_gloss_ratio is null or candidate_moisture_strict_gloss_ratio between 0 and 1),
  add column if not exists candidate_moisture_distributed_gloss_ratio double precision check (candidate_moisture_distributed_gloss_ratio is null or candidate_moisture_distributed_gloss_ratio between 0 and 1),
  add column if not exists candidate_moisture_largest_gloss_component_ratio double precision check (candidate_moisture_largest_gloss_component_ratio is null or candidate_moisture_largest_gloss_component_ratio between 0 and 1),
  add column if not exists candidate_moisture_roughness double precision check (candidate_moisture_roughness is null or candidate_moisture_roughness between 0 and 1),
  add column if not exists candidate_moisture_overexposed_ratio double precision check (candidate_moisture_overexposed_ratio is null or candidate_moisture_overexposed_ratio between 0 and 1),
  add column if not exists candidate_moisture_sampled_pixels integer check (candidate_moisture_sampled_pixels is null or candidate_moisture_sampled_pixels between 0 and 1000000);

create or replace function public.ai_thiet_chan_vision_shadow_record_v2(p_event jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id bigint;
begin
  if p_event is null or jsonb_typeof(p_event) <> 'object' then
    raise exception 'INVALID_VISION_SHADOW_EVENT';
  end if;

  insert into public.ai_thiet_chan_vision_shadow_events_v2(
    event_schema,model_id,model_sha256,shadow_status,runtime_version,feature_version,
    assessment_mode,device_class,hardware_tier,hardware_cores,hardware_memory,connection_class,
    latency_ms,baseline_roi_coverage,candidate_roi_coverage,coverage_delta,
    qc_glare_ratio,qc_flash_risk_score,qc_sharpness_proxy,
    baseline_top_color,candidate_top_color,top_color_agreement,baseline_top_fissure,
    candidate_median_sulcus_score,candidate_fissure_score,candidate_moisture_score,candidate_moisture_reliability,
    candidate_moisture_label,candidate_moisture_gloss_ratio,candidate_moisture_strict_gloss_ratio,
    candidate_moisture_distributed_gloss_ratio,candidate_moisture_largest_gloss_component_ratio,
    candidate_moisture_roughness,candidate_moisture_overexposed_ratio,candidate_moisture_sampled_pixels,
    baseline_bottom_vessel_ratio,candidate_bottom_vessel_ratio,candidate_bottom_vessel_visibility_score,
    baseline_bottom_dark_purple_ratio,candidate_bottom_dark_purple_ratio,candidate_bottom_vessel_balance,
    clinical_gold,production_eligible,authority,pipeline_impact
  ) values (
    left(coalesce(p_event->>'eventSchema','aitc-vision-shadow-v2'),80),
    nullif(left(coalesce(p_event->>'modelId',''),120),''),
    nullif(left(coalesce(p_event->>'modelSha256',''),64),''),
    nullif(left(coalesce(p_event->>'shadowStatus',''),60),''),
    nullif(left(coalesce(p_event->>'runtimeVersion',''),80),''),
    nullif(left(coalesce(p_event->>'shadowFeatureVersion',''),80),''),
    case when p_event->>'mode'='general' then 'general' else 'normal' end,
    nullif(left(coalesce(p_event->>'deviceClass',''),40),''),
    nullif(left(coalesce(p_event->>'hardwareTier',''),24),''),
    nullif(left(coalesce(p_event->>'hardwareCores',''),24),''),
    nullif(left(coalesce(p_event->>'hardwareMemory',''),24),''),
    nullif(left(coalesce(p_event->>'connectionClass',''),24),''),
    case when nullif(p_event->>'latencyMs','') is null then null else least(120000,greatest(0,(p_event->>'latencyMs')::integer)) end,
    case when nullif(p_event->>'baselineCoverage','') is null then null else least(1,greatest(0,(p_event->>'baselineCoverage')::double precision)) end,
    case when nullif(p_event->>'shadowCoverage','') is null then null else least(1,greatest(0,(p_event->>'shadowCoverage')::double precision)) end,
    case when nullif(p_event->>'coverageDelta','') is null then null else least(1,greatest(-1,(p_event->>'coverageDelta')::double precision)) end,
    case when nullif(p_event->>'qcGlareRatio','') is null then null else least(1,greatest(0,(p_event->>'qcGlareRatio')::double precision)) end,
    case when nullif(p_event->>'qcFlashRiskScore','') is null then null else least(1,greatest(0,(p_event->>'qcFlashRiskScore')::double precision)) end,
    case when nullif(p_event->>'qcSharpnessProxy','') is null then null else least(1,greatest(0,(p_event->>'qcSharpnessProxy')::double precision)) end,
    nullif(left(coalesce(p_event->>'baselineTopColor',''),40),''),
    nullif(left(coalesce(p_event->>'topColorCandidate',''),40),''),
    case when p_event ? 'topColorAgreement' then (p_event->>'topColorAgreement')::boolean else null end,
    case when p_event ? 'baselineTopFissure' then (p_event->>'baselineTopFissure')::boolean else null end,
    case when nullif(p_event->>'topMedianSulcusScore','') is null then null else least(1,greatest(0,(p_event->>'topMedianSulcusScore')::double precision)) end,
    case when nullif(p_event->>'topFissureCandidateScore','') is null then null else least(1,greatest(0,(p_event->>'topFissureCandidateScore')::double precision)) end,
    case when nullif(p_event->>'topMoistureProxyScore','') is null then null else least(1,greatest(0,(p_event->>'topMoistureProxyScore')::double precision)) end,
    case when nullif(p_event->>'topMoistureReliability','') is null then null else least(1,greatest(0,(p_event->>'topMoistureReliability')::double precision)) end,
    nullif(left(coalesce(p_event->>'topMoistureLabelCandidate',''),24),''),
    case when nullif(p_event->>'topMoistureGlossRatio','') is null then null else least(1,greatest(0,(p_event->>'topMoistureGlossRatio')::double precision)) end,
    case when nullif(p_event->>'topMoistureStrictGlossRatio','') is null then null else least(1,greatest(0,(p_event->>'topMoistureStrictGlossRatio')::double precision)) end,
    case when nullif(p_event->>'topMoistureDistributedGlossRatio','') is null then null else least(1,greatest(0,(p_event->>'topMoistureDistributedGlossRatio')::double precision)) end,
    case when nullif(p_event->>'topMoistureLargestGlossComponentRatio','') is null then null else least(1,greatest(0,(p_event->>'topMoistureLargestGlossComponentRatio')::double precision)) end,
    case when nullif(p_event->>'topMoistureRoughness','') is null then null else least(1,greatest(0,(p_event->>'topMoistureRoughness')::double precision)) end,
    case when nullif(p_event->>'topMoistureOverexposedRatio','') is null then null else least(1,greatest(0,(p_event->>'topMoistureOverexposedRatio')::double precision)) end,
    case when nullif(p_event->>'topMoistureSampledPixels','') is null then null else least(1000000,greatest(0,(p_event->>'topMoistureSampledPixels')::integer)) end,
    case when nullif(p_event->>'baselineBottomVesselCandidateRatio','') is null then null else least(1,greatest(0,(p_event->>'baselineBottomVesselCandidateRatio')::double precision)) end,
    case when nullif(p_event->>'bottomVesselCandidateRatio','') is null then null else least(1,greatest(0,(p_event->>'bottomVesselCandidateRatio')::double precision)) end,
    case when nullif(p_event->>'bottomVesselVisibilityScore','') is null then null else least(1,greatest(0,(p_event->>'bottomVesselVisibilityScore')::double precision)) end,
    case when nullif(p_event->>'baselineBottomDarkPurpleRatio','') is null then null else least(1,greatest(0,(p_event->>'baselineBottomDarkPurpleRatio')::double precision)) end,
    case when nullif(p_event->>'bottomDarkPurpleRatio','') is null then null else least(1,greatest(0,(p_event->>'bottomDarkPurpleRatio')::double precision)) end,
    case when nullif(p_event->>'bottomVesselBalance','') is null then null else least(1,greatest(0,(p_event->>'bottomVesselBalance')::double precision)) end,
    false,false,false,
    left(coalesce(p_event->>'pipelineImpact','none-fire-and-forget-after-response'),80)
  )
  returning id into v_id;

  return jsonb_build_object('ok',true,'id',v_id);
exception
  when invalid_text_representation then
    raise exception 'INVALID_VISION_SHADOW_VALUE';
end;
$function$;
