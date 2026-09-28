/* One source of truth for project icons. The emoji set is the only part of the
   old "accent colour" idea that people actually see, so it stays — but it is
   defined once instead of being copied into every page. */

export const PROJECT_ICONS = [
  { key: "folder", emoji: "📁" },
  { key: "rocket", emoji: "🚀" },
  { key: "chart", emoji: "📊" },
  { key: "sparkles", emoji: "✨" },
  { key: "briefcase", emoji: "💼" },
  { key: "calendar", emoji: "📅" },
  { key: "target", emoji: "🎯" },
  { key: "zap", emoji: "⚡" },
  { key: "heart", emoji: "❤️" },
  { key: "bookmark", emoji: "🔖" },
] as const;

const BY_KEY = new Map<string, string>(PROJECT_ICONS.map((i) => [i.key, i.emoji] as const));

export function projectEmoji(key?: string | null) {
  if (!key) return "📁";
  return BY_KEY.get(key) ?? (key.length <= 2 ? key : "📁");
}
