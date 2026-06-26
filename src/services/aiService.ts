import Groq from 'groq-sdk';
import { logger } from '../utils/logger';

const getClient = () => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not configured');
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
};

const GROQ_MODEL = 'llama-3.3-70b-versatile';

// ─── Language map ─────────────────────────────────────────────────────────────
// Maps i18n language codes to full language names for the model
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  yo: 'Yoruba (Nigerian Yorùbá — use proper Yoruba vocabulary, tones, and natural phrasing as spoken in Nigeria)',
  ha: 'Hausa (Nigerian Hausa — use proper Hausa vocabulary and natural phrasing as spoken in northern Nigeria)',
  ig: 'Igbo (Nigerian Igbo — use proper Igbo vocabulary and natural phrasing as spoken in southeastern Nigeria)',
  fr: 'French (use clear, everyday French)',
  pcm: 'Nigerian Pidgin English (Naija Pidgin — write exactly as Nigerians speak it, e.g. "how e dey", "e don finish", "abeg", "oga", "na so e be")',
};

function getLangInstruction(lang?: string): string {
  if (!lang || lang === 'en') return '';
  const name = LANGUAGE_NAMES[lang] || lang;
  return `\n\nLANGUAGE INSTRUCTION: You MUST respond entirely in ${name}. Do not mix in English unless a word has no equivalent. Write naturally as a native speaker would.`;
}

// ─── Master KudiBot system prompt ────────────────────────────────────────────
function buildChatSystemPrompt(storeContext?: Record<string, any>, language?: string): string {
  const langInstruction = getLangInstruction(language);
  const storeInfo = storeContext
    ? `\n\nACTIVE STORE CONTEXT:\n${JSON.stringify(storeContext, null, 2)}`
    : '';

  return `You are KudiBot — the smart AI business assistant built into KudiStocks, a mobile app designed specifically for Nigerian small and medium business owners (traders, retailers, wholesalers, shop owners).

═══════════════════════════════════════════
WHAT YOU KNOW ABOUT KUDISTOCKS
═══════════════════════════════════════════
KudiStocks is a business management app with these core features:
• INVENTORY — Add products, track stock quantities, set low-stock alerts, view active/low/out-of-stock items, upload product images
• ORDERS — Create purchase orders to restock from suppliers, track order status (pending → sent → confirmed → in-transit → delivered), re-order from existing suppliers
• SALES / RECORD SALES — Record how many units of a product were sold and at what price, track quantity sold (qtySold) per product
• ANALYTICS — View sales overview, stock flow (stock in vs stock out), total revenue, average order value, earnings over time (today / 7 days / 30 days / 90 days)
• SUPPLIERS — Add and manage suppliers (name, email, phone, address), link orders to suppliers
• NOTIFICATIONS — Low stock alerts, order updates, payment alerts, daily/weekly reports
• WALLET — Business wallet balance (coming soon)
• LOANS — Business loans feature (coming soon)
• MULTI-STORE — Users can manage multiple stores and switch between them
• MULTI-LANGUAGE — App supports English, Yoruba, Hausa, Igbo, French, Nigerian Pidgin

═══════════════════════════════════════════
HOW TO HELP USERS — BUSINESS KNOWLEDGE
═══════════════════════════════════════════
You are deeply knowledgeable about Nigerian business realities. You understand:

INVENTORY MANAGEMENT:
- Help users decide reorder points (when to restock) based on their sales pace
- Advise on dead stock (items not selling) — suggest discounts, bundles, or returning to supplier
- Guide on stock taking: counting physical stock and reconciling with the app
- Explain how to set low-stock alerts effectively (e.g. set alert at 7 days of supply)
- Seasonal stock advice for Nigerian markets (e.g. higher demand during Sallah, Christmas, back-to-school)

SALES & PRICING:
- Help users understand profit margins (selling price minus cost price)
- Advise on pricing strategies for Nigerian markets (competitive pricing, cost-plus, value-based)
- Explain what "top selling" products mean and how to focus on them
- Help identify slow-moving products and what to do about them
- Understand local market trends (Lagos, Abuja, Kano, Onitsha, Port Harcourt markets)

ORDERS & SUPPLIERS:
- Help users create a good supplier strategy (multiple suppliers, negotiating terms)
- Guide on when to place restock orders (lead time + buffer stock)
- Explain order statuses and what actions to take at each stage
- Advise on supplier relationships and payment terms (pay on delivery, credit, advance)

ANALYTICS & REPORTING:
- Explain what each metric means (total revenue, average order value, stock value vs cost value)
- Help users understand their sales trends and make decisions based on data
- Guide on how to use 30-day vs 7-day views to spot patterns

GENERAL BUSINESS ADVICE (Nigerian context):
- Cash flow management for small traders
- How to handle peak seasons (Ramadan, Christmas, Easter, back-to-school)
- Tips for managing market stalls, shops, wholesale businesses
- Record keeping and why it matters
- Handling credit sales (selling on credit) and debt management
- How to grow from a single store to multiple locations

═══════════════════════════════════════════
HOW TO RESPOND
═══════════════════════════════════════════
• Be warm, encouraging, and practical — like a knowledgeable friend who understands Nigerian business
• Give specific, actionable advice — not vague tips
• When a user describes a problem, ask 1-2 clarifying questions if needed, then give a direct solution
• Use bullet points or numbered steps for instructions
• Keep responses focused — do not write essays unless asked
• If a user types in Yoruba, respond in Yoruba. If they type in Pidgin, respond in Pidgin. Match their energy.
• Never say "I don't have access to your data" — if store context is provided, use it. If not, give general advice and ask them to share details.
• You can help with calculations (e.g. "I bought 50 bags at ₦2,000 each, how much profit if I sell at ₦2,800?")
• Currency is Nigerian Naira (₦) by default unless the store uses a different currency
• If asked something outside business management (e.g. politics, entertainment), politely redirect: "I'm best at helping with your business! Ask me about your inventory, sales, or orders."${storeInfo}${langInstruction}`;
}

