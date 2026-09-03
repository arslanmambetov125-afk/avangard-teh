import { esc, safeUrl, fmtDate, fmtDateOnly, fmtMoney, relativeTime, statusLabel, entityLabel, isOverdue, taskScore, monthStart, todayISO, weekStartISO } from "./lib.js";

export const viewMeta = {
  overview: ["Сегодня", "Операционный центр"], projects: ["Проекты", "Портфель бизнеса"], project: ["Проект", "Портфель бизнеса"],
  tasks: ["Задачи", "Центр выполнения"], inbox: ["Входящие", "Разобрать и назначить"], waiting: ["Жду", "Контроль обязательств"],
  sales: ["Продажи", "Клиенты и воронка"], finance: ["Деньги", "План и факт"], goals: ["Цели и идеи", "Направление движения"],
  agents: ["AI-агенты", "Оркестрация"], integrations: ["Интеграции", "Состояние системы"], activity: ["Журнал действий", "История операций"],
  reviews: ["Weekly review", "Еженедельный разбор"], settings: ["Настройки", "Рабочее пространство"],
};

export const providerMeta = {
  supabase: ["Supabase", "SB", "База, авторизация и RLS"], hubspot: ["HubSpot", "HS", "CRM: компании, ЛПР, сделки и задачи"],
  apollo: ["Apollo", "AP", "Компании и лица, принимающие решения"], github: ["GitHub", "GH", "Код и ветка shtab-2"],
  vercel: ["Vercel", "VC", "Production deployment"], google_drive: ["Google Drive", "GD", "Документы проектов"],
  gmail: ["Gmail", "GM", "Письма и follow-up"], calendar: ["Calendar", "CL", "Сроки и встречи"],
  heygen: ["HeyGen", "HG", "Контент и аватары"], openai: ["OpenAI", "AI", "AI Chief of Staff"], other: ["Другая система", "↗", "Внешний источник"],
};

let s;
const currency = () => s.workspace?.currency || "RUB";
const project = (id) => s.dashboard.find((item) => item.id === id) || s.projects.find((item) => item.id === id) || null;
const projectName = (id) => project(id)?.name || "Без проекта";
const openTasks = () => s.tasks.filter((item) => !["done", "cancelled"].includes(item.status));
const newInbox = () => s.inbox.filter((item) => item.status === "new");
const openWaiting = () => s.waiting.filter((item) => item.status === "waiting");
const crmTasks = () => s.entities.filter((item) => item.entity_type === "task" && !["COMPLETED", "done"].includes(item.status));
const topTasks = () => [...openTasks()].sort((a, b) => taskScore(b) - taskScore(a)).slice(0, 3);
const match = (...values) => !s.search || values.some((value) => String(value ?? "").toLocaleLowerCase("ru").includes(s.search.toLocaleLowerCase("ru")));
const badge = (status, label = statusLabel(status)) => `<span class="badge ${esc(status || "waiting")}">${esc(label)}</span>`;
const empty = (text) => `<div class="empty-inline">${esc(text)}</div>`;
const pageHead = (kicker, title, description, actions = "") => `<header class="page-head"><div><p class="eyebrow">${esc(kicker)}</p><h2>${esc(title)}</h2><p>${esc(description)}</p></div>${actions ? `<div class="page-actions">${actions}</div>` : ""}</header>`;
const metric = (value, label, note, tone = "") => `<article class="metric-card ${tone}"><span class="metric-label">${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`;

function brief() {
  const top = topTasks();
  const overdue = openTasks().filter((task) => isOverdue(task.due_at));
  const risks = s.dashboard.filter((item) => ["risk", "critical"].includes(item.health));
  const approvals = s.approvals.filter((item) => item.status === "pending");
  if (!top.length && !openWaiting().length && !newInbox().length) return "Рабочий контур свободен. Зафиксируйте три результата дня или добавьте денежное действие.";
  const parts = [];
  if (top[0]) parts.push(`Главный фокус — «${top[0].title}»`);
  if (overdue.length) parts.push(`${overdue.length} задач просрочено`);
  if (risks.length) parts.push(`${risks.length} проектов требуют внимания`);
  if (approvals.length) parts.push(`${approvals.length} решений ждут подтверждения`);
  return `${parts.join(". ")}. Сначала закройте действие с максимальным влиянием на деньги или клиента.`;
}

function taskRow(item, compact = false) {
  const overdue = isOverdue(item.due_at) && !["done", "cancelled"].includes(item.status);
  return `<article class="action-row ${overdue ? "overdue" : ""}"><button class="task-check ${item.status === "done" ? "done" : ""}" data-action="toggle-task" data-id="${item.id}" aria-label="Изменить статус">${item.status === "done" ? "✓" : ""}</button><div class="action-copy"><button class="text-button" data-action="edit-task" data-id="${item.id}"><b>${esc(item.title)}</b></button><small>${esc(projectName(item.project_id))} · P${item.priority || 3}${item.due_at ? ` · ${overdue ? "Просрочено " : ""}${esc(fmtDate(item.due_at))}` : " · Без срока"}</small>${!compact && item.description ? `<p>${esc(item.description)}</p>` : ""}</div><span class="score-pill" title="Приоритетный балл">${taskScore(item)}</span></article>`;
}

function projectMini(item) {
  const result = Number(item.actual_income || 0) - Number(item.actual_expense || 0);
  return `<button class="project-mini" data-open-project="${item.id}" style="--project-color:${esc(item.color || "#8fa4ff")}"><span class="project-mini-top"><i></i>${badge(item.health)}</span><b>${esc(item.name)}</b><small>${esc(item.next_step || "Нужен следующий шаг")}</small><span class="project-mini-meta"><em>${item.open_tasks || 0} задач</em><em>${fmtMoney(result, item.currency || currency())}</em></span></button>`;
}

