const axios = require('axios');

module.exports = async (req, res) => {
  // cors
  res.setheader('access-control-allow-origin', '*');
  res.setheader('access-control-allow-methods', 'post, options');
  res.setheader('access-control-allow-headers', 'content-type');

  if (req.method === 'options') {
    return res.status(200).end();
  }

  if (req.method !== 'post') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    const { message, history, system, image, file, deepthink = false } = req.body;

    if (!message && !image && !file) {
      return res.status(400).json({ error: 'message or file required' });
    }

    // ✅ vérification des clés api
    const hasopenrouter = !!process.env.openrouter_api_key;
    const hasgemini = !!process.env.gemini_api_key;
    
    console.log(`🔑 apis: ${hasopenrouter ? '✅ openrouter' : '❌'} ${hasgemini ? '✅ gemini' : '❌'}`);
    console.log(`🧠 deep think: ${deepthink ? 'active' : 'inactive'}`);

    if (!hasopenrouter && !hasgemini) {
      return res.json({
        reply: "<p>😅 no api available. use charts instead!</p>",
        suggestions: ["📊 pie chart", "📈 bar chart", "📉 line chart"]
      });
    }

    // ✅ sanitization
    const sanitizemessage = (msg) => {
      if (!msg || typeof msg !== 'string') return '';
      return msg
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 4000);
    };

    const cleanmessage = message ? sanitizemessage(message) : '';

    // ✅ détection de la langue
    const detectlanguage = (text) => {
      const patterns = {
        fr: /[éèêëàâäôöùûüçîï]|\b(je|tu|il|elle|nous|vous|ils|elles|le|la|les|un|une|des|et|ou|mais|donc|car|pour|dans|sur|avec|sans|chez|quoi|qui|que|quoi|dont|où)\b/i,
        es: /[áéíóúñü]|\b(hola|gracias|por favor|como|qué|quién|dónde|cuándo|por qué|el|la|los|las|un|una|unos|unas|y|o|pero|porque|con|sin|sobre|entre)\b/i,
        de: /[äöüß]|\b(ich|du|er|sie|es|wir|ihr|sie|der|die|das|ein|eine|und|oder|aber|weil|denn|mit|ohne|auf|über|unter)\b/i,
        it: /[àèéìíîòóùú]|\b(io|tu|lui|lei|noi|voi|loro|il|la|i|gli|le|un|uno|una|e|o|ma|perché|con|senza|su|sotto|tra)\b/i,
        pt: /[áâãàçéêíóôõú]|\b(eu|tu|ele|ela|nós|vós|eles|elas|o|a|os|as|um|uma|uns|umas|e|ou|mas|porque|com|sem|sobre|entre)\b/i
      };
      
      for (const [lang, pattern] of object.entries(patterns)) {
        if (pattern.test(text)) return lang;
      }
      return 'en';
    };

    const detectedlang = detectlanguage(cleanmessage || message || "hello");
    console.log(`🌐 langue détectée: ${detectedlang}`);

    // ============================================
    // fonctions de détection
    // ============================================
    function needswebsearch(query) {
      if (!query) return false;
      const lowerquery = query.tolowercase();
      
      const searchtriggers = [
        'news', 'breaking', 'recent', 'latest',
        'result', 'score', 'match', 'election', 'vote',
        'price', 'rate', 'stock', 'bitcoin', 'crypto',
        'near me', 'weather', 'temperature',
        'today', 'now', 'currently', 'live',
        'search', 'find', 'look for'
      ];
      
      for (let trigger of searchtriggers) {
        if (lowerquery.includes(trigger)) return true;
      }
      return false;
    }

    function needschart(query) {
      if (!query) return false;
      const lowerquery = query.tolowercase();
      
      const charttriggers = [
        'chart', 'graph', 'pie', 'bar', 'line', 'doughnut',
        'visualization', 'statistics'
      ];
      
      for (let trigger of charttriggers) {
        if (lowerquery.includes(trigger)) return true;
      }
      return false;
    }

    // ============================================
    // si graphique demandé
    // ============================================
    if (cleanmessage && needschart(cleanmessage)) {
      console.log('📊 chart request detected');
      
      try {
        let chartdata = {
          type: 'bar',
          labels: ['jan', 'feb', 'mar', 'apr', 'may', 'jun'],
          datasets: [{ label: 'data', data: [65, 59, 80, 81, 56, 75] }],
          title: "chart"
        };

        const chartresponse = await axios.post(
          `https://${req.headers.host}/api/chart`,
          chartdata,
          { headers: { 'content-type': 'application/json' }, timeout: 10000 }
        );
        
        if (chartresponse.data?.chart) {
          return res.json({
            reply: chartresponse.data.chart,
            suggestions: ["bar chart", "line chart", "pie chart"]
          });
        }
      } catch (charterror) {
        console.error('❌ chart error:', charterror.message);
      }
    }

    // ============================================
    // si recherche nécessaire
    // ============================================
    if (cleanmessage && needswebsearch(cleanmessage)) {
      console.log('🌐 search request detected');
      
      try {
        const searchresponse = await axios.post(
          `https://${req.headers.host}/api/searchunified`,
          { query: cleanmessage },
          { headers: { 'content-type': 'application/json' }, timeout: 10000 }
        );
        
        if (searchresponse.data?.reply) {
          return res.json({
            reply: searchresponse.data.reply,
            suggestions: searchresponse.data.suggestions || ["more results", "new search"]
          });
        }
      } catch (searcherror) {
        console.error('❌ search error:', searcherror.message);
      }
    }

    // ============================================
    // construction des messages
    // ============================================
    
    const messages = [];

    const systemprompt = `you are core ai. respond in ${detectedlang === 'fr' ? 'french' : detectedlang === 'es' ? 'spanish' : detectedlang === 'de' ? 'german' : detectedlang === 'it' ? 'italian' : detectedlang === 'pt' ? 'portuguese' : 'english'}. use html only.`;
    messages.push({ role: 'system', content: systemprompt });

    if (history && array.isarray(history)) {
      const lastusermessage = history
        .filter(msg => msg && msg.role === 'user' && msg.content)
        .slice(-1);
      
      lastusermessage.foreach(msg => {
        messages.push({ 
          role: msg.role, 
          content: sanitizemessage(msg.content).substring(0, 500)
        });
      });
    }

    if (cleanmessage) messages.push({ role: 'user', content: cleanmessage });

    let reply = null;
    let apiused = null;

    // ============================================
    // cas 1 : image reçue → toujours gemini
    // ============================================
    if (image && hasgemini) {
      console.log('📷 image analysis with gemini...');
      
      try {
        const geminipayload = {
          contents: [{
            parts: [
              { text: message || "describe this image in detail" },
              { inline_data: { mime_type: image.mime || "image/jpeg", data: image.data } }
            ]
          }]
        };

        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generatecontent?key=${process.env.gemini_api_key}`,
          geminipayload,
          { timeout: 15000 }
        );

        reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) {
          apiused = 'gemini vision';
          reply = `<p>📷 <strong>image analysis:</strong></p><p>${reply}</p>`;
        }
      } catch (error) {
        console.error('❌ gemini vision error:', error.message);
      }
    }

    // ============================================
    // cas 2 : fichier reçu → toujours gemini
    // ============================================
    if (!reply && file && hasgemini) {
      console.log('📄 file analysis with gemini...');
      
      try {
        const geminipayload = {
          contents: [{
            parts: [
              { text: message || "summarize this document" },
              { inline_data: { mime_type: file.mime || "application/pdf", data: file.data } }
            ]
          }]
        };

        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generatecontent?key=${process.env.gemini_api_key}`,
          geminipayload,
          { timeout: 20000 }
        );

        reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) {
          apiused = 'gemini document';
          reply = `<p>📄 <strong>document analysis:</strong></p><p>${reply}</p>`;
        }
      } catch (error) {
        console.error('❌ gemini document error:', error.message);
      }
    }

    // ============================================
    // cas 3 : texte seulement
    // ============================================
    if (!reply && cleanmessage) {
      
      const messagelength = cleanmessage.length;
      const isverylong = messagelength > 3000;
      const needssummarization = cleanmessage.tolowercase().includes('summarize') || 
                                 cleanmessage.tolowercase().includes('summary') ||
                                 cleanmessage.tolowercase().includes('résumé');

      // ============================================
      // décision intelligente (auto/fast combiné)
      // ============================================
      const usegeminifortext = deepthink || (isverylong || needssummarization) && hasgemini;

      // 1️⃣ essayer gemini si nécessaire
      if (usegeminifortext && hasgemini) {
        try {
          console.log(`📤 using gemini (${deepthink ? 'deep think' : isverylong ? 'long text' : 'summary'})...`);
          
          const geminimessages = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }));

          const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generatecontent?key=${process.env.gemini_api_key}`,
            { contents: geminimessages },
            { timeout: deepthink ? 25000 : 15000 }
          );

          reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) apiused = deepthink ? 'gemini (deep think)' : 'gemini';
          
        } catch (error) {
          console.log('⚠️ gemini failed:', error.message);
        }
      }

      // 2️⃣ sinon openrouter (toujours disponible)
      if (!reply && hasopenrouter) {
        try {
          console.log('📤 using openrouter...');
          
          const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
              model: 'openai/gpt-4o-mini',
              messages,
              temperature: 0.7,
              max_tokens: deepthink ? 2000 : 1000,
            },
            {
              headers: {
                authorization: `bearer ${process.env.openrouter_api_key}`,
                'content-type': 'application/json',
                'http-referer': `https://${req.headers.host}`,
                'x-title': 'core ai'
              },
              timeout: deepthink ? 25000 : 10000
            }
          );

          reply = response.data?.choices?.[0]?.message?.content;
          if (reply) apiused = 'openrouter';
          
        } catch (error) {
          console.log('⚠️ openrouter failed:', error.message);
        }
      }

      // 3️⃣ fallback ultime pour deep think
      if (!reply && deepthink && hasopenrouter) {
        try {
          console.log('⚡ deep think fallback to standard...');
          
          const fallbackres = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
              model: 'openai/gpt-4o-mini',
              messages,
              max_tokens: 1500
            },
            {
              headers: {
                authorization: `bearer ${process.env.openrouter_api_key}`,
                'http-referer': `https://${req.headers.host}`,
                'x-title': 'core ai'
              },
              timeout: 10000
            }
          );
          
          reply = fallbackres.data?.choices?.[0]?.message?.content;
          if (reply) {
            apiused = 'gpt-4o-mini (fallback)';
            reply = `<p><em>⚠️ deep think mode temporarily unavailable. standard response:</em></p>${reply}`;
          }
        } catch (ferror) {
          console.error('❌ fallback failed:', ferror.message);
        }
      }
    }

    if (!reply) {
      return res.json({
        reply: "<p>😅 service temporarily unavailable.</p><p>💡 use charts while waiting!</p>",
        suggestions: ["📊 pie chart", "📈 bar chart", "📉 line chart"]
      });
    }

    if (!reply.includes('<') || !reply.includes('>')) {
      reply = `<p>${reply.replace(/\n/g, '<br>')}</p>`;
    }

    // indicateur discret
    if (process.env.node_env === 'development') {
      reply += `<p style="font-size:10px; color:#999; margin-top:10px;">🤖 via ${apiused}</p>`;
    }

    const suggestions = ["📊 pie chart", "📈 bar chart", "📉 line chart", "📄 proposal"];

    res.json({ reply, suggestions });

  } catch (error) {
    console.error("❌ server error:", error.message);
    res.json({
      reply: "<p>⚠️ something went wrong. please try again.</p>",
      suggestions: ["📊 pie chart", "📈 bar chart", "📉 line chart", "🔄 try again"]
    });
  }
}; 
