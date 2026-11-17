-- Vehicle purchase submissions require an authenticated customer.
-- The function performs its own conversation-ownership checks and should not be callable by anon.
revoke all on function public.submit_vehicle_purchase(uuid, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.submit_vehicle_purchase(uuid, text, text, text, text, text, text, text, text, text) to authenticated;
