-- Photo Booth: whether guests choose their own stickers before the photos (the old way) or the booth skips that step and puts every sticker of the booth on every picture where the host placed it (faster).
alter table public.photobooths add column if not exists guest_stickers boolean not null default false;
