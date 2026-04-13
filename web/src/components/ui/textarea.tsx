import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "nipux-mono flex min-h-[96px] w-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] leading-6 tracking-[0.08em] text-[var(--foreground)] outline-none placeholder:text-[var(--subtle-foreground)] focus-visible:border-[var(--border-strong)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
