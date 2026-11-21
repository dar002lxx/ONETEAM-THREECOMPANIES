begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
create table public.members (
 id uuid primary key references auth.users(id) on delete cascade,
 worker_id text not null unique check(worker_id ~ '^[a-z][a-z0-9._-]{2,39}$'),
 name text not null check(length(name) between 1 and 100),
 company text not null check(company in ('deed','sks','japan')),
 role text not null default 'worker' check(role in ('admin','worker')),
 phone text not null default '', email text not null default '', nickname text not null default '', birthday date,
 photo text not null default '', created_at timestamptz not null default now()
);
create table private.directory (
 email text primary key, worker_id text not null unique, name text not null,
 company text not null check(company in ('deed','sks','japan')),
 role text not null default 'worker' check(role in ('admin','worker'))
);
alter table private.directory enable row level security;
-- Enroll the designated administrator in private.directory through a private server operation.
create function private.is_member() returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from public.members where id=(select auth.uid()))
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null and exists(select 1 from public.members where id=(select auth.uid()) and role='admin')
$$;
revoke all on function private.is_member(),private.is_admin() from public,anon;
grant execute on function private.is_member(),private.is_admin() to authenticated;
create function private.enroll_member() returns trigger language plpgsql security definer set search_path='' as $$
declare d private.directory;
begin
 select * into d from private.directory where email=lower(new.email);
 if d.email is null then raise exception 'Registration requires an administrator-created account'; end if;
 insert into public.members(id,worker_id,name,company,role,email) values(new.id,d.worker_id,d.name,d.company,d.role,d.email);
 return new;
end $$;
revoke all on function private.enroll_member() from public,anon,authenticated;
create trigger on_workspace_signup after insert on auth.users for each row execute function private.enroll_member();
alter table public.members enable row level security;
create policy members_read on public.members for select to authenticated using(private.is_member());
create policy members_self_edit on public.members for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
revoke all on public.members from anon,authenticated;
grant select on public.members to authenticated;
grant update(name,phone,email,nickname,birthday,photo) on public.members to authenticated;
grant all on public.members,private.directory to service_role;
create table public.chat_channels (
 name text primary key check(length(name) between 1 and 40 and left(name,1)<>'@'),
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
insert into public.chat_channels(name) values ('Бүгд'),('Борлуулалт'),('Логистик');
alter table public.chat_channels enable row level security;
create policy channels_read on public.chat_channels for select to authenticated using(private.is_member());
create policy channels_insert on public.chat_channels for insert to authenticated with check(private.is_member() and created_by=(select auth.uid()));
grant select,insert on public.chat_channels to authenticated;
revoke all on public.chat_channels from anon;
create table public.chat_messages (
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null references public.members(id),
 recipient_id uuid references public.members(id),
 channel text references public.chat_channels(name),
 body text not null default '' check(length(body)<=3000),
 attachments jsonb not null default '[]' check(jsonb_typeof(attachments)='array' and jsonb_array_length(attachments)<=8),
 reply jsonb,
 created_at timestamptz not null default now(),
 check((recipient_id is null) <> (channel is null)),
 check(recipient_id is null or recipient_id<>sender_id),
 check(length(trim(body))>0 or jsonb_array_length(attachments)>0)
);
create index chat_messages_sender_idx on public.chat_messages(sender_id);
create index chat_messages_recipient_idx on public.chat_messages(recipient_id,created_at desc);
create index chat_messages_channel_idx on public.chat_messages(channel,created_at desc);
alter table public.chat_messages enable row level security;
create policy messages_read on public.chat_messages for select to authenticated using(private.is_member() and (recipient_id is null or sender_id=(select auth.uid()) or recipient_id=(select auth.uid())));
create policy messages_send on public.chat_messages for insert to authenticated with check(private.is_member() and sender_id=(select auth.uid()));
grant select,insert on public.chat_messages to authenticated;
revoke all on public.chat_messages from anon;
alter publication supabase_realtime add table public.chat_messages,public.members,public.chat_channels;
insert into storage.buckets(id,name,public,file_size_limit) values('chat-media','chat-media',false,10485760);
create policy chat_media_insert on storage.objects for insert to authenticated with check(bucket_id='chat-media' and private.is_member() and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy chat_media_read on storage.objects for select to authenticated using(bucket_id='chat-media' and private.is_member() and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.chat_messages m where m.attachments @> jsonb_build_array(jsonb_build_object('path',name)))));
create policy chat_media_delete on storage.objects for delete to authenticated using(bucket_id='chat-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;

