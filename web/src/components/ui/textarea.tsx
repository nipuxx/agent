import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "nipux-mono flex min-h-[96px] w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--field-bg)] px-[var(--control-padding-x)] py-2 text-[13px] leading-6 tracking-[var(--input-letter-spacing)] text-[var(--foreground)] shadow-[var(--control-shadow)] [text-transform:var(--input-transform)] outline-none placeholder:text-[var(--subtle-foreground)] focus-visible:border-[var(--border-strong)]",
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
