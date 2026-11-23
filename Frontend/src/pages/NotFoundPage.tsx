import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { OrbixLogo } from '../components/OrbixLogo';
import { useAppSelector } from '../store';
import './NotFoundPage.css';

export default function NotFoundPage() {
  const user = useAppSelector((state) => state.user.user);
  const reducedMotion = useReducedMotion();
  const [turns, setTurns] = useState(0);
  const destination = !user ? '/' : user.accountType === 'club'
    ? (user.clubStatus === 'approved' || user.verifiedClub ? '/club/dashboard' : '/club/status')
    : '/dashboard';


  return (
    <div className="orbix-not-found">
      <header className="nf-header">
        <Link to="/" className="nf-brand" aria-label="Orbix home"><OrbixLogo className="nf-logo" />orbix<span>®</span></Link>
        <span className="nf-header-note">A little off course. Still in good company.</span>
        <Link to={destination} className="nf-header-link">{user ? 'My dashboard' : 'Home'} <ArrowUpRight size={17} /></Link>
      </header>

      <main className="nf-main">
        <div className="nf-status"><span /> WRONG TURN, RIGHT PLACE</div>
        <div className="nf-scene" aria-label="404: page not found">
          <span className="nf-four" aria-hidden="true">4</span>
          <motion.button
            type="button"
            className="nf-planet"
            onClick={() => setTurns((value) => value + 1)}
            animate={{ rotate: reducedMotion ? 0 : turns * 360 }}
            transition={{ type: 'spring', stiffness: 80, damping: 16 }}
            whileHover={reducedMotion ? undefined : { scale: 1.04 }}
            whileTap={reducedMotion ? undefined : { scale: 0.96 }}
            aria-label="Realign the lost planet"
          >
            <svg viewBox="0 0 300 300" fill="none" aria-hidden="true">
              <path d="M9 156a141 49 0 0 1 282 0" transform="rotate(-28 150 156)" stroke="currentColor" strokeWidth="3" strokeDasharray="7 9" />
              <circle cx="150" cy="145" r="87" fill="#a6ff70" stroke="currentColor" strokeWidth="4" />
              <path d="M87 113c12-25 34-39 59-41" stroke="white" strokeWidth="9" strokeLinecap="round" />
              <circle cx="121" cy="137" r="12" fill="currentColor" /><circle cx="178" cy="137" r="12" fill="currentColor" />
              <circle cx="125" cy="133" r="4" fill="white" /><circle cx="182" cy="133" r="4" fill="white" />
              <path d={turns ? 'M134 166q16 22 32 0' : 'M136 174q14-13 28 0'} stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              <ellipse cx="108" cy="162" rx="11" ry="5" fill="#fb923c" /><ellipse cx="192" cy="162" rx="11" ry="5" fill="#fb923c" />
              <path d="M9 156a141 49 0 0 0 282 0" transform="rotate(-28 150 156)" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
              <path d="M9 156a141 49 0 0 0 282 0" transform="rotate(-28 150 156)" stroke="#c4b5fd" strokeWidth="6" strokeLinecap="round" />
              <path d="m243 39 4 12 12 4-12 4-4 12-4-12-12-4 12-4z" fill="#fde047" stroke="currentColor" strokeWidth="3" />
              <circle cx="47" cy="236" r="9" fill="#fb923c" stroke="currentColor" strokeWidth="3" />
            </svg>
          </motion.button>
          <span className="nf-four" aria-hidden="true">4</span>
          <span className="nf-orbit-note" aria-hidden="true">{turns ? 'Orbit restored. Nice work! ↗' : 'Psst… tap the planet ↗'}</span>
        </div>

        <motion.div initial={false} animate={{ opacity: 1 }} className="nf-copy">
          <h1>This page drifted out of orbit.</h1>
          <p>The link may have moved, or the address took a wrong turn.<br className="nf-desktop-break" /> Let’s get you back to your corner of Orbix.</p>
          <div className="nf-actions">
            <Link to={destination} replace className="nf-primary"><ArrowLeft size={18} /> {user ? 'Back to my dashboard' : 'Back to home'}</Link>
            <Link to="/events" className="nf-secondary">Discover events <ArrowUpRight size={18} /></Link>
          </div>

          <span className="nf-sr-only" role="status">{turns > 0 ? 'Orbit restored! Ready to head back.' : ''}</span>
        </motion.div>
      </main>
      <footer className="nf-footer"><span>ERROR 404 / UNCHARTED TERRITORY</span></footer>
    </div>
  );
}
