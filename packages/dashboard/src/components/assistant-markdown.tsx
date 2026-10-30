"use client";

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownProseToHtml(raw: string): string {
  let s = escapeHtml(raw);
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline text-[#1f73b7]">$1</a>',
  );
  return s;
}

export function AssistantMarkdown({ text }: { text: string }) {
  const html = markdownProseToHtml(text);
  return (
    <div
      className="whitespace-pre-wrap break-words [&_strong]:font-semibold [&_em]:italic"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
