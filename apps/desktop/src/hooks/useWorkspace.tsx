import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { db, type Company, type CreateCompanyData } from "@/lib/database";
import { logError } from "@/lib/errorLogger";

const ACTIVE_COMPANY_KEY = "sordi.workspace.activeCompanyId";

interface WorkspaceContextValue {
  /** The company every scoped query/mutation in the app reads/writes
   *  against. Empty string until the companies list has loaded at least
   *  once — callers gate their queries on `isReady`, not on this being
   *  non-empty, so a render never fires a request with no company at all. */
  activeCompanyId: string;
  companies: Company[];
  isReady: boolean;
  // STRICT SINGLE-ENTERPRISE LOCK: no switchCompany here — Sordi supports
  // exactly one company per install (see create_company's hard block in
  // commands.rs), so there is nothing to switch between. createCompany
  // still exists solely for onboarding's one-time first-company creation
  // (SetupWizard) — the backend refuses any call after that.
  createCompany: (data: CreateCompanyData) => Promise<Company>;
  isCreatingCompany: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function loadStoredCompanyId(): string {
  try {
    return localStorage.getItem(ACTIVE_COMPANY_KEY) || "";
  } catch {
    return "";
  }
}

function storeCompanyId(id: string) {
  try {
    localStorage.setItem(ACTIVE_COMPANY_KEY, id);
  } catch {
    // localStorage unavailable (e.g. private mode) — the in-memory
    // activeCompanyId still works for the rest of this session.
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [activeCompanyId, setActiveCompanyId] = useState<string>(loadStoredCompanyId);
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);

  const { data: companies, isSuccess } = useQuery({
    queryKey: ["companies"],
    queryFn: () => db.companies.getAll(),
    // The whole app depends on this resolving before any scoped query fires
    // — companies rarely change, so a long staleTime avoids a refetch storm
    // every time a page mounts.
    staleTime: 5 * 60_000,
  });

  // Reconcile the stored/selected id against what's actually in the
  // database once the companies list loads: falls back to the first
  // registered company if nothing was stored yet, or if the stored id no
  // longer exists (e.g. profile was created on a different install).
  useEffect(() => {
    if (!isSuccess || !companies) return;
    const stillExists = companies.some((c) => c.id === activeCompanyId);
    if (!stillExists && companies.length > 0) {
      setActiveCompanyId(companies[0].id);
      storeCompanyId(companies[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, companies]);

  // Internal only — used by createCompany to select the newly-created (or
  // onboarding-updated) company, never exposed on the public context value.
  const switchCompany = (id: string) => {
    if (id === activeCompanyId) return;
    setActiveCompanyId(id);
    storeCompanyId(id);
    // Every company-scoped query is keyed with activeCompanyId as part of
    // its queryKey (see the individual entity hooks), so a plain
    // invalidateQueries({}) — everything — is the simplest way to guarantee
    // no stale cross-company data lingers on screen after a switch.
    queryClient.invalidateQueries();
  };

  const createCompany = async (data: CreateCompanyData): Promise<Company> => {
    setIsCreatingCompany(true);
    try {
      const company = await db.companies.create(data);
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      switchCompany(company.id);
      toast.success(`Espace "${company.name}" créé`);
      return company;
    } catch (error) {
      toast.error("Erreur lors de la création de l'entreprise");
      logError("Company creation error", error);
      throw error;
    } finally {
      setIsCreatingCompany(false);
    }
  };

  const value = useMemo<WorkspaceContextValue>(() => ({
    activeCompanyId,
    companies: companies ?? [],
    isReady: isSuccess && !!activeCompanyId,
    createCompany,
    isCreatingCompany,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [activeCompanyId, companies, isSuccess, isCreatingCompany]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/** Every company-scoped hook (useClients, useInvoices, ...) reads
 *  activeCompanyId from here to filter its query and to stamp new records —
 *  never hits db.companies directly. Throws outside WorkspaceProvider, same
 *  fail-fast convention as the rest of this codebase's context hooks. */
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}
