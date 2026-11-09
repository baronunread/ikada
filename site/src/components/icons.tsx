/** The chrome's 16-grid stroke icons (Waterline's set). Decorative: hidden from assistive tech. */
const paths = {
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </>
  ),
  sun: (
    <>
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
    </>
  ),
  moon: <path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7z" />,
  github: (
    <path d="M6 14v-2.2c-2.5.6-3-1-3-1-.4-1-1-1.3-1-1.3-.8-.5.1-.5.1-.5.9.1 1.4.9 1.4.9.8 1.4 2.1 1 2.6.8.1-.6.3-1 .6-1.2-2-.2-4.1-1-4.1-4.4 0-1 .3-1.8.9-2.4-.1-.2-.4-1.1.1-2.4 0 0 .8-.2 2.5.9a8.6 8.6 0 0 1 4.6 0c1.7-1.2 2.5-.9 2.5-.9.5 1.3.2 2.2.1 2.4.6.6.9 1.4.9 2.4 0 3.4-2.1 4.2-4.1 4.4.3.3.6.8.6 1.6V14" />
  ),
  copy: (
    <>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
    </>
  ),
  check: <path d="m3 8.5 3 3 7-7" />,
  arrow: <path d="M3 8h10M9 4l4 4-4 4" />,
  chev: <path d="m6 4 4 4-4 4" />,
  menu: <path d="M2.5 5h11M2.5 11h11" />,
  x: <path d="m4 4 8 8M12 4l-8 8" />,
  ext: <path d="M9 2.5h4.5V7M13.5 2.5 7 9M11 9.5V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V5.5A.5.5 0 0 1 3 5h3.5" />,
  file: (
    <>
      <path d="M9 2.5H4.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V6z" />
      <path d="M9 2.5V6h3.5" />
    </>
  ),
  box: (
    <>
      <path d="M2.5 5 8 2.5 13.5 5v6L8 13.5 2.5 11z" />
      <path d="M2.5 5 8 7.5 13.5 5M8 7.5v6" />
    </>
  ),
  sparkle: (
    <path d="M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3M4.2 4.2l1.6 1.6M10.2 10.2l1.6 1.6M4.2 11.8l1.6-1.6M10.2 5.8l1.6-1.6" />
  ),
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, className = "i" }: { name: IconName; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}
