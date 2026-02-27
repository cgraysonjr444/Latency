import { assertEquals } from "jsr:@std/assert";

Deno.test("Latency Logic - Basic Calculation Check", () => {
  const start = 1000;
  const end = 1055;
  const latency = Math.round(end - start);
  
  // Verify your > 50ms logic threshold
  assertEquals(latency, 55);
  assertEquals(latency > 50, true);
});

// Example of a mock fetch test
Deno.test("API Route - Check URL", () => {
  const url = "https://api.latency.app/grooves";
  assertEquals(url.includes("grooves"), true);
});
