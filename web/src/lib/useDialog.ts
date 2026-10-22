import { useEffect, useRef } from "react";

/** Moves focus into a dialog, keeps Tab inside it, closes on Escape, and restores focus on close. */
export function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Read during the first render: an autoFocus inside the dialog fires before effects run.
  const opener = useRef<HTMLElement | null>(typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null);
  useEffect(() => {
    const prev = opener.current;
    const root = ref.current;
    const focusables = () => Array.from(root?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter((el) => el.offsetParent !== null);
    const first = focusables().find((el) => el.matches("input, [autofocus]")) ?? focusables()[0];
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab") return;
      const f = focusables(); if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("keydown", onKey, true); prev?.focus?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}
