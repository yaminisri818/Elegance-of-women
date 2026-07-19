import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${Deno.env.get("GEMINI_API_KEY")}`;

// --- Supabase client (service role for DB writes) ---
function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// --- Gemini helpers ---

async function callGeminiText(prompt: string): Promise<string> {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  };
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  return text;
}

async function callGeminiVision(prompt: string, imageBase64: string, mimeType: string): Promise<string> {
  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
      ],
    }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  };
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini Vision error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");
  return text;
}

// Parse JSON from Gemini text (handles markdown code fences)
function parseJsonFromText(text: string): any {
  let cleaned = text.trim();
  // Remove markdown code fences
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  // Find first { or [ and last } or ]
  const firstBrace = cleaned.search(/[{[]/);
  const lastBrace = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return JSON.parse(cleaned);
}

// --- Route handlers ---

async function handleRecommendation(body: any): Promise<Response> {
  const { imageBase64, mimeType, gender, style, dressColor } = body;
  if (!imageBase64) return jsonError("Image is required", 400);

  const prompt = `You are an expert jewellery stylist AI. Analyze this person's photo and provide jewellery recommendations.
Consider their face shape, skin tone, and overall appearance.

User preferences:
- Gender: ${gender || "Female"}
- Preferred style: ${style || "Modern"}
- Dress color: ${dressColor || "Not specified"}

Respond in JSON format with this exact structure:
{
  "analysis": {
    "face_shape": "<detected face shape>",
    "skin_tone": "<detected skin tone>",
    "hair_color": "<detected hair color>",
    "overall_style": "<brief style assessment>"
  },
  "recommendations": {
    "earrings": { "type": "<specific earring style>", "reason": "<detailed explanation>" },
    "necklace": { "type": "<specific necklace style>", "reason": "<detailed explanation>" },
    "bangles": { "type": "<specific bangle style>", "reason": "<detailed explanation>" },
    "rings": { "type": "<specific ring style>", "reason": "<detailed explanation>" },
    "bracelets": { "type": "<specific bracelet style>", "reason": "<detailed explanation>" }
  },
  "summary": "<brief personalized summary>"
}`;

  const text = await callGeminiVision(prompt, imageBase64, mimeType || "image/jpeg");
  const result = parseJsonFromText(text);
  return jsonResponse({ success: true, ...result });
}

async function handleGiftPlanner(body: any): Promise<Response> {
  const { occasion, budgetMin, budgetMax, recipient, jewelleryType, metal } = body;
  if (!occasion) return jsonError("Occasion is required", 400);

  const prompt = `You are an expert jewellery gift advisor. Recommend jewellery gifts for the following occasion.

Occasion: ${occasion}
Budget: ₹${budgetMin || 0} - ₹${budgetMax || 5000}
Recipient: ${recipient || "Not specified"}
Preferred jewellery type: ${jewelleryType || "Any"}
Preferred metal: ${metal || "Any"}

Provide 5 specific gift recommendations in JSON format:
{
  "recommendations": [
    {
      "name": "<product name>",
      "type": "<jewellery type>",
      "estimated_price": <number>,
      "reason": "<why this is perfect for this occasion and recipient>",
      "gift_appeal": "<what makes it special as a gift>"
    }
  ],
  "occasion_advice": "<general advice for gifting jewellery for this occasion>"
}`;

  const text = await callGeminiText(prompt);
  const result = parseJsonFromText(text);
  return jsonResponse({ success: true, ...result });
}

async function handleCoupleMatch(body: any): Promise<Response> {
  const { brideName, groomName, initials, jewelleryType, metal, engraving } = body;
  if (!brideName || !groomName) return jsonError("Both names are required", 400);

  const prompt = `You are a jewellery design expert specializing in couple's jewellery. Suggest matching couple jewellery sets.

Bride: ${brideName}
Groom: ${groomName}
Initials: ${initials || "N/A"}
Jewellery type: ${jewelleryType || "rings"}
Metal preference: ${metal || "Gold"}
Engraving: ${engraving || "None"}

Respond in JSON format:
{
  "suggestions": [
    {
      "name": "<set name>",
      "bride_piece": "<description of bride's piece>",
      "groom_piece": "<description of groom's piece>",
      "design_description": "<detailed design description>",
      "estimated_price": <number>,
      "symbolism": "<meaning behind the design>"
    }
  ],
  "engraving_suggestions": ["<3 engraving ideas>"],
  "summary": "<romantic summary>"
}`;

  const text = await callGeminiText(prompt);
  const result = parseJsonFromText(text);
  return jsonResponse({ success: true, ...result });
}

async function handleExchange(body: any): Promise<Response> {
  const { imageBase64, mimeType, weight, metalType, description } = body;
  if (!imageBase64) return jsonError("Image is required", 400);

  const prompt = `You are a jewellery valuation expert. Analyze this jewellery item and estimate its exchange value.

Known details:
- Metal type: ${metalType || "Unknown"}
- Weight: ${weight || "Unknown"} grams
- Description: ${description || "None"}

Based on the image, assess the item and provide an estimated exchange valuation.
IMPORTANT: This is only an AI estimate and not a final valuation.

