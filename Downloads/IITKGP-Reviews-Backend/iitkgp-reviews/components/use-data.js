'use client';

import { useEffect, useState } from 'react';
import { api } from './api.js';

export function useData(endpoint) {
  const [state, setState] = useState({ endpoint: null, data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!endpoint) return;
    const controller = new AbortController();
    api(endpoint, { signal: controller.signal }).then(
      data => { if (!controller.signal.aborted) setState({ endpoint, data, error: null }); },
      error => { if (!controller.signal.aborted) setState({ endpoint, data: null, error }); },
    );
    return () => controller.abort();
  }, [endpoint, attempt]);
  function retry() {
    setState({ endpoint: null, data: null, error: null });
    setAttempt(number => number + 1);
  }
  return state.endpoint === endpoint && endpoint
    ? { ...state, pending: false, retry }
    : { data: null, error: null, pending: Boolean(endpoint), retry };
}
