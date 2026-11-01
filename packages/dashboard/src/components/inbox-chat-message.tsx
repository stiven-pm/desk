"use client";

import {
  parseAssistantUi,
  sanitizeDeskHtml,
  MAX_HTML_CHARS,
  type DeskUiBlock,
} from "@chatbot/chat-ui";
import { useMemo } from "react";
import { AssistantMarkdown } from "@/components/assistant-markdown";

const DESK_CHOICE_PILL =
  "inline-block rounded-full border border-[#d8dcde] bg-[#f8f9f9] px-3 py-1 text-xs text-[#2f3941]";

function ReadOnlyDeskBlock({ block }: { block: DeskUiBlock }) {
  if (block.type === "choices") {
    return (
      <div className="flex flex-wrap gap-2">
        {block.items.map((item, i) => (
          <span key={i} className={DESK_CHOICE_PILL} aria-hidden>
            {item.label}
          </span>
        ))}
      </div>
    );
  }
  if (block.type === "product_catalog") {
    return (
      <span className={DESK_CHOICE_PILL} aria-hidden>
        {block.buttonLabel}
      </span>
    );
  }
  if (block.type === "products") {
    return (
      <div className="space-y-1.5">
        {block.items.map((item, i) => (
          <div
            key={i}
            className="flex w-full items-baseline justify-between gap-2 rounded-md border border-[#d8dcde] bg-[#f8f9f9] px-3 py-2 text-left text-sm text-[#68737d]"
          >
            <span className="min-w-0 font-medium text-[#2f3941]">{item.title}</span>
            <span className="shrink-0 text-xs">
              {[item.badge, item.price].filter(Boolean).join(" · ") || "Ver"}
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (block.type === "offers") {
    return (
      <div className="space-y-3">
        {block.items.map((item, i) => (
          <div key={i} className="space-y-2">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt=""
                className="max-h-72 w-full rounded-lg bg-[#f8f9f9] object-contain"
              />
            ) : null}
            <div>
              <p className="text-sm font-medium">{item.title}</p>
              {item.subtitle ? (
                <p className="mt-1 whitespace-pre-wrap text-sm text-[#68737d]">
                  {item.subtitle}
                </p>
              ) : null}
              {item.price ? (
                <p className="text-sm font-semibold">{item.price}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (block.type === "html") {
    const safe = sanitizeDeskHtml(block.html, MAX_HTML_CHARS);
    return (
      <div
        className="space-y-2 text-sm text-[#2f3941] [&_img]:mb-2 [&_img]:max-h-72 [&_img]:w-full [&_img]:rounded-lg [&_img]:bg-[#f8f9f9] [&_img]:object-contain [&_p+p]:mt-2"
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    );
  }
  if (block.type === "external_link") {
    return <span className={DESK_CHOICE_PILL}>{block.label}</span>;
  }
  if (block.type === "cart") {
    return (
      <ul className="space-y-0.5 text-sm">
        {block.lines.map((line) => (
          <li key={line.productId}>
            {line.quantity}× {line.name}
          </li>
        ))}
      </ul>
    );
  }
  return null;
}

export function InboxAssistantMessageBody({ text }: { text: string }) {
  const parsed = useMemo(() => parseAssistantUi(text), [text]);
  return (
    <div className="space-y-2">
      {parsed.prose ? <AssistantMarkdown text={parsed.prose} /> : null}
      {parsed.blocks.map((block, i) => (
        <ReadOnlyDeskBlock key={i} block={block} />
      ))}
    </div>
  );
}

export function InboxThreadBubble({
  role,
  text,
}: {
  role: string;
  text: string;
}) {
  const isVisitor = role === "user";
  const isHuman = role === "human";
  return (
    <div
      className={
        isVisitor
          ? "ml-auto max-w-[90%] w-fit rounded-lg bg-[#edf0f2] px-3 py-2 text-sm text-[#2f3941]"
          : "mr-auto max-w-[95%] w-fit rounded-lg border border-[#d8dcde] bg-white px-3 py-2 text-sm text-[#2f3941]"
      }
    >
      {isVisitor ? (
        <p className="whitespace-pre-wrap">{text}</p>
      ) : isHuman ? (
        <p className="whitespace-pre-wrap">{text}</p>
      ) : (
        <InboxAssistantMessageBody text={text} />
      )}
    </div>
  );
}
