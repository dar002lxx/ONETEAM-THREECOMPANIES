begin;
create table public.workspace_items(
 kind text not null check(kind in ('task','board','report','inbox','note','shift','milestone','feedback')),
 id text not null, owner_id uuid not null references public.members(id), company text not null check(company in ('all','deed','sks','japan')),
 body jsonb not null check(jsonb_typeof(body)='object' and octet_length(body::text)<3000000),
 version bigint not null default 1, updated_at timestamptz not null default now(), primary key(kind,id)
);
create index workspace_owner_idx on public.workspace_items(owner_id);
alter table public.workspace_items enable row level security;
create policy items_read on public.workspace_items for select to authenticated using(private.is_member() and (kind<>'note' or owner_id=(select auth.uid())));
create policy items_insert on public.workspace_items for insert to authenticated with check(private.is_member() and (
 private.is_admin() or (owner_id=(select auth.uid()) and kind not in ('shift') and (company=(select company from public.members where id=(select auth.uid())) or kind in ('note','report','feedback','inbox')))));
create policy items_update on public.workspace_items for update to authenticated using(private.is_member() and (private.is_admin() or (owner_id=(select auth.uid()) and kind<>'shift') or (kind='board' and company=(select company from public.members where id=(select auth.uid()))))) with check(private.is_member() and (private.is_admin() or (owner_id=(select auth.uid()) and kind<>'shift') or (kind='board' and company=(select company from public.members where id=(select auth.uid())))));
create policy items_delete on public.workspace_items for delete to authenticated using(private.is_member() and (private.is_admin() or (owner_id=(select auth.uid()) and kind<>'shift')));
create function private.item_revision() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='UPDATE' then
  if new.owner_id<>old.owner_id and not private.is_admin() then raise exception 'Cannot transfer ownership';end if;
  if new.kind<>old.kind or new.id<>old.id then raise exception 'Cannot change identity';end if;
  new.version=old.version+1;
 end if;
 if new.kind in ('task','report','inbox') and new.body->>'owner' is distinct from (select worker_id from public.members where id=new.owner_id) then raise exception 'Invalid item owner';end if;
 if new.kind='milestone' and new.body->>'authorId' is distinct from (select worker_id from public.members where id=new.owner_id) then raise exception 'Invalid milestone author';end if;
 new.updated_at=clock_timestamp();return new;
end $$;
create trigger item_revision before insert or update on public.workspace_items for each row execute function private.item_revision();
alter policy items_update on public.workspace_items with check(private.is_member() and (private.is_admin() or (owner_id=(select auth.uid()) and kind<>'shift' and (company=(select company from public.members where id=(select auth.uid())) or kind in ('note','report','feedback','inbox'))) or (kind='board' and company=(select company from public.members where id=(select auth.uid())))));
grant select,insert,update,delete on public.workspace_items to authenticated;
revoke all on public.workspace_items from anon;
create function public.workspace_save(p_kind text,p_id text,p_body jsonb,p_company text,p_owner text,p_version bigint,p_remove boolean default false) returns public.workspace_items language plpgsql security invoker set search_path='' as $$
declare target uuid;result public.workspace_items;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select id into target from public.members where worker_id=p_owner;
 if target is null then raise exception 'Unknown employee';end if;
 if p_kind in ('task','report','inbox') and p_body->>'owner' is distinct from p_owner then raise exception 'Invalid owner';end if;
 if p_kind='milestone' and p_body->>'authorId' is distinct from p_owner then raise exception 'Invalid author';end if;
 if p_remove then
  delete from public.workspace_items where kind=p_kind and id=p_id and version=p_version returning * into result;
 elsif p_version=0 then
  insert into public.workspace_items(kind,id,owner_id,company,body) values(p_kind,p_id,target,p_company,p_body) returning * into result;
 else
  update public.workspace_items set body=p_body,company=p_company,owner_id=target where kind=p_kind and id=p_id and version=p_version returning * into result;
 end if;
 if result.id is null then raise exception 'CONFLICT: another device changed this item. Refresh and retry.';end if;
 return result;
end $$;
revoke all on function public.workspace_save(text,text,jsonb,text,text,bigint,boolean) from public,anon;
grant execute on function public.workspace_save(text,text,jsonb,text,text,bigint,boolean) to authenticated;

