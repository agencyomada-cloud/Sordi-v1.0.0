import EmployeesSection from "@/pages/management/Employees";

// Projets/Score (the old loosely-typed tracker) were retired in favor of the
// new Projets module (src/pages/Projects.tsx) — see PROJECT_STATE.md. Only
// Employés is left here, so the tab bar that used to switch between the
// three sections is gone too.
const Management = () => {
    return (
        <main className="flex-1 p-8 pt-4">
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Employés & Contrats</h1>
                    <p className="text-xs text-slate-500 mt-1">Gérez votre équipe</p>
                </div>

                <EmployeesSection />
            </div>
        </main>
    );
};

export default Management;
