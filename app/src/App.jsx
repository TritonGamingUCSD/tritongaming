import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './components/Navbar/NavBar';
import LandingPage from './pages/LandingPage';
import Layout from './components/Layout/Layout';

function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<Layout><LandingPage /></Layout>} />
      </Routes>
    </>
  );
}

export default App;
