import Link from 'next/link';
import { HomeSearch } from '../components/search.jsx';

export default function HomePage() {
  return (
    <div className="wrap home">
      <section className="hero">
        <div className="hero-content">
          <p className="hero-label"><span aria-hidden="true" /> IIT KHARAGPUR STUDENT REVIEWS</p>
          <h1>Find your next<br className="desktop-break" /> course.</h1>
          <p>Explore electives, project courses, and professors through the experiences of other KGP students.</p>
          <HomeSearch />
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-orbit orbit-outer" /><div className="hero-orbit orbit-inner" />
          <div className="art-sheet sheet-back"><span/><span/><span/></div>
          <div className="art-sheet sheet-front">
            <span className="art-book">≡</span><span className="art-line"/><span className="art-line short"/>
            <div className="art-stars">★ ★ ★ ★ ★</div>
          </div>
          <div className="art-glint">✦</div>
        </div>
      </section>
      <section className="home-directories" aria-labelledby="explore-heading">
        <div className="section-heading"><h2 id="explore-heading">Explore the directory</h2></div>
        <div className="tile-grid">
          <Link href="/courses" className="tile">
            <span className="tile-icon" aria-hidden="true">▤</span><div><h3>Browse courses</h3><p>Compare electives and project-based courses by department and term.</p></div><span className="tile-arrow" aria-hidden="true">↗</span>
          </Link>
          <Link href="/professors" className="tile">
            <span className="tile-icon lavender" aria-hidden="true">◉</span><div><h3>Browse professors</h3><p>See courses taught, teaching ratings, and project supervision reviews.</p></div><span className="tile-arrow" aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
      <section className="contribute">
        <div><h2>Help the next batch choose.</h2><p>Share your experience with a course or professor.</p></div>
        <Link href="/reviews/new" className="button primary">Write a review <span aria-hidden="true">↗</span></Link>
      </section>
    </div>
  );
}
