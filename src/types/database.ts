export type AppRole = 'ucsd' | 'division' | 'officer' | 'lead' | 'exec' | 'admin' | 'alumni' | 'recruit';
// 'guest' is never stored — it just means zero rows in user_roles.
export type UserRole = 'guest' | AppRole;
export type TicketStatus = 'active' | 'used' | 'cancelled' | 'expired';
export type EventAudience = 'public' | 'ucsd_only';

// 'instagram', 'twitter' (X), and 'tiktok' all get a real inline embed via
// that platform's own oEmbed widget script; 'youtube' embeds via a plain
// iframe (no script needed — YouTube's iframe embed is directly
// addressable by video id); 'discord' has no individual-message embed API
// at all, so it renders as a styled link-out card instead. See
// EventSocialEmbeds.tsx for the actual rendering of each.
export interface ScheduleItem {
  time: string;
  title: string;
  description?: string;
}

export interface EventSponsor {
  name: string;
  logo_url: string;
  url?: string;
}

export interface SocialEmbed {
  type: 'instagram' | 'twitter' | 'tiktok' | 'youtube' | 'discord';
  url: string;
}

// One event/division can have several — a multi-day LAN's day-1/day-2
// albums, or a semester compilation alongside the main one. Order here is
// the display order on the public page, same convention as SocialEmbed[].
export interface PhotoAlbumEntry {
  title: string;
  url: string;
}

export interface DocAttachment {
  name: string;
  url: string;
  kind: 'file' | 'google_album';
}

