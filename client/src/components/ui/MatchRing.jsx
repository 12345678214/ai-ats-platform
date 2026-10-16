import { scoreTone } from '../../lib/format';

// The product's signature element: a ring showing how well an applicant fits the job.
export default function MatchRing({ score, size = 56, stroke = 5, pending = false, showLabel = false }) {
  const tone = scoreTone(pending ? null : score);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = pending || score == null ? 0 : Math.max(0, Math.min(100, score));
  return (
    <div className="inline-flex flex-col items-center gap-1" title={pending || score == null ? 'Score pending' : `${Math.round(value)}% match`}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={`Match score ${score == null ? 'pending' : Math.round(value) + ' percent'}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e3e9e6" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone.color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
        </svg>
        <span className="absolute inset-0 grid place-items-center font-display font-semibold" style={{ fontSize: size * 0.3, color: tone.color }}>
          {pending || score == null ? '…' : Math.round(value)}
        </span>
      </div>
      {showLabel && <span className="text-xs font-medium" style={{ color: tone.color }}>{tone.label}</span>}
    </div>
  );
}
