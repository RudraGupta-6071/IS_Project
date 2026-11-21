'use client';

import { useState } from 'react';
import { api } from './api.js';
import { PageIntro } from './ui.jsx';

export function SignIn({ next }) {
  const [email, setEmail] = useState('');
  const [stage, setStage] = useState('email');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError('');
    setSending(true);
    const address = stage === 'email' ? String(data.get('email')).trim() : email;
    try {
      if (stage === 'email') {
        await api('auth/otp', { method: 'POST', body: JSON.stringify({ email: address }) });
        setEmail(address);
        setStage('code');
      } else {
        await api('auth/verify', { method: 'POST', body: JSON.stringify({ email: address, code: String(data.get('code')).trim() }) });
        window.location.assign(next);
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSending(false);
    }
  }
  return (
    <section className="auth-card">
      <PageIntro label="Student access" title={stage === 'email' ? 'Sign in to Coursebook' : 'Enter your sign-in code'}>
        {stage === 'email' ? 'Use your IIT Kharagpur institute email to browse and write reviews.'
          : 'If your address is eligible, you’ll receive a six-digit code at ' + email + '.'}
      </PageIntro>
      <form className="stack" onSubmit={submit} key={stage}>
        {stage === 'email'
          ? <label>Institute email<input className="input" name="email" type="email" autoComplete="email" maxLength={254} defaultValue={email} required /></label>
          : <label>Six-digit code<input className="input code-input" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus /></label>}
        {error && <p className="input-error" role="alert">{error}</p>}
        <button className="button primary" disabled={sending} type="submit">{sending ? 'Please wait…' : stage === 'email' ? 'Send sign-in code' : 'Verify and sign in'}</button>
        {stage === 'code' && <button className="button quiet" type="button" disabled={sending} onClick={() => { setStage('email'); setError(''); }}>Back to email</button>}
      </form>
    </section>
  );
}
