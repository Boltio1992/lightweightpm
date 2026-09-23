export const motionDurations = {
  fast: 0.13,
  normal: 0.19,
  slow: 0.26,
} as const;

export const motionEase = [0.22, 1, 0.36, 1] as const;

export const motionTransition = {
  fast: { duration: motionDurations.fast, ease: motionEase },
  normal: { duration: motionDurations.normal, ease: motionEase },
  slow: { duration: motionDurations.slow, ease: motionEase },
} as const;

export const fadeUp = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 },
};

export const fadeScale = {
  initial: { opacity: 0, scale: 0.98, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 6 },
};
