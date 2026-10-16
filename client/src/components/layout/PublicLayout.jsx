import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { homeFor } from '../../lib/format';
import Logo from './Logo';
import Button from '../ui/Button';

export default function PublicLayout() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden items-center gap-6 text-sm font-medium text-muted sm:flex" aria-label="Primary">
              <Link to="/jobs" className="hover:text-ink">Browse jobs</Link>
              <a href="/#how" className="hover:text-ink">How it works</a>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {user ? <Button to={homeFor(user.role)} size="sm">Open dashboard</Button> : (
              <><Button to="/login" variant="ghost" size="sm">Sign in</Button><Button to="/register" size="sm">Create account</Button></>
            )}
          </div>
        </div>
      </header>
      <Outlet />
      <footer className="mt-20 border-t border-line py-8 text-center text-sm text-muted">Shortlist — applicant tracking with explainable AI matching.</footer>
    </div>
  );
}
