import NavBar from '@/components/NavBar/NavBar';
import Footer from '@/components/Footer/Footer';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
