import { useEffect } from "react";

const menuSelector = "details.event-menu[open]";

function closeAll(except?: Node | null) {
  for (const menu of document.querySelectorAll<HTMLDetailsElement>(menuSelector)) {
    if (!except || !menu.contains(except)) menu.open = false;
  }
}

/**
 * Drop-down menus are native <details> elements, which stay open until their summary is clicked
 * again. Close them on a press anywhere else, after choosing one of their actions, and on Escape.
 */
export function useDismissableMenus() {
  useEffect(() => {
    const onPointer = (event: PointerEvent) => closeAll(event.target as Node | null);
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const action = target?.closest("details.event-menu > :not(summary) button");
      if (action) action.closest<HTMLDetailsElement>("details")?.removeAttribute("open");
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAll();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
}
