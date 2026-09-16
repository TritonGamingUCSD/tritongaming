import NavBar from '@/components/NavBar/NavBar';
import Footer from '@/components/Footer/Footer';
import AnnouncementBanner from '@/components/AnnouncementBanner/AnnouncementBanner';

// NavBar and AnnouncementBanner are independent fixed elements now, not
// stacked together — the banner lives as its own floating toast in the
// bottom-right corner (see AnnouncementBanner.module.css) instead of
// pushing the nav pill down from the top, which used to shove the nav (and
// anything relying on the static --navbar-height clearance) down into
// page content whenever a banner was showing.
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <main>{children}</main>
      <Footer />
      <AnnouncementBanner />
    </>
  );
}
