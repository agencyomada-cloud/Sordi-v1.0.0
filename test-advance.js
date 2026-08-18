import { invoke } from "@tauri-apps/api/core";

async function test() {
  try {
    const clients = await invoke("get_clients");
    console.log("Clients:", clients.map(c => ({ id: c.id, name: c.name, advance: c.advance_payment })));
    
    if (clients.length > 0) {
      const client = clients[0];
      console.log(`Adding advance of 500 to client: ${client.name} (${client.id})`);
      
      await invoke("add_client_advance", {
        data: {
          client_id: client.id,
          amount: 500,
          date: new Date().toISOString(),
          payment_mode: "Espèces"
        }
      });
      
      const updatedClients = await invoke("get_clients");
      console.log("Clients after:", updatedClients.map(c => ({ id: c.id, name: c.name, advance: c.advance_payment })));
    }
  } catch (e) {
    console.error("Test error:", e);
  }
}

test();
