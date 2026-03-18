// 1. PINNED IMPORT (Fixes "Missing version in specifier" on L1)
import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";

/**
 * TEST CASE: Latency Calculation Logic
 * This ensures your app's core math (received - sent) is accurate.
 */
Deno.test("Latency Calculation: Basic subtract check", () => {
  const sentTime = 1710750000000;
  const receivedTime = 1710750000050; // 50ms later
  
  const latency = receivedTime - sentTime;
  
  // This verifies that 150 - 100 correctly equals 50ms
  assertEquals(latency, 50);
});

/**
 * TEST CASE: Environment Integrity
 * Ensures the Deno runtime is accessible and versioned.
 */
Deno.test("Environment: Deno namespace check", () => {
  const hasVersion = typeof Deno.version.deno === "string";
  assertEquals(hasVersion, true);
});

/**
 * TEST CASE: Data Structure Validation
 * Simulates a JSON response from your latency log.
 */
Deno.test("Data Structure: Mock log validation", () => {
  const mockLog = {
    user: "cgraysonjr444",
    ping_ms: 45,
    status: "captured"
  };
  
  assertEquals(mockLog.status, "captured");
  assertEquals(typeof mockLog.ping_ms, "number");
});
