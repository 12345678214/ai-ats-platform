import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand-600 shadow-sm disabled:bg-brand/50',
  secondary: 'border border-line bg-white text-ink hover:bg-paper disabled:text-faint',
  ghost: 'text-muted hover:bg-line-soft hover:text-ink',
  danger: 'bg-rose text-white hover:bg-[#a93a33] disabled:bg-rose/50',
  dangerOutline: 'border border-rose/40 bg-white text-rose hover:bg-rose-50',
  dark: 'bg-forest text-white hover:bg-forest-2',
};
const SIZES = { sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2' };

export default function Button({ variant = 'primary', size = 'md', loading = false, to, icon: Icon, className = '', children, disabled, ...rest }) {
  const cls = `inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-colors ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  const content = (
    <>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </>
  );
  if (to) return <Link to={to} className={cls} {...rest}>{content}</Link>;
  return <button className={cls} disabled={disabled || loading} {...rest}>{content}</button>;
}
