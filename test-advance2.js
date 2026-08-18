import { invoke } from "@tauri-apps/api/core";

async function test() {
  try {
    const clients = await invoke("get_clients");
    if (clients.length > 0) {
      const client = clients[0];
      console.log(`Adding advance of 200 to client: ${client.name} (${client.id})`);
      
      const payload = {
        client_id: client.id,
        amount: 200,
        date: new Date().toISOString(),
        payment_mode: "Chèque",
        reference: "CHQ-123456",
        bank: "BEA",
        issuer_name: "Test Gérant",
        notes: "Test d'avance par chèque"
      };
      
      const advance = await invoke("add_client_advance", { data: payload });
      console.log("Added advance:", advance);
      
      const updatedClients = await invoke("get_clients");
      console.log("Clients after:", updatedClients.map(c => ({ id: c.id, name: c.name, advance: c.advance_payment })));
      
      const advances = await invoke("get_client_advances", { clientId: client.id });
      console.log("Client advances:", advances);
    }
  } catch (e) {
    console.error("Test error:", e);
  }
}

test();
