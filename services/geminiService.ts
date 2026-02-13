
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

    // Updated Prompt to fix user issues:
    // 1. Travelers: Default to userContext if not specified.
    // 2. Cost: Do NOT guess. Set to 0 if not mentioned.
    // 3. Purpose: Do NOT copy input. Extract short topic or leave empty.
    const prompt = `
      You are "CDG Travel Buddy", an efficient corporate travel assistant. 
      Today is ${TODAY}.
      
      Current User Profile: ${JSON.stringify(userContext || { name: 'Employee', id: 'EMP' })}
      User Input: "${userInput}"
      
      TASK:
      Analyze the user's input and extract structured data to perform an action.
      
      RULES for "CREATE_REQUEST":
      1. **Travelers**: 
         - If the user explicitly mentions a name (e.g. "for Sarah"), use that.
         - **DEFAULT**: If NO specific person is named, YOU MUST use the "Current User Profile" details to populate the 'travelers' array. This is the most common case (Request for Self).
      
      2. **Purpose**:
         - Extract a short, specific business purpose (e.g., "Client Meeting", "Site Visit", "Seminar").
         - If the input is vague or just a command (e.g. "book flight to Japan"), return an empty string "" for purpose.
         - **DO NOT** copy the entire user input string into the purpose field.

      3. **Cost (estimatedCost)**:
         - **ONLY** set this if the user explicitly states a budget (e.g. "budget 20k", "cost 5000").
         - Otherwise, set 'estimatedCost' to 0. Do NOT guess or estimate prices.

      4. **Dates**:
         - If specific dates aren't given, assume 'startDate' is tomorrow (${TODAY} + 1 day) and 'endDate' is 2 days later.

      5. **Travel Type**:
         - 'travelType': 'INTERNATIONAL' if outside Thailand, else 'DOMESTIC'.

      RESPONSE FORMAT (JSON ONLY):
      {
        "intent": "CREATE_REQUEST" | "CHECK_STATUS" | "GENERAL_CHAT" | "UPDATE_STATUS",
        "conversationalResponse": "Short polite text in ${language} summarizing what you are doing.",
        "travelRequest": {
            "trip": {
                "destination": "String (Required)",
                "startDate": "YYYY-MM-DD",
                "endDate": "YYYY-MM-DD",
                "purpose": "String"
            },
            "travelers": [ { "id": "...", "name": "...", "type": "Employee" } ],
            "travelType": "DOMESTIC" | "INTERNATIONAL",
            "estimatedCost": Number
        },
        "statusResults": ["ID1", "ID2"]
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
    console.error("Intent Parsing Error:", error);
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
