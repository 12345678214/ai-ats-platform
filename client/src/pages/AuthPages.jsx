import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { parseError } from '../lib/api';
import { homeFor } from '../lib/format';
import { Input } from '../components/ui/Field';
import Button from '../components/ui/Button';
import Logo from '../components/layout/Logo';

function AuthFrame({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="hidden flex-col justify-between bg-forest p-12 text-white lg:flex">
        <Logo dark />
        <div>
          <p className="font-display text-4xl font-semibold leading-tight">The applicants who fit best are already at the top.</p>
          <p className="mt-4 max-w-md text-white/70">Resumes are parsed, matched and ranked the moment someone applies.</p>
        </div>
        <p className="text-sm text-white/50">Shortlist applicant tracking</p>
      </div>
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-center text-sm text-muted">{footer}</div>
        </div>
      </div>
    </div>
  );
}

const DEMO = [
  { label: 'Candidate', email: 'candidate@ats.dev', password: 'Password@123' },
  { label: 'Recruiter', email: 'recruiter@ats.dev', password: 'Password@123' },
  { label: 'Admin', email: 'admin@ats.dev', password: 'Admin@12345' },
];

export function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e, creds = form) => {
    e?.preventDefault();
    setBusy(true); setErrors({});
    try {
      const user = await login(creds);
      navigate(location.state?.from || homeFor(user.role), { replace: true });
    } catch (err) {
      const p = parseError(err);
      setErrors(p.fields);
      if (!Object.keys(p.fields).length) toast.error(p.message);
    } finally { setBusy(false); }
  };

  return (
    <AuthFrame title="Welcome back" subtitle="Sign in to continue to your dashboard." footer={<>New to Shortlist? <Link to="/register" className="font-medium text-brand hover:underline">Create an account</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input label="Email" type="email" autoComplete="email" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label="Password" type="password" autoComplete="current-password" value={form.password} error={errors.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in</Button>
      </form>
      <div className="mt-8 rounded-xl border border-dashed border-line p-4">
        <p className="text-sm font-medium">Try a demo account</p>
        <p className="mt-0.5 text-xs text-muted">Seeded data, so everything is populated.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO.map((d) => <Button key={d.label} type="button" variant="secondary" size="sm" disabled={busy} onClick={() => { setForm(d); submit(null, d); }}>{d.label}</Button>)}
        </div>
      </div>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: params.get('role') === 'RECRUITER' ? 'RECRUITER' : 'CANDIDATE', companyName: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErrors({});
    try {
      const payload = { ...form, companyName: form.role === 'RECRUITER' ? form.companyName : undefined };
      const user = await register(payload);
      toast.success('Account created. Welcome to Shortlist!');
      navigate(user.role === 'CANDIDATE' ? '/candidate/profile' : homeFor(user.role), { replace: true });
    } catch (err) {
      const p = parseError(err);
      setErrors(p.fields);
      if (!Object.keys(p.fields).length) toast.error(p.message);
    } finally { setBusy(false); }
  };

  const roles = [['CANDIDATE', 'I’m looking for a job', UserRound], ['RECRUITER', 'I’m hiring', Briefcase]];
  return (
    <AuthFrame title="Create your account" subtitle="It takes about a minute." footer={<>Already have an account? <Link to="/login" className="font-medium text-brand hover:underline">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <fieldset>
          <legend className="label">I am</legend>
          <div className="grid grid-cols-2 gap-3">
            {roles.map(([value, label, Icon]) => (
              <label key={value} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-white p-3 text-sm font-medium has-[:checked]:border-brand has-[:checked]:bg-brand-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40">
                <input type="radio" name="role" value={value} checked={form.role === value} onChange={set('role')} className="sr-only" /><Icon className="h-4 w-4 text-brand" />{label}
              </label>
            ))}
          </div>
        </fieldset>
        <Input label="Full name" autoComplete="name" value={form.name} error={errors.name} onChange={set('name')} />
        {form.role === 'RECRUITER' && <Input label="Company name" value={form.companyName} error={errors.companyName} onChange={set('companyName')} />}
        <Input label="Email" type="email" autoComplete="email" value={form.email} error={errors.email} onChange={set('email')} />
        <Input label="Password" type="password" autoComplete="new-password" value={form.password} error={errors.password} hint="At least 8 characters, with a letter and a number." onChange={set('password')} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>Create account</Button>
      </form>
    </AuthFrame>
  );
}

export function NotFoundPage() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div><p className="font-display text-6xl font-semibold text-brand">404</p><h1 className="mt-3 text-2xl font-semibold">This page doesn&apos;t exist</h1>
        <p className="mt-2 text-muted">The link may be broken or the page may have moved.</p><Button to="/" className="mt-6">Back to home</Button></div>
    </div>
  );
}
