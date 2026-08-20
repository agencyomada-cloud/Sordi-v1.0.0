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
      // richColors intentionally off — it drives each type's background/
      // icon color automatically (that's where the off-brand green success
      // came from). Colors are set explicitly per type below instead.
      closeButton
      expand
      duration={3500}
      style={{ "--width": "360px" } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border/60 group-[.toaster]:shadow-elevated rounded-[6px] font-sans text-sm",
          description: "group-[.toast]:text-muted-foreground text-xs",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground font-medium rounded-[4px]",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground rounded-[4px]",
          // Success uses Sordi Blue instead of the generic green richColors
          // would apply — icons render with fill="currentColor", so
          // coloring the [data-icon] wrapper is enough to recolor the SVG.
          success: "group-[.toaster]:border-primary/30 [&_[data-icon]]:text-primary",
          // Error/warning keep conventional red/amber on purpose — safety
          // and attention expectations there outweigh brand consistency.
          error: "group-[.toaster]:border-rose-500/30 [&_[data-icon]]:text-rose-600",
          warning: "group-[.toaster]:border-amber-500/30 [&_[data-icon]]:text-amber-600",
          info: "group-[.toaster]:border-primary/30 [&_[data-icon]]:text-primary",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
