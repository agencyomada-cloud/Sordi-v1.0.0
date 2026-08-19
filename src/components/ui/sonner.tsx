import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      expand={false}
      duration={3500}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border/60 group-[.toaster]:shadow-elevated rounded-[6px] font-sans text-sm",
          description: "group-[.toast]:text-muted-foreground text-xs",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground font-medium rounded-[4px]",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground rounded-[4px]",
          success: "group-[.toaster]:border-emerald-500/30",
          error: "group-[.toaster]:border-rose-500/30",
          warning: "group-[.toaster]:border-amber-500/30",
          info: "group-[.toaster]:border-primary/30",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
