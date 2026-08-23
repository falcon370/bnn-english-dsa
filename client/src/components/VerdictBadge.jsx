'use client';

/**
 * VerdictBadge — shared component for rendering fact-check verdict badges
 * with a distinctive icon and colour for each class.
 *
 * Props:
 *  verdict  {string}  - 'Credible' | 'Needs Context' | 'Questionable' | 'Likely False' | 'Opinion'
 *  size     {string}  - 'xs' | 'sm' | 'md' (default: 'sm')
 *  showIcon {boolean} - whether to show the leading icon (default: true)
 */

const ICONS = {
  Credible: (
    // Shield with checkmark — trust & verification
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M9.661 2.237a.531.531 0 0 1 .678 0 11.947 11.947 0 0 0 7.078 2.749.5.5 0 0 1 .479.425c.069.52.104 1.05.104 1.589 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 0 1-.332 0C5.26 16.563 2 12.162 2 7c0-.538.035-1.069.104-1.589a.5.5 0 0 1 .48-.425 11.947 11.947 0 0 0 7.077-2.749Zm3.84 6.16a.75.75 0 0 0-1.06-1.06L9 10.34 7.56 8.9a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4-4Z"
        clipRule="evenodd"
      />
    </svg>
  ),
  'Needs Context': (
    // Information circle — needs more info
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
        clipRule="evenodd"
      />
    </svg>
  ),
  Questionable: (
    // Exclamation triangle — caution
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  ),
  'Likely False': (
    // X circle — false / rejected
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
        clipRule="evenodd"
      />
    </svg>
  ),
  Opinion: (
    // Pencil square — editorial / commentary
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
      <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
    </svg>
  ),
};

const STYLES = {
  Credible:       { wrap: 'bg-emerald-50 text-emerald-700 border-emerald-200', ring: '#10b981' },
  'Needs Context':{ wrap: 'bg-amber-50  text-amber-700  border-amber-200',  ring: '#f59e0b' },
  Questionable:   { wrap: 'bg-orange-50 text-orange-700 border-orange-200', ring: '#f97316' },
  'Likely False': { wrap: 'bg-red-50    text-red-700    border-red-200',    ring: '#ef4444' },
  Opinion:        { wrap: 'bg-purple-50 text-purple-700 border-purple-200', ring: '#9333ea' },
};

const SIZE = {
  xs: { badge: 'text-[8px]  px-1.5 py-0.5 gap-1',   icon: 'w-2.5 h-2.5' },
  sm: { badge: 'text-[9px]  px-2   py-0.5 gap-1',   icon: 'w-3   h-3'   },
  md: { badge: 'text-[11px] px-3   py-1   gap-1.5', icon: 'w-3.5 h-3.5' },
};

export function getVerdictRingColor(verdict) {
  return STYLES[verdict]?.ring ?? '#6b7280';
}

export default function VerdictBadge({ verdict, size = 'sm', showIcon = true }) {
  const style  = STYLES[verdict] ?? STYLES['Questionable'];
  const sizing = SIZE[size]      ?? SIZE['sm'];
  const icon   = ICONS[verdict];

  return (
    <span
      className={`
        inline-flex items-center font-black uppercase tracking-widest border
        ${style.wrap} ${sizing.badge}
      `}
    >
      {showIcon && icon && (
        <span className={`${sizing.icon} flex-shrink-0`}>
          {icon}
        </span>
      )}
      {verdict ?? 'Unknown'}
    </span>
  );
}
