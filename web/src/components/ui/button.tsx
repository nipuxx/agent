import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "nipux-mono inline-flex items-center justify-center gap-2 whitespace-nowrap border text-[11px] uppercase tracking-[var(--button-letter-spacing)] rounded-[var(--radius-control)] shadow-[var(--control-shadow)] transition-colors disabled:pointer-events-none disabled:opacity-50 outline-none",
  {
    variants: {
      variant: {
        default:
          "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90",
        secondary:
          "border-[var(--border)] bg-[var(--surface-2)] text-[var(--foreground)] hover:bg-[var(--surface-3)]",
        outline:
          "border-[var(--border-strong)] bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-2)]",
        ghost: "border-transparent bg-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
      },
      size: {
        default: "h-[var(--control-height)] px-[var(--control-padding-x)] py-2",
        sm: "h-[calc(var(--control-height)_-_6px)] px-3",
        lg: "h-[calc(var(--control-height)_+_6px)] px-7",
        icon: "h-[var(--control-height)] w-[var(--control-height)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
