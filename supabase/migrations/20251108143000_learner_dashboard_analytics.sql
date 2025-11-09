-- Learner Dashboard Analytics Foundation
-- Tables: learner_progress, course_enrollments, learning_streaks, learner_achievements
-- Triggers: rollups for streaks and enrollment status, title generation handled elsewhere
-- Indexes: optimized for common analytical queries

begin;

-- 1) learner_progress: granular progress records per user/course/video
create table if not exists public.learner_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  video_id uuid references public.videos(id) on delete set null,
  status text not null check (status in ('not_started','in_progress','completed')),
  score numeric(5,2),
  time_spent_seconds integer default 0 check (time_spent_seconds >= 0),
  started_at timestamptz default now(),
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, course_id, video_id)
);

create index if not exists idx_learner_progress_user on public.learner_progress(user_id);
create index if not exists idx_learner_progress_course on public.learner_progress(course_id);
create index if not exists idx_learner_progress_updated_at on public.learner_progress(updated_at);

-- 2) course_enrollments: track enrollment lifecycle statuses for analytics (distinct from transactional enrollments)
create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  current_status text not null check (current_status in ('enrolled','dropped','completed')),
  status_changed_at timestamptz default now(),
  enrolled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, course_id)
);

create index if not exists idx_course_enrollments_user on public.course_enrollments(user_id);
create index if not exists idx_course_enrollments_course on public.course_enrollments(course_id);
create index if not exists idx_course_enrollments_status on public.course_enrollments(current_status);

-- 3) learning_streaks: track consecutive learning days per user
create table if not exists public.learning_streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id)
);

create index if not exists idx_learning_streaks_user on public.learning_streaks(user_id);

-- 4) learner_achievements: badges/certificates/milestones
create table if not exists public.learner_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  type text not null,
  title text not null,
  description text,
  icon text,
  achieved_at timestamptz not null default now(),
  created_at timestamptz default now()
);

create index if not exists idx_learner_achievements_user on public.learner_achievements(user_id);
create index if not exists idx_learner_achievements_course on public.learner_achievements(course_id);

-- Trigger helpers
create or replace function public.fn_touch_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end; $$ language plpgsql;

-- Update updated_at on changes
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_learner_progress_touch') then
    create trigger trg_learner_progress_touch before update on public.learner_progress
      for each row execute function public.fn_touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_course_enrollments_touch') then
    create trigger trg_course_enrollments_touch before update on public.course_enrollments
      for each row execute function public.fn_touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_learning_streaks_touch') then
    create trigger trg_learning_streaks_touch before update on public.learning_streaks
      for each row execute function public.fn_touch_updated_at();
  end if;
end $$;

-- Rollup: update streaks when progress recorded
create or replace function public.fn_update_streak_on_progress() returns trigger as $$
declare d date;
begin
  d := coalesce(new.created_at::date, now()::date);
  insert into public.learning_streaks(user_id, current_streak, longest_streak, last_active_date)
    values (new.user_id, 1, 1, d)
  on conflict (user_id) do update set
    current_streak = case
      when public.learning_streaks.last_active_date is null then 1
      when public.learning_streaks.last_active_date = d then public.learning_streaks.current_streak
      when public.learning_streaks.last_active_date + 1 = d then public.learning_streaks.current_streak + 1
      else 1
    end,
    longest_streak = greatest(public.learning_streaks.longest_streak,
      case
        when public.learning_streaks.last_active_date is null then 1
        when public.learning_streaks.last_active_date = d then public.learning_streaks.current_streak
        when public.learning_streaks.last_active_date + 1 = d then public.learning_streaks.current_streak + 1
        else public.learning_streaks.longest_streak
      end),
    last_active_date = greatest(public.learning_streaks.last_active_date, d),
    updated_at = now();
  return new;
end; $$ language plpgsql;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_update_streak_on_progress') then
    create trigger trg_update_streak_on_progress
    after insert on public.learner_progress
    for each row execute function public.fn_update_streak_on_progress();
  end if;
end $$;

