// api/searchUnified.js
const axios = require('axios');

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // ✅ Vérification de la clé Serper
    if (!process.env.SERPER_API_KEY) {
      console.error('❌ Serper API key missing');
      return res.status(500).json({ 
        reply: "<p>⚠️ Search service temporarily unavailable.</p>",
        suggestions: ["Try again", "Write a proposal", "Find clients"]
      });
    }

    console.log(`🔍 Recherche universelle: "${query}"`);

    // Appel à Serper.dev (Google Search API)
    const response = await axios.post(
      'https://google.serper.dev/search',
      { 
        q: query,
        gl: 'ht', // Géolocalisation Haïti (optionnel)
        hl: 'fr'  // Langue française
      },
      {
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 8000 // 8 secondes timeout
      }
    );

    const data = response.data;
    
    // Construction de la réponse HTML
    let reply = `<h2>🔍 Résultats pour "${query}"</h2>`;
    
    // Nombre de résultats
    if (data.searchInformation?.totalResults) {
      const total = parseInt(data.searchInformation.totalResults).toLocaleString();
      reply += `<p><small>Environ ${total} résultats (${data.searchInformation.searchTime?.toFixed(1)} secondes)</small></p>`;
    }
    
    // Résultats organiques
    if (data.organic && data.organic.length > 0) {
      data.organic.slice(0, 5).forEach(result => {
        reply += `
          <div style="margin-bottom: 20px; padding: 10px; border-bottom: 1px solid #e2e8f0;">
            <h3 style="margin-bottom: 5px;">
              <a href="${result.link}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 600;">
                ${result.title}
              </a>
            </h3>
            <p style="color: #4b5563; margin-bottom: 5px;">${result.snippet}</p>
            <small style="color: #059669;">${result.link}</small>
          </div>
        `;
      });
    } else {
      reply += '<p>Aucun résultat trouvé.</p>';
    }
    
    // Questions connexes (People Also Ask)
    if (data.peopleAlsoAsk && data.peopleAlsoAsk.length > 0) {
      reply += '<h3 style="margin-top: 20px;">❓ Les gens demandent aussi</h3>';
      
      data.peopleAlsoAsk.slice(0, 3).forEach(item => {
        reply += `
          <div style="margin-bottom: 15px; padding: 15px; background: #f8fafc; border-radius: 8px;">
            <strong style="font-size: 16px;">${item.question}</strong>
            <p style="margin-top: 8px; color: #4b5563;">${item.snippet}</p>
            <small><a href="${item.link}" target="_blank" style="color: #2563eb;">Lire la réponse complète →</a></small>
          </div>
        `;
      });
    }
    
    // Suggestions de recherche
    if (data.relatedSearches && data.relatedSearches.length > 0) {
      reply += '<h3 style="margin-top: 20px;">📋 Recherches associées</h3>';
      reply += '<div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">';
      
      data.relatedSearches.slice(0, 8).forEach(item => {
        reply += `
          <button onclick="useSuggestion('${item.replace(/'/g, "\\'")}')" 
                  style="padding: 8px 16px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 30px; cursor: pointer; font-size: 14px; color: #1e293b;">
            ${item}
          </button>
        `;
      });
      
      reply += '</div>';
    }

    res.json({ 
      reply,
      suggestions: [
        "Plus de résultats",
        "Nouvelle recherche",
        "Préciser la recherche"
      ]
    });

  } catch (error) {
    console.error("❌ Erreur recherche universelle:", error.message);
    
    // Message d'erreur友好
    res.json({
      reply: `
        <h2>⚠️ Recherche temporairement indisponible</h2>
        <p>Je n'ai pas pu effectuer la recherche pour le moment.</p>
        <p>Suggestions :</p>
        <ul>
          <li>Réessaie dans quelques instants</li>
          <li>Reformule ta question</li>
          <li>Utilise le chat normal</li>
        </ul>
      `,
      suggestions: [
        "Réessayer",
        "Écrire une proposition",
        "Trouver des clients"
      ]
    });
  }
};