Respond in JSON format:
{
  "assessment": {
    "metal_type": "<detected or confirmed metal>",
    "estimated_purity": "<purity estimate>",
    "condition": "<condition assessment>",
    "estimated_weight": "<weight estimate if visible>",
    "design_era": "<possible era or style>"
  },
  "valuation": {
    "estimated_value": <number>,
    "buyback_value": <number>,
    "exchange_credit": <number>,
    "bonus_offer": <number>,
    "disclaimer": "This is an AI-estimated value. Final valuation will be determined after physical inspection."
  },
  "recommendations": "<advice for the customer>"
}`;

  const text = await callGeminiVision(prompt, imageBase64, mimeType || "image/jpeg");
  const result = parseJsonFromText(text);
  return jsonResponse({ success: true, ...result });
}

async function handleDesignJewellery(body: any): Promise<Response> {
  const { imageBase64, mimeType, metal } = body;
  if (!imageBase64) return jsonError("Sketch image is required", 400);

  const prompt = `You are a master jewellery designer. A customer has uploaded a hand-drawn sketch of their dream jewellery piece.
Analyze the sketch and describe the design in detail.

Preferred metal: ${metal || "Gold"}

Respond in JSON format:
{
  "design_description": "<detailed description of the jewellery design>",
  "design_name": "<creative name for this design>",
  "style": "<design style classification>",
  "materials": {
    "primary_metal": "<metal recommendation>",
    "gemstones": ["<recommended gemstones if any>"],
    "embellishments": ["<any additional embellishments>"]
  },
  "estimated_costs": {
    "manufacturing_cost": <number>,
    "material_cost": <number>,
    "selling_price": <number>,
    "currency": "INR"
  },
  "estimated_delivery_days": <number>,
  "craftsmanship_notes": "<notes about crafting complexity>",
  "customization_suggestions": "<suggestions for improvement>"
}`;

  const text = await callGeminiVision(prompt, imageBase64, mimeType || "image/jpeg");
  const result = parseJsonFromText(text);
  return jsonResponse({ success: true, ...result });
}

async function handleTrending(body: any): Promise<Response> {
  const { category } = body;

  const prompt = `You are a jewellery trend forecaster. Generate current trending jewellery recommendations.
${category ? `Focus on: ${category}` : "Cover all jewellery types"}

Provide 8 trending pieces in JSON format:
{
  "trends": [
    {
      "name": "<trending piece name>",
      "type": "<jewellery type>",
      "trend_reason": "<why it's trending now>",
      "trend_level": "<Viral|High Trend|Rising|Seasonal>",
      "celebrity_inspired": <true|false>,
      "estimated_price": <number>,
      "style_tip": "<how to wear it>"
    }
  ],
  "seasonal_insights": "<current season jewellery trends>"
}`;

  const text = await callGeminiText(prompt);
  const result = parseJsonFromText(text);
  return jsonResponse({ success: true, ...result });
}

async function handleSurpriseGift(body: any): Promise<Response> {
  const { productName, recipientName, occasion, budget, relationship } = body;
  if (!recipientName) return jsonError("Recipient name is required", 400);

  const prompt = `You are a luxury gifting expert. Generate a personalized gift experience.

Product: ${productName || "Jewellery gift"}
Recipient: ${recipientName}
Occasion: ${occasion || "Surprise"}
Budget: ₹${budget || "Not specified"}
Relationship: ${relationship || "Not specified"}

Respond in JSON format:
{
  "gift_message": "<heartfelt personalized gift message>",
  "gift_wrapping_recommendation": {
    "style": "<wrapping style>",
    "color_theme": "<color scheme>",
    "ribbon_type": "<ribbon recommendation>",
    "card_style": "<greeting card recommendation>"
  },
  "delivery_suggestion": {
    "ideal_date": "<suggested delivery timing>",
    "delivery_method": "<delivery recommendation>",
    "surprise_element": "<creative surprise idea>"
  },
  "presentation_tips": ["<3 tips for presenting the gift>"]
}`;

  const text = await callGeminiText(prompt);
  const result = parseJsonFromText(text);
  return jsonResponse({ success: true, ...result });
}

// --- Utilities ---

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400): Response {
  return jsonResponse({ success: false, error: message }, status);
}

// --- Main handler ---

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Check API key
  if (!Deno.env.get("GEMINI_API_KEY")) {
    return jsonError("GEMINI_API_KEY is not configured. Please set it as an edge function secret.", 500);
  }

  try {
    const url = new URL(req.url);
    const action = url.pathname.split("/").pop() || "";
    const body = await req.json();
    const { feature } = body;

    switch (feature) {
      case "recommendation":
        return await handleRecommendation(body);
      case "gift-planner":
        return await handleGiftPlanner(body);
      case "couple-match":
        return await handleCoupleMatch(body);
      case "exchange":
        return await handleExchange(body);
      case "design":
        return await handleDesignJewellery(body);
      case "trending":
        return await handleTrending(body);
      case "surprise-gift":
        return await handleSurpriseGift(body);
      default:
        return jsonError(`Unknown feature: ${feature}`, 400);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    // Check if it's a JSON parse error from Gemini response
    if (msg.includes("JSON")) {
      return jsonError("AI returned an invalid response. Please try again.", 502);
    }
    return jsonError(msg, 500);
  }
});
