-- A.I Thiệt Chẩn — silver textbook teacher lane registry v1
-- Registry metadata only. It does not convert textbook-derived weak labels into clinical gold.

insert into public.ai_thiet_chan_ml_dataset_versions(
  dataset_version,manifest_sha256,training_ready_count,train_count,validation_count,test_count,
  source_schema,provenance,locked,created_by
) values(
  'silver-textbook-teacher-v1',
  '2dddfc1d3ceb058610d415abdda062d8b186adee58160fba37cc13207a69dc4b',
  0,337,60,82,
  'aitc-silver-textbook-teacher-v1',
  jsonb_build_object(
    'sourceDataset','aitc-stage2-bootstrap-479-v1',
    'sourceType','owner-provided teaching textbooks',
    'sampleCount',479,
    'goldEligible',false,
    'holdoutEligible',false,
    'promotionEligible',false,
    'clinicalAccuracyEligible',false,
    'allowedUses',jsonb_build_array('bootstrap-training','pretraining','regression','ablation','annotation-tool-QA','shadow-candidate-development'),
    'forbiddenUses',jsonb_build_array('gold-ground-truth','clinical-accuracy-claim','gold-holdout','automatic-promotion','production-activation')
  ),
  true,'stage2-silver-lane'
)
on conflict(dataset_version) do update set
  provenance=excluded.provenance,
  locked=true;