create table public.feed_posts(id text primary key,author_id uuid not null references public.members(id),company text not null check(company in ('all','deed','sks','japan')),title text not null default '' check(length(title)<=200),body text not null default '' check(length(body)<=6000),media jsonb not null default '[]' check(jsonb_typeof(media)='array' and jsonb_array_length(media)<=5),pinned boolean not null default false,created_at timestamptz not null default now());
create index feed_posts_author_idx on public.feed_posts(author_id);
alter table public.feed_posts enable row level security;
create policy posts_read on public.feed_posts for select to authenticated using(private.is_member());
create policy posts_add on public.feed_posts for insert to authenticated with check(private.is_member() and author_id=(select auth.uid()) and private.valid_attachments(media) and (private.is_admin() or (not pinned and company=(select company from public.members where id=(select auth.uid())))));
create policy posts_delete on public.feed_posts for delete to authenticated using(author_id=(select auth.uid()) or private.is_admin());
create table public.feed_likes(post_id text not null references public.feed_posts(id) on delete cascade,owner_id uuid not null references public.members(id),primary key(post_id,owner_id));
alter table public.feed_likes enable row level security;
create policy likes_read on public.feed_likes for select to authenticated using(private.is_member());
create policy likes_add on public.feed_likes for insert to authenticated with check(private.is_member() and owner_id=(select auth.uid()));
create policy likes_remove on public.feed_likes for delete to authenticated using(owner_id=(select auth.uid()));
create index feed_likes_owner_idx on public.feed_likes(owner_id);
create table public.feed_comments(id uuid primary key default gen_random_uuid(),post_id text not null references public.feed_posts(id) on delete cascade,owner_id uuid not null references public.members(id),body text not null check(length(trim(body)) between 1 and 2000),created_at timestamptz not null default now());
create index feed_comments_post_idx on public.feed_comments(post_id);
create index feed_comments_owner_idx on public.feed_comments(owner_id);
alter table public.feed_comments enable row level security;
create policy comments_read on public.feed_comments for select to authenticated using(private.is_member());
create policy comments_add on public.feed_comments for insert to authenticated with check(private.is_member() and owner_id=(select auth.uid()));
create policy comments_remove on public.feed_comments for delete to authenticated using(owner_id=(select auth.uid()) or private.is_admin());
grant select,insert,delete on public.feed_posts,public.feed_likes,public.feed_comments to authenticated;
revoke all on public.feed_posts,public.feed_likes,public.feed_comments from anon;
insert into storage.buckets(id,name,public,file_size_limit) values('feed-media','feed-media',false,52428800);
create policy feed_media_add on storage.objects for insert to authenticated with check(bucket_id='feed-media' and private.is_member() and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy feed_media_read on storage.objects for select to authenticated using(bucket_id='feed-media' and private.is_member() and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.feed_posts p where p.media @> jsonb_build_array(jsonb_build_object('path',name)))));
create policy feed_media_remove on storage.objects for delete to authenticated using(bucket_id='feed-media' and (storage.foldername(name))[1]=(select auth.uid())::text);

create table public.workplace_offices(company text primary key check(company in ('deed','sks','japan')),name text not null,lat double precision not null check(lat between -90 and 90),lng double precision not null check(lng between -180 and 180),radius integer not null default 200 check(radius between 25 and 5000),enforce_gps boolean not null default false);
alter table public.workplace_offices enable row level security;
create policy offices_read on public.workplace_offices for select to authenticated using(private.is_member());
create policy offices_admin on public.workplace_offices for all to authenticated using(private.is_admin()) with check(private.is_admin());
grant select,insert,update,delete on public.workplace_offices to authenticated;
revoke all on public.workplace_offices from anon;
create table public.attendance_logs(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.members(id),company text not null,work_date date not null,clock_in timestamptz not null,clock_out timestamptz,source text not null default 'server',in_location jsonb,out_location jsonb,check(clock_out is null or clock_out>=clock_in));
create unique index attendance_one_open on public.attendance_logs(owner_id) where clock_out is null;
create index attendance_owner_date on public.attendance_logs(owner_id,work_date);
alter table public.attendance_logs enable row level security;
create policy attendance_read on public.attendance_logs for select to authenticated using(owner_id=(select auth.uid()) or private.is_admin());
grant select on public.attendance_logs to authenticated;
revoke all on public.attendance_logs from anon;
create function private.punch(p_action text,p_location jsonb) returns public.attendance_logs language plpgsql security definer set search_path='' as $$
declare me public.members;a public.attendance_logs;o public.workplace_offices;t timestamptz:=clock_timestamp();x double precision;y double precision;accuracy double precision;distance double precision;loc jsonb;
begin
 select * into me from public.members where id=auth.uid();if me.id is null then raise exception 'Sign in required';end if;
 perform pg_advisory_xact_lock(hashtextextended(me.id::text,0));
 select * into a from public.attendance_logs where owner_id=me.id and clock_out is null;
 if p_action not in ('in','out') or (p_action='in' and a.id is not null) or (p_action='out' and a.id is null) then raise exception 'Attendance changed on another device. Refresh and retry.';end if;
 select * into o from public.workplace_offices where company=me.company;
 if p_location is not null then
  x=(p_location->>'lat')::double precision;y=(p_location->>'lng')::double precision;accuracy=(p_location->>'accuracy')::double precision;
  if x is null or y is null or accuracy is null or not(x between -90 and 90) or not(y between -180 and 180) or not(accuracy between 0 and 10000) then raise exception 'Invalid GPS';end if;
  if o.company is not null then distance=6371000*2*asin(least(1,sqrt(power(sin(radians(x-o.lat)/2),2)+cos(radians(x))*cos(radians(o.lat))*power(sin(radians(y-o.lng)/2),2))));end if;
  loc=jsonb_build_object('lat',x,'lng',y,'accuracy',accuracy,'distance',round(distance::numeric),'verified',coalesce(distance+accuracy<=o.radius,false));
 end if;
 if coalesce(o.enforce_gps,false) and (loc is null or not (loc->>'verified')::boolean) then raise exception 'Оффисын GPS хүрээнд, нарийвчлалтай байршлаар дахин оролдоно уу.';end if;
 if p_action='in' then insert into public.attendance_logs(owner_id,company,work_date,clock_in,in_location) values(me.id,me.company,(t at time zone 'Asia/Ulaanbaatar')::date,t,loc) returning * into a;
 else update public.attendance_logs set clock_out=t,out_location=loc where id=a.id returning * into a;end if;
 return a;
