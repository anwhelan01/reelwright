import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none transition-[transform,background-color,color,opacity,border-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 active:not-disabled:scale-[0.96]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "bg-elevated text-foreground border border-border hover:border-foreground/25",
        ghost: "text-muted-foreground hover:text-foreground hover:bg-elevated",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-elevated",
        rec: "bg-rec text-foreground hover:bg-rec/90",
      },
      size: {
        default: "h-11 px-4 text-sm rounded-[var(--radius-md)]",
        sm: "h-9 px-3 text-xs rounded-[var(--radius-sm)]",
        lg: "h-12 px-5 text-sm rounded-[var(--radius-lg)]",
        icon: "size-11 rounded-[var(--radius-md)]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
