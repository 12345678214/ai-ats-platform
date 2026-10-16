import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

export default function Logo({ to = '/', dark = false }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2.5">
      <span className={`grid h-8 w-8 place-items-center rounded-lg ${dark ? 'bg-white text-forest' : 'bg-forest text-white'}`}><Check className="h-5 w-5" strokeWidth={3} /></span>
      <span className={`font-display text-xl font-semibold tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>Shortlist</span>
    </Link>
  );
}
