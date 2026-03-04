const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      job, skills, languages, clientType, platform, description,
      length, language, recaptcha 
    } = req.body;

    // reCAPTCHA verification
    const recaptchaVerify = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: recaptcha
        }
      }
    );

    if (!recaptchaVerify.data.success) {
      return res.status(400).json({ error: 'Invalid reCAPTCHA' });
    }

    // Build prompt
    const prompt = `As a professional freelance proposal writer, generate 3 proposal versions for a ${job}.

    Skills: ${skills}
    Languages: ${languages}
    Client type: ${clientType}
    Platform: ${platform}
    Job: ${description}
    Length: ${length}
    Language: ${language}

    Generate:
    1. PROFESSIONAL PROPOSAL
    2. SHORT VERSION
    3. PERSUASIVE VERSION`;

    // Call OpenRouter
    const aiResponse = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are an expert proposal writer.' },
          { role: 'user', content: prompt }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiText = aiResponse.data.choices[0].message.content;

    // Simple response
    res.json({
      professional: aiText,
      short: "Short version generated",
      persuasive: "Persuasive version generated"
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};
