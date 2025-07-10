import React from 'react';
import NavBar from '../Navbar/NavBar';
import Footer from '../Footer/Footer';

const Layout = ({ children }) => {
  return (
    <>
      <NavBar />
      {children}
      <Footer />
    </>
  );
};

export default Layout;
