import type { ReactNode } from "react";

export type IconName =
  | "aerial"
  | "arrow"
  | "camera"
  | "chevron"
  | "decision"
  | "gamepad"
  | "github"
  | "help"
  | "layers"
  | "muted"
  | "pause"
  | "photo"
  | "play"
  | "reset"
  | "route"
  | "sound"
  | "split"
  | "timeSpace"
  | "video";

const strokes: Record<IconName, ReactNode> = {
  aerial: (
    <>
      <path d="M2.5 5.5 7 4l6 2 4.5-1.5v10L13 16l-6-2-4.5 1.5Z" />
      <path d="M7 4v10m6-8v10" />
    </>
  ),
  arrow: <path d="M6 14 14 6M7 6h7v7" />,
  camera: (
    <>
      <circle cx="10" cy="10" r="3" />
      <path d="M10 2v3m0 10v3M2 10h3m10 0h3" />
    </>
  ),
  chevron: <path d="m6 8 4 4 4-4" />,
  decision: (
    <>
      <circle cx="10" cy="4.5" r="2" />
      <circle cx="5" cy="15.5" r="2" />
      <circle cx="15" cy="15.5" r="2" />
      <path d="M10 6.5V9l-3.8 4.9M10 9l3.8 4.9" />
    </>
  ),
  gamepad: (
    <>
      <path d="M6.5 6h7a4 4 0 0 1 3.9 4.9l-.7 3a1.7 1.7 0 0 1-2.9.7L12 13H8l-1.8 1.6a1.7 1.7 0 0 1-2.9-.7l-.7-3A4 4 0 0 1 6.5 6Z" />
      <path d="M6.5 8.6v2.8M5.1 10h2.8M13.2 9.2v.1m1.4 1.6v.1" />
    </>
  ),
  help: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M7.9 7.9a2.2 2.2 0 1 1 3.1 2c-.6.3-1 .8-1 1.4v.5m0 2.4v.1" />
    </>
  ),
  github: (
    <path d="M7 16c-2 0-2-1-3-2m9 3v-3c0-1-.3-1.5-.8-1.8 2.6-.3 4.3-1.1 4.3-4.2 0-.9-.3-1.6-.9-2.2.1-.3.4-1.2-.1-2.3 0 0-.7-.2-2.4.9a8.9 8.9 0 0 0-4.3 0C7.1 3.3 6.4 3.5 6.4 3.5c-.5 1.1-.2 2-.1 2.3-.5.6-.9 1.3-.9 2.2 0 3.1 1.8 3.9 4.3 4.2-.5.3-.8.9-.8 1.8v3" />
  ),
  layers: (
    <>
      <path d="m10 3 7 4-7 4-7-4 7-4Z" />
      <path d="m3 10 7 4 7-4M3 13l7 4 7-4" />
    </>
  ),
  muted: <path d="M3 8v4h3l4 3V5L6 8H3m10 0 4 4m0-4-4 4" />,
  pause: <path d="M8 5v10m4-10v10" />,
  photo: (
    <>
      <path d="M3 7h3l1.5-2h5L14 7h3v8H3Z" />
      <circle cx="10" cy="11" r="2.5" />
    </>
  ),
  play: <path d="m7 5 8 5-8 5V5Z" fill="currentColor" strokeWidth="1" />,
  reset: <path d="M4 9a6 6 0 1 1 1 5m-1-9v4h4" />,
  route: (
    <>
      <circle cx="5" cy="15" r="2" />
      <path d="M7 15h5.5a2.75 2.75 0 0 0 0-5.5h-5a2.75 2.75 0 0 1 0-5.5H15m-2-2 2 2-2 2" />
    </>
  ),
  sound: <path d="M3 8v4h3l4 3V5L6 8H3m10-.5a3.5 3.5 0 0 1 0 5m2-7a6.5 6.5 0 0 1 0 9" />,
  split: (
    <>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
      <path d="M10 4.5v11" />
    </>
  ),
  timeSpace: <path d="M3 3v14h14M6 14l3-5h3l3-5m-4.5 10 2-3.5" />,
  video: (
    <>
      <rect x="2.5" y="5.5" width="10.5" height="9" rx="1.5" />
      <path d="m13 9 4.5-2.5v7L13 11" />
    </>
  ),
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.45"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {strokes[name]}
    </svg>
  );
}
