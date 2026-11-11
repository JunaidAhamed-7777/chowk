import { type PointerEvent, useRef } from "react";

export function ComparisonWipe({
  position,
  onChange,
}: {
  position: number;
  onChange: (position: number) => void;
}) {
  const dragging = useRef<number>(null);

  function move(event: PointerEvent<HTMLDivElement>) {
    const stage = event.currentTarget.parentElement;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    if (bounds.width === 0) return;
    const next = Math.round(((event.clientX - bounds.left) / bounds.width) * 100);
    onChange(Math.max(0, Math.min(100, next)));
  }

  return (
    <div
      className="comparison-wipe"
      style={{ left: `${position}%` }}
      role="slider"
      tabIndex={0}
      aria-label="Comparison wipe"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={position}
      aria-valuetext={`${position}% left simulation`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        dragging.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.focus();
        move(event);
      }}
      onPointerMove={(event) => {
        if (dragging.current === event.pointerId) move(event);
      }}
      onLostPointerCapture={() => {
        dragging.current = null;
      }}
      onDoubleClick={() => onChange(50)}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 10 : 3;
        if (event.key === "ArrowRight") onChange(Math.min(100, position + step));
        else if (event.key === "ArrowLeft") onChange(Math.max(0, position - step));
        else if (event.key === "Home") onChange(0);
        else if (event.key === "End") onChange(100);
        else return;
        event.preventDefault();
      }}
    >
      <span className="wipe-handle" aria-hidden="true">‹ ›</span>
    </div>
  );
}
