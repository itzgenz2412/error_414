-- LPay secure database setup
-- Run this entire script in Supabase Dashboard > SQL Editor.
-- It replaces the unsafe "allow all" policy from the original package.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  active boolean not null default false,
  paystack_ref text unique,
  expires_at timestamptz,
  verified boolean not null default false,
  last_payment_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_transactions (
  reference text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  currency text not null,
  paid_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
alter table public.payment_transactions enable row level security;

-- Remove the unsafe policy if it exists.
drop policy if exists "allow all" on public.subscriptions;

-- Users can only read their own subscription. No client-side writes.
drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription"
on public.subscriptions for select
to authenticated
using (auth.uid() = user_id);

-- No client policies are created for payment_transactions.
-- Only the Edge Function's service-role client can access/write payment records.

-- Atomic payment recording + subscription extension.
create or replace function public.activate_lpay_subscription(
  p_user_id uuid,
  p_email text,
  p_reference text,
  p_amount integer,
  p_currency text,
  p_paid_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_reference text;
  existing_user uuid;
  new_expiry timestamptz;
begin
  if p_amount <> 150000 or p_currency <> 'NGN' then
    raise exception 'Invalid payment amount or currency';
  end if;

  insert into public.payment_transactions(reference,user_id,amount,currency,paid_at)
  values (p_reference,p_user_id,p_amount,p_currency,p_paid_at)
  on conflict (reference) do nothing
  returning reference into inserted_reference;

  if inserted_reference is null then
    select user_id into existing_user
    from public.payment_transactions where reference = p_reference;

    if existing_user is distinct from p_user_id then
      raise exception 'Payment reference has already been used';
    end if;

    select expires_at into new_expiry
    from public.subscriptions where user_id = p_user_id;

    return jsonb_build_object('success', true, 'expires_at', new_expiry, 'already_processed', true);
  end if;

  insert into public.subscriptions(user_id,email,active,paystack_ref,expires_at,verified,last_payment_at)
  values (p_user_id,p_email,true,p_reference,now() + interval '14 days',true,p_paid_at)
  on conflict (user_id) do update set
    email = excluded.email,
    active = true,
    paystack_ref = excluded.paystack_ref,
    expires_at = greatest(coalesce(public.subscriptions.expires_at, now()), now()) + interval '14 days',
    verified = true,
    last_payment_at = excluded.last_payment_at
  returning expires_at into new_expiry;

  return jsonb_build_object('success', true, 'expires_at', new_expiry, 'already_processed', false);
end;
$$;

-- Only the Supabase service role (used inside the Edge Function) may execute this RPC.
revoke all on function public.activate_lpay_subscription(uuid,text,text,integer,text,timestamptz) from public;
revoke all on function public.activate_lpay_subscription(uuid,text,text,integer,text,timestamptz) from anon;
revoke all on function public.activate_lpay_subscription(uuid,text,text,integer,text,timestamptz) from authenticated;
grant execute on function public.activate_lpay_subscription(uuid,text,text,integer,text,timestamptz) to service_role;

-- Do not grant direct client write access to these tables.
revoke insert, update, delete on public.subscriptions from anon, authenticated;
revoke all on public.payment_transactions from anon, authenticated;
