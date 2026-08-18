import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * The app had zero modal/dialog component before this — every "are you
 * sure?" style interaction either didn't exist or was hand-rolled inline.
 * Covers the accessibility basics a real dialog needs that are easy to
 * forget when hand-rolling one per use case:
 *   - role="dialog" + aria-modal so screen readers announce it correctly
 *   - focus moves into the dialog on open, returns to whatever triggered
 *     it on close (otherwise focus silently stays on a now-hidden button)
 *   - Escape closes it
 *   - background scroll is locked while open (a plain fixed overlay
 *     without this lets the page scroll underneath, which feels broken)
 * Does not implement full Tab-cycle focus trapping (keeping focus
 * physically locked inside the dialog on Tab/Shift+Tab) — the above
 * covers the most commonly-hit gaps without the complexity of manually
 * enumerating focusable elements.
 */
export default function Modal({ open, onClose, title, children, footer }) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    triggerRef.current = document.activeElement;
    dialogRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    // Click-outside-to-dismiss is a convenience shortcut, not the only way to
    // close this dialog — Escape (handled above) and the Close button below
    // are the accessible, keyboard-operable paths, so this backdrop doesn't
    // need its own keyboard handler.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      {/* stopPropagation keeps a click inside the dialog panel from bubbling to
          the backdrop above and closing the modal; role="dialog" + tabIndex
          already make this the focus target, so no separate keyboard handler
          is needed for the click itself. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg bg-surface shadow-xl outline-none"
      >
        {title && (
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 id="modal-title" className="font-display text-lg font-bold text-gray-900">{title}</h2>
            <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
