import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage/LegalPage';

const DESCRIPTION = 'What Triton Gaming collects, how it is used, and how to control or delete it.';

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

      <h2>Who we share it with</h2>
      <p>Only the services that help us run the site, each limited to what it needs to do its job:</p>
      <ul>
        <li><strong>Supabase</strong> for the database and sign-in, and <strong>Vercel</strong> for hosting and analytics.</li>
        <li><strong>Stripe</strong> for payments.</li>
        <li><strong>Google</strong> for sign-in.</li>
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
        Data is sent over HTTPS, and access to the portal is limited by role. No system is perfectly secure, so please tell us right away if you think your account has been affected.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>See and edit your details in <strong>Profile</strong> in the portal, and choose what shows on a public card.</li>
        <li>Turn push notifications on or off at any time.</li>
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
