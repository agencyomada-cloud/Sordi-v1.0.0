import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import EmployeesSection from "@/pages/management/Employees";
import ProjectsSection from "@/pages/management/Projects";
import ScoreSection from "@/pages/management/Score";

type Tab = "employees" | "projects" | "score";

const Management = () => {
    const [activeTab, setActiveTab] = useState<Tab>("employees");

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                <Header />
                <main className="flex-1 p-8 pt-4">
                    <div className="flex flex-col gap-8">
                        <div>
                            <h1 className="text-3xl font-bold text-foreground tracking-tight">Management</h1>
                            <p className="text-muted-foreground mt-1">Gérez vos ressources et projets</p>
                        </div>

                        {/* Top Navigation Bar */}
                        <div className="flex items-center gap-1 p-1 bg-secondary/30 w-fit rounded-2xl border border-border/50">
                            <button
                                onClick={() => setActiveTab("employees")}
                                className={cn(
                                    "px-6 py-2.5 text-sm font-medium transition-all rounded-xl",
                                    activeTab === "employees"
                                        ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                )}
                            >
                                Employés
                            </button>
                            <button
                                onClick={() => setActiveTab("projects")}
                                className={cn(
                                    "px-6 py-2.5 text-sm font-medium transition-all rounded-xl",
                                    activeTab === "projects"
                                        ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                )}
                            >
                                Projets
                            </button>
                            <button
                                onClick={() => setActiveTab("score")}
                                className={cn(
                                    "px-6 py-2.5 text-sm font-medium transition-all rounded-xl",
                                    activeTab === "score"
                                        ? "bg-card text-foreground shadow-sm ring-1 ring-border/50"
                                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                                )}
                            >
                                Score
                            </button>
                        </div>

                        {/* Section Content */}
                        <div className="flex-1">
                            {activeTab === "employees" && <EmployeesSection />}
                            {activeTab === "projects" && <ProjectsSection />}
                            {activeTab === "score" && <ScoreSection />}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Management;
