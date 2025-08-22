import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './components/Navbar/NavBar';
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import Layout from './components/Layout/Layout';
import EventsPage from './pages/EventsPage';
import SponsorPage from './pages/SponsorPage';

function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<Layout><LandingPage /></Layout>} />
        <Route path="/about" element={<Layout><AboutPage /></Layout>} />
        <Route path="/events" element={<Layout><EventsPage /></Layout>} />
				<Route path="/sponsors" element={<Layout><SponsorPage /></Layout>} />
      </Routes>
    </>
  );
}

export default App;
