import NavBar from '@/components/NavBar/NavBar';
import Footer from '@/components/Footer/Footer';
import AnnouncementBanner from '@/components/AnnouncementBanner/AnnouncementBanner';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnnouncementBanner />
      <NavBar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
