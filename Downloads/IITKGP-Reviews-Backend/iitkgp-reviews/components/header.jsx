'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { api } from './api.js';
import { useData } from './use-data.js';

export function Header() {
  const path = usePathname();
  const session = useData('auth/session');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  async function logout() {
    setWorking(true);
    setMessage('');
    try {
      await api('auth/logout', { method: 'POST' });
      window.location.assign('/');
    } catch {
      setMessage('Sign-out failed. Try again.');
      setWorking(false);
    }
  }
  return (
    <header className="header">
      <div className="wrap header-row">
        <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">K</span>KGP Coursebook</Link>
        <nav className="navigation" aria-label="Main navigation">
          <Link href="/courses" aria-current={path.startsWith('/courses') ? 'page' : undefined}>Courses</Link>
          <Link href="/professors" aria-current={path.startsWith('/professors') ? 'page' : undefined}>Professors</Link>
          <Link href="/reviews/new" aria-current={path === '/reviews/new' ? 'page' : undefined}>Write a review</Link>
          {session.data?.canModerate && <Link href="/moderation" aria-current={path === '/moderation' ? 'page' : undefined}>Moderation</Link>}
        </nav>
        <div className="account">
          {session.data?.authenticated
            ? <button type="button" className="button quiet compact" disabled={working} onClick={logout}>Sign out</button>
            : <Link href="/sign-in" className="button quiet compact">Sign in <span aria-hidden="true">↗</span></Link>}
          {message && <span className="header-error" role="alert">{message}</span>}
        </div>
      </div>
    </header>
  );
}
