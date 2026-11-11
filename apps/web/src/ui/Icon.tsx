import type { ReactNode } from "react";

type IconName = "arrow" | "camera" | "chevron" | "github" | "layers" | "pause" | "play" | "reset";

const strokes: Record<IconName, ReactNode> = {
  arrow: <path d="M6 14 14 6M7 6h7v7" />,
  camera: (
    <>
      <circle cx="10" cy="10" r="3" />
      <path d="M10 2v3m0 10v3M2 10h3m10 0h3" />
    </>
  ),
  chevron: <path d="m6 8 4 4 4-4" />,
  github: (
    <path d="M7 16c-2 0-2-1-3-2m9 3v-3c0-1-.3-1.5-.8-1.8 2.6-.3 4.3-1.1 4.3-4.2 0-.9-.3-1.6-.9-2.2.1-.3.4-1.2-.1-2.3 0 0-.7-.2-2.4.9a8.9 8.9 0 0 0-4.3 0C7.1 3.3 6.4 3.5 6.4 3.5c-.5 1.1-.2 2-.1 2.3-.5.6-.9 1.3-.9 2.2 0 3.1 1.8 3.9 4.3 4.2-.5.3-.8.9-.8 1.8v3" />
  ),
  layers: (
    <>
      <path d="m10 3 7 4-7 4-7-4 7-4Z" />
      <path d="m3 10 7 4 7-4M3 13l7 4 7-4" />
    </>
  ),
  pause: <path d="M8 5v10m4-10v10" />,
  play: <path d="m7 5 8 5-8 5V5Z" fill="currentColor" strokeWidth="1" />,
  reset: <path d="M4 9a6 6 0 1 1 1 5m-1-9v4h4" />,
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
