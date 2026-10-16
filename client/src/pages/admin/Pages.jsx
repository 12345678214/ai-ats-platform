import { useState } from 'react';
import { BadgeCheck, EyeOff, Eye, Power, Trash2 } from 'lucide-react';
import { api, parseError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatDate, timeAgo } from '../../lib/format';
import { Avatar } from '../../components/ui/Misc';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Field';
import Button from '../../components/ui/Button';
import AdminList from './AdminList';

function useAct() {
  const toast = useToast();
  return async (fn, ok, reload) => { try { await fn(); toast.success(ok); reload(); } catch (e) { toast.error(parseError(e).message); } };
}

export function AdminUsers() {
  const { user: me } = useAuth();
  const act = useAct();
  const [target, setTarget] = useState(null);
  return (
    <>
      <AdminList title="Users" description="Every account on the platform. Deactivating blocks sign-in immediately." path="/admin/users" searchPlaceholder="Search name or email"
        filters={[{ key: 'role', label: 'All roles', options: [{ value: 'CANDIDATE', label: 'Candidates' }, { value: 'RECRUITER', label: 'Recruiters' }, { value: 'ADMIN', label: 'Admins' }] }, { key: 'active', label: 'Any status', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Deactivated' }] }]}
        columns={[
          { header: 'User', render: (u) => <div className="flex items-center gap-3"><Avatar name={u.name} /><div className="min-w-0"><p className="truncate text-sm font-medium">{u.name}</p><p className="truncate text-xs text-muted">{u.email}</p></div></div> },
          { header: 'Role', render: (u) => <Badge tone={u.role === 'ADMIN' ? 'violet' : u.role === 'RECRUITER' ? 'sky' : 'gray'}>{u.role.charAt(0) + u.role.slice(1).toLowerCase()}</Badge> },
          { header: 'Details', render: (u) => <span className="text-muted">{u.recruiterProfile?.company.name || (u.candidateProfile ? `${u.candidateProfile._count.applications} applications` : '—')}</span> },
          { header: 'Joined', render: (u) => <span className="text-muted">{formatDate(u.createdAt)}</span> },
          { header: 'Last sign-in', render: (u) => <span className="text-muted">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</span> },
          { header: 'Status', render: (u) => <Badge tone={u.isActive ? 'brand' : 'rose'}>{u.isActive ? 'Active' : 'Deactivated'}</Badge> },
        ]}
        actions={(u, reload) => u.role === 'ADMIN' || u.id === me.id ? null : u.isActive
          ? <Button size="sm" variant="dangerOutline" icon={Power} onClick={() => setTarget({ u, reload })}>Deactivate</Button>
          : <Button size="sm" variant="secondary" icon={Power} onClick={() => act(() => api.patch(`/admin/users/${u.id}/active`, { isActive: true }), `${u.name} reactivated`, reload)}>Reactivate</Button>} />
      <ConfirmDialog open={!!target} onClose={() => setTarget(null)} danger title={`Deactivate ${target?.u.name}?`} message="They will be signed out and unable to sign in until reactivated. Their data is kept."
        confirmLabel="Deactivate" onConfirm={async () => { await act(() => api.patch(`/admin/users/${target.u.id}/active`, { isActive: false }), `${target.u.name} deactivated`, target.reload); setTarget(null); }} />
    </>
  );
}

export function AdminCompanies() {
  const act = useAct();
  return (
    <AdminList title="Companies" description="Verify employers and disable companies that violate the rules." path="/admin/companies" searchPlaceholder="Search companies"
      filters={[{ key: 'active', label: 'Any status', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Disabled' }] }]}
      columns={[
        { header: 'Company', render: (c) => <div className="flex items-center gap-3"><Avatar name={c.name} /><div><p className="flex items-center gap-1.5 text-sm font-medium">{c.name}{c.isVerified && <BadgeCheck className="h-4 w-4 text-brand" aria-label="Verified" />}</p><p className="text-xs text-muted">{c.industry || 'No industry'}</p></div></div> },
        { header: 'Owner', render: (c) => <span className="text-muted">{c.owner ? `${c.owner.name} · ${c.owner.email}` : '—'}</span> },
        { header: 'Jobs', className: 'text-right', render: (c) => c.jobCount },
        { header: 'Created', render: (c) => <span className="text-muted">{formatDate(c.createdAt)}</span> },
        { header: 'Status', render: (c) => <Badge tone={c.isActive ? 'brand' : 'rose'}>{c.isActive ? 'Active' : 'Disabled'}</Badge> },
      ]}
      actions={(c, reload) => (<>
        <Button size="sm" variant="secondary" icon={BadgeCheck} onClick={() => act(() => api.patch(`/admin/companies/${c.id}/verify`, { isVerified: !c.isVerified }), c.isVerified ? 'Verification removed' : `${c.name} verified`, reload)}>{c.isVerified ? 'Unverify' : 'Verify'}</Button>
        <Button size="sm" variant={c.isActive ? 'dangerOutline' : 'secondary'} icon={Power} onClick={() => act(() => api.patch(`/admin/companies/${c.id}/active`, { isActive: !c.isActive }), c.isActive ? 'Company disabled. Its jobs are hidden.' : 'Company enabled', reload)}>{c.isActive ? 'Disable' : 'Enable'}</Button></>)} />
  );
}

export function AdminJobs() {
  const act = useAct();
  const [flag, setFlag] = useState(null);
  const [reason, setReason] = useState('');
  const [del, setDel] = useState(null);
  return (
    <>
      <AdminList title="Jobs" description="Moderate listings. Flagged jobs are hidden from the public board and the recruiter is notified." path="/admin/jobs" searchPlaceholder="Search jobs or companies"
        filters={[{ key: 'status', label: 'Any status', options: ['ACTIVE', 'DRAFT', 'PAUSED', 'CLOSED'].map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() })) }, { key: 'flagged', label: 'All jobs', options: [{ value: 'true', label: 'Flagged only' }] }]}
        columns={[
          { header: 'Job', render: (j) => <div><p className="text-sm font-medium">{j.title}</p><p className="text-xs text-muted">{j.company.name} · {j.recruiter.name}</p>{j.isFlagged && <p className="mt-0.5 text-xs text-rose">Flagged: {j.flagReason}</p>}</div> },
          { header: 'Status', render: (j) => <div className="flex items-center gap-1.5"><StatusBadge status={j.status} />{j.isFlagged && <Badge tone="rose">Flagged</Badge>}</div> },
          { header: 'Applicants', className: 'text-right', render: (j) => j.applicantCount },
          { header: 'Posted', render: (j) => <span className="text-muted">{j.publishedAt ? timeAgo(j.publishedAt) : 'Unpublished'}</span> },
        ]}
        actions={(j, reload) => (<>
          {j.isFlagged ? <Button size="sm" variant="secondary" icon={Eye} onClick={() => act(() => api.patch(`/admin/jobs/${j.id}/flag`, { isFlagged: false }), 'Job restored', reload)}>Restore</Button>
            : <Button size="sm" variant="secondary" icon={EyeOff} onClick={() => { setReason(''); setFlag({ j, reload }); }}>Flag</Button>}
          <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${j.title}`} onClick={() => setDel({ j, reload })} /></>)} />
      <Modal open={!!flag} onClose={() => setFlag(null)} title="Flag this job" description="It will be hidden from candidates until you restore it." size="sm"
        footer={<><Button variant="secondary" onClick={() => setFlag(null)}>Cancel</Button><Button variant="danger" onClick={async () => { await act(() => api.patch(`/admin/jobs/${flag.j.id}/flag`, { isFlagged: true, reason: reason || undefined }), 'Job flagged and hidden', flag.reload); setFlag(null); }}>Flag job</Button></>}>
        <Textarea label="Reason (shown to the recruiter)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      </Modal>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger title="Delete this job permanently?" message="All applications to it are deleted too. This cannot be undone. Flagging is usually the safer option." confirmLabel="Delete"
        onConfirm={async () => { await act(() => api.delete(`/admin/jobs/${del.j.id}`), 'Job deleted', del.reload); setDel(null); }} />
    </>
  );
}

export function AdminApplications() {
  return (
    <AdminList title="Applications" description="Read-only view of every application on the platform." path="/admin/applications" searchPlaceholder="Search candidate or job"
      filters={[{ key: 'status', label: 'Any status', options: ['APPLIED', 'REVIEWING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN'].map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() })) }]}
      columns={[
        { header: 'Candidate', render: (a) => <div className="flex items-center gap-3"><Avatar name={a.candidate.user.name} /><div><p className="text-sm font-medium">{a.candidate.user.name}</p><p className="text-xs text-muted">{a.candidate.user.email}</p></div></div> },
        { header: 'Job', render: (a) => <div><p className="text-sm">{a.job.title}</p><p className="text-xs text-muted">{a.job.company.name}</p></div> },
        { header: 'Match', className: 'text-right', render: (a) => (a.match?.status === 'COMPLETED' ? `${Math.round(a.match.score)}%` : '—') },
        { header: 'Applied', render: (a) => <span className="text-muted">{formatDate(a.appliedAt)}</span> },
        { header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
      ]} />
  );
}
