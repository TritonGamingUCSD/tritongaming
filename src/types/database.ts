export type UserRole = 'guest' | 'member' | 'officer' | 'division' | 'lead' | 'exec' | 'admin';
export type TicketStatus = 'active' | 'used' | 'cancelled' | 'expired';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string | null;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          gamer_tag: string | null;
          major: string | null;
          year: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      ticket_status: TicketStatus;
    };
  };
}

// Convenience types with joined data
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Event = Database['public']['Tables']['events']['Row'];
export type Ticket = Database['public']['Tables']['tickets']['Row'];
export type SiteContent = Database['public']['Tables']['site_contents']['Row'];
export type Sponsor = Database['public']['Tables']['sponsors']['Row'];

export type TicketWithEvent = Ticket & {
  event: Pick<Event, 'id' | 'title' | 'start_date' | 'end_date' | 'location' | 'flyer_url'>;
};

// Ranks: division/lead sit below officer privilege level (org-staff)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  guest:    0,
  member:   1,
  division: 2, // division-track member — no org-staff privileges
  lead:     3, // division-track lead   — check-in + content editing
  officer:  4, // org officer          — events, check-in, content editing
  exec:     5, // executive board
  admin:    6, // full platform access
};

export const ROLE_LABELS: Record<UserRole, string> = {
  guest:    'Guest',
  member:   'Member',
  division: 'Division Member',
  lead:     'Division Lead',
  officer:  'Officer',
  exec:     'Executive',
  admin:    'Admin',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  guest:    '#6b7280',
  member:   '#059669',
  division: '#7c3aed',
  lead:     '#0ea5e9',
  officer:  '#2563eb',
  exec:     '#dc2626',
  admin:    '#ffc72c',
};

export function hasRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

// Roles that can edit site content (not officers — they manage events, not the website)
export const CONTENT_EDITOR_ROLES: UserRole[] = ['lead', 'exec', 'admin'];
export function canEditContent(role: UserRole): boolean {
  return CONTENT_EDITOR_ROLES.includes(role);
}
