import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './components/Navbar/NavBar';
import LandingPage from './pages/LandingPage';
import AboutPage from './pages/AboutPage';
import Layout from './components/Layout/Layout';

function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<Layout><LandingPage /></Layout>} />
        <Route path="/about" element={<Layout><AboutPage /></Layout>} />
      </Routes>
    </>
  );
}

export default App;
