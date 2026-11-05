/** The ikada icon set: 16px line icons on a 1.6px stroke that inherit the text colour. */
import type { ComponentProps } from "react";
import { cn } from "./cn";

type IconProps = ComponentProps<"svg">;

function Icon({ className, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn("size-4 shrink-0", className)}
      {...props}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m3.5 8.5 3 3 6-7" />
  </Icon>
);
export const MinusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 8h8" />
  </Icon>
);
export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m4 6 4 4 4-4" />
  </Icon>
);
export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Icon>
);
export const CopyIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 3.5v-.5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h.5" />
  </Icon>
);
export const ArrowUpRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 11 11 5M6 5h5v5" />
  </Icon>
);

/** The ↩ hook arrow: a straight shaft pointing left, the tail curling up at the right. */
export const UndoIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 10.5h7.25a3.25 3.25 0 0 0 0-6.5H8.5" />
    <path d="M5.5 7.5l-3 3 3 3" />
  </Icon>
);

/** The whole icon turns, and only under motion-safe; otherwise it is a static ring segment. */
export const SpinnerIcon = ({ className, ...props }: IconProps) => (
  <Icon className={cn("motion-safe:animate-spin", className)} {...props}>
    <circle cx="8" cy="8" r="6" opacity="0.25" />
    <path d="M14 8a6 6 0 0 0-6-6" />
  </Icon>
);

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="m10.5 10.5 3 3" />
  </Icon>
);
export const ChevronRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 4 4 4-4 4" />
  </Icon>
);
export const MoreIcon = (props: IconProps) => (
  <Icon {...props} strokeWidth="2.4">
    <path d="M3.5 8h.01M8 8h.01M12.5 8h.01" />
  </Icon>
);
export const MenuIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
  </Icon>
);
/** A panel with its left rail: the collapse toggle of the sidebar. */
export const SidebarIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2" y="2.5" width="12" height="11" rx="2" />
    <path d="M6 2.5v11" />
  </Icon>
);
export const ArrowUpIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 13V3M4 7l4-4 4 4" />
  </Icon>
);
export const ArrowDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 3v10M4 9l4 4 4-4" />
  </Icon>
);
/** Both chevrons: a column that can be sorted. */
export const SortIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m5 6.5 3-3 3 3M5 9.5l3 3 3-3" />
  </Icon>
);
export const InfoIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 7.5V11M8 5.25h.01" />
  </Icon>
);
export const AlertIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 2.5 14 13H2L8 2.5Z" />
    <path d="M8 6.5v3M8 11.5h.01" />
  </Icon>
);
export const HomeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 7.5 8 3l5.5 4.5V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V7.5Z" />
    <path d="M6.5 13.5V9.5h3v4" />
  </Icon>
);
export const FolderIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1.4 1.5h5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7Z" />
  </Icon>
);
export const RocketIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 2c2.5 1.2 3.5 3.6 3.5 6L10 11H6L4.5 8c0-2.4 1-4.8 3.5-6Z" />
    <circle cx="8" cy="6.5" r="1" />
    <path d="M6 11.5 5 14M10 11.5l1 2.5" />
  </Icon>
);
export const LogsIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="2" width="10" height="12" rx="1.5" />
    <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
  </Icon>
);
export const DatabaseIcon = (props: IconProps) => (
  <Icon {...props}>
    <ellipse cx="8" cy="4" rx="5" ry="1.8" />
    <path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8S13 9 13 8" />
  </Icon>
);
export const GlobeIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="8" cy="8" r="6" />
    <path d="M2 8h12M8 2c2 1.7 2.8 3.7 2.8 6S10 12.3 8 14c-2-1.7-2.8-3.7-2.8-6S6 3.7 8 2Z" />
  </Icon>
);
export const KeyIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="5.5" cy="10.5" r="2.5" />
    <path d="m7.3 8.7 5.2-5.2M10.5 5.5l1.5 1.5" />
  </Icon>
);
export const CardIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
    <path d="M2 6.5h12" />
  </Icon>
);
export const SettingsIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="8" cy="8" r="2" />
    <path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.8 3.8l1 1M11.2 11.2l1 1M12.2 3.8l-1 1M4.8 11.2l-1 1" />
  </Icon>
);
export const ActivityIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M1.5 8h3l2-5 3 10 2-5h3" />
  </Icon>
);
export const InboxIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 9.5 4 3.5h8l1.5 6v3a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-3Z" />
    <path d="M2.5 9.5h3.2l.8 1.5h3l.8-1.5h3.2" />
  </Icon>
);
export const EyeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" />
    <circle cx="8" cy="8" r="2" />
  </Icon>
);
export const EyeOffIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2 2l12 12" />
    <path d="M6.6 3.8A6.2 6.2 0 0 1 8 3.5C12 3.5 14.5 8 14.5 8a11 11 0 0 1-2 2.5M9.5 12.2a6 6 0 0 1-1.5.3C4 12.5 1.5 8 1.5 8a11 11 0 0 1 2.6-3.1" />
    <path d="M6.6 6.6a2 2 0 0 0 2.8 2.8" />
  </Icon>
);
export const ChevronLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m10 4-4 4 4 4" />
  </Icon>
);
export const LogOutIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6.5 2.5h-3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3M10 5l3 3-3 3M13 8H6" />
  </Icon>
);
export const UserIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="8" cy="5.5" r="2.5" />
    <path d="M3 13.5c.5-2.4 2.5-3.5 5-3.5s4.5 1.1 5 3.5" />
  </Icon>
);
export const ShieldIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 2 3 3.8v3.9c0 3 2.1 5.2 5 6.3 2.9-1.1 5-3.3 5-6.3V3.8L8 2Z" />
  </Icon>
);
export const CpuIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4" y="4" width="8" height="8" rx="1.5" />
    <path d="M6.5 6.5h3v3h-3zM6 2v2M10 2v2M6 12v2M10 12v2M2 6h2M2 10h2M12 6h2M12 10h2" />
  </Icon>
);

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 3.5v9M3.5 8h9" />
  </Icon>
);
/** Up and down chevrons: a switcher trigger. */
export const SelectorIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m5 6 3-3 3 3M5 10l3 3 3-3" />
  </Icon>
);
/** Four tiles: a list of sprouts. */
export const AppsIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1.2" />
    <rect x="9" y="2.5" width="4.5" height="4.5" rx="1.2" />
    <rect x="2.5" y="9" width="4.5" height="4.5" rx="1.2" />
    <rect x="9" y="9" width="4.5" height="4.5" rx="1.2" />
  </Icon>
);
export const GaugeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 11a5.5 5.5 0 1 1 11 0" />
    <path d="m8 11 2.5-3.5" />
  </Icon>
);
export const BookIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 3.5c1.8-.6 3.5-.4 5 .8 1.5-1.2 3.2-1.4 5-.8v9c-1.8-.6-3.5-.4-5 .8-1.5-1.2-3.2-1.4-5-.8z" />
    <path d="M8 4.3v9" />
  </Icon>
);
export const BoltIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 2 4 9h4l-1 5 5-7H8z" />
  </Icon>
);
export const PauseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5.5 3.5v9M10.5 3.5v9" />
  </Icon>
);
export const PlayIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 3.5v9l7-4.5z" />
  </Icon>
);
export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />
  </Icon>
);
export const RefreshIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M13 8a5 5 0 1 1-1.5-3.6" />
    <path d="M13 2.5v3h-3" />
  </Icon>
);
export const LinkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7 9a2.5 2.5 0 0 0 3.5 0l2-2A2.5 2.5 0 0 0 9 3.5l-.7.7" />
    <path d="M9 7a2.5 2.5 0 0 0-3.5 0l-2 2A2.5 2.5 0 0 0 7 12.5l.7-.7" />
  </Icon>
);
export const WebhookIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="4.5" cy="11.5" r="1.5" />
    <circle cx="11.5" cy="11.5" r="1.5" />
    <circle cx="8" cy="4.5" r="1.5" />
    <path d="M7.2 5.8 5 10M6 11.5h4M9 5.8l2 4.2" />
  </Icon>
);
export const LockIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </Icon>
);
export const MailIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
    <path d="m2.5 4.5 5.5 4 5.5-4" />
  </Icon>
);
export const GitHubIcon = ({ className, ...props }: IconProps) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" className={cn("size-4 shrink-0", className)} {...props}>
    <path
      fill="currentColor"
      d="M8 .2a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.4 7.4 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.7-3.6 3.9.3.3.6.8.6 1.5v2.2c0 .2.1.5.6.4A8 8 0 0 0 8 .2"
    />
  </svg>
);
/** Stacked cylinders, lighter than DatabaseIcon: the Storage section. */
export const StorageIcon = (props: IconProps) => (
  <Icon {...props}>
    <ellipse cx="8" cy="4" rx="5" ry="1.8" />
    <path d="M3 4v4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8v4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V8" />
  </Icon>
);
/** An open-top bin: an R2 bucket. */
export const BucketIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 4.5h11l-1.2 8.2a1 1 0 0 1-1 .8H4.7a1 1 0 0 1-1-.8z" />
    <path d="M5 4.5V3.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
  </Icon>
);
/** Three lines stepping in: a queue. */
export const QueueIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 4.5h10M3 8h10M3 11.5h6" />
  </Icon>
);
/** A cube: a Durable Object. */
export const CubeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 2 13 4.8v6.4L8 14l-5-2.8V4.8z" />
    <path d="M3 4.8 8 7.6l5-2.8M8 7.6V14" />
  </Icon>
);
export const TableIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
    <path d="M2.5 6.5h11M2.5 10h11M6.5 6.5V13" />
  </Icon>
);
export const FileIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 2.5H4.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V6z" />
    <path d="M9 2.5V6h3.5" />
  </Icon>
);
export const ImageIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
    <circle cx="6" cy="6.5" r="1.2" />
    <path d="m3 12 3.5-3.5 2.5 2.5 1.5-1.5L13 12" />
  </Icon>
);
export const VideoIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5.5 4.5v7l6-3.5z" />
  </Icon>
);
export const UploadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 10.5V3M5 6l3-3 3 3M3 10.5v1.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1.5" />
  </Icon>
);
export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 3v7.5M5 7.5l3 3 3-3M3 10.5v1.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1.5" />
  </Icon>
);
/** A prompt chevron and a cursor: the terminal. */
export const TerminalIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m3 4.5 3.5 3.5L3 11.5M8 12h5" />
  </Icon>
);
export const ClockIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M8 5v3l2 1.5" />
  </Icon>
);
/** A four-point spark: start from a template. */
export const SparkleIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 2.5c.4 2.7 2.8 5.1 5.5 5.5-2.7.4-5.1 2.8-5.5 5.5-.4-2.7-2.8-5.1-5.5-5.5 2.7-.4 5.1-2.8 5.5-5.5z" />
  </Icon>
);
export const ListIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 4.5h7M6 8h7M6 11.5h7M3 4.5h.01M3 8h.01M3 11.5h.01" />
  </Icon>
);
export const GridIcon = AppsIcon;
export const FilterIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 3.5h11L9.5 8.5v4l-3-1.5v-2.5z" />
  </Icon>
);
