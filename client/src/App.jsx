import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import PublicLayout from './components/layout/PublicLayout';
import { PageLoader } from './components/ui/States';
import JobsBoard from './components/jobs/JobsBoard';
import JobDetail from './components/jobs/JobDetail';
import { PageHeader } from './components/ui/Misc';
import Landing from './pages/Landing';
import { LoginPage, RegisterPage, NotFoundPage } from './pages/AuthPages';
import Notifications from './pages/shared/Notifications';
import CandidateDashboard from './pages/candidate/Dashboard';
import Applications from './pages/candidate/Applications';
import SavedJobs from './pages/candidate/SavedJobs';
import Profile from './pages/candidate/Profile';
import RecruiterDashboard from './pages/recruiter/Dashboard';
import RecruiterJobs from './pages/recruiter/Jobs';
import JobForm from './pages/recruiter/JobForm';
import Applicants from './pages/recruiter/Applicants';
import Interviews from './pages/recruiter/Interviews';
import Company from './pages/recruiter/Company';
import { AdminUsers, AdminCompanies, AdminJobs, AdminApplications } from './pages/admin/Pages';

// Recharts is heavy; load analytics lazily.
const Analytics = lazy(() => import('./pages/recruiter/Analytics'));
const Overview = lazy(() => import('./pages/admin/Overview'));

const lazyPage = (el) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;

function Home() {
  const { user } = useAuth();
  return <Landing key={user?.id || 'anon'} />;
}

function RecruiterJobPreview() {
  const { id } = useParams();
  return <JobDetail backTo={`/recruiter/jobs/${id}/applicants`} backLabel="Back to applicants" />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="jobs" element={<div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-8"><PageHeader title="Open roles" description="Find your next job. Sign in to apply with one click." /><JobsBoard base="/jobs" /></div>} />
        <Route path="jobs/:id" element={<div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-8"><JobDetail backTo="/jobs" /></div>} />
      </Route>
      <Route path="login" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute role="CANDIDATE" />}>
        <Route path="candidate" element={<AppShell />}>
          <Route index element={<CandidateDashboard />} />
          <Route path="jobs" element={<><PageHeader title="Browse jobs" description="Search open roles and apply in a few clicks." /><JobsBoard base="/candidate/jobs" /></>} />
          <Route path="jobs/:id" element={<JobDetail backTo="/candidate/jobs" />} />
          <Route path="applications" element={<Applications />} />
          <Route path="saved" element={<SavedJobs />} />
          <Route path="profile" element={<Profile />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute role="RECRUITER" />}>
        <Route path="recruiter" element={<AppShell />}>
          <Route index element={<RecruiterDashboard />} />
          <Route path="jobs" element={<RecruiterJobs />} />
          <Route path="jobs/new" element={<JobForm />} />
          <Route path="jobs/:id" element={<RecruiterJobPreview />} />
          <Route path="jobs/:id/edit" element={<JobForm />} />
          <Route path="jobs/:id/applicants" element={<Applicants />} />
          <Route path="interviews" element={<Interviews />} />
          <Route path="analytics" element={lazyPage(<Analytics />)} />
          <Route path="company" element={<Company />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute role="ADMIN" />}>
        <Route path="admin" element={<AppShell />}>
          <Route index element={lazyPage(<Overview />)} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="companies" element={<AdminCompanies />} />
          <Route path="jobs" element={<AdminJobs />} />
          <Route path="applications" element={<AdminApplications />} />
        </Route>
      </Route>

      <Route path="dashboard" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
