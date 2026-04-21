import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert at extracting data from Indian poultry "Delivery Chalan" (DC) PDFs from chicken/broiler trading companies (Suguna, Venkys, etc.).

Extract these fields and return JSON via the provided tool. Match values exactly as printed (do not invent).
The cage table has rows with: Cage / Crate No, Quantity (number of birds), Weight (in kg).
If a field is missing, leave it empty string. Numbers must be numbers, not strings.`;

const TOOL = {
  type: "function" as const,
  function: {
    name: "extract_dc",
    description: "Extract delivery chalan fields and cage list from a poultry DC document",
    parameters: {
      type: "object",
      properties: {
        order_no: { type: "string", description: "Order Number / DC Number" },
        trader_name: { type: "string" },
        order_date: { type: "string", description: "Order date as printed (e.g. 12/04/2026 or 12-04-2026)" },
        lifting_date: { type: "string", description: "Lifting / dispatch date as printed" },
        vehicle_no: { type: "string" },
        driver_name: { type: "string" },
        driver_no: { type: "string", description: "Driver phone number" },
        farm: { type: "string", description: "Farm name and location" },
        lot_number: { type: "string" },
        supervisor: { type: "string" },
        cages: {
          type: "array",
          description: "Each row of the cage/crate table",
          items: {
            type: "object",
            properties: {
              cage_no: { type: "string", description: "Cage / crate / Sr. number as printed" },
              birds: { type: "number", description: "Quantity = number of birds in that cage" },
              weight_kg: { type: "number", description: "Weight in kilograms (decimal)" },
            },
            required: ["cage_no", "birds", "weight_kg"],
            additionalProperties: false,
          },
        },
      },
      required: ["order_no", "cages"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileBase64, fileName } = await req.json();
    if (!fileBase64) throw new Error("fileBase64 is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isPdf = (fileName ?? "").toLowerCase().endsWith(".pdf");
    const mime = isPdf ? "application/pdf" : "image/jpeg";
    const dataUrl = `data:${mime};base64,${fileBase64}`;

    const body = {
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract every cage row and all header fields from this DC document." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      tools: [TOOL],
      tool_choice: { type: "function", function: { name: "extract_dc" } },
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again in a minute." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Lovable workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "AI extraction failed: " + t.slice(0, 200) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "Could not parse DC. Please use manual entry." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const args = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-dc error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});