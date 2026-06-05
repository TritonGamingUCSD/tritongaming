export type UserRole = 'guest' | 'member' | 'officer' | 'division' | 'lead' | 'exec' | 'admin';
export type TicketStatus = 'active' | 'used' | 'cancelled' | 'expired';
export type PostType = 'text' | 'link' | 'image';
export type MemberRequestStatus = 'pending' | 'approved' | 'rejected';

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
          division_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      divisions: {
        Row: {
          id: string;
          slug: string;
          name: string;
          logo_url: string | null;
          description: string | null;
          long_description: string | null;
          color: string;
          discord_link: string | null;
          website_url: string | null;
          game: string | null;
          order_index: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['divisions']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['divisions']['Insert']>;
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
          division_id: string | null;
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
      board_categories: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          icon: string;
          color: string;
          order_index: number;
          is_active: boolean;
        };
        Insert: Omit<Database['public']['Tables']['board_categories']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['board_categories']['Insert']>;
      };
      board_posts: {
        Row: {
          id: string;
          category_id: string;
          author_id: string;
          title: string;
          content: string;
          type: PostType;
          url: string | null;
          score: number;
          comment_count: number;
          is_pinned: boolean;
          is_locked: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['board_posts']['Row'], 'id' | 'score' | 'comment_count' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['board_posts']['Insert']>;
      };
      board_comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          parent_id: string | null;
          content: string;
          score: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['board_comments']['Row'], 'id' | 'score' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['board_comments']['Insert']>;
      };
      board_votes: {
        Row: {
          id: string;
          user_id: string;
          post_id: string | null;
          comment_id: string | null;
          value: 1 | -1;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['board_votes']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['board_votes']['Insert']>;
      };
      division_content: {
        Row: {
          id: string;
          division_id: string;
          about_text: string | null;
          schedule_text: string | null;
          achievements: string | null;
          roster: RosterMember[];
          social_links: Record<string, string>;
          gallery_urls: string[];
          updated_by: string | null;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['division_content']['Row'], 'id'>;
        Update: Partial<Database['public']['Tables']['division_content']['Insert']>;
      };
      member_requests: {
        Row: {
          id: string;
          user_id: string;
          requested_role: UserRole;
          division_id: string | null;
          message: string | null;
          status: MemberRequestStatus;
          reviewed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['member_requests']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['member_requests']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      ticket_status: TicketStatus;
      post_type: PostType;
      member_request_status: MemberRequestStatus;
    };
  };
}

export interface RosterMember {
  name: string;
  gamer_tag?: string;
  role?: string;
  avatar_url?: string;
}

// Convenience types with joined data
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Division = Database['public']['Tables']['divisions']['Row'];
export type Event = Database['public']['Tables']['events']['Row'];
export type Ticket = Database['public']['Tables']['tickets']['Row'];
export type BoardCategory = Database['public']['Tables']['board_categories']['Row'];
export type BoardPost = Database['public']['Tables']['board_posts']['Row'];
export type BoardComment = Database['public']['Tables']['board_comments']['Row'];
export type DivisionContent = Database['public']['Tables']['division_content']['Row'];

export type BoardPostWithAuthor = BoardPost & {
  author: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'gamer_tag' | 'role'>;
  category: Pick<BoardCategory, 'slug' | 'name' | 'color' | 'icon'>;
  user_vote?: 1 | -1 | null;
};

export type BoardCommentWithAuthor = BoardComment & {
  author: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'role'>;
  replies?: BoardCommentWithAuthor[];
  user_vote?: 1 | -1 | null;
};

export type TicketWithEvent = Ticket & {
  event: Pick<Event, 'id' | 'title' | 'start_date' | 'end_date' | 'location' | 'flyer_url'>;
};

// Ranks: division/lead are division-track roles (below officer privilege level)
// officer and above are org-level staff with event/check-in powers
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  guest:    0,
  member:   1,
  division: 2, // game division member — no org-staff privileges
  lead:     3, // game division lead   — can edit their division page + check-in
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
