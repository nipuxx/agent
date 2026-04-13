import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
        <input
        type={type}
        className={cn(
          "nipux-mono flex h-11 w-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] uppercase tracking-[0.08em] text-[var(--foreground)] outline-none placeholder:text-[var(--subtle-foreground)] focus-visible:border-[var(--border-strong)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
