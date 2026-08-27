import { useState } from "react";
import {
  RiBuildingLine as BuildingIcon,
  RiCheckLine as CheckIcon,
  RiArrowDownSLine as ChevronIcon,
  RiAddLine as AddIcon,
} from "@remixicon/react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@sordi/ui";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { CreateCompanyDialog } from "@/components/layout/CreateCompanyDialog";

interface WorkspaceSwitcherProps {
  /** Icon-only rail mode (desktop collapsed sidebar). */
  iconOnly?: boolean;
}

export function WorkspaceSwitcher({ iconOnly = false }: WorkspaceSwitcherProps) {
  const { activeCompanyId, companies, switchCompany, isReady } = useWorkspace();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const activeCompany = companies.find((c) => c.id === activeCompanyId);

  if (!isReady) return null;

  const renderLogo = (logo: string | null | undefined, size: string) => (
    logo ? (
      <img src={logo} alt="" className={cn(size, "rounded-lg object-cover shrink-0")} />
    ) : (
      <span className={cn(size, "rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0")}>
        <BuildingIcon className="w-3.5 h-3.5" />
      </span>
    )
  );

  return (
    <>
      <div className={cn("px-3 pt-2", iconOnly ? "px-3" : "px-3")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              title={iconOnly ? (activeCompany?.name ?? "Entreprise") : undefined}
              className={cn(
                "w-full flex items-center gap-2.5 py-2 rounded-xl border border-sidebar-border bg-sidebar-foreground/[0.03] hover:bg-sidebar-accent/60 hover:border-sidebar-primary/35 transition-all duration-150",
                iconOnly ? "justify-center px-0" : "px-2.5"
              )}
            >
              {renderLogo(activeCompany?.logo_base64, "w-7 h-7")}
              {!iconOnly && (
                <>
                  <span className="flex-1 min-w-0 text-start">
                    <span className="block text-sm font-semibold text-sidebar-foreground truncate">
                      {activeCompany?.name ?? "Sélectionner"}
                    </span>
                  </span>
                  <ChevronIcon className="w-3.5 h-3.5 shrink-0 text-sidebar-foreground/40" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 rounded-2xl p-1.5">
            <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Entreprises
            </DropdownMenuLabel>
            {companies.map((company) => (
              <DropdownMenuItem
                key={company.id}
                onClick={() => switchCompany(company.id)}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 cursor-pointer"
              >
                {renderLogo(company.logo_base64, "w-6 h-6")}
                <span className="flex-1 min-w-0 truncate text-sm">{company.name}</span>
                {company.id === activeCompanyId && (
                  <CheckIcon className="w-4 h-4 text-primary shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setCreateDialogOpen(true)}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 cursor-pointer text-primary"
            >
              <span className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <AddIcon className="w-3.5 h-3.5" />
              </span>
              <span className="text-sm font-medium">Créer une nouvelle entreprise</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CreateCompanyDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </>
  );
}
