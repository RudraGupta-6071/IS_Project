'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { queryString } from './api.js';
import { SearchField } from './search.jsx';
import { useData } from './use-data.js';
import { CourseBadge, DemoBadge, PageIntro, PageNav, RatingBadge, StatePanel, termName } from './ui.jsx';

function DirectoryCard({ item, courses }) {
  const name = courses ? item.title : item.name;
  return (
    <article className="directory-card">
      <div className="card-top"><span className={'tile-icon small' + (courses ? '' : ' lavender')} aria-hidden="true">{courses ? '▤' : '◉'}</span>
        <span className="card-badges"><DemoBadge show={item.is_demo} />{courses && <CourseBadge value={item.course_type}/>}</span>
      </div>
      <p className="card-label">{courses ? item.code : item.department}</p>
      <h3><Link href={'/' + (courses ? 'courses' : 'professors') + '/' + item.id}>{name} <span aria-hidden="true">↗</span></Link></h3>
      {courses ? <p className="card-description">{item.department}</p> :
        <div className="taught-list"><span>Courses taught</span>
          {item.courses.length
            ? <ul>{item.courses.slice(0, 3).map(course => <li key={course.id}><Link href={'/courses/' + course.id}>{course.code} · {course.title}</Link></li>)}
              {item.courses.length > 3 && <li>+{item.courses.length - 3} more on profile</li>}</ul>
            : <p>No course assignments listed.</p>}
        </div>}
      <div className="card-footer"><RatingBadge average={item.average_rating} count={item.review_count} /></div>
    </article>
  );
}

export function Directory({ resource, params }) {
  const router = useRouter();
  const courses = resource === 'courses';
  const categoryField = courses ? 'type' : 'context';
  const browse = '/' + resource;
  const options = useData('catalog');
  const filters = Object.fromEntries(['q', 'departmentId', 'termId', categoryField].map(key => [key, typeof params[key] === 'string' ? params[key] : '']));
  const offset = typeof params.offset === 'string' && /^\d+$/.test(params.offset) ? Math.min(Number(params.offset), 1000000) : 0;
  const endpoint = resource + queryString({ ...filters, limit: 12, offset });
  const results = useData(endpoint);
  const currentUrl = browse + queryString({ ...filters, offset: offset || undefined });

  function apply(event) {
    event.preventDefault();
    const filterData = Object.fromEntries(new FormData(event.currentTarget));
    filterData.q = filterData.q.trim();
    router.push(browse + queryString(filterData));
  }

  return (
    <div className="wrap inner-page">
      <PageIntro label="Student directory" title={courses ? 'Browse courses' : 'Browse professors'}>
        {courses ? 'Compare courses by department, type, and academic term.' : 'Explore courses taught and read feedback on teaching and project supervision.'}
      </PageIntro>
      <form className="filter-panel" onSubmit={apply}>
        <SearchField label={courses ? 'Search courses' : 'Search professors'} defaultValue={filters.q}
          placeholder={courses ? 'Course name or code' : 'Professor name'} />
        <label>Department<select className="input" name="departmentId" defaultValue={filters.departmentId} key={'department-' + Number(Boolean(options.data))}>
          <option value="">All departments</option>
          {options.data?.departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label>{courses ? 'Course type' : 'Review context'}<select className="input" name={categoryField} defaultValue={filters[categoryField]}>
          <option value="">{courses ? 'All course types' : 'All contexts'}</option>
          {courses ? <><option value="regular">Regular</option><option value="project_based">Project-based</option></> :
            <><option value="teaching">Teaching</option><option value="project">Project supervision</option></>}
        </select></label>
        <label>Academic term<select className="input" name="termId" defaultValue={filters.termId} key={'term-' + Number(Boolean(options.data))}>
          <option value="">All terms</option>
          {options.data?.terms.map(term => <option key={term.id} value={term.id}>{termName(term)}</option>)}
        </select></label>
        <button className="button primary" type="submit">Apply filters</button>
      </form>
      {options.error && options.error.status !== 401 && results.data &&
        <p className="input-error" role="alert">Department and term filters couldn’t load. <button className="text-button" onClick={options.retry}>Retry</button></p>}
      <div className="section-heading results-heading">
        <h2>{courses ? 'Course results' : 'Professor results'}</h2>
        {Object.values(filters).some(Boolean) && <Link href={browse} className="text-button">Clear filters</Link>}
      </div>
      <StatePanel state={results} next={currentUrl} busy="Loading directory…" />
      {results.data && <>
        {results.data.items.length ? <div className="directory-grid">{results.data.items.map(item => <DirectoryCard key={item.id} item={item} courses={courses}/>)}</div>
          : <div className="state-panel"><h3>No {resource} match these filters</h3><p>Try a different search term or clear your filters.</p><Link className="button quiet" href={browse}>Clear filters</Link></div>}
        <PageNav offset={offset} nextOffset={results.data.nextOffset} href={next => browse + queryString({ ...filters, offset: next || undefined })} />
      </>}
    </div>
  );
}
