import { invoke } from "@tauri-apps/api/core";

async function test() {
  try {
    const clients = await invoke("get_clients");
    const testClient = clients.find(c => c.name.toLowerCase().includes("test"));
    
    if (testClient) {
      console.log(`Found test client: ${testClient.name} (${testClient.id})`);
      console.log(`Current advance balance: ${testClient.advance_payment}`);
      
      const advances = await invoke("get_client_advances", { clientId: testClient.id });
      console.log(`History of advances:`, advances.map(a => `${a.amount} ${a.payment_mode}`));
      
      const sum = advances.reduce((acc, curr) => acc + curr.amount, 0);
      console.log(`Sum of advances in history: ${sum}`);
    } else {
        console.log("No test client found");
    }
  } catch (e) {
    console.error("Test error:", e);
  }
}

test();
