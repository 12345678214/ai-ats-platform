import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, Search, FileText, Bookmark, UserRound, Bell, Briefcase, CalendarClock, BarChart3, Building2,
  Users, ClipboardList, Menu, LogOut, X, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import Logo from './Logo';
import { Avatar } from '../ui/Misc';

const NAV = {
  CANDIDATE: [
    { to: '/candidate', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/candidate/jobs', label: 'Browse jobs', icon: Search },
    { to: '/candidate/applications', label: 'Applications', icon: FileText },
    { to: '/candidate/saved', label: 'Saved jobs', icon: Bookmark },
    { to: '/candidate/profile', label: 'Profile & resume', icon: UserRound },
  ],
  RECRUITER: [
    { to: '/recruiter', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/recruiter/jobs', label: 'Jobs & applicants', icon: Briefcase },
    { to: '/recruiter/interviews', label: 'Interviews', icon: CalendarClock },
    { to: '/recruiter/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/recruiter/company', label: 'Company profile', icon: Building2 },
  ],
  ADMIN: [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/companies', label: 'Companies', icon: Building2 },
    { to: '/admin/jobs', label: 'Jobs', icon: Briefcase },
    { to: '/admin/applications', label: 'Applications', icon: ClipboardList },
  ],
};
const ROLE_LABEL = { CANDIDATE: 'Candidate', RECRUITER: 'Recruiter', ADMIN: 'Administrator' };

function Sidebar({ items, user, onNavigate }) {
  return (
    <div className="flex h-full flex-col bg-forest text-white">
      <div className="flex h-16 items-center px-5"><Logo dark to="/" /></div>
      <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Main">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={onNavigate}
            className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/8 hover:text-white'}`}>
            <Icon className="h-[18px] w-[18px]" />{label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <Avatar name={user.name} size={34} />
          <div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="flex items-center gap-1 text-xs text-white/60">{user.role === 'ADMIN' && <ShieldCheck className="h-3 w-3" />}{ROLE_LABEL[user.role]}</p></div>
        </div>
      </div>
    </div>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const items = NAV[user.role];

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (user.role === 'ADMIN') return undefined;
    let active = true;
    const load = () => api.get('/notifications/unread-count').then((r) => active && setUnread(r.data.unread)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    const onRead = () => load();
    window.addEventListener('notifications:changed', onRead);
    return () => { active = false; clearInterval(t); window.removeEventListener('notifications:changed', onRead); };
  }, [user.role, location.pathname]);

  const base = user.role === 'CANDIDATE' ? '/candidate' : '/recruiter';
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-screen lg:block"><Sidebar items={items} user={user} /></aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)} style={{ background: 'rgba(18,59,51,.45)' }}>
          <div className="h-full w-[260px]" style={{ animation: 'slide-in .18s ease-out reverse' }}>
            <button className="absolute right-3 top-3 z-10 rounded-lg bg-white/10 p-1.5 text-white" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            <Sidebar items={items} user={user} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-paper/90 px-4 backdrop-blur sm:px-8">
          <button className="rounded-lg p-2 text-ink hover:bg-line-soft lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            {user.role !== 'ADMIN' && (
              <Link to={`${base}/notifications`} className="relative rounded-lg p-2 text-muted hover:bg-line-soft hover:text-ink" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
                <Bell className="h-5 w-5" />
                {unread > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose px-1 text-[10px] font-semibold text-white">{unread > 9 ? '9+' : unread}</span>}
              </Link>
            )}
            <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-line-soft hover:text-ink"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span></button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8"><Outlet /></main>
      </div>
    </div>
  );
}
