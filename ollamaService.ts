
const SYSTEM_INSTRUCTION = `You are a professional receipt analysis expert. 
Your task is to extract items and their total amounts from receipt images. 
Ignore taxes and discounts if they are already factored into the item price, 
otherwise list them as separate items. 
Return only a JSON object containing an array of items with 'name' and 'amount' fields. 
The 'amount' should be a number. 
Example response format: {"items": [{"name": "Burger", "amount": 150}, {"name": "Coke", "amount": 35}]}`;

export async function analyzeReceipt(base64Image: string): Promise<{ name: string; amount: number }[]> {
    // Debug check: Verify if API Key is loaded in the frontend
    console.log("Ollama Analysis Started (Direct Fetch):");
    console.log("- API Key Status:", process.env.OLLAMA_API_KEY ? `Defined (Length: ${process.env.OLLAMA_API_KEY.length})` : "Undefined");

    try {
        const base64Data = base64Image.substring(base64Image.indexOf(',') + 1);
        const host = (typeof window !== 'undefined' ? window.location.origin : '') + "/ollama-proxy";

        const response = await fetch(`${host}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OLLAMA_API_KEY || ''}`
            },
            body: JSON.stringify({
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
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const data = await response.json();
        let content = data.message?.content;

        // Fix: Strip markdown code blocks if the model returns them
        if (content && (content.includes('```json') || content.includes('```'))) {
            content = content.replace(/```json\s?|```/g, '').trim();
        }

        const result = JSON.parse(content || '{"items": []}');
        return result.items || [];
    } catch (error: any) {
        console.error("Error analyzing receipt with fetch:", error);
        throw new Error(`分析失敗：${error.message || "請檢查網路連線或 API Key"}`);
    }
}
