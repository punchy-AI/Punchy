const axios = require('axios');

module.exports = async (req, res) => {
  // Autoriser les requêtes de partout
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Vérifier que c'est une requête POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, targetLang } = req.body;

    // Vérifier les paramètres
    if (!text || !targetLang) {
      return res.status(400).json({ error: 'Missing text or target language' });
    }

    // Appel à OpenRouter pour la traduction
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-3.5-turbo',
        messages: [
          { 
            role: 'system', 
            content: `You are a professional translator. Translate the following text to ${targetLang}. Keep the tone and style consistent. Return ONLY the translation, no explanations, no additional text.` 
          },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://freelancebot.vercel.app',
          'X-Title': 'FreelancePitch Pro'
        }
      }
    );

    // Vérifier la réponse
    if (!response.data || !response.data.choices || !response.data.choices[0]) {
      throw new Error('Invalid response from AI');
    }

    const translated = response.data.choices[0].message.content.trim();

    res.json({ translated });

  } catch (error) {
    console.error('Translation error:', error);
    
    // Message d'erreur plus précis
    const errorMessage = error.response?.data?.error?.message || error.message;
    res.status(500).json({ 
      error: 'Translation failed', 
      details: errorMessage 
    });
  }
};
