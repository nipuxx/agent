import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
        <input
        type={type}
        className={cn(
          "nipux-mono flex h-[var(--control-height)] w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--field-bg)] px-[var(--control-padding-x)] py-2 text-[13px] tracking-[var(--input-letter-spacing)] text-[var(--foreground)] shadow-[var(--control-shadow)] [text-transform:var(--input-transform)] outline-none placeholder:text-[var(--subtle-foreground)] focus-visible:border-[var(--border-strong)]",
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
