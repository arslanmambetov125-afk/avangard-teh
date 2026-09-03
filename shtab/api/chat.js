const SUPABASE_URL = 'https://vnpkczboxrhscplxivvx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Giap9iC_aWfhoHN8n9oLJg_DpKYQSGu';
const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/responses';
const MODEL = 'openai/gpt-5.6-sol';

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

function functionCalls(payload) {
  return (payload?.output || []).filter((item) => item?.type === 'function_call' && item?.name && item?.call_id);
}

function clamp(n, min, max, fallback) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback;
}

function uuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function postRow(table, token, payload) {
  const rows = await sb(`/rest/v1/${table}?select=*`, token, {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify(payload),
  });
  return rows?.[0] || null;
}

async function patchOwned(table, token, userId, id, payload) {
  const rows = await sb(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&owner_id=eq.${userId}&select=*`, token, {
    method: 'PATCH',
    prefer: 'return=representation',
    body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() }),
  });
  if (!rows?.length) throw new Error('Запись не найдена или нет доступа');
  return rows[0];
}

async function logAction(token, ctx, eventType, title, description = '', extra = {}) {
  if (!ctx.workspace?.id) return;
  await sb('/rest/v1/activity_events', token, {
    method: 'POST',
    body: JSON.stringify({
      owner_id: ctx.userId,
      workspace_id: ctx.workspace.id,
      project_id: extra.project_id || null,
      actor_type: 'agent',
      event_type: eventType,
      title,
      description,
      source: 'shtab-ai',
      entity_type: extra.entity_type || null,
      entity_id: extra.entity_id || null,
      metadata: extra.metadata || {},
    }),
  }).catch(() => null);
}

function findProject(projects, ref) {
  if (!ref) return null;
  const raw = String(ref).trim();
  if (uuidLike(raw)) return projects.find((p) => p.id === raw) || null;
  const q = raw.toLocaleLowerCase('ru');
  return projects.find((p) => String(p.name || '').toLocaleLowerCase('ru') === q)
    || projects.find((p) => String(p.name || '').toLocaleLowerCase('ru').includes(q))
    || null;
}

function findTask(tasks, ref) {
  if (!ref) return null;
  const raw = String(ref).trim();
  if (uuidLike(raw)) return tasks.find((t) => t.id === raw) || null;
  const q = raw.toLocaleLowerCase('ru');
  return tasks.find((t) => String(t.title || '').toLocaleLowerCase('ru') === q)
    || tasks.find((t) => String(t.title || '').toLocaleLowerCase('ru').includes(q))
    || null;
}

const tools = [
  {
    type: 'function', name: 'create_task',
    description: 'Создать реальную задачу в Штабе, только когда пользователь явно просит создать/добавить/зафиксировать задачу.',
    parameters: { type: 'object', properties: {
      project: { type: 'string', description: 'Название или ID проекта из текущего контекста' },
      title: { type: 'string' }, description: { type: 'string' }, due_at: { type: ['string','null'], description: 'ISO 8601 дата/время или null' },
      priority: { type: 'integer', minimum: 1, maximum: 5 }, impact: { type: 'integer', minimum: 1, maximum: 5 }, urgency: { type: 'integer', minimum: 1, maximum: 5 },
    }, required: ['project','title'] },
  },
  {
    type: 'function', name: 'update_task_status',
    description: 'Изменить статус существующей задачи, когда пользователь явно просит отметить её выполненной, вернуть в работу, поставить ожидание или отменить.',
    parameters: { type: 'object', properties: {
      task: { type: 'string', description: 'Название или ID задачи' },
      status: { type: 'string', enum: ['todo','in_progress','waiting','done','cancelled'] },
    }, required: ['task','status'] },
  },
  {
    type: 'function', name: 'update_project',
    description: 'Изменить управленческие поля проекта: статус, здоровье, этап, цель или следующий шаг. Использовать только при явной команде пользователя.',
    parameters: { type: 'object', properties: {
      project: { type: 'string' }, status: { type: ['string','null'], enum: ['active','waiting','paused','done','archived',null] },
      health: { type: ['string','null'], enum: ['strong','stable','risk','critical',null] }, stage: { type: ['string','null'] },
      goal: { type: ['string','null'] }, next_step: { type: ['string','null'] },
    }, required: ['project'] },
  },
  {
    type: 'function', name: 'create_inbox',
    description: 'Сохранить идею, заметку, сигнал или неразобранный материал во Входящие Штаба.',
    parameters: { type: 'object', properties: {
      title: { type: 'string' }, body: { type: 'string' }, project: { type: ['string','null'] },
      item_type: { type: 'string', enum: ['note','idea','task','integration','ai_suggestion'] },
    }, required: ['title'] },
  },
  {
    type: 'function', name: 'create_waiting',
    description: 'Добавить в раздел Жду обещание, ответ, оплату, материал или другое внешнее ожидание.',
    parameters: { type: 'object', properties: {
      title: { type: 'string' }, counterparty: { type: ['string','null'] }, project: { type: ['string','null'] }, notes: { type: 'string' },
      due_at: { type: ['string','null'] }, follow_up_at: { type: ['string','null'] },
    }, required: ['title'] },
  },
  {
    type: 'function', name: 'create_goal',
    description: 'Создать цель в Штабе только при явной просьбе пользователя зафиксировать новую цель.',
    parameters: { type: 'object', properties: {
      title: { type: 'string' }, description: { type: 'string' }, project: { type: ['string','null'] }, due_at: { type: ['string','null'] },
    }, required: ['title'] },
  },
  {
    type: 'function', name: 'save_memory',
    description: 'Сохранить устойчивую рабочую договорённость, правило, предпочтение проекта или важный контекст в общей памяти Штаба. Не сохранять временные мелочи.',
    parameters: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key','value'] },
  },
];

async function executeTool(call, token, ctx) {
  let args = {};
  try { args = JSON.parse(call.arguments || '{}'); } catch { throw new Error('AI передал некорректные параметры действия'); }
  const project = args.project ? findProject(ctx.projects, args.project) : null;

  if (call.name === 'create_task') {
    if (!project) throw new Error(`Проект «${args.project || ''}» не найден`);
    const row = await postRow('work_items', token, {
      owner_id: ctx.userId, workspace_id: ctx.workspace.id, project_id: project.id,
      title: String(args.title || '').trim().slice(0, 180), description: String(args.description || '').trim().slice(0, 2000) || null,
      status: 'todo', priority: clamp(args.priority, 1, 5, 3), impact: clamp(args.impact, 1, 5, 3), urgency: clamp(args.urgency, 1, 5, 3),
      due_at: normalizeDate(args.due_at), assignee_name: 'Арслан', source: 'shtab-ai',
    });
    await logAction(token, ctx, 'ai_task_created', 'AI создал задачу', row.title, { project_id: project.id, entity_type: 'work_item', entity_id: row.id });
    return { ok: true, action: 'Задача создана', title: row.title, project: project.name, id: row.id };
  }

  if (call.name === 'update_task_status') {
    const task = findTask(ctx.tasks, args.task);
    if (!task) throw new Error(`Задача «${args.task || ''}» не найдена`);
    const status = ['todo','in_progress','waiting','done','cancelled'].includes(args.status) ? args.status : 'todo';
    const row = await patchOwned('work_items', token, ctx.userId, task.id, { status, completed_at: status === 'done' ? new Date().toISOString() : null });
    await logAction(token, ctx, 'ai_task_status_changed', 'AI изменил статус задачи', `${row.title}: ${status}`, { project_id: row.project_id, entity_type: 'work_item', entity_id: row.id });
    return { ok: true, action: 'Статус задачи изменён', title: row.title, status, id: row.id };
  }

  if (call.name === 'update_project') {
    if (!project) throw new Error(`Проект «${args.project || ''}» не найден`);
    const patch = {};
    if (args.status) patch.status = args.status;
    if (args.health) patch.health = args.health;
    if (args.stage) patch.stage = String(args.stage).slice(0, 120);
    if (typeof args.goal === 'string') patch.goal = args.goal.slice(0, 2000);
    if (typeof args.next_step === 'string') patch.next_step = args.next_step.slice(0, 2000);
    if (!Object.keys(patch).length) throw new Error('Не указано, что изменить в проекте');
    const row = await patchOwned('projects', token, ctx.userId, project.id, patch);
    await logAction(token, ctx, 'ai_project_updated', 'AI обновил проект', row.name, { project_id: row.id, entity_type: 'project', entity_id: row.id, metadata: patch });
    return { ok: true, action: 'Проект обновлён', project: row.name, changes: patch, id: row.id };
  }

  if (call.name === 'create_inbox') {
    if (args.project && !project) throw new Error(`Проект «${args.project}» не найден`);
    const row = await postRow('inbox_items', token, {
      owner_id: ctx.userId, workspace_id: ctx.workspace.id, project_id: project?.id || null,
      title: String(args.title || '').trim().slice(0, 180), body: String(args.body || '').trim().slice(0, 3000) || null,
      item_type: ['note','idea','task','integration','ai_suggestion'].includes(args.item_type) ? args.item_type : 'note', source: 'shtab-ai', status: 'new',
    });
    await logAction(token, ctx, 'ai_inbox_created', 'AI добавил входящее', row.title, { project_id: row.project_id, entity_type: 'inbox_item', entity_id: row.id });
    return { ok: true, action: 'Добавлено во Входящие', title: row.title, id: row.id };
  }

  if (call.name === 'create_waiting') {
    if (args.project && !project) throw new Error(`Проект «${args.project}» не найден`);
    const row = await postRow('waiting_items', token, {
      owner_id: ctx.userId, workspace_id: ctx.workspace.id, project_id: project?.id || null,
      title: String(args.title || '').trim().slice(0, 180), counterparty: args.counterparty ? String(args.counterparty).slice(0, 180) : null,
      notes: String(args.notes || '').slice(0, 3000) || null, status: 'waiting', due_at: normalizeDate(args.due_at), follow_up_at: normalizeDate(args.follow_up_at),
    });
    await logAction(token, ctx, 'ai_waiting_created', 'AI добавил ожидание', row.title, { project_id: row.project_id, entity_type: 'waiting_item', entity_id: row.id });
    return { ok: true, action: 'Добавлено в Жду', title: row.title, counterparty: row.counterparty, id: row.id };
  }

  if (call.name === 'create_goal') {
    if (args.project && !project) throw new Error(`Проект «${args.project}» не найден`);
    const row = await postRow('goals', token, {
      owner_id: ctx.userId, workspace_id: ctx.workspace.id, project_id: project?.id || null,
      title: String(args.title || '').trim().slice(0, 180), description: String(args.description || '').slice(0, 3000) || null,
      status: 'active', progress: 0, due_at: normalizeDate(args.due_at),
    });
    await logAction(token, ctx, 'ai_goal_created', 'AI создал цель', row.title, { project_id: row.project_id, entity_type: 'goal', entity_id: row.id });
    return { ok: true, action: 'Цель создана', title: row.title, id: row.id };
  }

  if (call.name === 'save_memory') {
    const key = String(args.key || '').trim().toLocaleLowerCase('ru').replace(/[^a-zа-я0-9_-]+/gi, '_').slice(0, 100);
    const value = String(args.value || '').trim().slice(0, 5000);
    if (!key || !value) throw new Error('Память не может быть пустой');
    const rows = await sb('/rest/v1/ai_project_memory?on_conflict=user_id,memory_key&select=*', token, {
      method: 'POST', prefer: 'resolution=merge-duplicates,return=representation',
      body: JSON.stringify({ user_id: ctx.userId, memory_key: key, memory_value: { text: value }, updated_at: new Date().toISOString() }),
    });
    const row = rows?.[0];
    await logAction(token, ctx, 'ai_memory_saved', 'AI обновил общую память', key, { entity_type: 'ai_memory', metadata: { key } });
    return { ok: true, action: 'Память сохранена', key: row?.memory_key || key };
  }

  throw new Error(`Неизвестное действие ${call.name}`);
}

async function askGateway(apiKey, payload) {
  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`AI Gateway ${response.status}: ${JSON.stringify(data)}`);
  return data;
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

    const workspaceRows = await sb(`/rest/v1/workspaces?owner_id=eq.${userId}&select=id,name,timezone,currency&limit=1`, token);
    const workspace = workspaceRows?.[0];
    if (!workspace) return json(res, 409, { error: 'Рабочее пространство Штаба не найдено' });

    let threadId = body.threadId || null;
    if (!threadId) {
      const created = await sb('/rest/v1/ai_chat_threads?select=id,title', token, {
        method: 'POST', prefer: 'return=representation',
        body: JSON.stringify({ user_id: userId, title: message.slice(0, 70) || 'Новый диалог' }),
      });
      threadId = created?.[0]?.id;
    } else {
      const owned = await sb(`/rest/v1/ai_chat_threads?id=eq.${encodeURIComponent(threadId)}&user_id=eq.${userId}&select=id`, token);
      if (!owned?.length) return json(res, 403, { error: 'Диалог не найден' });
    }

    await sb('/rest/v1/ai_chat_messages', token, {
      method: 'POST', body: JSON.stringify({ thread_id: threadId, user_id: userId, role: 'user', content: message }),
    });

    const [projects, tasks, goals, memory, history, waiting, inbox] = await Promise.all([
      sb('/rest/v1/projects?select=id,name,status,priority,description,stage,health,goal,next_step,target_date&order=priority.asc&limit=30', token).catch(() => []),
      sb('/rest/v1/work_items?select=id,title,status,priority,due_at,project_id,description,impact,urgency&order=updated_at.desc&limit=80', token).catch(() => []),
      sb('/rest/v1/goals?select=id,title,status,progress,due_at,project_id,description&order=updated_at.desc&limit=30', token).catch(() => []),
      sb('/rest/v1/ai_project_memory?select=memory_key,memory_value&order=updated_at.desc&limit=30', token).catch(() => []),
      sb(`/rest/v1/ai_chat_messages?thread_id=eq.${encodeURIComponent(threadId)}&select=role,content,created_at&order=created_at.desc&limit=24`, token).catch(() => []),
      sb('/rest/v1/waiting_items?select=id,title,status,counterparty,due_at,follow_up_at,project_id&status=eq.waiting&order=created_at.desc&limit=30', token).catch(() => []),
      sb('/rest/v1/inbox_items?select=id,title,item_type,status,project_id,source&status=eq.new&order=created_at.desc&limit=30', token).catch(() => []),
    ]);

    const ctx = { userId, workspace, projects, tasks, goals, memory, waiting, inbox };
    const currentTime = new Date().toISOString();
    const context = { workspace, current_time_utc: currentTime, projects, tasks, goals, waiting, inbox, memory };
    const instructions = `Ты — AI Chief of Staff Арслана внутри «Штаб 2.2». Ты видишь актуальные данные его операционной системы и можешь выполнять ограниченный набор реальных действий через инструменты.\n\nПРАВИЛА:\n1. Не соглашайся автоматически. Проверяй идеи, риски и приоритеты.\n2. Никогда не выдумывай данные Штаба.\n3. Инструменты записи используй ТОЛЬКО когда пользователь явно просит создать, добавить, изменить, отметить, зафиксировать или сохранить что-то. Для анализа и советов ничего не меняй.\n4. Не удаляй данные: инструментов удаления у тебя нет.\n5. Если действие неоднозначно и есть риск изменить не ту сущность, сначала уточни в ответе, не вызывай инструмент.\n6. После выполненного действия кратко сообщи, что реально изменено.\n7. Даты интерпретируй относительно current_time_utc и timezone рабочего пространства.\n8. Отвечай по-русски, компактно и предметно.\n\nАКТУАЛЬНЫЙ КОНТЕКСТ ШТАБА:\n${JSON.stringify(context)}`;

    const recentHistory = [...history].reverse().slice(0, 24);
    const input = recentHistory.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: [{ type: 'input_text', text: m.content }] }));
    const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
    if (!apiKey) return json(res, 503, { error: 'AI Gateway не настроен для проекта' });

    let aiPayload = await askGateway(apiKey, { model: MODEL, instructions, input, tools });
    const actions = [];

    for (let round = 0; round < 4; round += 1) {
      const calls = functionCalls(aiPayload);
      if (!calls.length) break;
      const outputs = [];
      for (const call of calls) {
        try {
          const result = await executeTool(call, token, ctx);
          actions.push(result);
          outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
          if (result.id && call.name === 'create_task') {
            ctx.tasks.unshift({ id: result.id, title: result.title, status: 'todo', project_id: findProject(projects, result.project)?.id || null });
          }
        } catch (error) {
          const failure = { ok: false, action: call.name, error: String(error?.message || error) };
          actions.push(failure);
          outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(failure) });
        }
      }
      aiPayload = await askGateway(apiKey, { model: MODEL, previous_response_id: aiPayload.id, instructions, input: outputs, tools });
    }

    const answer = extractText(aiPayload) || (actions.length ? 'Действие выполнено и зафиксировано в Штабе.' : 'Не удалось получить текстовый ответ.');
    await sb('/rest/v1/ai_chat_messages', token, {
      method: 'POST', body: JSON.stringify({ thread_id: threadId, user_id: userId, role: 'assistant', content: answer }),
    });
    await sb(`/rest/v1/ai_chat_threads?id=eq.${encodeURIComponent(threadId)}`, token, {
      method: 'PATCH', body: JSON.stringify({ updated_at: new Date().toISOString() }),
    });

    return json(res, 200, { threadId, answer, actions });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Ошибка AI-синхронизации', detail: String(error?.message || error) });
  }
};