function overview() {
  const tasks = openTasks();
  const overdue = tasks.filter((item) => isOverdue(item.due_at));
  const active = s.dashboard.filter((item) => item.status === "active");
  const risks = s.dashboard.filter((item) => ["risk", "critical"].includes(item.health) || !item.next_step);
  const entries = s.finance.filter((item) => item.occurred_on >= monthStart() && item.status === "actual");
  const income = entries.filter((item) => item.entry_type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
  const expense = entries.filter((item) => item.entry_type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
  const approvals = s.approvals.filter((item) => item.status === "pending").length;
  const plan = s.dailyPlans.find((item) => item.plan_date === todayISO());
  return `${pageHead("Founder operating system", "Сегодня", "Фокус на день: деньги, клиент и выполненное действие.", `<button class="button button-ghost" data-action="save-daily">${plan ? "Обновить план дня" : "Зафиксировать план"}</button><button class="button button-primary" data-create="task">+ Задача</button>`)}
  <section class="brief-card"><div class="brief-icon">✦</div><div><p class="eyebrow">AI Chief of Staff · аналитический режим</p><h3>${esc(brief())}</h3><div class="brief-legend"><span><i class="auto"></i>Автоматически анализируется</span><span><i class="manual"></i>Выполняет Арслан</span><span><i class="approval"></i>Требует проверки: ${approvals}</span></div></div></section>
  <section class="metrics-grid metrics-grid-five">${metric(active.length, "Активных проектов", `${risks.length} требуют следующего шага`, risks.length ? "warning" : "")}${metric(tasks.length, "Открытых задач", `${overdue.length} просрочено`, overdue.length ? "danger" : "")}${metric(fmtMoney(income, currency()), "Доход за месяц", income ? "Фактические записи" : "Добавьте первый факт", "positive")}${metric(fmtMoney(expense, currency()), "Расход за месяц", "Фактические записи")}${metric(newInbox().length + openWaiting().length, "Нужно разобрать", `${newInbox().length} входящих · ${openWaiting().length} ожиданий`, newInbox().length ? "warning" : "")}</section>
  <section class="dashboard-grid"><article class="content-card focus-card"><header class="content-card-header"><div><p class="eyebrow">Top-3</p><h3>Главные действия</h3></div><button class="text-link" data-view="tasks">Все задачи →</button></header><div class="action-list">${topTasks().length ? topTasks().map((item) => taskRow(item)).join("") : empty("Добавьте задачи и оцените влияние — Штаб соберёт Top-3.")}</div></article>
  <article class="content-card money-card"><header class="content-card-header"><div><p class="eyebrow">Деньги</p><h3>Финансовый импульс</h3></div><button class="text-link" data-create="finance">+ Запись</button></header><div class="money-balance"><span>Результат месяца</span><strong class="${income - expense >= 0 ? "positive-text" : "negative-text"}">${fmtMoney(income - expense, currency())}</strong></div><div class="progress-track"><i style="width:${Math.min(100, income ? Math.round((Math.max(0, income - expense) / income) * 100) : 0)}%"></i></div><p class="muted">Учтены только реальные записи со статусом «Факт».</p></article>
  <article class="content-card"><header class="content-card-header"><p class="eyebrow">Контроль</p><h3>Риски и стоп-факторы</h3></header><div class="signal-list">${risks.length ? risks.slice(0, 6).map((item) => `<button class="signal-row" data-open-project="${item.id}"><span class="status-light ${item.health === "critical" ? "error" : "waiting"}"></span><span><b>${esc(item.name)}</b><small>${esc(item.next_step || "Не определён следующий шаг")}</small></span><span>→</span></button>`).join("") : empty("Все проекты имеют следующий шаг.")}</div></article>
  <article class="content-card"><header class="content-card-header"><div><p class="eyebrow">Следом</p><h3>Ожидания и входящие</h3></div><button class="text-link" data-view="inbox">Разобрать →</button></header><div class="signal-list">${[...openWaiting().map((item) => ({ ...item, target: "waiting" })), ...newInbox().map((item) => ({ ...item, target: "inbox" }))].slice(0, 6).map((item) => `<button class="signal-row" data-view="${item.target}"><span class="status-light waiting"></span><span><b>${esc(item.title)}</b><small>${item.target === "waiting" ? `Ждём: ${esc(item.counterparty || "ответ")}` : `Входящее · ${esc(item.source)}`}</small></span><span>→</span></button>`).join("") || empty("Нет неразобранных входящих и ожиданий.")}</div></article></section>
  <section class="section-block"><header class="section-heading"><div><p class="eyebrow">Портфель</p><h3>Проекты в движении</h3></div><button class="text-link" data-view="projects">Открыть портфель →</button></header><div class="project-strip">${s.dashboard.filter((item) => item.status !== "archived").slice(0, 8).map(projectMini).join("")}</div></section>`;
}

function projectCard(item) {
  const result = Number(item.actual_income || 0) - Number(item.actual_expense || 0);
  return `<article class="project-card" style="--project-color:${esc(item.color || "#8fa4ff")}"><header><span class="project-index">P${item.priority}</span>${badge(item.status)}</header><button class="project-card-title" data-open-project="${item.id}"><h3>${esc(item.name)}</h3><span>${esc(item.stage || "development")} · ${esc(statusLabel(item.health))}</span></button><p>${esc(item.goal || item.description || "Цель проекта ещё не зафиксирована.")}</p><div class="project-next"><span>Следующий шаг</span><b>${esc(item.next_step || "Определить следующий результат")}</b></div><div class="project-stats"><span><b>${item.open_tasks || 0}</b><small>задач</small></span><span><b>${item.hubspot_contacts || item.apollo_contacts || 0}</b><small>ЛПР</small></span><span><b>${fmtMoney(result, item.currency || currency())}</b><small>результат</small></span></div><footer><span class="health-line ${esc(item.health)}"><i></i>${esc(statusLabel(item.health))}</span><button class="text-link" data-open-project="${item.id}">Открыть →</button></footer></article>`;
}

function projects() {
  const statuses = [["all", "Все"], ["active", "Активные"], ["waiting", "Ожидают"], ["paused", "Пауза"], ["done", "Готово"], ["archived", "Архив"]];
  const list = s.dashboard.filter((item) => (s.projectStatus === "all" || item.status === s.projectStatus) && match(item.name, item.slug, item.goal, item.next_step));
  return `${pageHead("Портфель бизнеса", "Проекты", "Статус, здоровье, следующий шаг, задачи и деньги каждого направления.", `<button class="button button-primary" data-create="project">+ Новый проект</button>`)}<div class="filter-bar"><div class="segmented">${statuses.map(([value, label]) => `<button class="${s.projectStatus === value ? "active" : ""}" data-project-status="${value}">${label}</button>`).join("")}</div><span class="filter-summary">${list.length} из ${s.dashboard.length}</span></div><section class="projects-grid expanded">${list.map(projectCard).join("") || empty("Проекты не найдены.")}</section>`;
}

function entityTable(records = s.entities) {
  const list = records.filter((item) => match(item.display_name, item.entity_type, item.provider, projectName(item.project_id)));
  return `<section class="table-card">${list.length ? `<table class="data-table"><thead><tr><th>Название</th><th>Тип</th><th>Проект</th><th>Источник</th><th>Статус</th><th>Обновлено</th></tr></thead><tbody>${list.map((item) => `<tr><td><a class="table-primary" href="${safeUrl(item.external_url)}" target="_blank" rel="noopener">${esc(item.display_name || "Без названия")} ↗</a></td><td>${esc(entityLabel(item.entity_type))}</td><td>${esc(projectName(item.project_id))}</td><td>${esc(providerMeta[item.provider]?.[0] || item.provider)}</td><td>${badge(item.status || "waiting")}</td><td>${esc(fmtDate(item.synced_at || item.source_updated_at))}</td></tr>`).join("")}</tbody></table>` : empty("Рабочих записей пока нет.")}</section>`;
}

function financeRow(item) {
  return `<article class="finance-row"><span class="finance-icon ${item.entry_type}">${item.entry_type === "income" ? "+" : "−"}</span><div><button class="text-button" data-edit="finance" data-id="${item.id}"><b>${esc(item.description)}</b></button><small>${esc(projectName(item.project_id))} · ${esc(item.category || "Без категории")} · ${esc(fmtDateOnly(item.occurred_on))}</small></div><div class="finance-amount ${item.entry_type}"><b>${item.entry_type === "income" ? "+" : "−"}${fmtMoney(item.amount, item.currency)}</b>${badge(item.status)}</div></article>`;
}

function goalRow(item) {
  return `<article class="goal-row"><div class="goal-progress"><span style="--progress:${Number(item.progress || 0) * 3.6}deg"><b>${item.progress || 0}%</b></span></div><div><button class="text-button" data-edit="goal" data-id="${item.id}"><b>${esc(item.title)}</b></button><small>${esc(projectName(item.project_id))} · ${esc(fmtDateOnly(item.due_at))}</small>${item.description ? `<p>${esc(item.description)}</p>` : ""}</div><div>${badge(item.status)}</div></article>`;
}

function projectView() {
  const item = project(s.selectedProjectId);
  if (!item) return `${pageHead("Проект", "Проект не найден", "Вернитесь в портфель.")}<button class="button button-primary" data-view="projects">К проектам</button>`;
  const tabs = [["overview", "Обзор"], ["tasks", "Задачи"], ["sales", "Продажи"], ["finance", "Деньги"], ["goals", "Цели"], ["settings", "Настройки"]];
  const itemTasks = s.tasks.filter((row) => row.project_id === item.id);
  const entities = s.entities.filter((row) => row.project_id === item.id);
  const finances = s.finance.filter((row) => row.project_id === item.id);
  const goals = s.goals.filter((row) => row.project_id === item.id);
  let content;
  if (s.projectTab === "tasks") content = `<section class="content-card">${itemTasks.length ? itemTasks.map((row) => taskRow(row)).join("") : empty("У проекта нет задач.")}</section>`;
  else if (s.projectTab === "sales") content = entityTable(entities);
  else if (s.projectTab === "finance") content = `<section class="content-card"><header class="content-card-header"><h3>Финансы проекта</h3><button class="text-link" data-create="finance" data-project="${item.id}">+ Запись</button></header>${finances.length ? finances.map(financeRow).join("") : empty("Финансовых записей нет.")}</section>`;
  else if (s.projectTab === "goals") content = `<section class="content-card"><header class="content-card-header"><h3>Цели проекта</h3><button class="text-link" data-create="goal" data-project="${item.id}">+ Цель</button></header>${goals.length ? goals.map(goalRow).join("") : empty("Зафиксируйте цель проекта.")}</section>`;
  else if (s.projectTab === "settings") content = `<section class="settings-grid"><article class="settings-card"><h3>Управление проектом</h3><p>Статус, приоритет, здоровье и следующий шаг.</p><div class="settings-row"><span><b>${esc(statusLabel(item.status))}</b><small>${esc(statusLabel(item.health))} · ${esc(item.stage)}</small></span><button class="button button-ghost button-small" data-edit="project" data-id="${item.id}">Изменить</button></div></article><article class="settings-card"><h3>Подтверждённые ссылки</h3>${s.refs.filter((row) => row.project_id === item.id).map((row) => `<div class="settings-row"><span><b>${esc(providerMeta[row.provider]?.[0] || row.provider)}</b><small>Связано с проектом</small></span><a class="button button-ghost button-small" href="${safeUrl(row.external_url)}" target="_blank" rel="noopener">Открыть ↗</a></div>`).join("") || empty("Внешние ссылки не добавлены.")}</article></section>`;
  else {
    const income = finances.filter((row) => row.entry_type === "income" && row.status === "actual").reduce((sum, row) => sum + Number(row.amount), 0);
    const expense = finances.filter((row) => row.entry_type === "expense" && row.status === "actual").reduce((sum, row) => sum + Number(row.amount), 0);
    content = `<section class="metrics-grid">${metric(itemTasks.filter((row) => !["done", "cancelled"].includes(row.status)).length, "Открытых задач", `${itemTasks.filter((row) => isOverdue(row.due_at)).length} просрочено`)}${metric(entities.filter((row) => row.entity_type === "contact").length, "ЛПР", `${entities.filter((row) => ["company", "account"].includes(row.entity_type)).length} компаний`)}${metric(fmtMoney(income - expense, item.currency), "Финансовый результат", `Цель ${fmtMoney(item.revenue_target, item.currency)}`)}${metric(goals.length, "Целей", `${goals.filter((row) => row.status === "at_risk").length} в риске`)}</section><section class="dashboard-grid"><article class="content-card"><header class="content-card-header"><h3>Следующий результат</h3></header><div class="big-next-step"><span>→</span><b>${esc(item.next_step || "Определить следующий измеримый шаг")}</b></div></article><article class="content-card"><header class="content-card-header"><h3>Ближайшие задачи</h3></header>${itemTasks.filter((row) => !["done", "cancelled"].includes(row.status)).sort((a, b) => taskScore(b) - taskScore(a)).slice(0, 4).map((row) => taskRow(row, true)).join("") || empty("Открытых задач нет.")}</article></section>`;
  }
  return `${pageHead(`P${item.priority} · ${statusLabel(item.status)}`, item.name, item.goal || item.description || "Цель проекта не зафиксирована.", `<button class="button button-ghost" data-edit="project" data-id="${item.id}">Редактировать</button><button class="button button-primary" data-create="task" data-project="${item.id}">+ Задача</button>`)}<div class="project-tabs">${tabs.map(([value, label]) => `<button class="${s.projectTab === value ? "active" : ""}" data-project-tab="${value}">${label}</button>`).join("")}</div>${content}`;
}

function tasks() {
  const statuses = [["open", "Открытые"], ["all", "Все"], ["todo", "К выполнению"], ["in_progress", "В работе"], ["waiting", "Ожидают"], ["done", "Готово"]];
  const list = s.tasks.filter((item) => (s.taskStatus === "all" || (s.taskStatus === "open" ? !["done", "cancelled"].includes(item.status) : item.status === s.taskStatus)) && (s.taskProject === "all" || item.project_id === s.taskProject) && match(item.title, item.description, projectName(item.project_id), (item.tags || []).join(" "))).sort((a, b) => taskScore(b) - taskScore(a));
  const options = `<option value="all">Все проекты</option>${s.projects.map((item) => `<option value="${item.id}" ${item.id === s.taskProject ? "selected" : ""}>${esc(item.name)}</option>`).join("")}`;
  return `${pageHead("Центр выполнения", "Задачи", "Приоритет учитывает важность, влияние, срочность и просрочку.", `<button class="button button-primary" data-create="task">+ Новая задача</button>`)}<div class="filter-bar"><div class="segmented">${statuses.map(([value, label]) => `<button class="${s.taskStatus === value ? "active" : ""}" data-task-status="${value}">${label}</button>`).join("")}</div><select id="taskProjectFilter" class="compact-select">${options}</select></div><section class="table-card task-table-card">${list.length ? list.map((item) => taskRow(item)).join("") : empty("Задач по выбранным условиям нет.")}</section>${crmTasks().length ? `<section class="content-card section-block"><header class="content-card-header"><div><h3>Действия из HubSpot</h3><small class="muted">Источник только для чтения</small></div>${badge("waiting", "CRM")}</header>${crmTasks().filter((item) => match(item.display_name, projectName(item.project_id))).map((item) => `<article class="action-row"><span class="task-check source">HS</span><div class="action-copy"><a href="${safeUrl(item.external_url)}" target="_blank" rel="noopener"><b>${esc(item.display_name || "CRM-задача")}</b><small>${esc(projectName(item.project_id))} · ${esc(fmtDate(item.source_updated_at))}</small></a></div><span>↗</span></article>`).join("")}</section>` : ""}`;
}

function inbox() {
  const list = s.inbox.filter((item) => match(item.title, item.body, item.source, projectName(item.project_id)));
  return `${pageHead("Единая точка входа", "Входящие", "Идеи, заметки, сигналы интеграций и неподтверждённые действия.", `<button class="button button-primary" data-create="inbox">+ Добавить входящее</button>`)}<section class="inbox-layout"><article class="content-card"><header class="content-card-header"><h3>Нужно разобрать</h3><span>${newInbox().length}</span></header><div class="inbox-list">${list.length ? list.map((item) => `<article class="inbox-row ${item.status !== "new" ? "muted-row" : ""}"><div class="type-icon">${item.item_type === "idea" ? "✦" : item.item_type === "integration" ? "⌁" : "↓"}</div><div><button class="text-button" data-edit="inbox" data-id="${item.id}"><b>${esc(item.title)}</b></button><small>${esc(item.source)} · ${esc(projectName(item.project_id))} · ${esc(relativeTime(item.created_at))}</small>${item.body ? `<p>${esc(item.body)}</p>` : ""}</div><div class="row-actions">${item.status === "new" ? `<button class="button button-ghost button-small" data-action="inbox-to-task" data-id="${item.id}">В задачу</button><button class="icon-button" data-action="process-inbox" data-id="${item.id}" title="Разобрано">✓</button>` : badge(item.status)}</div></article>`).join("") : empty("Входящие разобраны.")}</div></article><aside class="content-card inbox-guide"><p class="eyebrow">Правило Inbox</p><h3>Каждая запись должна получить место.</h3><ol><li>Превратить в задачу.</li><li>Привязать к проекту.</li><li>Отложить или архивировать.</li></ol></aside></section>`;
}

function waiting() {
  const list = s.waiting.filter((item) => match(item.title, item.counterparty, item.notes, projectName(item.project_id)));
  const overdue = openWaiting().filter((item) => isOverdue(item.follow_up_at || item.due_at));
  return `${pageHead("Контроль обязательств", "Жду", "Ни один обещанный ответ или результат не должен потеряться.", `<button class="button button-primary" data-create="waiting">+ Добавить ожидание</button>`)}<section class="metrics-grid">${metric(openWaiting().length, "Ожидаем", `${overdue.length} требуют follow-up`, overdue.length ? "danger" : "")}${metric(list.filter((item) => item.status === "resolved").length, "Получено", "За всё время", "positive")}${metric(list.filter((item) => item.follow_up_at && new Date(item.follow_up_at).toDateString() === new Date().toDateString()).length, "Follow-up сегодня", "Запланированные касания")}</section><section class="content-card section-block"><div class="waiting-list">${list.length ? list.map((item) => { const due = item.follow_up_at || item.due_at; return `<article class="waiting-row ${item.status === "waiting" && isOverdue(due) ? "overdue" : ""}"><span class="waiting-date"><b>${due ? esc(new Intl.DateTimeFormat("ru-RU", { day: "2-digit" }).format(new Date(due))) : "—"}</b><small>${due ? esc(new Intl.DateTimeFormat("ru-RU", { month: "short" }).format(new Date(due))) : "срок"}</small></span><div><button class="text-button" data-edit="waiting" data-id="${item.id}"><b>${esc(item.title)}</b></button><small>${esc(item.counterparty || "Контрагент не указан")} · ${esc(projectName(item.project_id))}</small></div><div class="row-actions">${badge(item.status)}${item.status === "waiting" ? `<button class="icon-button" data-action="resolve-waiting" data-id="${item.id}" title="Получено">✓</button>` : ""}</div></article>`; }).join("") : empty("Добавьте то, что ждёте от клиента, партнёра или команды.")}</div></section>`;
}

function sales() {
  const companies = s.entities.filter((item) => ["company", "account"].includes(item.entity_type));
  const contacts = s.entities.filter((item) => item.entity_type === "contact");
  const deals = s.entities.filter((item) => item.entity_type === "deal");
  return `${pageHead("Клиентский контур", "Продажи", "Реальные сущности HubSpot и Apollo. Без выдуманных сумм и конверсий.")}<section class="pipeline"><div class="pipeline-stage"><span>1. Компании</span><strong>${companies.length}</strong><small>HubSpot + Apollo</small></div><div class="pipeline-arrow">→</div><div class="pipeline-stage"><span>2. ЛПР</span><strong>${contacts.length}</strong><small>Контакты</small></div><div class="pipeline-arrow">→</div><div class="pipeline-stage"><span>3. Сделки</span><strong>${deals.length}</strong><small>Синхронизировано</small></div><div class="pipeline-arrow">→</div><div class="pipeline-stage"><span>4. Следующие шаги</span><strong>${crmTasks().length}</strong><small>CRM-задачи</small></div></section><div class="data-honesty"><span>i</span><p><b>Суммы и вероятность не подставляются.</b> Они появятся после поступления соответствующих полей из HubSpot.</p></div>${entityTable()}`;
}

function finance() {
  const actual = s.finance.filter((item) => item.status === "actual");
  const income = actual.filter((item) => item.entry_type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
  const expense = actual.filter((item) => item.entry_type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
  const expected = s.finance.filter((item) => item.status === "expected" && item.entry_type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
  return `${pageHead("План и факт", "Деньги", "Ручные и интеграционные финансовые записи с обязательным источником.", `<button class="button button-primary" data-create="finance">+ Доход или расход</button>`)}<section class="metrics-grid">${metric(fmtMoney(income, currency()), "Доход — факт", `${actual.filter((item) => item.entry_type === "income").length} записей`, "positive")}${metric(fmtMoney(expense, currency()), "Расход — факт", `${actual.filter((item) => item.entry_type === "expense").length} записей`)}${metric(fmtMoney(income - expense, currency()), "Результат", income - expense >= 0 ? "Положительный" : "Отрицательный", income - expense >= 0 ? "positive" : "danger")}${metric(fmtMoney(expected, currency()), "Ожидаемый доход", "Не включён в факт", "warning")}</section><section class="finance-layout"><article class="content-card"><header class="content-card-header"><h3>Операции</h3><span>${s.finance.length}</span></header>${s.finance.length ? s.finance.filter((item) => match(item.description, item.category, projectName(item.project_id))).map(financeRow).join("") : empty("Добавьте первый доход или расход.")}</article><aside class="content-card"><p class="eyebrow">По проектам</p><h3>Финансовый результат</h3><div class="project-finance-list">${s.dashboard.map((item) => { const result = Number(item.actual_income || 0) - Number(item.actual_expense || 0); return `<button data-open-project="${item.id}"><span>${esc(item.name)}</span><b class="${result >= 0 ? "positive-text" : "negative-text"}">${fmtMoney(result, item.currency)}</b></button>`; }).join("")}</div></aside></section>`;
}

function goals() {
  const active = s.goals.filter((item) => ["active", "at_risk"].includes(item.status));
  const average = active.length ? Math.round(active.reduce((sum, item) => sum + Number(item.progress || 0), 0) / active.length) : 0;
  return `${pageHead("Направление движения", "Цели и идеи", "Измеримые результаты, идеи и решения, связанные с проектами.", `<button class="button button-ghost" data-create="inbox" data-type="idea">+ Идея</button><button class="button button-primary" data-create="goal">+ Цель</button>`)}<section class="metrics-grid">${metric(active.length, "Активных целей", `${s.goals.filter((item) => item.status === "at_risk").length} в риске`)}${metric(`${average}%`, "Средний прогресс", "По активным целям")}${metric(newInbox().filter((item) => item.item_type === "idea").length, "Идей во входящих", "Ожидают решения")}</section><section class="goals-layout"><article class="content-card"><header class="content-card-header"><h3>Цели</h3><span>${s.goals.length}</span></header>${s.goals.length ? s.goals.filter((item) => match(item.title, item.description, projectName(item.project_id))).map(goalRow).join("") : empty("Поставьте первую измеримую цель.")}</article><aside class="content-card"><p class="eyebrow">Идеи</p><h3>Кандидаты в действия</h3>${s.inbox.filter((item) => item.item_type === "idea" && item.status === "new").slice(0, 8).map((item) => `<button class="idea-chip" data-edit="inbox" data-id="${item.id}">✦ ${esc(item.title)}</button>`).join("") || empty("Новых идей нет.")}</aside></section>`;
}

function agentCard(item) {
  const runs = s.agentRuns.filter((run) => run.agent_id === item.id);
  const last = runs[0];
  return `<article class="agent-card"><header><span class="agent-avatar">✦</span>${badge(item.status)}</header><button class="project-card-title" data-edit="agent" data-id="${item.id}"><h3>${esc(item.name)}</h3><span>${esc(item.role)}</span></button><div class="agent-stats"><span><b>${runs.length}</b><small>запусков</small></span><span><b>${fmtMoney(runs.reduce((sum, run) => sum + Number(run.cost || 0), 0), item.currency)}</b><small>стоимость</small></span><span><b>L${item.autonomy_level}</b><small>автономность</small></span></div><footer><small>${last ? `${statusLabel(last.status)} · ${relativeTime(last.created_at)}` : "Запусков ещё не было"}</small></footer></article>`;
}

function agents() {
  const openAI = s.connections.find((item) => item.provider === "openai");
  const pending = s.approvals.filter((item) => item.status === "pending");
  return `${pageHead("Оркестрация", "AI-агенты", "Реестр ролей, запусков, стоимости и обязательных подтверждений.", `<button class="button button-primary" data-create="agent">+ Добавить агента</button>`)}<div class="ai-mode-card ${openAI?.status === "connected" ? "connected" : ""}"><div class="ai-orbit">✦</div><div><p class="eyebrow">AI Chief of Staff</p><h3>${openAI?.status === "connected" ? "Модель подключена" : "Аналитический режим без модели"}</h3><p>${openAI?.status === "connected" ? "Можно создавать объяснимые рекомендации на основе данных Штаба." : "Приоритеты и риски рассчитываются локальными правилами. Для генеративных рекомендаций нужен серверный OpenAI-ключ."}</p></div>${badge(openAI?.status || "not_connected")}</div>${pending.length ? `<section class="content-card section-block"><header class="content-card-header"><h3>Требуют подтверждения</h3>${badge("approval", String(pending.length))}</header>${pending.map((item) => `<div class="approval-row"><span>!</span><div><b>${esc(item.title)}</b><small>${esc(item.description || "Критичное действие агента")}</small></div><div><button class="button button-ghost button-small" data-action="decide-approval" data-id="${item.id}" data-decision="rejected">Отклонить</button><button class="button button-primary button-small" data-action="decide-approval" data-id="${item.id}" data-decision="approved">Одобрить</button></div></div>`).join("")}</section>` : ""}<section class="agents-grid">${s.agents.length ? s.agents.map(agentCard).join("") : `<div class="agent-empty-card"><div class="empty-state"><div class="empty-orbit">✦</div><h2>Реестр агентов пуст</h2><p>Добавьте реальную роль. Штаб не изображает запусков, которых не было.</p><button class="button button-primary" data-create="agent">Добавить первого агента</button></div></div>`}</section>`;
}

function integrationCard(item) {
  const meta = providerMeta[item.provider] || [item.provider, "↗", "Внешняя система"];
  const sync = s.syncs.find((row) => row.provider === item.provider);
  const ok = item.status === "connected" && (!sync || sync.status === "success");
  return `<article class="integration-card"><header class="integration-head"><div class="integration-brand"><span class="integration-logo">${esc(meta[1])}</span><span><h3>${esc(meta[0])}</h3><small>${esc(meta[2])}</small></span></div>${badge(ok ? "connected" : item.status)}</header><div class="integration-stats"><span><b>${sync ? Number(sync.records_seen || 0) : item.provider === "supabase" ? s.dashboard.length + s.tasks.length : "—"}</b><small>${sync ? "получено" : "записей"}</small></span><span><b>${sync ? Number(sync.records_upserted || 0) : item.schedule || "—"}</b><small>${sync ? "обновлено" : "расписание"}</small></span></div><footer class="integration-foot"><span>${item.last_error ? `Ошибка: ${esc(item.last_error)}` : `Последний успех: ${esc(relativeTime(item.last_success_at || sync?.finished_at))}`}</span><span class="mini-state ${ok ? "good" : ""}">${ok ? "● online" : "○ setup"}</span></footer>${item.status === "not_connected" ? `<div class="setup-note">Для подключения потребуются разрешение сервиса и серверный ключ. Секреты в браузере не сохраняются.</div>` : ""}</article>`;
}

function integrations() {
  const connected = s.connections.filter((item) => item.status === "connected").length;
  const latest = s.syncs.map((item) => item.finished_at || item.started_at).filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0];
  return `${pageHead("Состояние системы", "Интеграции", "Только подтверждённые подключения, реальные синхронизации и ошибки.")}<section class="metrics-grid">${metric(connected, "Подключено", `из ${s.connections.length} систем`, "positive")}${metric(s.syncs.filter((item) => item.status === "success").length, "Успешных запусков", "В истории синхронизаций")}${metric(s.syncs.filter((item) => ["failed", "partial"].includes(item.status)).length, "Ошибок и частичных", "Требуют внимания")}${metric(fmtDate(latest), "Последняя синхронизация", "Все источники")}</section><section class="integrations-grid">${s.connections.map(integrationCard).join("")}</section>`;
}

function activity() {
  const explicit = s.activities.map((item) => ({ ...item, displaySource: item.source }));
  const syncEvents = s.syncs.map((item) => ({ id: `sync-${item.id}`, title: `${providerMeta[item.provider]?.[0] || item.provider}: ${statusLabel(item.status)}`, description: `${item.records_upserted || 0} обновлено из ${item.records_seen || 0}`, source: item.provider, displaySource: item.provider, actor_type: "integration", created_at: item.finished_at || item.started_at }));
  const events = [...explicit, ...syncEvents].filter((item) => (s.activitySource === "all" || item.actor_type === s.activitySource) && match(item.title, item.description, item.source, projectName(item.project_id))).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return `${pageHead("История операций", "Журнал действий", "Пользовательские изменения, AI, системные события и синхронизации.")}<div class="filter-bar"><div class="segmented">${[["all", "Все"], ["user", "Арслан"], ["ai", "AI"], ["integration", "Интеграции"], ["system", "Система"]].map(([value, label]) => `<button class="${s.activitySource === value ? "active" : ""}" data-activity-source="${value}">${label}</button>`).join("")}</div></div><section class="timeline">${events.length ? events.slice(0, 150).map((item) => `<article class="timeline-item"><span class="timeline-icon ${esc(item.actor_type)}">${item.actor_type === "integration" ? "⌁" : item.actor_type === "ai" ? "✦" : item.actor_type === "system" ? "⚙" : "АМ"}</span><div><b>${esc(item.title)}</b><p>${esc(item.description || "")}</p><small>${esc(item.displaySource || item.source)} · ${esc(projectName(item.project_id))} · ${esc(fmtDate(item.created_at, true))}</small></div></article>`).join("") : empty("Журнал пока пуст.")}</section>`;
}

function reviews() {
  const current = s.reviews.find((item) => item.week_start === weekStartISO());
  return `${pageHead("Еженедельный разбор", "Weekly review", "Факты недели, проблемы, решения и план следующего цикла.", `<button class="button button-primary" data-create="review" data-id="${current?.id || ""}">${current ? "Продолжить обзор" : "+ Начать обзор"}</button>`)}<section class="review-summary"><article class="content-card"><p class="eyebrow">Текущая неделя</p><h3>${esc(fmtDateOnly(weekStartISO()))}</h3><div class="review-metrics"><span><b>${s.tasks.filter((item) => item.status === "done" && item.completed_at?.slice(0, 10) >= weekStartISO()).length}</b><small>задач завершено</small></span><span><b>${s.finance.filter((item) => item.occurred_on >= weekStartISO() && item.entry_type === "income" && item.status === "actual").length}</b><small>доходных событий</small></span><span><b>${s.goals.filter((item) => item.updated_at?.slice(0, 10) >= weekStartISO()).length}</b><small>целей обновлено</small></span></div><p>${esc(current?.summary || "Обзор недели ещё не зафиксирован.")}</p></article><article class="content-card"><p class="eyebrow">Рекомендация Штаба</p><h3>Закройте незавершённые циклы.</h3><p>${esc(brief())}</p></article></section><section class="content-card section-block"><header class="content-card-header"><h3>Архив обзоров</h3><span>${s.reviews.length}</span></header>${s.reviews.length ? s.reviews.map((item) => `<button class="review-row" data-edit="review" data-id="${item.id}"><span><b>Неделя ${esc(fmtDateOnly(item.week_start))}</b><small>${esc(item.summary || "Без итогового резюме")}</small></span>${badge(item.status)}</button>`).join("") : empty("Сохранённых обзоров пока нет.")}</section>`;
}

function settings() {
  const auto = Number(s.preferences?.auto_refresh_seconds ?? 60);
  return `${pageHead("Рабочее пространство", "Настройки", "Параметры сохраняются в Supabase и применяются на всех устройствах.", `<button class="button button-ghost" data-action="export">Экспорт JSON</button>`)}<section class="settings-grid settings-grid-wide">
  <form class="settings-card" data-settings="profile"><h3>Профиль</h3><p>Личные параметры владельца.</p><label class="field-label"><span>Имя</span><input class="field" name="display_name" value="${esc(s.profile?.display_name || "")}" required /></label><div class="form-grid"><label class="field-label"><span>Часовой пояс</span><input class="field" name="timezone" value="${esc(s.profile?.timezone || "Europe/Berlin")}" /></label><label class="field-label"><span>Валюта</span><select class="field" name="currency">${["RUB", "EUR", "USD", "TRY"].map((value) => `<option ${s.profile?.currency === value ? "selected" : ""}>${value}</option>`).join("")}</select></label></div><button class="button button-primary button-small" type="submit">Сохранить профиль</button></form>
  <form class="settings-card" data-settings="workspace"><h3>Рабочее пространство</h3><p>Название, неделя и рабочий день.</p><label class="field-label"><span>Название</span><input class="field" name="name" value="${esc(s.workspace?.name || "Штаб 2.1")}" required /></label><label class="field-label"><span>Описание</span><textarea class="field field-textarea" name="description">${esc(s.workspace?.description || "")}</textarea></label><div class="form-grid"><label class="field-label"><span>Начало дня</span><input class="field" type="time" name="workday_start" value="${esc(String(s.workspace?.workday_start || "09:00").slice(0, 5))}" /></label><label class="field-label"><span>Валюта</span><select class="field" name="currency">${["RUB", "EUR", "USD", "TRY"].map((value) => `<option ${s.workspace?.currency === value ? "selected" : ""}>${value}</option>`).join("")}</select></label></div><button class="button button-primary button-small" type="submit">Сохранить пространство</button></form>
  <form class="settings-card" data-settings="preferences"><h3>Интерфейс</h3><p>Внешний вид и обновление.</p><div class="form-grid"><label class="field-label"><span>Тема</span><select class="field" name="theme"><option value="dark" ${s.preferences?.theme === "dark" ? "selected" : ""}>Тёмная</option><option value="light" ${s.preferences?.theme === "light" ? "selected" : ""}>Светлая</option><option value="system" ${s.preferences?.theme === "system" ? "selected" : ""}>Системная</option></select></label><label class="field-label"><span>Плотность</span><select class="field" name="density"><option value="comfortable" ${s.preferences?.density === "comfortable" ? "selected" : ""}>Комфортная</option><option value="compact" ${s.preferences?.density === "compact" ? "selected" : ""}>Компактная</option></select></label></div><label class="field-label"><span>Автообновление</span><select class="field" name="auto_refresh_seconds">${[[0, "Выключено"], [30, "30 секунд"], [60, "1 минута"], [300, "5 минут"]].map(([value, label]) => `<option value="${value}" ${auto === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><button class="button button-primary button-small" type="submit">Применить интерфейс</button></form>
  <form class="settings-card" data-settings="notifications"><h3>Уведомления</h3><p>Что должно привлекать внимание.</p>${[["deadlines", "Дедлайны"], ["overdue_tasks", "Просроченные задачи"], ["follow_ups", "Follow-up"], ["integration_errors", "Ошибки интеграций"], ["ai_approvals", "Подтверждения AI"], ["daily_brief", "План дня"], ["weekly_review", "Weekly review"]].map(([name, label]) => `<label class="check-row"><span><b>${label}</b><small>Показывать в центре внимания</small></span><input type="checkbox" name="${name}" ${s.notifications?.[name] ? "checked" : ""} /></label>`).join("")}<button class="button button-primary button-small" type="submit">Сохранить уведомления</button></form>
  <article class="settings-card"><h3>Доступ и безопасность</h3><p>Сессия и защита данных.</p><div class="settings-row"><span><b>${esc(s.session?.user?.email || "")}</b><small>Magic link · Supabase Auth</small></span>${badge("connected", "Владелец")}</div><div class="settings-row"><span><b>Row Level Security</b><small>Посторонняя роль получает 0 записей</small></span>${badge("success", "Проверено")}</div><div class="settings-row"><span><b>Завершить сеанс</b><small>Выйти на этом устройстве</small></span><button class="button button-ghost button-small" data-action="logout">Выйти</button></div></article>
  <article class="settings-card"><h3>Production-среда</h3><p>Инфраструктура приложения.</p><div class="settings-row"><span><b>Vercel</b><small>shtab-2-ten.vercel.app</small></span>${badge("connected", "Production")}</div><div class="settings-row"><span><b>Supabase</b><small>vnpkczboxrhscplxivvx</small></span>${badge("connected", "Online")}</div><div class="settings-row"><span><b>Обновлено</b><small>${esc(fmtDate(s.lastLoadedAt, true))}</small></span><button class="button button-ghost button-small" data-action="refresh">Обновить</button></div></article></section>`;
}

const renderers = { overview, projects, project: projectView, tasks, inbox, waiting, sales, finance, goals, agents, integrations, activity, reviews, settings };

export function renderView(state) {
  s = state;
  if (s.loading) return `<div class="loading-grid">${Array.from({ length: 8 }, () => `<span class="loading-card"></span>`).join("")}</div>`;
  if (s.error) return `<section class="empty-state panel"><div class="empty-orbit">!</div><h2>Данные не загрузились</h2><p>${esc(s.error.message || "Проверьте подключение.")}</p><button class="button button-primary" data-action="refresh">Повторить</button></section>`;
  return (renderers[s.view] || overview)();
}

export function getTopTasks(state) {
  s = state;
  return topTasks();
}

export function getBrief(state) {
  s = state;
  return brief();
}