export type Capability =
  | 'manage_events'
  | 'view_division_members'
  | 'manage_meetings'
  | 'manage_help'
  | 'view_internal_events'
  | 'view_attendance_reports'
  | 'host_internal_events'
  | 'manage_internal_events'
  | 'attend_meetings'
  | 'host_meetings'
  | 'view_events'
  | 'delete_events'
  | 'checkin'
  | 'manage_site_content'
  | 'manage_division'
  | 'manage_divisions_directory'
  | 'view_members'
  | 'view_admin_dashboard'
  | 'manage_roles'
  | 'generate_qr_codes'
  | 'view_docs'
  | 'manage_docs'
  | 'view_photo_albums'
  | 'manage_photo_albums'
  | 'manage_rewards_shop'
  | 'scan_redemptions'
  | 'manage_points';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          display_name: string | null;
          avatar_url: string | null;
          custom_avatar_url: string | null;
          bio: string | null;
          gamer_tag: string | null;
          major: string | null;
          minor: string | null;
          year: string | null;
          class_of: number | null;
          college: string | null;
          pronouns: string | null;
          discord: string | null;
          org_title: string | null;
          show_on_board: boolean;
          social_links: Record<string, string>;
          portfolio_links: Array<{ label: string; url: string }>;
          calendar_token: string;
          game_ids: Array<{ game: string; id: string }>;
          board_visibility: Record<string, boolean>;
          referral_code: string;
          referred_by: string | null;
          leaderboard_anonymous: boolean;
          preferred_email: string | null;
          board_email: string | null;
          board_order: number | null;
          onboarded_at: string | null;
          google_first_name: string | null;
          google_last_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      // Owner-only (and admin-readable) — kept off the publicly readable
      // profiles table on purpose. See 20261002000000_profile_gender_private_drop_birthday.sql.
      profile_private: {
        Row: {
          user_id: string;
          gender: 'Male' | 'Female' | 'Non-binary' | 'Other' | 'Prefer not to say' | null;
          division_interests: string[];
          platforms: string[];
          favorite_games: string | null;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['profile_private']['Row']> & { user_id: string };
        Update: Partial<Database['public']['Tables']['profile_private']['Row']>;
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: AppRole;
          division_id: string | null;
          granted_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_roles']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['user_roles']['Insert']>;
      };
      divisions: {
        Row: {
          id: string;
          slug: string;
          name: string;
          logo_url: string | null;
          discord_url: string | null;
          description: string | null;
          application_url: string | null;
          social_links: Record<string, string>;
          social_embeds: SocialEmbed[];
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['divisions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['divisions']['Insert']>;
      };
      role_change_log: {
        Row: {
          id: string;
          user_id: string;
          changed_by: string | null;
          before: { role: AppRole; division_id: string | null }[];
          after: { role: AppRole; division_id: string | null }[];
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['role_change_log']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['role_change_log']['Insert']>;
      };
      events: {
        Row: {
          id: string;
          slug: string | null;
          title: string;
          name: string | null;
          description: string | null;
          content: string | null;
          location: string | null;
          start_date: string;
          end_date: string | null;
          flyer_url: string | null;
          banner_url: string | null;
          url: string | null;
          max_capacity: number | null;
          is_published: boolean;
          requires_ticket: boolean;
          ticket_price: number;
          audience: EventAudience;
          division_id: string | null;
          photo_albums: PhotoAlbumEntry[];
          post_event_info: string | null;
          venue_address: string | null;
          venue_notes: string | null;
          schedule: ScheduleItem[];
          sponsors: EventSponsor[];
          requires_checkin_form: boolean;
          checkin_food_item: string | null;
          checkin_windows: Array<{ day: string; start: string; end: string }>;
          checkin_form_event_name: string | null;
          // Same shape as checkin_form_settings' own columns (see
          // CheckinFormConfig in src/lib/checkinForm.ts) — null means "use
          // the site-wide default form."
          checkin_form_override: {
            form_url?: string | null;
            entry_event_name?: string | null;
            entry_academic_year?: string | null;
            entry_affiliation?: string | null;
            entry_food_item?: string | null;
            year_mapping?: Array<{ value?: string; label?: string }>;
            affiliation_mapping?: Array<{ value?: string; label?: string }>;
          } | null;
          social_embeds: SocialEmbed[];
          points_value: number;
          is_online: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['events']['Insert']>;
      };
      tickets: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          ticket_code: string;
          status: TicketStatus;
          checked_in_at: string | null;
          checked_in_by: string | null;
          stripe_session_id: string | null;
          created_at: string;
          checkin_form_completed_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['tickets']['Row'], 'id' | 'ticket_code' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['tickets']['Insert']>;
      };
      site_contents: {
        Row: {
          key: string;
          title: string;
          description: string | null;
          content: Record<string, unknown>;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: Database['public']['Tables']['site_contents']['Row'];
        Update: Partial<Database['public']['Tables']['site_contents']['Insert']>;
      };
      sponsors: {
        Row: {
          id: string;
          name: string;
          logo_url: string;
          website_url: string | null;
          tier: 'platinum' | 'gold' | 'silver' | 'bronze';
          is_active: boolean;
          order_index: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['sponsors']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['sponsors']['Insert']>;
      };
      docs: {
        Row: {
          id: string;
          slug: string;
          title: string;
          category_id: string | null;
          parent_id: string | null;
          order_index: number;
          content: string;
          attachments: DocAttachment[];
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['docs']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['docs']['Insert']>;
      };
      doc_categories: {
        Row: {
          id: string;
          name: string;
          order_index: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['doc_categories']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['doc_categories']['Insert']>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          href: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };
      photo_albums: {
        Row: {
          id: string;
          title: string;
          url: string;
          event_id: string | null;
          created_by: string | null;
          created_at: string;
          sort_order: number;
        };
        Insert: Omit<Database['public']['Tables']['photo_albums']['Row'], 'id' | 'created_at' | 'sort_order'> & { sort_order?: number };
        Update: Partial<Database['public']['Tables']['photo_albums']['Insert']>;
      };
      checkin_form_settings: {
        Row: {
          id: number;
          form_url: string | null;
          entry_event_name: string | null;
          entry_academic_year: string | null;
          entry_affiliation: string | null;
          entry_food_item: string | null;
          year_mapping: Array<{ value?: string; label?: string }>;
          affiliation_mapping: Array<{ value?: string; label?: string }>;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['checkin_form_settings']['Row']>;
        Update: Partial<Database['public']['Tables']['checkin_form_settings']['Row']>;
      };
      point_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          type: 'event_checkin' | 'referral_bonus' | 'redemption' | 'admin_adjustment';
          event_id: string | null;
          ticket_id: string | null;
          related_user_id: string | null;
          redemption_id: string | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
          reversed_at: string | null;
          reverses_transaction_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['point_transactions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['point_transactions']['Insert']>;
      };
      reward_items: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          point_cost: number;
          stock: number | null;
          min_tier: string | null;
          active: boolean;
          max_per_user: number | null;
          reward_type: 'physical' | 'digital';
          grants_fast_pass: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['reward_items']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['reward_items']['Insert']>;
      };
      reward_redemptions: {
        Row: {
          id: string;
          user_id: string;
          reward_id: string;
          status: 'pending' | 'fulfilled' | 'cancelled';
          point_cost: number;
          claimed_at: string;
          fulfilled_at: string | null;
          fulfilled_by: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
        };
        Insert: Omit<Database['public']['Tables']['reward_redemptions']['Row'], 'id' | 'claimed_at'>;
        Update: Partial<Database['public']['Tables']['reward_redemptions']['Insert']>;
      };
      officer_point_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          type: 'manual_award' | 'redemption';
          redemption_id: string | null;
          note: string | null;
          created_by: string | null;
          created_at: string;
          reversed_at: string | null;
          reverses_transaction_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['officer_point_transactions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['officer_point_transactions']['Insert']>;
      };
      officer_reward_items: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          point_cost: number;
          stock: number | null;
          min_tier: string | null;
          active: boolean;
          max_per_user: number | null;
          reward_type: 'physical' | 'digital';
          grants_fast_pass: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['officer_reward_items']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['officer_reward_items']['Insert']>;
      };
      officer_reward_redemptions: {
        Row: {
          id: string;
          user_id: string;
          reward_id: string;
          status: 'pending' | 'fulfilled' | 'cancelled';
          point_cost: number;
          claimed_at: string;
          fulfilled_at: string | null;
          fulfilled_by: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
        };
        Insert: Omit<Database['public']['Tables']['officer_reward_redemptions']['Row'], 'id' | 'claimed_at'>;
        Update: Partial<Database['public']['Tables']['officer_reward_redemptions']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      app_role: AppRole;
      ticket_status: TicketStatus;
    };
  };
}

// Convenience types with joined data
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type UserRoleGrant = Database['public']['Tables']['user_roles']['Row'];
export type Division = Database['public']['Tables']['divisions']['Row'];
export type Event = Database['public']['Tables']['events']['Row'];
export type Ticket = Database['public']['Tables']['tickets']['Row'];
export type SiteContent = Database['public']['Tables']['site_contents']['Row'];
export type Sponsor = Database['public']['Tables']['sponsors']['Row'];
export type Doc = Database['public']['Tables']['docs']['Row'];
export type DocCategory = Database['public']['Tables']['doc_categories']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type PhotoAlbum = Database['public']['Tables']['photo_albums']['Row'];
export type PointTransaction = Database['public']['Tables']['point_transactions']['Row'];
export type RewardItem = Database['public']['Tables']['reward_items']['Row'];
export type RewardRedemption = Database['public']['Tables']['reward_redemptions']['Row'];

export type TicketWithEvent = Ticket & {
  event: Pick<Event, 'id' | 'title' | 'start_date' | 'end_date' | 'location' | 'flyer_url'>;
};

// Display-only ordering for badges/sorting — NOT used for authorization.
// officer and division intentionally tie: they're peers with different
// capabilities, neither implies the other. See src/lib/capabilities.ts for
// the actual permission model.
// alumni ranks above ucsd/recruit (a former member outranks an unaffiliated
// verified student or a prospect) but below officer (an alumnus isn't
// automatically staff). This ordering is also what MembersSectionContent's
// ORDER array keys off of — keep the two in sync, since a mismatch there
// previously caused an alumni-who-is-also-ucsd to be misclassified as
// ucsd-only and dropped from the member directory entirely.
export const ROLE_DISPLAY_RANK: Record<UserRole, number> = {
  guest: 0,
  ucsd: 1,
  recruit: 1.5,
  alumni: 1.8,
  officer: 2,
  division: 2,
  lead: 3,
  exec: 4,
  admin: 5,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  guest: 'Guest',
  ucsd: 'UCSD Student',
  division: 'Division Lead',
  officer: 'Officer',
  lead: 'Lead',
  exec: 'Executive',
  admin: 'Admin',
  alumni: 'Alumni',
  recruit: 'Recruit',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  guest: '#6b7280',
  ucsd: '#0ea5e9',
  division: '#7c3aed',
  officer: '#2563eb',
  lead: '#059669',
  exec: '#dc2626',
  admin: '#ffc72c',
  alumni: '#b45309',
  recruit: '#de4188',
};

// Roles assignable via the Role Manager UI (excludes 'guest', which is the
// implicit zero-roles state, not something you grant).
export const ASSIGNABLE_ROLES: AppRole[] = ['ucsd', 'division', 'officer', 'lead', 'exec', 'admin', 'alumni', 'recruit'];
