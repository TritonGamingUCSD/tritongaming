import type { Metadata } from 'next';
import InfoSection from '@/components/InfoSection/InfoSection';
import AlternateTitle from '@/components/AlternateTitle/AlternateTitle';
import ExecList from '@/components/ExecList/ExecList';
import { getContentBlock } from '@/lib/content';
import defaultOfficers from '@/data/officers.json';
import type { OfficerEntry } from '@/types';
import styles from './about.module.css';

export const metadata: Metadata = {
  title: 'About | Triton Gaming',
  description: 'Learn about Triton Gaming — our community, events, and executive board.',
};

type DbPerson = {
  display_name?: string;
  title?: string;
  gamer_tag?: string;
  photo_url?: string;
  major?: string;
  year?: string;
};

function dbOfficersToEntries(items: DbPerson[]): OfficerEntry[] {
  return items
    .filter((p) => p.display_name || p.title)
    .map((p, i) => {
      const parts = (p.display_name || '').trim().split(' ');
      const first_name = parts[0] || '';
      const last_name = parts.slice(1).join(' ');
      return {
        title: p.title || '',
        order: i,
        officer: {
          first_name,
          last_name,
          gamer_tag: p.gamer_tag || '',
          bio: '',
          year: p.year || '',
          major: p.major || '',
          committee: [],
          profile_picture: p.photo_url || '',
        },
      };
    });
}

export default async function AboutPage() {
  const officersContent = await getContentBlock('officers');
  const dbPeople = officersContent.items as DbPerson[] | undefined;
  const officers: OfficerEntry[] = dbPeople?.length
    ? dbOfficersToEntries(dbPeople)
    : (defaultOfficers as OfficerEntry[]);

  return (
    <div className={styles.page}>
      <InfoSection
        title="INSIDE TG"
        text="Triton Gaming is devoted to fostering a diverse and inviting community within the gaming sphere at UC San Diego, while striving to provide officers with industry, sponsorship, and leadership opportunities. Behind the scenes of every event are numerous dedicated teams. Creative designs themed graphics for everything from merchandise to decor, allowing artists of all skill levels to practice and add pieces to their portfolios. Live Events focuses on every aspect of event planning, including creating floorplans, organizing sponsor prizing, troubleshooting tech, executing interactive elements, emceeing, and livestreaming, just to name a few. Marketing's social media, sponsorship, and photography teams ensure our events have massive attendance, impressive sponsors and personalities, and high-quality media coverage. Lastly, Social is our link to the community at UC San Diego, interacting with students through fun events such as boba runs, tournaments and game sessions, and holiday events."
        image="/images/inside_tg.jpg"
        imageAlt="Inside TG officers"
        tag="TG"
        photoCredit="Justin Lu"
        photoCreditLink="https://www.instagram.com/justinzlu/"
      />
      <InfoSection
        title="COMMUNITY"
        text="Beyond working hard, our officers play hard too! Our tight-knit community has plenty to offer on the social side, with field days, cooking competitions, and quarterly retreats, just to name a few. Looking for someone to queue with? Look no further — we always have officers online at all times of the day, just waiting to hop into a game of League. Not interested in gaming? That's ok, we have officers chatting about just about any topic you could think of. We also offer a big-little program twice a year to foster friendships and help you form closer bonds with other officers. Our dedicated Human Resources team is also here to help, providing support for issues and helping to foster a warm and welcoming environment. Interested in learning more? Apply to become a Triton Gaming officer today!"
        image="/images/community_tg.jpg"
        imageAlt="Community TG officers"
        tag="COMMUNITY"
        reverse
        photoCredit="Justin Lu"
        photoCreditLink="https://www.instagram.com/justinzlu/"
      />
      <InfoSection
        title="EVENTS"
        text="Here at Triton Gaming, we're focused on bringing the best events possible to UC San Diego, which is only possible with our dedicated officer base. During our largest events, it's all hands on deck. Planning begins weeks, and sometimes even months in advance, with Marketing planning social media posts and reaching out to sponsors and possible panelists. Once theming and events details are decided, Creative can get to work on amazing graphics and planning merchandise, decor, artist alley, and more. Meanwhile, Live Events begins figuring out event details including floorplans, organizations to collaborate with, and interactives. Closer to the event, emcee scripts are created and sponsor tech and prizing is distributed. During the event, all officers staff and interact with attendees. Stream Team livestreams tournaments, emcees give shoutouts and host activities on stage, Tech Team troubleshoots issues that occur, Photography Team snaps shots of attendees and sponsor items, and more. Post event, Marketing compiles analytics, and we begin the process all over again!"
        image="/images/events_tg.JPG"
        imageAlt="Events TG officers"
        tag="EVENTS"
        photoCredit="Mina Yang"
        photoCreditLink="https://www.instagram.com/tritongamingsd"
      />

      <AlternateTitle bgTitle="Executive Board" fgTitle="Executive Board" />
      <ExecList officers={officers} />
    </div>
  );
}
