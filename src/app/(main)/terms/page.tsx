import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/LegalPage/LegalPage';

const DESCRIPTION = 'The rules for using the Triton Gaming website, member portal, tickets and events.';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: DESCRIPTION,
  alternates: { canonical: '/terms' },
  openGraph: { title: 'Terms of Service', description: DESCRIPTION, type: 'website', images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title: 'Terms of Service', description: DESCRIPTION, images: ['/opengraph-image'] },
};

const CONTACT = 'tritongamingofficial@gmail.com';

export default function TermsPage() {
  return (
    <LegalPage label="The rules" title="Terms of service" sub="Please read these before using the site and portal." updated="October 6, 2026">
      <p>
        These terms cover your use of the Triton Gaming website and member portal (the &ldquo;site&rdquo;). Triton Gaming is a Gaming Org at UC San Diego and is not affiliated with or endorsed by the University of California.
        By using the site you agree to these terms.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You sign in with Google. Keep your account secure and do not share access to it.</li>
        <li>Give accurate information, and tell us if you think someone else has used your account.</li>
        <li>Portal tools depend on your role. Access is granted and removed by Triton Gaming officers and may change.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Do not:</p>
      <ul>
        <li>break the law, or harass, threaten or discriminate against anyone;</li>
        <li>try to access data or tools you have not been given, or disrupt or attack the site;</li>
        <li>use someone else&rsquo;s ticket, check in on someone&rsquo;s behalf, or misuse points, rewards or QR codes;</li>
        <li>upload content you do not have the right to share, or that is harmful or misleading.</li>
      </ul>
      <p>We may remove content or limit, suspend or end an account that breaks these rules or puts others at risk.</p>

      <h2>Events and tickets</h2>
      <ul>
        <li>Tickets are for the person named and for the event shown. Free and paid event rules, capacity and refund terms are given on each event page.</li>
        <li>Paid tickets are processed by Stripe. Prices and availability can change until you complete a purchase.</li>
        <li>Events are run by volunteers. Details, times and locations may change, and events may be cancelled.</li>
      </ul>

      <h2>Points, rewards and perks</h2>
      <p>Points and rewards have no cash value, cannot be sold or transferred, and may be adjusted or removed to correct mistakes or if they were earned unfairly.</p>

      <h2>Your content</h2>
      <p>
        You keep ownership of what you submit, such as profile details, photos and messages. You give Triton Gaming permission to store and display it as needed to run the site and, where you choose to make it public (for example on a team card),
        to show it there. You can remove it at any time in the portal or by asking us.
      </p>

      <h2>Google Calendar link</h2>
      <p>
        Linking a Google Calendar is optional and read only. How we handle that data is described in our <Link href="/privacy#google-calendar">privacy policy</Link>. You can disconnect at any time.
      </p>

      <h2>Our content</h2>
      <p>The Triton Gaming name, logos, designs and site content belong to Triton Gaming or the people who made them. Do not copy or reuse them without permission, except for normal sharing of links to the site.</p>

      <h2>Disclaimers</h2>
      <p>
        The site is provided &ldquo;as is&rdquo;, without promises that it will always be available or error free. Attending events and meeting others is at your own risk, and you are responsible for your own conduct and belongings.
      </p>

      <h2>Limit of liability</h2>
      <p>
        To the extent the law allows, Triton Gaming and its officers and volunteers are not liable for indirect or consequential losses arising from your use of the site or events. Nothing here limits rights that cannot be limited by law.
      </p>

      <h2>Ending your use</h2>
      <p>You can stop using the site and ask us to delete your account at any time. We may suspend or end access as described above.</p>

      <h2>Changes</h2>
      <p>We may update these terms. The date at the top shows the latest version, and continuing to use the site after a change means you accept it.</p>

      <h2>Contact</h2>
      <p>Questions about these terms? Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
    </LegalPage>
  );
}
