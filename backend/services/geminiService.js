const OpenAI = require('openai');
const logger = require('../utils/logger');

let openai;

const initializeOpenAI = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  logger.info('✅ OpenAI initialized successfully');
  return openai;
};

/**
 * Generate a response from OpenAI with conversation history
 * @param {string} userMessage - The user's current message
 * @param {Array} history - Array of previous messages [{sender, content}]
 * @returns {Object} - { response: string, tokensUsed: number }
 */
const generateResponse = async (userMessage, history = []) => {
  if (!openai) {
    initializeOpenAI();
  }

  try {
    // Build the system message
    const systemMessage = {
      role: 'system',
      content: `You are a helpful, knowledgeable, and friendly AI assistant. 
You provide accurate, thoughtful, and well-structured responses. 
You can help with a wide range of topics including coding, writing, analysis, math, creative tasks, and general knowledge.
Keep your responses clear, concise, and helpful. Use markdown formatting when appropriate.
Always be respectful, professional, and honest. If you don't know something, say so.`,
    };

    // Format history for OpenAI chat
    const messages = [systemMessage];

    history.forEach((msg) => {
      messages.push({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    });

    // Add the current user message
    messages.push({ role: 'user', content: userMessage });

    logger.debug(`Sending message to OpenAI: "${userMessage.substring(0, 100)}..."`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      temperature: 0.7,
      max_tokens: 4096,
      top_p: 0.95,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const text = completion.choices[0]?.message?.content || 'No response generated.';

    // Extract token usage
    const tokensUsed = completion.usage
      ? (completion.usage.prompt_tokens || 0) + (completion.usage.completion_tokens || 0)
      : 0;

    logger.debug(`OpenAI response received. Tokens used: ${tokensUsed}`);

    return {
      response: text,
      tokensUsed,
    };
  } catch (error) {
    logger.error('OpenAI API error:', error);

    if (error.status === 401 || error.code === 'invalid_api_key') {
      throw new Error('Invalid OpenAI API key. Please check your configuration.');
    }
    if (error.status === 429) {
      throw new Error('API rate limit exceeded. Please try again later.');
    }
    if (error.status === 503) {
      throw new Error('OpenAI service is temporarily unavailable. Please try again.');
    }
    if (error.code === 'insufficient_quota') {
      throw new Error('OpenAI quota exceeded. Please check your billing.');
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
  if (!openai) {
    initializeOpenAI();
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
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
    // Fallback: use first 40 chars of the message
    return firstMessage.length > 40
      ? firstMessage.substring(0, 40) + '...'
      : firstMessage;
  }
};

module.exports = { initializeOpenAI, generateResponse, generateChatTitle };
