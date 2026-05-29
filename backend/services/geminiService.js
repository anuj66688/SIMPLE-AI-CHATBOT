const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const logger = require('../utils/logger');

let genAI;
let model;

const initializeGemini = () => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  });

  logger.info('✅ Gemini AI initialized successfully');
  return model;
};

/**
 * Generate a response from Gemini AI with conversation history
 * @param {string} userMessage - The user's current message
 * @param {Array} history - Array of previous messages [{role, content}]
 * @returns {Object} - { response: string, tokensUsed: number }
 */
const generateResponse = async (userMessage, history = []) => {
  if (!model) {
    initializeGemini();
  }

  try {
    // Build the system instruction
    const systemInstruction = `You are a helpful, knowledgeable, and friendly AI assistant. 
You provide accurate, thoughtful, and well-structured responses. 
You can help with a wide range of topics including coding, writing, analysis, math, creative tasks, and general knowledge.
Keep your responses clear, concise, and helpful. Use markdown formatting when appropriate.
Always be respectful, professional, and honest. If you don't know something, say so.`;

    // Format history for Gemini chat
    const chatHistory = history.map((msg) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // Start a chat session with history
    const chat = model.startChat({
      history: chatHistory,
      systemInstruction: {
        parts: [{ text: systemInstruction }],
        role: 'system',
      },
    });

    logger.debug(`Sending message to Gemini: "${userMessage.substring(0, 100)}..."`);

    const result = await chat.sendMessage(userMessage);
    const response = result.response;
    const text = response.text();

    // Extract token usage if available
    const tokensUsed = response.usageMetadata
      ? (response.usageMetadata.promptTokenCount || 0) +
        (response.usageMetadata.candidatesTokenCount || 0)
      : 0;

    logger.debug(`Gemini response received. Tokens used: ${tokensUsed}`);

    return {
      response: text,
      tokensUsed,
    };
  } catch (error) {
    logger.error('Gemini API error:', error);

    if (error.message?.includes('API_KEY_INVALID')) {
      throw new Error('Invalid Gemini API key. Please check your configuration.');
    }
    if (error.message?.includes('QUOTA_EXCEEDED') || error.status === 429) {
      throw new Error('API quota exceeded. Please try again later.');
    }
    if (error.message?.includes('SAFETY')) {
      throw new Error('Your message was flagged by safety filters. Please rephrase your question.');
    }

    throw new Error(`AI service error: ${error.message}`);
  }
};

/**
 * Generate a chat title based on the first user message
 * @param {string} firstMessage - The first message in the chat
 * @returns {string} - Generated title
 */
const generateChatTitle = async (firstMessage) => {
  if (!model) {
    initializeGemini();
  }

  try {
    const prompt = `Generate a short, concise title (max 6 words) for a chat that starts with this message: "${firstMessage}". 
Return ONLY the title text, no quotes, no explanation, no punctuation at the end.`;

    const result = await model.generateContent(prompt);
    const title = result.response.text().trim().replace(/['"]/g, '');
    return title.length > 60 ? title.substring(0, 60) + '...' : title;
  } catch (error) {
    logger.error('Error generating chat title:', error);
    // Fallback: use first 40 chars of the message
    return firstMessage.length > 40
      ? firstMessage.substring(0, 40) + '...'
      : firstMessage;
  }
};

module.exports = { initializeGemini, generateResponse, generateChatTitle };
