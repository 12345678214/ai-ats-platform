import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { api, parseError } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../lib/useAsync';
import { Async, EmptyState } from '../../components/ui/States';
import { PageHeader } from '../../components/ui/Misc';
import Pagination from '../../components/ui/Pagination';
import Button from '../../components/ui/Button';
import JobCard from '../../components/jobs/JobCard';

export default function SavedJobs() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const state = useAsync(() => api.get('/candidate/saved-jobs', { params: { page } }).then((r) => r.data), [page]);
  const unsave = async (job) => {
    try { await api.delete(`/candidate/saved-jobs/${job.id}`); toast.success('Removed from saved jobs'); state.reload({ silent: true }); } catch (e) { toast.error(parseError(e).message); }
  };
  return (
    <div>
      <PageHeader title="Saved jobs" description="Roles you want to come back to." />
      <Async state={state} emptyWhen={(d) => d.items.length === 0}
        empty={<EmptyState icon={Bookmark} title="No saved jobs" description="Tap the bookmark on any job to keep it here." action={<Button to="/candidate/jobs">Browse jobs</Button>} />}>
        {(d) => (<><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{d.items.map((j) => <div key={j.id} className="relative flex"><JobCard job={j} base="/candidate/jobs" canSave onToggleSave={unsave} /></div>)}</div><Pagination pagination={d.pagination} onPage={setPage} /></>)}
      </Async>
    </div>
  );
}
