export type Event = {
  _id: string;
  full_name: string;
  name: string;
  start_date: string;
  end_date: string;
  flyer_url: string;
  location: string;
  content: string;
  url: string;
  requires_ticket: boolean;
  ticket_price: number;
  audience: 'public' | 'ucsd_only';
};

export type OfficerEntry = {
  title: string;
  order: number;
  officer: {
    first_name: string;
    last_name: string;
    gamer_tag: string;
    bio: string;
    year: string;
    major: string;
    committee: string[];
    profile_picture: string;
  };
};

export type LogoItem = {
  name: string;
  logo: string;
  size: 'small' | 'medium' | 'large';
  link?: string;
  order?: number;
  description?: string;
};
