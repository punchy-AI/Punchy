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
    const { message, history, system } = req.body;

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

    // ✅ Détection de la langue du message
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
      return 'en'; // défaut anglais
    };

    const detectedLang = detectLanguage(cleanMessage);
    console.log(`🌐 Langue détectée: ${detectedLang}`);

    // ============================================
    // 🎯 FONCTION : DÉTECTION DE RECHERCHE
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
          console.log(`🔍 Recherche universelle déclenchée par: "${trigger}"`);
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
            console.log(`🔍 Recherche universelle pour question courte: "${lowerQuery}"`);
            return true;
          }
        }
      }
      
      return false;
    }

    // ============================================
    // 📊 FONCTION : DÉTECTION DES DEMANDES DE GRAPHIQUES
    // ============================================
    function needsChart(query) {
      const lowerQuery = query.toLowerCase();
      
      const chartTriggers = [
        'graphique', 'chart', 'diagramme', 'histogramme',
        'camembert', 'secteurs', 'barres', 'lignes',
        'visualisation', 'statistiques', 'stats',
        'répartition', 'comparaison', 'évolution',
        'affiche les données', 'montre les chiffres'
      ];
      
      for (let trigger of chartTriggers) {
        if (lowerQuery.includes(trigger)) {
          console.log(`📊 Graphique demandé: "${trigger}"`);
          return true;
        }
      }
      return false;
    }

    // ============================================
    // 🎯 SI GRAPHIQUE DEMANDÉ, ON REDIRIGE
    // ============================================
    if (needsChart(cleanMessage)) {
      console.log('📊 Redirection vers générateur de graphiques');
      
      try {
        // Extraire des données potentielles de la question
        // Par défaut, on utilise des données d'exemple
        let chartData = {
          type: 'bar',
          labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'],
          datasets: [
            { label: 'Données', data: [65, 59, 80, 81, 56, 75] }
          ],
          title: "Graphique",
          description: "Visualisation des données"
        };

        // Adapter le type selon la demande
        if (cleanMessage.includes('camembert') || cleanMessage.includes('secteurs')) {
          chartData.type = 'pie';
          chartData.labels = ['Catégorie A', 'Catégorie B', 'Catégorie C', 'Catégorie D'];
          chartData.datasets = [{ label: 'Répartition', data: [45, 25, 20, 10] }];
          chartData.title = "Répartition en secteurs";
        } else if (cleanMessage.includes('lignes') || cleanMessage.includes('évolution')) {
          chartData.type = 'line';
          chartData.labels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'];
          chartData.datasets = [{ label: 'Évolution', data: [12, 19, 15, 25, 22, 30] }];
          chartData.title = "Évolution dans le temps";
        } else if (cleanMessage.includes('anneau') || cleanMessage.includes('doughnut')) {
          chartData.type = 'doughnut';
          chartData.labels = ['Part A', 'Part B', 'Part C', 'Part D'];
          chartData.datasets = [{ label: 'Parts', data: [35, 25, 20, 20] }];
          chartData.title = "Répartition en anneau";
        }

        const chartResponse = await axios.post(
          `https://${req.headers.host}/api/chart`,
          chartData,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
          }
        );
        
        if (chartResponse.data && chartResponse.data.chart) {
          return res.json({
            reply: chartResponse.data.chart,
            suggestions: [
              "Graphique en barres",
              "Graphique en lignes",
              "Camembert",
              "Autres données"
            ]
          });
        }
      } catch (chartError) {
        console.error('❌ Erreur graphique:', chartError.message);
        // Si erreur, on continue avec l'IA normale
      }
    }

    // ============================================
    // 🎯 SI RECHERCHE NÉCESSAIRE, ON REDIRIGE
    // ============================================
    if (needsWebSearch(cleanMessage)) {
      console.log('🌐 Redirection vers recherche universelle...');
      
      try {
        const searchResponse = await axios.post(
          `https://${req.headers.host}/api/searchUnified`,
          { query: cleanMessage },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
          }
        );
        
        if (searchResponse.data && searchResponse.data.reply) {
          return res.json({
            reply: searchResponse.data.reply,
            suggestions: searchResponse.data.suggestions || [
              "Plus de résultats",
              "Nouvelle recherche",
              "Préciser"
            ]
          });
        }
      } catch (searchError) {
        console.error('❌ Erreur recherche universelle:', searchError.message);
      }
    }

    // ============================================
    // 🤖 SI PAS DE RECHERCHE, ON UTILISE L'IA NORMALE
    // ============================================
    
    // ✅ PROMPT SYSTÈME MULTILINGUE AVEC INSTRUCTIONS POUR TABLEAUX
    const CHATGPT_SYSTEM_PROMPT = `You are CORE AI, an advanced intelligent assistant designed to help people understand, learn, create, and solve problems.

CRITICAL INSTRUCTION - LANGUAGE:
- The user wrote in ${detectedLang === 'en' ? 'English' : detectedLang === 'fr' ? 'French' : detectedLang === 'es' ? 'Spanish' : detectedLang === 'de' ? 'German' : detectedLang === 'it' ? 'Italian' : detectedLang === 'pt' ? 'Portuguese' : 'English'}
- You MUST respond in EXACTLY the same language as the user
- NEVER switch languages mid-conversation

CAPABILITIES:
• Answering everyday questions
• Writing and communication assistance
• Business and productivity advice
• Programming and technology help
• Learning and education support
• Creative project guidance

🚨🚨🚨 CRITICAL INSTRUCTION - HTML FORMATTING ONLY 🚨🚨🚨

You are FORBIDDEN from using Markdown syntax. You MUST use ONLY these HTML tags:
- <h2> for main titles
- <h3> for subtitles
- <p> for paragraphs
- <ul> and <li> for bullet points
- <ol> and <li> for numbered lists
- <strong> for bold text
- <em> for italic text
- <br> for line breaks

🚨🚨🚨 TABLE FORMATTING INSTRUCTIONS 🚨🚨🚨
When the user asks for a table, comparison, or structured data, you MUST:
1. Use proper HTML <table> tags
2. Include <thead> with <th> for headers
3. Use <tbody> for data rows
4. Add basic styling with inline CSS or classes
5. Make it responsive and readable on mobile

EXAMPLE TABLE:
<table style="width:100%; border-collapse: collapse; margin:10px 0; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
  <thead>
    <tr style="background: #2563eb; color: white;">
      <th style="padding: 12px 10px; text-align: left; font-weight: 600;">Produit</th>
      <th style="padding: 12px 10px; text-align: left; font-weight: 600;">Prix</th>
      <th style="padding: 12px 10px; text-align: left; font-weight: 600;">Stock</th>
    </tr>
  </thead>
  <tbody>
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 10px;">iPhone 14</td>
      <td style="padding: 10px;">999€</td>
      <td style="padding: 10px;">15</td>
    </tr>
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 10px;">Samsung S23</td>
      <td style="padding: 10px;">899€</td>
      <td style="padding: 10px;">8</td>
    </tr>
  </tbody>
</table>

RESPONSE STYLE (in the user's language):
✔ natural and human - write like you're talking to a friend
✔ conversational tone - be warm and helpful
✔ easy to read on mobile - short paragraphs
✔ clear and structured - use headings when helpful
✔ avoid dense text - keep it light and scannable
✔ prioritize clarity and usefulness

REMEMBER: 
1. Respond in the SAME LANGUAGE as the user
2. Use ONLY HTML tags, NEVER Markdown
3. For tables, ALWAYS use proper HTML table structure with headers
4. Be helpful and natural`;

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

    // Ajustements de ton
    const toneAdjustments = {
      programming: "You're explaining technical concepts to a developer. Be precise but friendly.",
      business: "You're advising a professional. Be clear and practical.",
      marketing: "You're helping with marketing strategy. Be creative and actionable.",
      writing: "You're coaching someone on writing. Be encouraging and constructive.",
      productivity: "You're helping someone be more productive. Be practical and motivating.",
      general: "You're having a helpful conversation. Be natural and warm."
    };

    // Construction des messages
    const messages = [];

    if (system && typeof system === 'string') {
      messages.push({ 
        role: 'system', 
        content: sanitizeMessage(system) + '\n\nREMEMBER: Respond in the user\'s language. Use HTML only. For tables, use proper HTML table structure.' 
      });
    } else {
      messages.push({ 
        role: 'system', 
        content: CHATGPT_SYSTEM_PROMPT + '\n\n' + toneAdjustments[domain]
      });
    }

    // ============================================
    // 📋 HISTORIQUE SIMPLIFIÉ - CORRECTION DU BUG
    // ============================================
    // On ne garde que le dernier message utilisateur pour éviter le bug
    if (history && Array.isArray(history)) {
      // Prendre seulement le dernier message utilisateur
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

    // Appel OpenRouter
    let reply;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries && !reply) {
      try {
        const response = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: 'openai/gpt-4o-mini',
            messages,
            temperature: 0.7,
            max_tokens: 2000,
            top_p: 0.9
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://freelancepitch.vercel.app',
              'X-Title': 'CORE AI'
            },
            timeout: 15000
          }
        );

        if (response.data?.choices?.[0]?.message?.content) {
          reply = response.data.choices[0].message.content;
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

    if (!reply) {
      return res.json({
        reply: "<p>⚠️ I'm having trouble connecting right now. Please try again in a moment.</p>",
        suggestions: [
          "Try again",
          "Write a proposal",
          "Find clients",
          "Pricing help"
        ]
      });
    }

    // Nettoyage HTML
    if (!reply.includes('<') || !reply.includes('>')) {
      reply = `<p>${reply.replace(/\n/g, '<br>')}</p>`;
    }

    // Suggestions multilingues
    const suggestionsByLang = {
      en: {
        programming: ["Explain this code", "Help me debug", "React best practices", "Optimize my function"],
        business: ["Write a proposal", "How to negotiate?", "Find more clients", "Create an invoice"],
        marketing: ["SEO tips", "Social media strategy", "Build my brand", "Content ideas"],
        writing: ["Improve this text", "Write an email", "Grammar check", "Make it persuasive"],
        productivity: ["Manage my time", "Organize my work", "Stop procrastinating", "Best tools"],
        general: ["Write a proposal", "Improve my profile", "Find clients", "Price my services", "Get organized"]
      },
      fr: {
        programming: ["Explique ce code", "Aide-moi à déboguer", "React best practices", "Optimise ma fonction"],
        business: ["Écrire une proposition", "Comment négocier ?", "Trouver des clients", "Créer une facture"],
        marketing: ["Conseils SEO", "Stratégie social media", "Construire ma marque", "Idées de contenu"],
        writing: ["Améliore ce texte", "Écrire un email", "Vérifier la grammaire", "Rends-le persuasif"],
        productivity: ["Gérer mon temps", "Organiser mon travail", "Arrêter de procrastiner", "Meilleurs outils"],
        general: ["Écrire une proposition", "Améliorer mon profil", "Trouver des clients", "Fixer mes prix", "S'organiser"]
      },
      es: {
        programming: ["Explica este código", "Ayúdame a depurar", "React mejores prácticas", "Optimiza mi función"],
        business: ["Escribir una propuesta", "¿Cómo negociar?", "Encontrar más clientes", "Crear una factura"],
        marketing: ["Consejos SEO", "Estrategia redes sociales", "Construir mi marca", "Ideas de contenido"],
        writing: ["Mejora este texto", "Escribir un email", "Revisar gramática", "Hacerlo persuasivo"],
        productivity: ["Gestionar mi tiempo", "Organizar mi trabajo", "Dejar de procrastinar", "Mejores herramientas"],
        general: ["Escribir propuesta", "Mejorar mi perfil", "Encontrar clientes", "Fijar precios", "Organizarme"]
      }
    };

    const suggestionsByDomain = suggestionsByLang[detectedLang] || suggestionsByLang.en;
    const suggestions = suggestionsByDomain[domain] || suggestionsByDomain.general;

    res.json({ reply, suggestions });

  } catch (error) {
    console.error("❌ Server error:", error.message);
    res.json({
      reply: "<p>⚠️ Something went wrong. Please try again - I'm here to help!</p>",
      suggestions: [
        "Try again",
        "Write a proposal",
        "Find clients",
        "Start over"
      ]
    });
  }
};
