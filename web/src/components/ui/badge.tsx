import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "nipux-mono inline-flex items-center border px-2 py-1 text-[10px] uppercase tracking-[0.16em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]",
        secondary: "border-[var(--border)] bg-transparent text-[var(--muted-foreground)]",
        success: "border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--foreground)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
