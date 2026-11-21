'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { queryString } from './api.js';

export function SearchField({ name = 'q', defaultValue, placeholder, label }) {
  return (
    <label className="search-field">
      <span className="sr-only">{label}</span>
      <span className="search-icon" aria-hidden="true" />
      <input type="search" name={name} defaultValue={defaultValue} maxLength={120} placeholder={placeholder} />
    </label>
  );
}

export function HomeSearch() {
  const router = useRouter();
  const [mode, setMode] = useState('courses');
  const courses = mode === 'courses';
  function search(event) {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get('q')).trim();
    router.push('/' + mode + queryString({ q }));
  }
  return (
    <div className="hero-search">
      <div className="mode-switch" aria-label="Search directory">
        <button type="button" aria-pressed={courses} onClick={() => setMode('courses')}>Courses</button>
        <button type="button" aria-pressed={!courses} onClick={() => setMode('professors')}>Professors</button>
      </div>
      <form className="hero-search-row" onSubmit={search}>
        <SearchField key={mode} label={courses ? 'Search courses' : 'Search professors'}
          placeholder={courses ? 'Course name or code' : 'Professor name'} />
        <button className="button primary" type="submit">Search <span aria-hidden="true">→</span></button>
      </form>
    </div>
  );
}
