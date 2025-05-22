import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

console.log("REPLICATE-UPSCALE-DEBUG: Function definition loaded.");

serve(async (req) => {
  console.log("REPLICATE-UPSCALE-DEBUG: Request received:", req.method, req.url);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("REPLICATE-UPSCALE-DEBUG: Handling OPTIONS request.");
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*", 
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const body = await req.json();
    const imageUrl = body.imageUrl;
    console.log("REPLICATE-UPSCALE-DEBUG: Request body parsed. Image URL:", imageUrl);

    if (!imageUrl) {
      console.error("REPLICATE-UPSCALE-DEBUG: imageUrl is missing.");
      return new Response(JSON.stringify({ error: "imageUrl is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Simulate a successful response
    const mockUpscaledUrl = `https://example.com/upscaled-${Date.now()}.png`;
    console.log("REPLICATE-UPSCALE-DEBUG: Simulating successful upscale. URL:", mockUpscaledUrl);
    
    return new Response(JSON.stringify({ upscaledImageUrl: mockUpscaledUrl, message: "Debug response: success" }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (error) {
    console.error("REPLICATE-UPSCALE-DEBUG: Error in function:", error.message, error.stack);
    return new Response(JSON.stringify({ error: `Internal Server Error (Debug): ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}); 