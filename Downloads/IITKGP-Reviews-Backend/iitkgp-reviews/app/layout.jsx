import Link from 'next/link';
import { Header } from '../components/header.jsx';
import './globals.css';

export const metadata = {
  title: { default: 'KGP Coursebook', template: '%s · KGP Coursebook' },
  description: 'Explore IIT Kharagpur courses and professors through student reviews.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <Header />
        <main id="main">{children}</main>
        <footer className="footer">
          <div className="wrap footer-row">
            <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">K</span>KGP Coursebook</Link>
            <span>Course and professor reviews for IIT Kharagpur students</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
