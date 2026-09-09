import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      offset="24px"
      richColors
      closeButton
      expand={false}
      visibleToasts={3}
      gap={8}
      duration={3000}
      style={{ "--width": "350px" } as React.CSSProperties}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white/95 dark:group-[.toaster]:bg-slate-900/95 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-slate-900 dark:group-[.toaster]:text-slate-100 group-[.toaster]:border group-[.toaster]:border-slate-200/80 dark:group-[.toaster]:border-slate-800/80 group-[.toaster]:shadow-[0_12px_36px_-6px_rgba(0,0,0,0.12)] rounded-2xl font-sans text-xs font-medium py-2.5 px-4",
          title: "text-xs font-medium text-slate-800 dark:text-slate-100 tracking-tight",
          description: "group-[.toast]:text-slate-500 dark:group-[.toast]:text-slate-400 text-[11px] leading-relaxed",
          actionButton: "group-[.toast]:bg-slate-900 group-[.toast]:text-white font-medium rounded-xl text-xs",
          cancelButton: "group-[.toast]:bg-slate-100 group-[.toast]:text-slate-600 rounded-xl text-xs",
          closeButton: "!bg-white dark:!bg-slate-800 !border-slate-200/80 dark:!border-slate-700 !text-slate-400 hover:!text-slate-700 dark:hover:!text-slate-200",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
