'use client';

import { useState } from 'react';
import { reportReasons } from '../lib/report-reasons.js';
import { api } from './api.js';

export function ReportReview({ id }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function send(event) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await api('reviews/' + id + '/report', {
        method: 'POST', body: JSON.stringify({ reason: fields.get('reason'), details: fields.get('details') }),
      });
      setSent(true);
      setOpen(false);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="report-review">
    {sent ? <p role="status">Report sent for moderation.</p> :
      <button className="text-button" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close report form' : 'Report review'}</button>}
    {open && <form className="stack report-form" onSubmit={send}>
      <label>Reason (required)<select name="reason" className="input" defaultValue="" required>
        <option disabled value="">Select a reason</option>
        {Object.entries(reportReasons).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <label>Details (optional)<textarea className="input" name="details" rows={2} maxLength={500} /></label>
      {error && <p role="alert" className="input-error">{error}</p>}
      <button className="button primary" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>
    </form>}
  </div>;
}
