
import { Ollama } from "ollama";

// Using window.location.origin to ensure the SDK doesn't try to append :11434 to a relative path
const ollama = new Ollama({
    // Use relative path for both dev (Vite proxy) and prod (Express proxy)
    host: (typeof window !== 'undefined' ? window.location.origin : '') + "/ollama-proxy",
    headers: {
        // Fallback for local dev; in production the Express server will inject this
        Authorization: "Bearer " + (process.env.OLLAMA_API_KEY || ''),
    },
});

const SYSTEM_INSTRUCTION = `You are a professional receipt analysis expert. 
Your task is to extract items and their total amounts from receipt images. 
Ignore taxes and discounts if they are already factored into the item price, 
otherwise list them as separate items. 
Return only a JSON object containing an array of items with 'name' and 'amount' fields. 
The 'amount' should be a number. 
Example response format: {"items": [{"name": "Burger", "amount": 150}, {"name": "Coke", "amount": 35}]}`;

export async function analyzeReceipt(base64Image: string): Promise<{ name: string; amount: number }[]> {
    // Debug check: Verify if API Key is loaded in the frontend
    console.log("Ollama SDK Initialization Check:");
    console.log("- Host: /ollama-proxy (via window.location.origin)");
    console.log("- API Key Status:", process.env.OLLAMA_API_KEY ? `Defined (Length: ${process.env.OLLAMA_API_KEY.length})` : "Undefined");
    if (process.env.OLLAMA_API_KEY) {
        console.log("- API Key Prefix:", process.env.OLLAMA_API_KEY.substring(0, 8) + "...");
    }

    try {
        const base64Data = base64Image.substring(base64Image.indexOf(',') + 1);

        const response = await ollama.chat({
            model: "gemini-3-flash-preview:latest",
            messages: [
                {
                    role: 'user',
                    content: SYSTEM_INSTRUCTION + "\n\nPlease analyze this receipt.",
                    images: [base64Data]
                }
            ],
            stream: false,
            format: "json"
        });

        let content = response.message.content;

        // Fix: Strip markdown code blocks if the model returns them
        if (content && (content.includes('```json') || content.includes('```'))) {
            content = content.replace(/```json\s?|```/g, '').trim();
        }

        const result = JSON.parse(content || '{"items": []}');
        return result.items || [];
    } catch (error: any) {
        console.error("Error analyzing receipt with Ollama SDK:", error);
        throw new Error(`分析失敗：${error.message || "請檢查網路連線或 API Key"}`);
    }
}
