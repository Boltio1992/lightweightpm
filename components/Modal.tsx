"use client";

import { useEffect, useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { motionTransition } from "@/lib/motion";

// Slides up from the bottom on touch layouts, scales in on larger screens.
const sheetIn = {
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 12, scale: 1 },
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-lg",
  stickyFooter = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
  /** Set when the body ends in a `.sheet-actions` bar: the body then drops its
      own bottom padding so the bar can sit flush against the sheet edge. */
  stickyFooter?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const headingId = useId();
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (reduceMotion) {
      setMounted(false);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), 220);
    return () => window.clearTimeout(timer);
  }, [open, reduceMotion]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <motion.div
      // Phones: a full-height bottom sheet (thumb reach, one-handed, and the
      // whole thing stays above the on-screen keyboard). Tablet/desktop: the
      // usual centred dialog.
      className={`scroll-area fixed inset-0 z-50 flex overflow-y-auto bg-black/20 p-0 sm:p-4 sm:pt-[8vh] ${
        open ? "" : "pointer-events-none"
      } items-end justify-center sm:items-start`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      initial={false}
      animate={{ opacity: open ? 1 : 0 }}
      transition={reduceMotion ? { duration: 0 } : motionTransition.fast}
    >
      <motion.div
        className={`card w-full ${width} shadow-pop flex h-[100dvh] flex-col rounded-b-none sm:h-auto sm:max-h-[92dvh] sm:rounded-b-lg`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        initial={false}
        animate={reduceMotion ? { opacity: open ? 1 : 0 } : open ? sheetIn.animate : sheetIn.exit}
        transition={reduceMotion ? { duration: 0 } : motionTransition.normal}
      >
        {/* Top padding clears the notch/status bar when the sheet is
            full-height (viewport-fit=cover). */}
        <div
          className="flex flex-none items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5 sm:py-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <h2 id={headingId} className="min-w-0 text-sm font-semibold text-ink">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="tap tap-icon -mr-2 flex-none items-center justify-center px-2 text-muted transition hover:text-ink"
            aria-label="Close"
          >
            <svg className="h-5 w-5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6l-12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {/* Only the body scrolls, so header/footer stay reachable with a thumb. */}
        <div
          className={`scroll-area min-h-0 flex-1 overflow-y-auto px-4 pt-4 sm:px-5 ${
            stickyFooter ? "pb-0" : "pb-4"
          }`}
          style={
            stickyFooter
              ? undefined
              : { paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }
          }
        >
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
