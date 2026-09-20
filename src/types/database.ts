export type AppRole = 'ucsd' | 'division' | 'officer' | 'lead' | 'exec' | 'admin' | 'alumni' | 'recruit';
// 'guest' is never stored — it just means zero rows in user_roles.
export type UserRole = 'guest' | AppRole;
export type TicketStatus = 'active' | 'used' | 'cancelled' | 'expired';
export type EventAudience = 'public' | 'ucsd_only';

export interface SocialEmbed {
  type: 'instagram' | 'discord';
  url: string;
}

export interface DocAttachment {
  name: string;
  url: string;
  kind: 'file' | 'google_album';
}

export type Capability =
  | 'manage_events'
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
  | 'manage_photo_albums';

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
          year: string | null;
          college: string | null;
          pronouns: string | null;
          discord: string | null;
          birthday: string | null;
          org_title: string | null;
          show_on_board: boolean;
          social_links: Record<string, string>;
          board_visibility: Record<string, boolean>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
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
          photo_album_url: string | null;
          post_event_info: string | null;
          social_embeds: SocialEmbed[];
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
        };
        Insert: Omit<Database['public']['Tables']['photo_albums']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['photo_albums']['Insert']>;
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
  recruit: '#f97316',
};

// Roles assignable via the Role Manager UI (excludes 'guest', which is the
// implicit zero-roles state, not something you grant).
export const ASSIGNABLE_ROLES: AppRole[] = ['ucsd', 'division', 'officer', 'lead', 'exec', 'admin', 'alumni', 'recruit'];
