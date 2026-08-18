import { invoke } from "@tauri-apps/api/core";

async function test() {
  try {
    const clients = await invoke("get_clients");
    console.log("Clients in DB:", clients.map(c => ({ 
      id: c.id, 
      name: c.name, 
      advance_payment: c.advance_payment 
    })));
  } catch (e) {
    console.error("Test error:", e);
  }
}

test();
