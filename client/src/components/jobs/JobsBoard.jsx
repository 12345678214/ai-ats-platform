import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Briefcase, SlidersHorizontal, X } from 'lucide-react';
import { api, parseError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync, useDebounced } from '../../lib/useAsync';
import { JOB_TYPES, LEVELS, WORK_MODES, enumOptions } from '../../lib/format';
import { Async, SkeletonRows, EmptyState } from '../ui/States';
import { Select } from '../ui/Field';
import { SearchInput } from '../ui/Misc';
import Pagination from '../ui/Pagination';
import Button from '../ui/Button';
import JobCard from './JobCard';

const FILTER_KEYS = ['location', 'workMode', 'jobType', 'experienceLevel', 'salaryMin', 'skills'];

export default function JobsBoard({ base }) {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const dq = useDebounced(q);
  const [showFilters, setShowFilters] = useState(FILTER_KEYS.some((k) => params.get(k)));
  const page = Number(params.get('page')) || 1;
  const get = (k) => params.get(k) || '';

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  useEffect(() => { if (dq !== get('q')) setParam('q', dq); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = Object.fromEntries([...params.entries()].filter(([, v]) => v));
  const state = useAsync(() => api.get('/jobs', { params: { limit: 9, ...query } }).then((r) => r.data), [params.toString()]);
  const activeCount = FILTER_KEYS.filter((k) => get(k)).length;
  const canSave = user?.role === 'CANDIDATE';

  const toggleSave = async (job) => {
    try {
      if (job.isSaved) await api.delete(`/candidate/saved-jobs/${job.id}`); else await api.post(`/candidate/saved-jobs/${job.id}`);
      state.setData({ ...state.data, items: state.data.items.map((j) => (j.id === job.id ? { ...j, isSaved: !job.isSaved } : j)) });
      toast.success(job.isSaved ? 'Removed from saved jobs' : 'Job saved');
    } catch (e) { toast.error(parseError(e).message); }
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput value={q} onChange={setQ} placeholder="Search by title, company or skill" className="flex-1" />
        <Button variant="secondary" icon={SlidersHorizontal} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>Filters{activeCount > 0 && ` (${activeCount})`}</Button>
        <Select aria-label="Sort jobs" value={get('sort') || 'newest'} onChange={(e) => setParam('sort', e.target.value)} className="sm:w-44"
          options={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'salary', label: 'Highest salary' }, { value: 'title', label: 'Title A–Z' }]} />
      </div>

      {showFilters && (
        <div className="card mt-3 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><label className="label" htmlFor="f-loc">Location</label><input id="f-loc" className="input" value={get('location')} onChange={(e) => setParam('location', e.target.value)} placeholder="City, country or Remote" /></div>
          <Select label="Work mode" value={get('workMode')} onChange={(e) => setParam('workMode', e.target.value)} placeholder="Any" options={enumOptions(WORK_MODES)} />
          <Select label="Job type" value={get('jobType')} onChange={(e) => setParam('jobType', e.target.value)} placeholder="Any" options={enumOptions(JOB_TYPES)} />
          <Select label="Experience level" value={get('experienceLevel')} onChange={(e) => setParam('experienceLevel', e.target.value)} placeholder="Any" options={enumOptions(LEVELS)} />
          <div><label className="label" htmlFor="f-sal">Minimum salary</label><input id="f-sal" type="number" min="0" className="input" value={get('salaryMin')} onChange={(e) => setParam('salaryMin', e.target.value)} placeholder="e.g. 60000" /></div>
          <div><label className="label" htmlFor="f-sk">Skills (comma separated)</label><input id="f-sk" className="input" value={get('skills')} onChange={(e) => setParam('skills', e.target.value)} placeholder="React, Python" /></div>
          {activeCount > 0 && <div className="sm:col-span-2 lg:col-span-3"><Button variant="ghost" size="sm" icon={X} onClick={() => { const n = new URLSearchParams(); if (get('q')) n.set('q', get('q')); setParams(n); }}>Clear filters</Button></div>}
        </div>
      )}

      <div className="mt-6">
        <Async state={state} skeleton={<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-52" />)}</div>}
          emptyWhen={(d) => d.items.length === 0}
          empty={<EmptyState icon={Briefcase} title="No jobs match these filters" description="Try a broader search, remove a filter, or check back soon for new openings." action={<Button variant="secondary" onClick={() => { setQ(''); setParams(new URLSearchParams()); }}>Reset search</Button>} />}>
          {(d) => (
            <>
              <p className="mb-3 text-sm text-muted" aria-live="polite">{d.pagination.total} {d.pagination.total === 1 ? 'job' : 'jobs'} found</p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {d.items.map((job) => <div key={job.id} className="relative flex"><JobCard job={job} base={base} canSave={canSave} onToggleSave={toggleSave} /></div>)}
              </div>
              <Pagination pagination={d.pagination} onPage={(p) => { setParam('page', String(p)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            </>
          )}
        </Async>
      </div>
    </div>
  );
}