// ─── Insights system prompt ───────────────────────────────────────────────────
function buildInsightsSystemPrompt(language?: string): string {
  const langInstruction = getLangInstruction(language);
  return `You are KudiBot, an expert business analyst for KudiStocks — a Nigerian inventory management app. You analyze real business data and give Nigerian small business owners clear, practical, actionable insights. Be specific with numbers. Use ₦ for prices. Focus on what the owner can DO, not just what the data shows.${langInstruction}`;
}

// ─── Public functions ─────────────────────────────────────────────────────────

export const generateAIInsights = async (data: {
  type: 'inventory' | 'sales' | 'supplier' | 'general';
  context: Record<string, any>;
  question?: string;
  language?: string;
}): Promise<string> => {
  try {
    const client = getClient();
    const systemPrompt = buildInsightsSystemPrompt(data.language);

    let userPrompt = '';
    switch (data.type) {
      case 'inventory':
        userPrompt = `Analyze this inventory data for my store and give me clear insights:\n${JSON.stringify(data.context, null, 2)}\n\nTell me:\n1. Which products are selling fast and need restock soon\n2. Which products are stuck (not selling) and what I should do\n3. Any items critically low on stock\n4. One key action I should take today`;
        break;
      case 'sales':
        userPrompt = `Analyze these sales figures for my store:\n${JSON.stringify(data.context, null, 2)}\n\nTell me:\n1. How my sales are performing overall\n2. What's driving revenue vs what's underperforming\n3. Any trend I should pay attention to\n4. One specific action to improve sales this period`;
        break;
      case 'supplier':
        userPrompt = `Analyze my supplier data:\n${JSON.stringify(data.context, null, 2)}\n\nTell me:\n1. Which suppliers are reliable vs risky\n2. Where I can cut costs or negotiate better\n3. Any supply risk I should address\n4. Recommendations to improve my supplier strategy`;
        break;
      default:
        userPrompt = data.question || `Give me useful business insights based on this data: ${JSON.stringify(data.context, null, 2)}`;
    }

    const response = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 1500,
      temperature: 0.5,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    return response.choices[0]?.message?.content || 'Unable to generate insights at this time.';
  } catch (error) {
    logger.error('AI service error:', error);
    throw new Error('AI service temporarily unavailable');
  }
};

export const generateProductDescription = async (productData: {
  name: string;
  category: string;
  brand?: string;
  features?: string[];
  language?: string;
}): Promise<string> => {
  try {
    const client = getClient();
    const langInstruction = getLangInstruction(productData.language);

    const response = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 500,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `You write short, compelling product descriptions for Nigerian business owners using the KudiStocks inventory app. Write 2-3 sentences. Be clear, appealing, and relevant to Nigerian buyers. Return only the description text.${langInstruction}`,
        },
        {
          role: 'user',
          content: `Product: ${productData.name}\nCategory: ${productData.category}\nBrand: ${productData.brand || 'N/A'}\nFeatures: ${(productData.features || []).join(', ')}\n\nWrite a product description:`,
        },
      ],
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    logger.error('AI product description error:', error);
    throw new Error('Unable to generate product description');
  }
};

export const getInventoryForecast = async (historicalData: any[], language?: string): Promise<any> => {
  try {
    const client = getClient();
    const langInstruction = getLangInstruction(language);

    const response = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 1200,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are an inventory forecasting expert for Nigerian small businesses. Analyze sales data and return ONLY valid JSON with no markdown, no explanation — just the JSON object. The "insights" field must be practical advice in plain language.${langInstruction}`,
        },
        {
          role: 'user',
          content: `Based on this product sales data, give me a demand forecast and reorder plan.\n\nReturn JSON with exactly these keys:\n- forecast: array of { product: string, predictedDemand: number, recommendedReorder: number }\n- insights: string (2-3 sentences of practical advice)\n- risks: array of strings (potential stock risks)\n\nData:\n${JSON.stringify(historicalData, null, 2)}\n\nJSON only:`,
        },
      ],
    });

    const text = (response.choices[0]?.message?.content || '').trim();
    // Strip markdown code fences if model wraps it
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return { insights: text, forecast: [], risks: [] };
    }
  } catch (error) {
    logger.error('AI forecast error:', error);
    throw new Error('Unable to generate forecast');
  }
};

export const chatWithAI = async (
  messages: { role: 'user' | 'assistant'; content: string }[],
  storeContext?: Record<string, any>,
  language?: string
): Promise<string> => {
  try {
    const client = getClient();
    const systemPrompt = buildChatSystemPrompt(storeContext, language);

    const response = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 1024,
      temperature: 0.65,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    });

    return response.choices[0]?.message?.content || 'I could not process your request.';
  } catch (error) {
    logger.error('AI chat error:', error);
    throw new Error('AI assistant temporarily unavailable');
  }
};
