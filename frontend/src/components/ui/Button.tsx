import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "accent" | "danger" | "ghost";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = "",
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "relative inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 select-none shadow-sm";

    const variantStyles = {
      primary:
        "bg-ink-900 text-white hover:bg-ink-700 active:bg-ink-950 focus-visible:ring-ink-900 shadow-slate-900/10 hover:shadow",
      accent:
        "bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-800 focus-visible:ring-accent-600 shadow-accent-600/20 hover:shadow-md",
      secondary:
        "bg-slate-100 text-ink-900 hover:bg-slate-200 active:bg-slate-300 focus-visible:ring-slate-400 border border-slate-200",
      outline:
        "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 focus-visible:ring-slate-400 hover:shadow-sm",
      danger:
        "bg-white text-risk-high border border-risk-high/30 hover:bg-risk-high/5 hover:border-risk-high/50 active:bg-risk-high/10 focus-visible:ring-risk-high",
      ghost:
        "bg-transparent text-slate-600 hover:text-ink-900 hover:bg-slate-100 active:bg-slate-200 shadow-none focus-visible:ring-slate-400",
    };

    const sizeStyles = {
      xs: "px-2.5 py-1.5 text-xs gap-1.5",
      sm: "px-3 py-1.5 text-xs gap-1.5",
      md: "px-4 py-2 text-sm gap-2",
      lg: "px-5 py-2.5 text-base gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 size={size === "xs" || size === "sm" ? 13 : 16} className="animate-spin shrink-0" />
            <span>{children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            <span>{children}</span>
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
