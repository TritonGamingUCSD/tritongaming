import type { Metadata } from 'next';
import LegalPage, { legalStyles as s } from '@/components/LegalPage/LegalPage';

const DESCRIPTION = 'What Triton Gaming collects, how it is used, and how to control or delete it, including the optional Google Calendar link.';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: DESCRIPTION,
  alternates: { canonical: '/privacy' },
  openGraph: { title: 'Privacy Policy', description: DESCRIPTION, type: 'website', images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title: 'Privacy Policy', description: DESCRIPTION, images: ['/opengraph-image'] },
};

const CONTACT = 'tritongamingofficial@gmail.com';

export default function PrivacyPage() {
  return (
    <LegalPage label="Your data" title="Privacy policy" sub="What we collect, why, and how you stay in control." updated="October 6, 2026">
      <p>
        Triton Gaming is a Gaming Org at UC San Diego. This policy explains what information the Triton Gaming website and member portal (the &ldquo;site&rdquo;) collect, how we use it,
        and the choices you have. Triton Gaming is not affiliated with or endorsed by the University of California.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Sign-in details.</strong> When you sign in with Google we receive your name, email address and profile picture. We never see your Google password.</li>
        <li><strong>Profile details you add.</strong> For example a gamer tag, year, college, major, pronouns, bio, game IDs and social links. Some of these are private and visible only to you; others can appear on a team or member card only if you choose to show them.</li>
        <li><strong>Activity.</strong> Tickets you get, events and meetings you check in to or RSVP for, points and rewards, and help requests you send us (with any screenshots you attach).</li>
        <li><strong>Payments.</strong> Paid tickets are handled by Stripe. We receive confirmation that a payment happened, not your card number.</li>
        <li><strong>Notifications.</strong> If you turn on push notifications, we store the address your browser gives us so we can send them. You can turn them off in Profile.</li>
        <li><strong>Basic usage.</strong> Our hosting provider and privacy-friendly analytics record page views and technical details such as device type and country. We use a sign-in session cookie so the portal knows who you are.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run the portal: your tickets, check-in, points, meeting scheduling and team tools.</li>
        <li>To contact you about events, meetings and help requests you are involved in.</li>
        <li>To keep the site safe, prevent abuse and fix problems.</li>
      </ul>
      <p>We do not sell your information and we do not show advertising.</p>

      <h2 id="google-calendar">Google Calendar link (optional)</h2>
      <p>
        Members can choose to link their own Google Calendar to the portal. It is off until you press the link button and approve Google&rsquo;s permission screen. Signing in with Google never gives us access to your calendar.
      </p>
      <h3>What we ask Google for</h3>
      <p>
        One permission only: <strong>view events on your calendars</strong> (<code>https://www.googleapis.com/auth/calendar.events.readonly</code>), plus your Google email address so we can show which account is linked.
        It is read only. The site can never create, change or delete anything in your Google Calendar.
      </p>
      <h3>What we do with it</h3>
      <ul>
        <li>We show your events (times, and titles if you allow it) <strong>to you only</strong>, inside your portal calendar.</li>
        <li>When you plan a meeting, your busy times appear as a hint on <strong>your own</strong> availability grid. Other people do not see your calendar events.</li>
        <li>You can choose to hide event titles so only busy times are shown.</li>
      </ul>
      <h3>What we store</h3>
      <ul>
        <li>The Google account email you linked, a record of the permission you granted, and your title preference.</li>
        <li>A <strong>refresh token</strong>, stored encrypted, so the link keeps working without asking you to sign in again.</li>
        <li>Your calendar events are <strong>not saved in our database</strong>. They are fetched from Google when you open the calendar and held in memory for about a minute and a half to keep the page fast.</li>
      </ul>
      <h3>Who can see it</h3>
      <p>
        No one but you. We do not read your calendar data, and we do not allow anyone else to, except with your consent, where needed to investigate abuse or a security problem, or where the law requires it. We never use it for advertising and we never sell or transfer it to anyone else.
      </p>
      <h3>Stopping it</h3>
      <ul>
        <li>In the portal, open <strong>Calendar</strong>, then the Google sync panel, and press disconnect. That deletes our stored token and tells Google to revoke it.</li>
        <li>You can also remove access at any time at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a>.</li>
      </ul>
      <p className={s.callout}>
        Triton Gaming&rsquo;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.
      </p>

      <h2>Who we share it with</h2>
      <p>Only the services that help us run the site, each limited to what it needs to do its job:</p>
      <ul>
        <li><strong>Supabase</strong> for the database and sign-in, and <strong>Vercel</strong> for hosting and analytics.</li>
        <li><strong>Stripe</strong> for payments.</li>
        <li><strong>Google</strong> for sign-in and, if you choose, the calendar link.</li>
      </ul>
      <p>
        Triton Gaming officers can see member information they need to run events and meetings, according to their role. We may also share information if the law requires it or to protect people&rsquo;s safety.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your information while your account is active. When you ask us to delete your account, we delete your personal information, except what we must keep to meet legal, accounting or safety duties.
      </p>

      <h2>Security</h2>
      <p>
        Data is sent over HTTPS, access to the portal is limited by role, and calendar refresh tokens are encrypted. No system is perfectly secure, so please tell us right away if you think your account has been affected.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>See and edit your details in <strong>Profile</strong> in the portal, and choose what shows on a public card.</li>
        <li>Turn push notifications on or off, and disconnect Google Calendar, at any time.</li>
        <li>Ask us to see, correct or delete your information by emailing <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</li>
      </ul>

      <h2>Children</h2>
      <p>The site is for college students and the wider gaming community. It is not directed at children under 13, and we do not knowingly collect their information.</p>

      <h2>Changes to this policy</h2>
      <p>If we change this policy we will update the date at the top. For significant changes we will tell members in the portal.</p>

      <h2>Contact</h2>
      <p>Questions about privacy? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </LegalPage>
  );
}
