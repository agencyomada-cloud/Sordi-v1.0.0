import { db } from "./database";

const STANDARD_PRODUCTS = [
    { code: "0/3", name: "0/3", unit_price: 600, tva_rate: 19 },
    { code: "3/8", name: "3/8", unit_price: 700, tva_rate: 19 },
    { code: "8/15", name: "8/15", unit_price: 700, tva_rate: 19 },
    { code: "15/25", name: "15/25", unit_price: 650, tva_rate: 19 },
    { code: "TVC", name: "Tout Venant Carrière", unit_price: 350, tva_rate: 19 },
    { code: "TVS", name: "Tout Venant Oued", unit_price: 450, tva_rate: 19 },
    { code: "40/70", name: "40/70", unit_price: 550, tva_rate: 19 },
];

export async function seedProducts() {
    try {
        const existingProducts = await db.products.getAll();
        let seededCount = 0;

        for (const p of STANDARD_PRODUCTS) {
            const exists = existingProducts.some(ep => ep.code === p.code || ep.name === p.name);
            if (!exists) {
                await db.products.create({
                    code: p.code,
                    name: p.name,
                    unit_price: p.unit_price,
                    tva_rate: p.tva_rate,
                    unit: "tonne",
                    display_order: 0
                });
                seededCount++;
            }
        }

        return seededCount;
    } catch (error) {
        console.error("Error seeding products:", error);
        throw error;
    }
}
