import { type ButtonHTMLAttributes, useId } from "react";
import { Icon, type IconName } from "./Icon";
import "./dock.css";

interface DockTipProps {
  id: string;
  label: string;
  hint: string;
}

/** The hover card above a dock icon. Only the hint is referenced as the description; the label
    is already the control's accessible name. */
export function DockTip({ id, label, hint }: DockTipProps) {
  return (
    <span className="dock-tip" aria-hidden="true">
      <strong>{label}</strong>
      <span id={id}>{hint}</span>
    </span>
  );
}

interface DockButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children" | "type"> {
  icon: IconName;
  label: string;
  hint: string;
  /** Anchors the card to the button's right edge so it stays on screen at the end of the dock. */
  tipAlign?: "end";
}

export function DockButton({ icon, label, hint, tipAlign, className, ...rest }: DockButtonProps) {
  const id = useId();
  return (
    <button
      {...rest}
      type="button"
      className={`control-button dock-button${className ? ` ${className}` : ""}`}
      aria-label={label}
      aria-describedby={id}
      data-tip-align={tipAlign}
    >
      <Icon name={icon} size={18} />
      <DockTip id={id} label={label} hint={hint} />
    </button>
  );
}
