import Hero from '../components/Hero/Hero';
import LandingAbout from '../components/LandingAbout/LandingAbout';
import LandingEvents from '../components/LandingEvents/LandingEvents';
import LandingStatistics from '../components/LandingStatistics/LandingStatistics';
import LandingDivisions from '../components/LandingDivisions/LandingDivisions';
import LandingSponsors from '../components/LandingSponsors/LandingSponsors';
import LandingRecruitment from '../components/LandingRecruitment/LandingRecruitment';

const LandingPage = () => (
  <div className='landing-page'>
    <Hero />
    <LandingAbout />
    <LandingStatistics />
    <LandingEvents />
    <LandingSponsors />
    <LandingDivisions />
    <LandingRecruitment />
  </div>
);

export default LandingPage;
