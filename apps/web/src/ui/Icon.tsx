import type { JSX, SVGProps } from 'react';

/** Ícones do sistema visual: traço 1,5 em grade 24 (design/minimal/SistemaVisual). */
const PATHS = {
  mic: <><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M19 10.5v1.5a7 7 0 0 1-14 0v-1.5" /><path d="M12 19v2.5" /></>,
  micOff: <><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M19 10.5v1.5a7 7 0 0 1-11.6 5.3" /><path d="M5 10.5v1.5a7 7 0 0 0 .5 2.6" /><path d="M3.5 3.5 20.5 20.5" /></>,
  headphones: <path d="M3.2 14h2.6a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4.6a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1.2a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />,
  headphonesOff: <><path d="M3.2 14h2.6a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4.6a2 2 0 0 1-2-2v-7a9 9 0 0 1 13.4-7.8" /><path d="M20.6 10.4a9 9 0 0 1 .4 2.6v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" /><path d="M3.5 3.5 20.5 20.5" /></>,
  channel: <><path d="M11 5 6 9H2.8v6H6l5 4V5Z" /><path d="M15.5 9.2a4 4 0 0 1 0 5.6" /></>,
  screen: <><rect x="2.5" y="4" width="19" height="13" rx="2.2" /><path d="M9 20.5h6" /></>,
  share: <><rect x="2.5" y="4" width="19" height="13" rx="2.2" /><path d="M9 20.5h6" /><path d="M12 13.5V8" /><path d="m9.6 10.4 2.4-2.4 2.4 2.4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>,
  leave: <><path d="M9.5 21H5.5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 16.5 4.5-4.5L16 7.5" /><path d="M20.5 12H10" /></>,
  invite: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  people: <><path d="M16 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H6.4A3.4 3.4 0 0 0 3 18.4V20" /><circle cx="9.5" cy="8" r="3.4" /><path d="M21 20v-1.6a3.4 3.4 0 0 0-2.6-3.3" /><path d="M15.5 4.7a3.4 3.4 0 0 1 0 6.6" /></>,
  brand: <><path d="M4 18h16" /><path d="M4 18 2.6 8.2l5.2 3.6L12 4.6l4.2 7.2 5.2-3.6L20 18" /></>,
  lock: <><rect x="4" y="10" width="16" height="10" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  copy: <><rect x="8.5" y="8.5" width="12" height="12" rx="2.2" /><path d="M15.5 5.5v-.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h.5" /></>,
  close: <><path d="M6.5 6.5 17.5 17.5" /><path d="M17.5 6.5 6.5 17.5" /></>,
  chevronDown: <path d="M7 10.5 12 15l5-4.5" />,
  camera: <><path d="M3 8.5A2 2 0 0 1 5 6.5h1.6l1.2-2h8.4l1.2 2H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.5Z" /><circle cx="12" cy="13" r="3.4" /></>,
  expand: <><path d="M9 4H4v5" /><path d="M15 4h5v5" /><path d="M15 20h5v-5" /><path d="M9 20H4v-5" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 16.5v-4.2" /><path d="M12 8.4h.01" /></>,
} as const;

export type IconName = keyof typeof PATHS;

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: IconName;
  size?: number;
};

export function Icon({ name, size = 20, ...props }: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
