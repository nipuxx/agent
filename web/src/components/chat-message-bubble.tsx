import { cn } from "@/lib/utils";

export function ChatMessageBubble({
  label,
  body,
  role,
}: {
  label: string;
  body: string;
  role: string;
}) {
  const normalizedRole = role === "user" ? "user" : "assistant";
  const showLabel = label && label.toLowerCase() !== normalizedRole;

  return (
    <div className="nipux-message-row" data-role={normalizedRole}>
      <div className={cn("nipux-message-bubble", normalizedRole === "assistant" && "min-w-[120px]")}>
        {showLabel ? <div className="nipux-message-role">{label}</div> : null}
        <div className="nipux-message-body">{body}</div>
      </div>
    </div>
  );
}
