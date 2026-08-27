import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      offset="20px"
      richColors
      // richColors now drives each type's background/icon/border color
      // (success=green, error=red, warning=amber, info=blue) — the previous
      // per-type overrides below are gone since they'd fight richColors'
      // own colors rather than complement them. Explicitly chosen over the
      // brand-tinted alternative (see git history on this file).
      closeButton
      expand
      duration={3500}
      style={{ "--width": "360px" } as React.CSSProperties}
      toastOptions={{
        classNames: {
          // bg-card/border/text apply to plain untyped toasts — richColors
          // only paints toasts that carry a type (success/error/warning/info).
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border/60 group-[.toaster]:shadow-elevated rounded-2xl font-sans text-sm",
          description: "group-[.toast]:text-muted-foreground text-xs",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground font-medium rounded-full",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground rounded-full",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