-- Rollup: maintain course_enrollments current_status based on progress
create or replace function public.fn_sync_enrollment_status() returns trigger as $$
begin
  insert into public.course_enrollments(user_id, course_id, current_status, enrolled_at)
    values (new.user_id, new.course_id, 'enrolled', new.started_at)
  on conflict (user_id, course_id) do update set
    current_status = case when new.status = 'completed' then 'completed' else 'enrolled' end,
    completed_at = case when new.status = 'completed' then coalesce(new.completed_at, now()) else public.course_enrollments.completed_at end,
    status_changed_at = now(),
    updated_at = now();
  return new;
end; $$ language plpgsql;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_sync_enrollment_status') then
    create trigger trg_sync_enrollment_status
    after insert or update on public.learner_progress
    for each row execute function public.fn_sync_enrollment_status();
  end if;
end $$;

-- Optional: basic achievement on course completion
create or replace function public.fn_award_completion_badge() returns trigger as $$
begin
  if new.status = 'completed' then
    insert into public.learner_achievements(user_id, course_id, type, title, description, icon, achieved_at)
    values (new.user_id, new.course_id, 'badge', 'Course Completed', 'Completed a course', 'award', now())
    on conflict do nothing;
  end if;
  return new;
end; $$ language plpgsql;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_award_completion_badge') then
    create trigger trg_award_completion_badge
    after insert or update on public.learner_progress
    for each row execute function public.fn_award_completion_badge();
  end if;
end $$;

-- RLS policies
alter table public.learner_progress enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.learning_streaks enable row level security;
alter table public.learner_achievements enable row level security;

do $$ begin
  -- learner_progress policies
  if not exists (select 1 from pg_policy p join pg_class c on p.polrelid = c.oid where c.relname = 'learner_progress' and p.polname = 'select_own_learner_progress') then
    create policy select_own_learner_progress on public.learner_progress for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policy p join pg_class c on p.polrelid = c.oid where c.relname = 'learner_progress' and p.polname = 'insert_own_learner_progress') then
    create policy insert_own_learner_progress on public.learner_progress for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policy p join pg_class c on p.polrelid = c.oid where c.relname = 'learner_progress' and p.polname = 'update_own_learner_progress') then
    create policy update_own_learner_progress on public.learner_progress for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  -- course_enrollments policies
  if not exists (select 1 from pg_policy p join pg_class c on p.polrelid = c.oid where c.relname = 'course_enrollments' and p.polname = 'select_own_course_enrollments') then
    create policy select_own_course_enrollments on public.course_enrollments for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policy p join pg_class c on p.polrelid = c.oid where c.relname = 'course_enrollments' and p.polname = 'insert_own_course_enrollments') then
    create policy insert_own_course_enrollments on public.course_enrollments for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policy p join pg_class c on p.polrelid = c.oid where c.relname = 'course_enrollments' and p.polname = 'update_own_course_enrollments') then
    create policy update_own_course_enrollments on public.course_enrollments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  -- learning_streaks policies
  if not exists (select 1 from pg_policy p join pg_class c on p.polrelid = c.oid where c.relname = 'learning_streaks' and p.polname = 'select_own_learning_streaks') then
    create policy select_own_learning_streaks on public.learning_streaks for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policy p join pg_class c on p.polrelid = c.oid where c.relname = 'learning_streaks' and p.polname = 'insert_own_learning_streaks') then
    create policy insert_own_learning_streaks on public.learning_streaks for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policy p join pg_class c on p.polrelid = c.oid where c.relname = 'learning_streaks' and p.polname = 'update_own_learning_streaks') then
    create policy update_own_learning_streaks on public.learning_streaks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  -- learner_achievements policies
  if not exists (select 1 from pg_policy p join pg_class c on p.polrelid = c.oid where c.relname = 'learner_achievements' and p.polname = 'select_own_learner_achievements') then
    create policy select_own_learner_achievements on public.learner_achievements for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policy p join pg_class c on p.polrelid = c.oid where c.relname = 'learner_achievements' and p.polname = 'insert_own_learner_achievements') then
    create policy insert_own_learner_achievements on public.learner_achievements for insert with check (auth.uid() = user_id);
  end if;
end $$;

commit;