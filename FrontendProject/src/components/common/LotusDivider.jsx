import lotus from '../../assets/icon-lotos-slider.svg';

export default function LotusDivider({ className = '' }) {
  return (
    <div
      className={`flex items-center justify-center gap-3 text-ink-mute/70 ${className}`}
      aria-hidden
    >
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-ink/30 to-ink/30" />
      <img
        src={lotus}
        alt=""
        className="h-5 w-5 opacity-70 blend-multiply"
      />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-ink/30 to-ink/30" />
    </div>
  );
}
