// src/components/ui/badge.tsx
import React from "react";
import { cn } from "@/lib/utils";

// Define the possible variant types
type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

// Type the component props
interface BadgeProps {
  className?: string;
  variant?: BadgeVariant;
  [key: string]: any;
}

export const Badge = ({ 
  className = "", 
  variant = "default", 
  ...props 
}: BadgeProps) => {
  const variants: Record<BadgeVariant, string> = {
    default: "bg-primary text-primary-foreground hover:bg-primary/80",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/80",
    outline: "text-foreground border",
  };

  return (
    <div 
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant as BadgeVariant],
        className
      )} 
      {...props} 
    />
  );
};
