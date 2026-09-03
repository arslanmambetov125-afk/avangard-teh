const SUPABASE_URL = 'https://vnpkczboxrhscplxivvx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Giap9iC_aWfhoHN8n9oLJg_DpKYQSGu';
const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/responses';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function sb(path, token, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || '',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text}`);
  return data;
}

function extractText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim();
  const chunks = [];
  for (const item of payload?.output || []) {
    for (const part of item?.content || []) {
      if ((part?.type === 'output_text' || part?.type === 'text') && part?.text) chunks.push(part.text);
    }
  }
  return chunks.join('\n').trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return json(res, 401, { error: 'Требуется авторизация в Штабе' });

  try {
    const user = await sb('/auth/v1/user', token);
    const userId = user?.id;
    if (!userId) return json(res, 401, { error: 'Недействительная сессия' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const message = String(body.message || '').trim().slice(0, 8000);
    if (!message) return json(res, 400, { error: 'Пустое сообщение' });

    let threadId = body.threadId || null;
    if (!threadId) {
      const title = message.slice(0, 70) || 'Новый диалог';
      const created = await sb('/rest/v1/ai_chat_threads?select=id,title', token, {
        method: 'POST',
        prefer: 'return=representation',
        body: JSON.stringify({ user_id: userId, title }),
      });
      threadId = created?.[0]?.id;
    } else {
      const owned = await sb(`/rest/v1/ai_chat_threads?id=eq.${encodeURIComponent(threadId)}&user_id=eq.${userId}&select=id`, token);
      if (!owned?.length) return json(res, 403, { error: 'Диалог не найден' });
    }

    await sb('/rest/v1/ai_chat_messages', token, {
      method: 'POST',
      body: JSON.stringify({ thread_id: threadId, user_id: userId, role: 'user', content: message }),
    });

    const [projects, tasks, goals, memory, history] = await Promise.all([
      sb('/rest/v1/projects?select=id,name,status,description&order=updated_at.desc&limit=12', token).catch(() => []),
      sb('/rest/v1/work_items?select=id,title,status,priority,due_at,project_id,description&order=updated_at.desc&limit=25', token).catch(() => []),
      sb('/rest/v1/goals?select=id,title,status,target_date,description&order=updated_at.desc&limit=12', token).catch(() => []),
      sb('/rest/v1/ai_project_memory?select=memory_key,memory_value&order=updated_at.desc&limit=20', token).catch(() => []),
      sb(`/rest/v1/ai_chat_messages?thread_id=eq.${encodeURIComponent(threadId)}&select=role,content,created_at&order=created_at.desc&limit=20`, token).catch(() => []),
    ]);

    const recentHistory = [...history].reverse().slice(0, 20);
    const context = {
      projects,
      tasks,
      goals,
      memory,
    };

    const instructions = `Ты — AI-операционный партнёр Арслана внутри «Штаб 2.1».\nТвоя задача — помогать принимать решения и превращать их в конкретные действия. Не соглашайся автоматически: проверяй идеи, отмечай риски, предлагай сильные альтернативы.\nИспользуй данные Штаба как источник текущего состояния проектов, задач и целей. Если данных не хватает — прямо скажи, чего не хватает. Не выдумывай статусы и цифры.\nОтвечай по-русски, кратко и предметно.\n\nТЕКУЩИЙ КОНТЕКСТ ШТАБА:\n${JSON.stringify(context)}`;

    const input = recentHistory.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: [{ type: 'input_text', text: m.content }],
    }));

    const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
    if (!apiKey) return json(res, 503, { error: 'AI Gateway не настроен для проекта' });

    const aiResponse = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5.6-sol',
        instructions,
        input,
      }),
    });

    const aiPayload = await aiResponse.json();
    if (!aiResponse.ok) throw new Error(`AI Gateway ${aiResponse.status}: ${JSON.stringify(aiPayload)}`);
    const answer = extractText(aiPayload) || 'Не удалось получить текстовый ответ.';

    await sb('/rest/v1/ai_chat_messages', token, {
      method: 'POST',
      body: JSON.stringify({ thread_id: threadId, user_id: userId, role: 'assistant', content: answer }),
    });
    await sb(`/rest/v1/ai_chat_threads?id=eq.${encodeURIComponent(threadId)}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ updated_at: new Date().toISOString() }),
    });

    return json(res, 200, { threadId, answer });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Ошибка AI-синхронизации', detail: String(error?.message || error) });
  }
};
