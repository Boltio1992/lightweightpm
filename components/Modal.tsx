"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { fadeScale, motionTransition } from "@/lib/motion";

export default function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}) {
  const reduceMotion = useReducedMotion();
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
      className={`fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/20 p-4 pt-[8vh] ${open ? "" : "pointer-events-none"}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      initial={false}
      animate={{ opacity: open ? 1 : 0 }}
      transition={reduceMotion ? { duration: 0 } : motionTransition.fast}
    >
      <motion.div
        className={`card w-full ${width} shadow-pop`}
        onClick={(e) => e.stopPropagation()}
        initial={false}
        animate={reduceMotion ? { opacity: open ? 1 : 0 } : open ? fadeScale.animate : fadeScale.exit}
        transition={reduceMotion ? { duration: 0 } : motionTransition.normal}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="text-muted transition hover:text-ink" aria-label="Close">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6l-12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </motion.div>
    </motion.div>
  );
}
