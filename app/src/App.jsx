import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import NavBar from './components/Navbar/NavBar';
import LandingPage from './pages/LandingPage';

function App() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
      </Routes>
    </>
  );
}

export default App;
