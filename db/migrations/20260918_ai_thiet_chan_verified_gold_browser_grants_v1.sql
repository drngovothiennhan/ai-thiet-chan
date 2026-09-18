-- A.I Thiệt Chẩn — browser-admin grant correction for verified gold v1
-- Admin Center uses the publishable key (anon/authenticated) and each RPC validates the admin token internally.

grant execute on function public.ai_thiet_chan_admin_list_verified_clinical_contributions_v1(text,integer) to anon, authenticated;
grant execute on function public.ai_thiet_chan_admin_review_verified_clinical_contribution_v1(text,uuid,text,text) to anon, authenticated;
grant execute on function public.ai_thiet_chan_admin_gold_progress_v2(text) to anon, authenticated;
grant execute on function public.ai_thiet_chan_admin_list_verified_gold_experts_v1(text) to anon, authenticated;
grant execute on function public.ai_thiet_chan_admin_create_verified_adjudicator_session_v1(text,text,integer) to anon, authenticated;
grant execute on function public.ai_thiet_chan_admin_ml_training_status_v3(text) to anon, authenticated;
