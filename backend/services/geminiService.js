const OpenAI = require('openai');
const logger = require('../utils/logger');

let client;

const initializeGrok = () => {
  if (!process.env.GROK_API_KEY) {
    throw new Error('GROK_API_KEY is not configured');
  }

  client = new OpenAI({
    apiKey: process.env.GROK_API_KEY,
    baseURL: 'https://api.x.ai/v1',
  });

  logger.info('✅ Grok AI initialized successfully');
  return client;
};

/**
 * Generate a response from Grok with conversation history
 * @param {string} userMessage - The user's current message
 * @param {Array} history - Array of previous messages [{sender, content}]
 * @returns {Object} - { response: string, tokensUsed: number }
 */
const generateResponse = async (userMessage, history = []) => {
  if (!client) {
    initializeGrok();
  }

  try {
    const systemMessage = {
      role: 'system',
      content: `You are a helpful, knowledgeable, and friendly AI assistant. 
You provide accurate, thoughtful, and well-structured responses. 
You can help with a wide range of topics including coding, writing, analysis, math, creative tasks, and general knowledge.
Keep your responses clear, concise, and helpful. Use markdown formatting when appropriate.
Always be respectful, professional, and honest. If you don't know something, say so.`,
    };

    // Build messages array
    const messages = [systemMessage];

    history.forEach((msg) => {
      messages.push({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    });

    messages.push({ role: 'user', content: userMessage });

    logger.debug(`Sending message to Grok: "${userMessage.substring(0, 100)}..."`);

    const completion = await client.chat.completions.create({
      model: 'grok-3-mini',
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    });

    const text = completion.choices[0]?.message?.content || 'No response generated.';

    const tokensUsed = completion.usage
      ? (completion.usage.prompt_tokens || 0) + (completion.usage.completion_tokens || 0)
      : 0;

    logger.debug(`Grok response received. Tokens used: ${tokensUsed}`);

    return {
      response: text,
      tokensUsed,
    };
  } catch (error) {
    logger.error('Grok API error:', error);

    if (error.status === 401 || error.code === 'invalid_api_key') {
      throw new Error('Invalid Grok API key. Please check your configuration.');
    }
    if (error.status === 429) {
      throw new Error('API rate limit exceeded. Please try again later.');
    }
    if (error.status === 503) {
      throw new Error('Grok service is temporarily unavailable. Please try again.');
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
  if (!client) {
    initializeGrok();
  }

  try {
    const completion = await client.chat.completions.create({
      model: 'grok-3-mini',
      messages: [
        {
          role: 'system',
          content: 'Generate a short, concise title (max 6 words) for a chat conversation. Return ONLY the title text, no quotes, no explanation, no punctuation at the end.',
        },
        {
          role: 'user',
          content: `Generate a title for a chat that starts with: "${firstMessage}"`,
        },
      ],
      temperature: 0.7,
      max_tokens: 30,
    });

    const title = completion.choices[0]?.message?.content?.trim().replace(/['"]/g, '') || firstMessage.substring(0, 40);
    return title.length > 60 ? title.substring(0, 60) + '...' : title;
  } catch (error) {
    logger.error('Error generating chat title:', error);
    return firstMessage.length > 40
      ? firstMessage.substring(0, 40) + '...'
      : firstMessage;
  }
};

module.exports = { initializeGrok, generateResponse, generateChatTitle };
