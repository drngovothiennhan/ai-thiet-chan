-- A.I Thiệt Chẩn — unified approved learning retrieval v2
-- Existing admin-approved feedback memory and new verified clinician contributions
-- are both retrievable while model-training remains a separate shadow lane.

create or replace function public.ai_thiet_chan_find_learned_cases_v2(
  p_feature_vector jsonb,
  p_top_image_hash text default '',
  p_bottom_image_hash text default '',
  p_limit integer default 3
)
returns table(
  knowledge_id uuid,
  similarity numeric,
  exact_image_match boolean,
  approved_at timestamptz,
  clinical_note text,
  professional_title text,
  knowledge_revision bigint,
  base_analysis jsonb
)
language sql
security definer
set search_path to 'public','pg_temp'
as $function$
  with legacy as (
    select
      k.id as knowledge_id,
      k.feature_vector,
      k.top_image_hash,
      k.bottom_image_hash,
      k.approved_at,
      k.clinical_note,
      k.professional_title,
      k.knowledge_revision,
      k.base_analysis
    from public.ai_thiet_chan_learned_knowledge k
    where k.active=true
  ),
  verified as (
    select
      x.id as knowledge_id,
      coalesce(c.feature_vector,'{}'::jsonb) as feature_vector,
      x.top_image_hash,
      x.bottom_image_hash,
      x.reviewed_at as approved_at,
      case
        when nullif(trim(coalesce(x.clinical_note,'')),'') is not null then x.clinical_note
        else 'Nhãn cấu trúc đã được Bác sĩ/Y sĩ xác nhận và Admin duyệt.'
      end as clinical_note,
      x.professional_title,
      floor(extract(epoch from coalesce(x.reviewed_at,x.created_at))*1000)::bigint as knowledge_revision,
      jsonb_build_object(
        'source','verified_clinical_contribution_v1',
        'verifiedClinicalAnnotation',x.annotation,
        'verificationBasis',x.verification_basis,
        'professionalAttested',x.professional_attested,
        'adminReviewed',true
      ) as base_analysis
    from public.ai_thiet_chan_verified_clinical_contributions_v1 x
    join public.ai_thiet_chan_cases c on c.id=x.case_id
    where x.status='approved'
  ),
  all_knowledge as (
    select * from legacy
    union all
    select * from verified
  ),
  scored as (
    select k.*,
      public.ai_thiet_chan_feature_similarity_v1(k.feature_vector,p_feature_vector) as feature_similarity,
      (nullif(p_top_image_hash,'') is not null and k.top_image_hash=p_top_image_hash) as exact_top,
      (nullif(p_bottom_image_hash,'') is not null and k.bottom_image_hash=p_bottom_image_hash) as exact_bottom
    from all_knowledge k
  )
  select s.knowledge_id,
    least(1, round(
      (case when s.exact_top then 0.35 else 0 end) +
      (case when s.exact_bottom then 0.10 else 0 end) +
      (case when s.exact_top then 0.55 else 1 end) * s.feature_similarity
    ,4)) as similarity,
    (s.exact_top or s.exact_bottom) as exact_image_match,
    s.approved_at,s.clinical_note,s.professional_title,s.knowledge_revision,s.base_analysis
  from scored s
  where s.exact_top or s.exact_bottom or s.feature_similarity >= 0.45
  order by (s.exact_top or s.exact_bottom) desc,
           least(1,
             (case when s.exact_top then 0.35 else 0 end) +
             (case when s.exact_bottom then 0.10 else 0 end) +
             (case when s.exact_top then 0.55 else 1 end) * s.feature_similarity
           ) desc,
           s.approved_at desc
  limit least(greatest(coalesce(p_limit,3),1),5);
$function$;

revoke all on function public.ai_thiet_chan_find_learned_cases_v2(jsonb,text,text,integer) from public, anon, authenticated;
grant execute on function public.ai_thiet_chan_find_learned_cases_v2(jsonb,text,text,integer) to anon, authenticated;
