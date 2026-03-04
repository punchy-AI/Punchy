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
    const { message, history, system, model = 'fast' } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // ✅ Vérification OpenRouter
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('❌ OpenRouter API key missing');
      return res.status(500).json({ 
        reply: "<p>⚠️ Service temporarily unavailable. Please try again later.</p>",
        suggestions: ["Try again", "Write a proposal", "Find clients"]
      });
    }

    // ✅ Sanitization
    const sanitizeMessage = (msg) => {
      if (!msg || typeof msg !== 'string') return '';
      return msg
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 4000);
    };

    const cleanMessage = sanitizeMessage(message);

    // ✅ Détection de la langue
    const detectLanguage = (text) => {
      const patterns = {
        fr: /[éèêëàâäôöùûüçîï]|\b(je|tu|il|elle|nous|vous|ils|elles|le|la|les|un|une|des|et|ou|mais|donc|car|pour|dans|sur|avec|sans|chez|quoi|qui|que|quoi|dont|où)\b/i,
        es: /[áéíóúñü]|\b(hola|gracias|por favor|como|qué|quién|dónde|cuándo|por qué|el|la|los|las|un|una|unos|unas|y|o|pero|porque|con|sin|sobre|entre)\b/i,
        de: /[äöüß]|\b(ich|du|er|sie|es|wir|ihr|Sie|der|die|das|ein|eine|und|oder|aber|weil|denn|mit|ohne|auf|über|unter)\b/i,
        it: /[àèéìíîòóùú]|\b(io|tu|lui|lei|noi|voi|loro|il|la|i|gli|le|un|uno|una|e|o|ma|perché|con|senza|su|sotto|tra)\b/i,
        pt: /[áâãàçéêíóôõú]|\b(eu|tu|ele|ela|nós|vós|eles|elas|o|a|os|as|um|uma|uns|umas|e|ou|mas|porque|com|sem|sobre|entre)\b/i
      };
      
      for (const [lang, pattern] of Object.entries(patterns)) {
        if (pattern.test(text)) return lang;
      }
      return 'en';
    };

    const detectedLang = detectLanguage(cleanMessage);
    console.log(`🌐 Langue détectée: ${detectedLang}`);

    // ============================================
    // 🎯 FONCTIONS DE DÉTECTION
    // ============================================
    function needsWebSearch(query) {
      const lowerQuery = query.toLowerCase();
      
      const searchTriggers = [
        'actualité', 'news', 'breaking', 'dernière minute', 'récent',
        'résultat', 'score', 'match', 'élection', 'vote', 'gagné', 'perdu',
        'prix', 'cours', 'taux', 'bourse', 'action', 'bitcoin', 'crypto', 'ethereum',
        'près de moi', 'proche', 'autour', 'restaurant', 'hôtel', 'magasin', 'où trouver',
        'météo', 'température', 'pluie', 'soleil', 'vent',
        'aujourd\'hui', 'maintenant', 'en ce moment', 'actuel', 'en direct',
        'cherche', 'trouve', 'recherche', 'information sur', 'je veux savoir',
        'âge de', 'taille de', 'date de naissance', 'biographie',
        'classement', 'ligue', 'championnat', 'coupe du monde'
      ];
      
      for (let trigger of searchTriggers) {
        if (lowerQuery.includes(trigger)) {
          console.log(`🔍 Recherche déclenchée par: "${trigger}"`);
          return true;
        }
      }
      
      const questionPatterns = [
        /^(qui|que|quoi|quel|quelle|quels|quelles) (est|sont) (le|la|les) /i,
        /^(comment|pourquoi|quand|où) /i,
        /^est-ce que /i
      ];
      
      const words = lowerQuery.split(' ').filter(w => w.length > 0);
      if (words.length < 6) {
        for (let pattern of questionPatterns) {
          if (pattern.test(lowerQuery)) {
            console.log(`🔍 Recherche pour question courte: "${lowerQuery}"`);
            return true;
          }
        }
      }
      
      return false;
    }

    function needsChart(query) {
      if (!query) return false;
      const lowerQuery = query.toLowerCase();
      
      const chartTriggers = [
        'graphique', 'chart', 'diagramme', 'histogramme',
        'camembert', 'secteurs', 'barres', 'lignes',
        'visualisation', 'statistiques', 'stats',
        'répartition', 'comparaison', 'évolution',
        'affiche les données', 'montre les chiffres'
      ];
      
      for (let trigger of chartTriggers) {
        if (lowerQuery.includes(trigger)) return true;
      }
      return false;
    }

    // ============================================
    // 🎯 SI GRAPHIQUE DEMANDÉ
    // ============================================
    if (cleanMessage && needsChart(cleanMessage)) {
      console.log('📊 Redirection vers générateur de graphiques');
      
      try {
        let chartData = {
          type: 'bar',
          labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'],
          datasets: [{ label: 'Données', data: [65, 59, 80, 81, 56, 75] }],
          title: "Graphique"
        };

        if (cleanMessage.includes('camembert') || cleanMessage.includes('secteurs')) {
          chartData.type = 'pie';
          chartData.labels = ['Catégorie A', 'Catégorie B', 'Catégorie C', 'Catégorie D'];
          chartData.datasets = [{ label: 'Répartition', data: [45, 25, 20, 10] }];
        } else if (cleanMessage.includes('lignes') || cleanMessage.includes('évolution')) {
          chartData.type = 'line';
        } else if (cleanMessage.includes('anneau') || cleanMessage.includes('doughnut')) {
          chartData.type = 'doughnut';
        }

        const chartResponse = await axios.post(
          `https://${req.headers.host}/api/chart`,
          chartData,
          { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
        );
        
        if (chartResponse.data?.chart) {
          return res.json({
            reply: chartResponse.data.chart,
            suggestions: ["Graphique en barres", "Graphique en lignes", "Camembert"]
          });
        }
      } catch (chartError) {
        console.error('❌ Erreur graphique:', chartError.message);
      }
    }

    // ============================================
    // 🎯 SI RECHERCHE NÉCESSAIRE
    // ============================================
    if (cleanMessage && needsWebSearch(cleanMessage)) {
      console.log('🌐 Redirection vers recherche universelle...');
      
      try {
        const searchResponse = await axios.post(
          `https://${req.headers.host}/api/searchUnified`,
          { query: cleanMessage },
          { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
        );
        
        if (searchResponse.data?.reply) {
          return res.json({
            reply: searchResponse.data.reply,
            suggestions: searchResponse.data.suggestions || ["Plus de résultats", "Nouvelle recherche"]
          });
        }
      } catch (searchError) {
        console.error('❌ Erreur recherche:', searchError.message);
      }
    }

    // ============================================
    // 🤖 IA NORMALE
    // ============================================
    
    // Détection de domaine
    function detectDomain(text) {
      const msg = text.toLowerCase();
      if (msg.match(/code|javascript|python|program|function|bug|api|react|vue|angular|node|html|css/i)) return 'programming';
      if (msg.match(/proposal|client|price|contract|freelance|invoice|business|startup|company|market/i)) return 'business';
      if (msg.match(/marketing|seo|ads|social media|growth|brand|content|audience/i)) return 'marketing';
      if (msg.match(/write|text|email|content|article|blog|grammar|copy|edit|proofread|story/i)) return 'writing';
      if (msg.match(/focus|time|productivity|organize|task|todo|schedule|calendar|efficiency|workflow/i)) return 'productivity';
      return 'general';
    }

    const domain = detectDomain(cleanMessage);

    // Construction des messages
    const messages = [];

    if (system && typeof system === 'string') {
      messages.push({ 
        role: 'system', 
        content: sanitizeMessage(system) + '\n\nREMEMBER: Respond in the user\'s language. Use HTML only.' 
      });
    } else {
      const systemPrompt = `You are CORE AI. Respond in ${detectedLang === 'fr' ? 'French' : 'English'}. Use HTML only.`;
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Historique (1 message max)
    if (history && Array.isArray(history)) {
      const lastUserMessage = history
        .filter(msg => msg && msg.role === 'user' && msg.content)
        .slice(-1);
      
      lastUserMessage.forEach(msg => {
        messages.push({ 
          role: msg.role, 
          content: sanitizeMessage(msg.content).substring(0, 500)
        });
      });
    }

    messages.push({ role: 'user', content: cleanMessage });

    // ============================================
    // 🚀 SÉLECTION DU MODÈLE (MISTRAL LARGE POUR MODE EXPERT)
    // ============================================
    
    let reply;
    let apiUsed = '';
    let retryCount = 0;
    const maxRetries = 2;

    // Définir le modèle à utiliser
    let selectedModel;
    let timeoutValue;
    
    if (model === 'expert') {
      // ✅ MODE EXPERT AVEC MISTRAL LARGE (beaucoup plus fiable)
      selectedModel = 'mistralai/mistral-large'; // Plus fiable que Llama
      timeoutValue = 20000; // 20 secondes
      console.log('🧠 Mode Expert activé - Utilisation de Mistral Large');
    } else {
      // Mode Rapide - GPT-4o-mini
      selectedModel = 'openai/gpt-4o-mini';
      timeoutValue = 10000;
      console.log('🚀 Mode Rapide activé - Utilisation de GPT-4o-mini');
    }

    // Tentative avec le modèle sélectionné
    while (retryCount <= maxRetries && !reply) {
      try {
        console.log(`📤 Tentative ${retryCount + 1} avec ${selectedModel}...`);
        
        const response = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: selectedModel,
            messages,
            temperature: 0.7,
            max_tokens: model === 'expert' ? 2000 : 1000,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': `https://${req.headers.host}`,
              'X-Title': 'CORE AI'
            },
            timeout: timeoutValue
          }
        );

        if (response.data?.choices?.[0]?.message?.content) {
          reply = response.data.choices[0].message.content;
          apiUsed = model === 'expert' ? 'Mistral Large' : 'GPT-4o-mini';
        }

      } catch (error) {
        retryCount++;
        console.log(`⚠️ Tentative ${retryCount} échouée:`, error.message);
        
        if (error.response?.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          retryCount--;
        } else if (retryCount <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
    }

    // ============================================
    // 🔄 FALLBACK INTELLIGENT
    // ============================================
    
    // Si le modèle principal a échoué et qu'on était en Mode Expert
    if (!reply && model === 'expert') {
      console.log('⚠️ Mistral Large indisponible, fallback sur GPT-4o-mini...');
      try {
        const fallbackRes = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: 'openai/gpt-4o-mini',
            messages,
            max_tokens: 1500
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'HTTP-Referer': `https://${req.headers.host}`,
              'X-Title': 'CORE AI'
            },
            timeout: 10000
          }
        );
        reply = fallbackRes.data?.choices?.[0]?.message?.content;
        if (reply) {
          apiUsed = 'GPT-4o-mini (Fallback)';
          // Ajouter un message pour prévenir l'utilisateur
          reply = `<p><em>⚠️ Le Mode Expert est temporairement saturé. Voici une réponse avec le modèle standard :</em></p>${reply}`;
        }
      } catch (fError) {
        console.error('❌ Fallback échoué:', fError.message);
      }
    }

    // Fallback général si tout a échoué
    if (!reply) {
      return res.json({
        reply: "<p>⚠️ I'm having trouble connecting right now. Please try again in a moment.</p>",
        suggestions: ["Try again", "Write a proposal", "Find clients", "Pricing help"]
      });
    }

    // Nettoyage HTML
    if (!reply.includes('<') || !reply.includes('>')) {
      reply = `<p>${reply.replace(/\n/g, '<br>')}</p>`;
    }

    // Suggestions
    const suggestions = detectedLang === 'fr'
      ? ["📊 Camembert", "📈 Barres", "📉 Lignes", "📄 Proposal"]
      : ["📊 Pie chart", "📈 Bar chart", "📉 Line chart", "📄 Proposal"];

    res.json({ reply, suggestions });

  } catch (error) {
    console.error("❌ Server error:", error.message);
    res.json({
      reply: "<p>⚠️ Something went wrong. Please try again.</p>",
      suggestions: ["📊 Camembert", "📈 Barres", "📉 Lignes", "🔄 Réessayer"]
    });
  }
};
