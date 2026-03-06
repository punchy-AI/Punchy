const axios = require('axios');

module.exports = async (req, res) => {
  // Gestion des CORS pour permettre les appels depuis ton index.html
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Message requis' });

    const API_KEY = process.env.OPENROUTER_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ reply: "<p>⚠️ Erreur : La clé API n'est pas configurée dans Vercel.</p>" });
    }

    // Nettoyage rapide du message
    const cleanMessage = message.replace(/<[^>]*>/g, '').trim();

    // Construction du prompt système (Forcer le HTML et la langue)
    const systemPrompt = {
      role: "system",
      content: `Tu es CORE AI. Réponds TOUJOURS en utilisant uniquement des balises HTML (<h2>, <p>, <ul>, <li>, <strong>). 
                Réponds dans la même langue que l'utilisateur. 
                Si on te demande un tableau, utilise les balises <table>, <thead>, <tr>, <th> et <td>.`
    };

    // Préparation des messages pour OpenRouter
    const messages = [systemPrompt];
    
    // Ajout d'un historique court pour éviter les bugs de mémoire
    if (history && Array.isArray(history)) {
      history.slice(-3).forEach(msg => {
        messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
      });
    }

    messages.push({ role: "user", content: cleanMessage });

    // Appel à OpenRouter
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-4o-mini',
        messages: messages,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://vercel.com', // Requis par OpenRouter
          'X-Title': 'CORE AI'
        },
        timeout: 20000
      }
    );

    let reply = response.data.choices[0].message.content;

    // Si l'IA n'a pas mis de HTML, on enveloppe dans un <p>
    if (!reply.includes('<')) {
      reply = `<p>${reply.replace(/\n/g, '<br>')}</p>`;
    }

    res.status(200).json({
      reply: reply,
      suggestions: ["Explique plus en détail", "Donne un exemple", "Résume"]
    });

  } catch (error) {
    console.error("Erreur API:", error.response?.data || error.message);
    res.status(500).json({ 
      reply: "<p>⚠️ Désolé, une erreur est survenue lors de la communication avec l'IA.</p>",
      error: error.message 
    });
  }
};
