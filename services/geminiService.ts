
import { GoogleGenAI } from "@google/genai";
import { storageService } from "./storage";
import { TravelRequest, SystemSettings, ChatActionData, TravelPolicy, AppFeature, TravelerDetails, QuotationOption, TravelServiceItem } from "../types";

const TODAY = new Date().toISOString().split('T')[0];
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- API ADAPTERS ---

export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Handle both data:URL with base64 and raw base64 if needed
            const base64String = result.includes(',') ? result.split(',')[1] : result;
            resolve({
                inlineData: {
                    data: base64String,
                    mimeType: file.type
                }
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const callGemini = async (prompt: string | any[], config: SystemSettings['apiConfigs']['gemini'], jsonMode: boolean = false) => {
    if (!config.apiKey) throw new Error("Gemini API Key is missing");
    try {
        const ai = new GoogleGenAI({ apiKey: config.apiKey });
        const contents = Array.isArray(prompt) ? prompt : [{ text: prompt }];
        
        // Decide model based on task complexity or config
        const modelName = config.model || 'gemini-3-flash-preview';

        const response = await ai.models.generateContent({
            model: modelName, 
            contents: { parts: contents as any },
            config: jsonMode ? { responseMimeType: "application/json" } : undefined
        });

        if (!response.text) throw new Error("Empty response from Gemini");
        return response.text;
    } catch (error) {
        console.error("Gemini API Error:", error);
        throw error;
    }
};

const generateText = async (prompt: string | any[], jsonMode: boolean = false, feature: AppFeature = 'CHAT'): Promise<string> => {
    const settings = storageService.getSettings();
    const provider = settings.featureMapping[feature] || 'GEMINI';

    if (provider === 'MOCK') {
        await delay(settings.latencySimulation);
        return `[MOCK] Response from ${feature}... (Configure API Key to use Real AI)`;
    }

    if (provider === 'GEMINI') {
        return callGemini(prompt, settings.apiConfigs.gemini, jsonMode);
    }
    
    // Fallback/Default
    return callGemini(prompt, settings.apiConfigs.gemini, jsonMode); 
};

// --- PUBLIC FUNCTIONS ---

export const translateContent = async (text: string, targetLanguageCode: 'th' | 'en' | 'zh'): Promise<string> => {
    const langMap = { th: 'Thai', en: 'English (Business/Formal)', zh: 'Chinese (Simplified)' };
    const targetLang = langMap[targetLanguageCode] || 'English';
    
    const prompt = `
        Role: Expert Linguist & Corporate Travel Assistant.
        Task: Translate the input text to "${targetLang}".
        
        Guidelines:
        1. **Context Aware**: The text is likely about travel, booking, business meetings, or justifications.
        2. **Fix Slang/Typos**: Interpret "weird words" or slang intelligently.
        3. **Tone**: Formal and polite (Corporate Standard).
        4. **Output**: Return ONLY the final translated text string. No explanations.

        Input Text:
        "${text}"
    `;

    try {
        return await generateText(prompt, false, 'CHAT');
    } catch (error) {
        console.error("Translation Error:", error);
        return text; 
    }
};

export const parseVendorQuote = async (emailText: string): Promise<QuotationOption[]> => {
    const prompt = `
        You are an AI assistant for a Corporate Travel Agent.
        Analyze the following email text from a travel agency/vendor.
        The email might contain **multiple options** (e.g., Option 1: Thai Airways, Option 2: Emirates).
        
        Task: Extract separate quotation options.
        
        Input Email Text:
        "${emailText}"

        Return a JSON Array of 'QuotationOption':
        [
            {
                "id": "gen_id_1",
                "name": string (e.g., "Option 1: TG - Direct"),
                "totalAmount": number (Sum of all service costs in this option),
                "remark": string (Brief summary, e.g. "Non-refundable, includes luggage"),
                "services": [
                    { 
                        "id": "gen_svc_1",
                        "type": "FLIGHT" | "HOTEL" | "CAR", 
                        "actualCost": number,
                        "flightNumber": string,
                        "hotelName": string,
                        "bookingReference": string,
                        "details": string
                    }
                ]
            }
        ]
        
        If only one option exists, return array with 1 element.
        Map fields intelligently. If hotel name is found, put in 'hotelName' property of service.
    `;

    try {
        const text = await generateText(prompt, true, 'OCR');
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        // Ensure structure matches TS types roughly
        return parsed.map((opt: any) => ({
            ...opt,
            isSelected: false,
            services: opt.services.map((s: any) => ({
                ...s,
                // Ensure required ServiceBase fields
                id: s.id || `SVC-${Math.random()}`,
                type: s.type || 'FLIGHT' 
            }))
        }));
    } catch (error) {
        console.error("Parse Quote Error:", error);
        return [];
    }
};

export const parsePolicyDocument = async (file: File): Promise<Partial<TravelPolicy>> => {
    try {
        const imagePart = await fileToGenerativePart(file);
        const promptText = `
            Analyze this travel policy document image. Extract limits and rules.
            JSON Structure: { "defaultHotelLimit": { "domestic": number, "international": number }, "perDiem": number }
            If values are not found, use sensible defaults or null.
        `;
        const text = await generateText([imagePart, { text: promptText }], true, 'OCR');
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        throw new Error("Policy extraction failed.");
    }
};

export interface IntentResult {
    intent: "CREATE_REQUEST" | "CHECK_STATUS" | "GENERAL_CHAT" | "GENERATE_DOC" | "UPDATE_STATUS";
    travelRequest?: Partial<TravelRequest>;
    conversationalResponse: string;
    generatedDocument?: { name: string, type: string };
    statusResults?: TravelRequest[];
    statusUpdate?: { requestId: string; status: string };
}

export const parseTravelIntent = async (
    userInput: string, 
    existingRequests: TravelRequest[],
    language: 'th' | 'en' | 'zh' = 'th',
    userContext?: TravelerDetails
): Promise<IntentResult> => {
  const settings = storageService.getSettings();
  
  if (settings.featureMapping['CHAT'] === 'MOCK') {
    await delay(1000);
    return {
        intent: "GENERAL_CHAT",
        conversationalResponse: "[MOCK] AI is in mock mode. Please configure API key in Settings."
    };
  }

  try {
    const requestsSummary = existingRequests.map(r => ({
      id: r.id, destination: r.trip.destination, status: r.status, date: r.submittedAt
    }));

    const contextStr = userContext 
        ? `User: ${userContext.name} (ID: ${userContext.id}, Dept: ${userContext.department || 'N/A'})`
        : `User: Anonymous`;

    const prompt = `
      You are "CDG Travel Buddy". ${contextStr}. Today: ${TODAY}.
      User Existing Requests: ${JSON.stringify(requestsSummary)}
      User Input: "${userInput}"
      
      Instructions:
      1. Analyze intent: CREATE_REQUEST, CHECK_STATUS, GENERAL_CHAT, or UPDATE_STATUS.
      2. Respond in language: "${language}".
      3. If creating request, extract trip details (dest, dates, purpose).
      4. If checking status, look at Existing Requests to find matches.
      5. Keep response helpful and concise.

      Return JSON:
      {
        "intent": "CREATE_REQUEST" | "CHECK_STATUS" | "GENERAL_CHAT" | "UPDATE_STATUS",
        "travelRequest": { ... } | null,
        "conversationalResponse": string,
        "statusResults": [ID_LIST_STRINGS], 
        "statusUpdate": { "requestId": "ID", "status": "Approved/Rejected" }
      }
    `;

    const text = await generateText(prompt, true, 'CHAT');
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);

    // Hydrate results
    if (result.intent === 'CHECK_STATUS' && result.statusResults) {
        result.statusResults = existingRequests.filter(r => result.statusResults.includes(r.id));
    }

    return result as IntentResult;
  } catch (error) {
    return {
        intent: "GENERAL_CHAT",
        conversationalResponse: `System Error: ${(error as Error).message}`
    };
  }
};

/**
 * Real AI Receipt Analysis using Gemini Vision
 */
export const analyzeReceiptImage = async (file: File): Promise<ChatActionData> => {
  try {
      const imagePart = await fileToGenerativePart(file);
      const prompt = `
        Analyze this receipt image. Extract the following details:
        - Merchant Name
        - Total Amount (number)
        - Currency (e.g. THB, USD, SGD)
        - Date (YYYY-MM-DD)
        
        Return JSON: { "merchant": string, "amount": number, "currency": string, "date": string }
      `;
      
      const text = await generateText([imagePart, { text: prompt }], true, 'OCR');
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
  } catch (error) {
      console.error("Receipt Analysis Failed", error);
      throw new Error("Could not analyze receipt. Please try again.");
  }
};

export const generateJustification = async (
  destination: string,
  purpose: string,
  days: number,
  travelType: string
): Promise<string> => {
  try {
    const prompt = `
        Write a professional business justification for a travel request.
        Destination: ${destination}
        Purpose: ${purpose}
        Duration: ${days} days
        Type: ${travelType}
        
        Output: A single concise paragraph (approx 40 words) suitable for CFO approval.
    `;
    return await generateText(prompt, false, 'JUSTIFICATION');
  } catch (error) {
    return `Error generating justification.`;
  }
};

export const checkPolicyCompliance = async (
  destination: string,
  cost: number,
  days: number,
  travelType: string,
  requestFor: string
): Promise<{ compliant: boolean; message: string; flags: string[] }> => {
  try {
    const currentPolicy = await storageService.getPolicies();
    const prompt = `
      Audit trip: ${travelType} to ${destination}, ${days} days, ฿${cost}.
      Limits: Dom ฿${currentPolicy.defaultHotelLimit.domestic}, Intl ฿${currentPolicy.defaultHotelLimit.international}.
      Return JSON: { "compliant": boolean, "message": string, "flags": string[] }
    `;
    const text = await generateText(prompt, true, 'POLICY');
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    return { compliant: true, message: "AI Check Skipped (Config Missing)", flags: [] };
  }
};
