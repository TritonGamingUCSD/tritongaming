import NavBar from '@/components/NavBar/NavBar';
import Footer from '@/components/Footer/Footer';
import AnnouncementBanner from '@/components/AnnouncementBanner/AnnouncementBanner';
import HeaderStack from '@/components/HeaderStack/HeaderStack';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HeaderStack banner={<AnnouncementBanner />} nav={<NavBar />} />
      <main>{children}</main>
      <Footer />
    </>
  );
}
