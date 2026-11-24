begin;
create function private.valid_workspace_body(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text;x jsonb;t text;
begin
 if jsonb_typeof(v)='object' then
  for k,x in select * from jsonb_each(v) loop
   if k in ('id','boardId','listId','owner','authorId','recipient','date','effective','start','end','time','endTime','fromTime','toTime','breakStart','company') and jsonb_typeof(x)='string' then
    t=x#>>'{}';if length(t)>200 or t !~ '^[a-zA-Z0-9_.:@ -]*$' then return false;end if;
   end if;
   if k in ('color','cover') and jsonb_typeof(x)='string' and (x#>>'{}') !~ '^[#a-zA-Z0-9(),.% -]*$' then return false;end if;
   if k='sticker' and jsonb_typeof(x)='string' and (x#>>'{}') not in ('','⭐','📌','🚗','📞','📦','🎯','💡','🤝') then return false;end if;
   if k='url' and jsonb_typeof(x)='string' and (x#>>'{}') !~ '^https?://' then return false;end if;
   if not private.valid_workspace_body(x) then return false;end if;
  end loop;
 elsif jsonb_typeof(v)='array' then for x in select * from jsonb_array_elements(v) loop if not private.valid_workspace_body(x) then return false;end if;end loop;
 end if;
 return true;
end $$;
revoke all on function private.valid_workspace_body(jsonb) from public,anon;
grant execute on function private.valid_workspace_body(jsonb) to authenticated;
alter table public.workspace_items add constraint workspace_payload_safe check(private.valid_workspace_body(body));
alter table public.workspace_items add constraint workspace_task_numeric check(kind<>'task' or jsonb_typeof(body->'id')='number');
revoke insert on public.feed_posts,public.feed_comments from authenticated;
grant insert(id,author_id,company,title,body,media,pinned) on public.feed_posts to authenticated;
grant insert(id,post_id,owner_id,body) on public.feed_comments to authenticated;
create function private.admin_employee(p_id uuid,p_name text,p_company text) returns void language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Administrator required';end if;
 if length(trim(p_name)) not between 1 and 100 or p_company not in ('deed','sks','japan') then raise exception 'Invalid employee';end if;
 update public.members set name=trim(p_name),company=p_company where id=p_id;
 update private.directory set name=trim(p_name),company=p_company where email=(select lower(email) from auth.users where id=p_id);
end $$;
revoke all on function private.admin_employee(uuid,text,text) from public,anon;
grant execute on function private.admin_employee(uuid,text,text) to authenticated;
create function public.workspace_employee(p_id uuid,p_name text,p_company text) returns void language sql security invoker set search_path='' as $$select private.admin_employee(p_id,p_name,p_company)$$;
revoke all on function public.workspace_employee(uuid,text,text) from public,anon;
grant execute on function public.workspace_employee(uuid,text,text) to authenticated;
create function public.workspace_clock() returns timestamptz language sql security invoker set search_path='' as $$select clock_timestamp()$$;
revoke all on function public.workspace_clock() from public,anon;
grant execute on function public.workspace_clock() to authenticated;
commit;