end $$;
revoke all on function private.punch(text,jsonb) from public,anon;
grant execute on function private.punch(text,jsonb) to authenticated;
create function public.attendance_punch(p_action text,p_location jsonb default null) returns public.attendance_logs language sql security invoker set search_path='' as $$ select private.punch(p_action,p_location) $$;
revoke all on function public.attendance_punch(text,jsonb) from public,anon;
grant execute on function public.attendance_punch(text,jsonb) to authenticated;
create table public.attendance_requests(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.members(id),company text not null,body jsonb not null,status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),created_at timestamptz not null default now(),reviewed_at timestamptz,reviewed_by uuid references public.members(id),review_note text);
create index requests_owner_idx on public.attendance_requests(owner_id);
create index requests_reviewer_idx on public.attendance_requests(reviewed_by);
alter table public.attendance_requests enable row level security;
create policy requests_read on public.attendance_requests for select to authenticated using(owner_id=(select auth.uid()) or private.is_admin());
create policy requests_add on public.attendance_requests for insert to authenticated with check(private.is_member() and owner_id=(select auth.uid()) and status='pending' and reviewed_by is null and company=(select company from public.members where id=(select auth.uid())));
grant select on public.attendance_requests to authenticated;
grant insert(id,owner_id,company,body) on public.attendance_requests to authenticated;
revoke all on public.attendance_requests from anon;
create function private.review_request(p_id uuid,p_status text,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare r public.attendance_requests;s timestamptz;e timestamptz;
begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 select * into r from public.attendance_requests where id=p_id for update;
 if r.id is null or r.status<>'pending' then raise exception 'Request already reviewed';end if;
 if p_status='cancelled' then if r.owner_id<>auth.uid() then raise exception 'Not your request';end if;
 elsif not private.is_admin() or p_status not in ('approved','rejected') then raise exception 'Administrator required';end if;
 if p_status='rejected' and length(trim(p_note))<3 then raise exception 'Reason required';end if;
 if p_status='approved' and r.body->>'kind'='correction' then
  s=((r.body->>'start')||'T'||(r.body->>'fromTime')||':00+08:00')::timestamptz;e=((r.body->>'end')||'T'||(r.body->>'toTime')||':00+08:00')::timestamptz;
  if s is null or e is null or e<=s or e>now() or e-s>interval '18 hours' then raise exception 'Invalid correction';end if;
  perform pg_advisory_xact_lock(hashtextextended(r.owner_id::text,0));
  if exists(select 1 from public.attendance_logs where owner_id=r.owner_id and (clock_out is null or (clock_in<e and clock_out>s))) then raise exception 'Overlapping attendance';end if;
  insert into public.attendance_logs(owner_id,company,work_date,clock_in,clock_out,source) values(r.owner_id,r.company,(s at time zone 'Asia/Ulaanbaatar')::date,s,e,'approved-correction');
 end if;
 update public.attendance_requests set status=p_status,reviewed_at=clock_timestamp(),reviewed_by=auth.uid(),review_note=left(p_note,1000) where id=p_id;
end $$;
revoke all on function private.review_request(uuid,text,text) from public,anon;
grant execute on function private.review_request(uuid,text,text) to authenticated;
create function public.attendance_review(p_id uuid,p_status text,p_note text default '') returns void language sql security invoker set search_path='' as $$select private.review_request(p_id,p_status,p_note)$$;
revoke all on function public.attendance_review(uuid,text,text) from public,anon;
grant execute on function public.attendance_review(uuid,text,text) to authenticated;
alter publication supabase_realtime add table public.workspace_items,public.feed_posts,public.feed_likes,public.feed_comments,public.workplace_offices,public.attendance_logs,public.attendance_requests;
commit;
