import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface GlowButtonProps extends React.ComponentProps<typeof Button> {
  children: React.ReactNode;
}

export const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn(
          "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold glow-orange transition-all duration-200",
          className
        )}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

GlowButton.displayName = "GlowButton";
