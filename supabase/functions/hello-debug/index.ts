import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

console.log("HELLO-DEBUG: Function definition loaded.");

serve(async (req) => {
  console.log("HELLO-DEBUG: Request received:", req.method, req.url);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("HELLO-DEBUG: Handling OPTIONS request.");
    return new Response("ok", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", 
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer",
      },
    });
  }

  try {
    const body = await req.json();
    const imageUrl = body.imageUrl; // Keep this to match client payload
    console.log("HELLO-DEBUG: Request body parsed. Payload:", body);

    if (!imageUrl) { // Still check for it as client sends it
      console.error("HELLO-DEBUG: imageUrl is missing in payload.");
      // Return a 200 but with an error message for easier debugging if this is the case
      return new Response(JSON.stringify({ message: "HELLO-DEBUG: imageUrl is missing.", error: true }), {
        status: 200, // Changed to 200 to see if any response gets through
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const mockMessage = `Hello from HELLO-DEBUG! Input imageUrl was: ${imageUrl}. Timestamp: ${Date.now()}`;
    console.log("HELLO-DEBUG: Sending successful mock response.", mockMessage);
    
    return new Response(JSON.stringify({ message: mockMessage, upscaledImageUrl: `https://example.com/debugged-${Date.now()}.png` }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (error) {
    console.error("HELLO-DEBUG: Error in function:", error.message, error.stack);
    return new Response(JSON.stringify({ error: `Internal Server Error (HELLO-DEBUG): ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}); 