-- Flips the public Team page's per-field visibility (bio, year/major,
-- socials, pronouns, email) from opt-out (visible by default) to opt-in
-- (hidden by default) — see isVisible() in src/lib/profile.ts, updated in
-- the same change. Paired with officer now auto-appearing on the board
-- alongside exec/lead (see getBoardMembers.ts): without this reset, every
-- existing profile already has these keys explicitly set to `true` from
-- the original 20260916133915_profile_board_visibility migration's column
-- default, so an officer newly surfaced by that change would show their
-- bio/pronouns/etc. with no chance to have chosen that first.
--
-- Unconditional reset for everyone, not just profiles that still match the
-- old literal default — partial customization (someone who flipped only
-- one of these four fields, leaving the rest at their original true
-- default) can't be told apart from a deliberate all-true choice, so
-- there's no safe finer-grained condition here. Per-field toggles are a
-- fairly obscure setting few people have touched at all.
update public.profiles
set board_visibility = board_visibility || '{"bio":false,"year_major":false,"socials":false,"pronouns":false}'::jsonb;

-- New profiles going forward start fully hidden (beyond the always-on
-- name/picture/title), matching the new opt-in philosophy.
alter table public.profiles
  alter column board_visibility set default
    '{"bio":false,"year_major":false,"socials":false,"pronouns":false,"email":false}'::jsonb;
