const { getStore } = require('@netlify/blobs');

exports.handler = async (event, context) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // 1. Get user context from Netlify Identity
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    // Initialize store, using env vars if automatically injected context is missing (Netlify Drop)
    const store = getStore({ 
      name: 'levelup_user_progress',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_API_TOKEN
    });
    
    const userId = user.sub; // Netlify user UUID

    // 2. GET: Read progress data
    if (event.httpMethod === 'GET') {
      const data = await store.get(userId, { type: 'json' });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data || { empty: true })
      };
    }

    // 3. POST: Write progress data
    if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body);
      
      const dataToStore = {
        state: payload.state,
        updated_at: payload.updated_at || new Date().toISOString()
      };

      await store.set(userId, JSON.stringify(dataToStore));
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, updated_at: dataToStore.updated_at })
      };
    }

    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  } catch (err) {
    console.error('Sync function error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error', details: err.message })
    };
  }
};
