
revoke execute on function public.has_role(uuid, uuid, public.app_role) from public, anon;
revoke execute on function public.is_business_member(uuid, uuid) from public, anon;
revoke execute on function public.is_business_manager(uuid, uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.has_role(uuid, uuid, public.app_role) to authenticated;
grant execute on function public.is_business_member(uuid, uuid) to authenticated;
grant execute on function public.is_business_manager(uuid, uuid) to authenticated;
