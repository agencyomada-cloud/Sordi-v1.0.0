import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useCreateClient, useDeleteClient } from "@/hooks/useClients";
import { useCreateProduct } from "@/hooks/useProducts";
import { useCreateInvoice, useDeleteInvoice } from "@/hooks/useInvoices";
import { db } from "@/lib/database";
import { Check, X, Loader2, Play } from "lucide-react";

interface TestStep {
    id: string;
    name: string;
    status: "pending" | "running" | "passed" | "failed";
    message?: string;
}

export default function VerificationTest() {
    const [steps, setSteps] = useState<TestStep[]>([
        { id: "1", name: "Création client de test", status: "pending" },
        { id: "2", name: "Création produit de test", status: "pending" },
        { id: "3", name: "Création facture", status: "pending" },
        { id: "4", name: "Vérification statistiques client", status: "pending" },
        { id: "5", name: "Vérification historique produits", status: "pending" },
        { id: "6", name: "Nettoyage données de test", status: "pending" },
    ]);

    const [isRunning, setIsRunning] = useState(false);

    // Hooks
    const createClient = useCreateClient();
    const createProduct = useCreateProduct();
    const createInvoice = useCreateInvoice();
    const deleteClient = useDeleteClient();
    // We don't have a hook for deleting products exposed easily, but we can use db directly
    const deleteInvoice = useDeleteInvoice();

    const updateStep = (id: string, status: TestStep["status"], message?: string) => {
        setSteps((prev) =>
            prev.map((step) =>
                step.id === id ? { ...step, status, message } : step
            )
        );
    };

    const runTest = async () => {
        if (isRunning) return;
        setIsRunning(true);

        // Reset steps
        setSteps(prev => prev.map(s => ({ ...s, status: "pending", message: undefined })));

        let clientId = "";
        let productId = "";
        let invoiceId = "";
        const testSuffix = Math.floor(Math.random() * 10000).toString();

        try {
            // Step 1: Create Client
            updateStep("1", "running");
            const clientName = `Test Client ${testSuffix}`;
            const client = await createClient.mutateAsync({
                name: clientName,
                email: `test${testSuffix}@example.com`,
                phone: "0555000000",
                address: "Test Address",
            });
            clientId = client.id;
            updateStep("1", "passed", `Client créé: ${clientName} (${clientId})`);

            // Step 2: Create Product
            updateStep("2", "running");
            const productCode = `TEST-${testSuffix}`;
            const productPrice = 1000;
            const product = await createProduct.mutateAsync({
                code: productCode,
                name: `Test Product ${testSuffix}`,
                unit_price: productPrice,
                unit: "U",
            });
            productId = product.id;
            updateStep("2", "passed", `Produit créé: ${productCode} (${productId})`);

            // Step 3: Create Invoice
            updateStep("3", "running");
            const qty = 5;
            const tvaRate = 19;
            // Note: useCreateInvoice expects items array
            const invoice = await createInvoice.mutateAsync({
                client_id: clientId,
                invoice_date: new Date().toISOString().split('T')[0],
                items: [{
                    product_id: productId,
                    quantity: qty,
                    unit_price: productPrice,
                    // tva_rate might be optional or inferred, check CreateInvoiceData in hooks
                    // logic in hook/backend seems to handle tva_rate
                } as any], // Casting as any to bypass potential type mismatch in quick test script if CreateInvoiceData definition varies
                invoice_type: "invoice"
            });
            invoiceId = invoice.id;
            updateStep("3", "passed", `Facture créée: ${invoice.invoice_number}`);

            // Step 4: Verify Client Stats
            updateStep("4", "running");
            // Need a small delay for DB commit/invalidation if async background
            await new Promise(r => setTimeout(r, 1000));

            const invoices = await db.invoices.getAll();
            const clientInvoices = invoices.filter(i => i.client_id === clientId);
            const totalTTC = clientInvoices.reduce((sum, i) => sum + (i.total_ttc || 0), 0);

            if (clientInvoices.length === 1 && totalTTC > 0) {
                updateStep("4", "passed", `Total client vérifié: ${totalTTC.toFixed(2)} DA`);
            } else {
                throw new Error(`Stats incorrectes. Factures: ${clientInvoices.length}, Total: ${totalTTC}`);
            }

            // Step 5: Verify Product History
            updateStep("5", "running");
            const productsHistory = await db.clients.getProducts(clientId);
            const historyItem = productsHistory.find(p => p.product_id === productId);

            if (historyItem && historyItem.total_quantity === qty) {
                updateStep("5", "passed", `Historique vérifié: Quantité ${historyItem.total_quantity}`);
            } else {
                throw new Error(`Historique incorrect. Trouvé: ${JSON.stringify(historyItem)}`);
            }

        } catch (error: any) {
            console.error(error);
            const currentStepIndex = steps.findIndex(s => s.status === "running");
            updateStep(steps[currentStepIndex].id, "failed", error.message || "Erreur inconnue");
        } finally {
            // Step 6: Cleanup
            updateStep("6", "running");
            try {
                if (invoiceId) {
                    await deleteInvoice.mutateAsync(invoiceId);
                }
                if (clientId) await deleteClient.mutateAsync(clientId);
                // We leave product as discussed

                updateStep("6", "passed", "Données de test nettoyées (sauf produit)");
            } catch (e: any) {
                updateStep("6", "failed", `Erreur nettoyage: ${e.message}`);
            }

            setIsRunning(false);
        }
    };

    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                <Header />
                <main className="flex-1 p-8">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold mb-2">Test de Vérification Système</h1>
                        <p className="text-muted-foreground">
                            Ce test automatique vérifie le flux complet de données : création client, produit, facture et statistiques.
                        </p>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                                <span>Étapes du test</span>
                                <Button onClick={runTest} disabled={isRunning}>
                                    {isRunning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                                    {isRunning ? "Test en cours..." : "Lancer le test"}
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {steps.map((step) => (
                                    <div
                                        key={step.id}
                                        className="flex items-center justify-between p-4 border rounded-lg bg-card"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center
                        ${step.status === 'pending' ? 'bg-secondary text-muted-foreground' : ''}
                        ${step.status === 'running' ? 'bg-blue-100 text-blue-600 animate-pulse' : ''}
                        ${step.status === 'passed' ? 'bg-green-100 text-green-600' : ''}
                        ${step.status === 'failed' ? 'bg-red-100 text-red-600' : ''}
                      `}>
                                                {step.status === 'pending' && step.id}
                                                {step.status === 'running' && <Loader2 className="w-4 h-4 animate-spin" />}
                                                {step.status === 'passed' && <Check className="w-4 h-4" />}
                                                {step.status === 'failed' && <X className="w-4 h-4" />}
                                            </div>
                                            <div className="font-medium">{step.name}</div>
                                        </div>
                                        {step.message && (
                                            <div className={`text-sm ${step.status === 'failed' ? 'text-red-600' : 'text-muted-foreground'
                                                }`}>
                                                {step.message}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </main>
            </div>
        </div>
    );
}
