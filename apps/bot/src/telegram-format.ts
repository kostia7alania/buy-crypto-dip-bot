export const escapeTelegramHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

// The direct command path still uses Telegram's legacy Markdown mode. Escape
// only interpolated values; template markup remains authored and reviewable.
export const escapeTelegramMarkdown = (value: string): string =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll("_", "\\_")
    .replaceAll("*", "\\*")
    .replaceAll("`", "\\`")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
