export default function Loading() {
  return (
    <main className="ink-splash">
      <div className="ink-splash-brand">
        <svg className="fv-mark" viewBox="0 0 64 64" width="76" height="76" aria-hidden="true">
          <rect className="fv-mark-tile" x="4" y="4" width="56" height="56" rx="17" />
          <path className="fv-mark-stroke" pathLength={1} d="M19 44V20h14M19 32h11" />
          <path className="fv-mark-stroke fv-mark-stroke-v" pathLength={1} d="M35 20l7.5 24L50 20" />
        </svg>
        <span className="ink-splash-name">FieldVision</span>
        <span className="ink-splash-sub">Analytics</span>
      </div>
      <div className="ink-splash-track">
        <div className="ink-splash-bar" />
      </div>
    </main>
  );
}
