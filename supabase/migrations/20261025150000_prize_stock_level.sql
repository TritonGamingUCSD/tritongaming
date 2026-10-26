-- Free prizes (small merch like stickers) are counted loosely: instead of an exact number on hand they have a level. Only used for prizes whose size is counted loosely (a switch on the size).
alter table public.logistics_prizes add column if not exists stock_level text not null default 'plenty' check (stock_level in ('plenty', 'some', 'low', 'out'));

-- The smallest tier is the free small merch (set 2026-10-25); the switch is "Counted Loosely" on a size in the Prizing settings.
update public.logistics_options set meta = coalesce(meta, '{}'::jsonb) || '{"loose": true}'::jsonb where kind = 'prize_size' and value = 'Tiny Prizing';
