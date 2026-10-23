import type { TableKind } from '../../domain/floor'

/** Table kinds seen from above, for buttons and cards. */
export function KindIcon({ kind, size = 20 }: { kind: TableKind; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      {kind === 'table' && (
        <>
          <rect x="6" y="7" width="12" height="10" rx="1.5" />
          <path d="M9 3.5h2M13 3.5h2M9 20.5h2M13 20.5h2" strokeWidth={2.4} strokeLinecap="round" />
        </>
      )}
      {kind === 'round' && (
        <>
          <circle cx="12" cy="12" r="5.5" />
          <path d="M12 2.8v1.6M12 19.6v1.6M2.8 12h1.6M19.6 12h1.6" strokeWidth={2.4} strokeLinecap="round" />
        </>
      )}
      {kind === 'bar' && (
        <>
          <rect x="3" y="6" width="18" height="5" rx="1.2" />
          <circle cx="6.5" cy="16.5" r="1.6" /><circle cx="12" cy="16.5" r="1.6" /><circle cx="17.5" cy="16.5" r="1.6" />
        </>
      )}
      {kind === 'high' && (
        <>
          <circle cx="12" cy="12" r="3.6" />
          <circle cx="12" cy="4.6" r="1.6" /><circle cx="12" cy="19.4" r="1.6" />
        </>
      )}
      {kind === 'booth' && (
        <>
          <rect x="6" y="8.5" width="12" height="7" rx="1.2" />
          <path d="M4.5 4.5h15M4.5 19.5h15" strokeWidth={2.6} strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}
