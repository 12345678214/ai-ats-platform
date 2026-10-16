import { useEffect, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { api, parseError } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../lib/useAsync';
import { Async, SkeletonRows } from '../../components/ui/States';
import { PageHeader } from '../../components/ui/Misc';
import { Badge } from '../../components/ui/Badge';
import { Input, Select, Textarea } from '../../components/ui/Field';
import Button from '../../components/ui/Button';

const SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'].map((s) => ({ value: s, label: `${s} employees` }));

export default function Company() {
  const toast = useToast();
  const state = useAsync(() => api.get('/recruiter/company').then((r) => r.data.company), []);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { const c = state.data; if (c) setForm({ name: c.name, website: c.website || '', industry: c.industry || '', size: c.size || '', location: c.location || '', description: c.description || '', jobTitle: c.jobTitle || '', phone: c.phone || '' }); }, [state.data]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErrors({});
    try { await api.put('/recruiter/company', Object.fromEntries(Object.entries(form).filter(([k, v]) => k === 'name' || v !== ''))); toast.success('Company profile saved'); state.reload({ silent: true }); }
    catch (err) { const p = parseError(err); setErrors(p.fields); toast.error(Object.keys(p.fields).length ? 'Please fix the highlighted fields' : p.message); } finally { setBusy(false); }
  };
  return (
    <div>
      <PageHeader title="Company profile" description="Candidates see this on every job you publish." />
      <Async state={state} skeleton={<SkeletonRows rows={3} className="h-40" />}>
        {(c) => form && (
          <form onSubmit={save} className="grid gap-6 xl:grid-cols-[1fr_300px]">
            <div className="space-y-6">
              <section className="card space-y-4 p-5"><h2 className="font-semibold">Company</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Company name" required value={form.name} onChange={set('name')} error={errors.name} />
                  <Input label="Website" value={form.website} onChange={set('website')} placeholder="https://" error={errors.website} />
                  <Input label="Industry" value={form.industry} onChange={set('industry')} error={errors.industry} />
                  <Select label="Company size" value={form.size} onChange={set('size')} placeholder="Select size" options={SIZES} />
                  <div className="sm:col-span-2"><Input label="Headquarters" value={form.location} onChange={set('location')} error={errors.location} /></div>
                  <div className="sm:col-span-2"><Textarea label="About the company" rows={5} value={form.description} onChange={set('description')} error={errors.description} /></div>
                </div></section>
              <section className="card space-y-4 p-5"><h2 className="font-semibold">Your recruiter profile</h2>
                <div className="grid gap-4 sm:grid-cols-2"><Input label="Your job title" value={form.jobTitle} onChange={set('jobTitle')} /><Input label="Phone" value={form.phone} onChange={set('phone')} /></div></section>
            </div>
            <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
              <div className="card p-5"><h2 className="font-semibold">Verification</h2>
                <div className="mt-3">{c.isVerified ? <Badge tone="brand"><BadgeCheck className="h-3.5 w-3.5" />Verified company</Badge> : <Badge tone="gray">Not verified yet</Badge>}</div>
                <p className="mt-3 text-sm text-muted">{c.isVerified ? 'A “Verified” label is shown beside your company name on job listings.' : 'A platform administrator reviews companies and can mark them verified.'}</p></div>
              <Button type="submit" size="lg" className="w-full" loading={busy}>Save changes</Button>
            </aside>
          </form>
        )}
      </Async>
    </div>
  );
}
