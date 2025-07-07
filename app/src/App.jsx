import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import NavBar from './components/NavBar';
import LandingPage from './components/LandingPage';

function App() {

  return (
    <>
      <NavBar />
      <LandingPage />
    </>
  )
}

export default App
