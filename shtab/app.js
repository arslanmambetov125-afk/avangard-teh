import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.4";

const SUPABASE_URL = "https://vnpkczboxrhscplxivvx.supabase.co";
const SUPABASE_KEY = "sb_publishable_Giap9iC_aWfhoHN8n9oLJg_DpKYQSGu";
const OWNER_EMAIL = "arslan.mambetov125@gmail.com";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

const viewMeta = {
  overview: ["Главная", "Операционный центр"],
  projects: ["Проекты", "Портфель проектов"],
  project: ["Проект", "Портфель проектов"],
  tasks: ["Задачи", "Центр выполнения"],
  sales: ["Продажи", "Клиенты и воронка"],
  agents: ["AI-агенты", "Оркестрация"],
  integrations: ["Интеграции", "Состояние системы"],
  activity: ["Журнал действий", "История операций"],
  settings: ["Настройки", "Рабочее пространство"],
};

const providerMeta = {
  supabase: ["Supabase", "SB"],
  hubspot: ["HubSpot", "HS"],
  apollo: ["Apollo", "AP"],
  github: ["GitHub", "GH"],
  vercel: ["Vercel", "VC"],
  heygen: ["HeyGen", "HG"],
  google_drive: ["Google Drive", "GD"],
  gmail: ["Gmail", "GM"],
  calendar: ["Calendar", "CL"],
  other: ["Другая система", "↗"],
};

const state = {
  session: null,
  loading: true,
  error: null,
  view: "overview",
  search: "",
  projectStatus: "all",
  taskStatus: "open",
  taskProject: "all",
  selectedProjectId: null,
  autoRefresh: true,
  lastLoadedAt: null,
  refreshTimer: null,
  confirmHandler: null,
  projects: [],
  dashboard: [],
  entities: [],
  refs: [],
  syncs: [],
  work: [],
};

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);

const safeUrl = (value) => {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) ? esc(url.href) : "#";
  } catch {
    return "#";
  }
};

const fmtDate = (value, withYear = false) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const fmtDateOnly = (value) => {
  if (!value) return "Без срока";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const relativeTime = (value) => {
  if (!value) return "нет данных";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.round(hours / 24);
  return `${days} дн назад`;
};

const statusLabel = (status) => ({
  active: "Активен",
  waiting: "Ожидает",
  paused: "Пауза",
  done: "Выполнено",
  archived: "Архив",
  todo: "К выполнению",
  in_progress: "В работе",
  cancelled: "Отменено",
  success: "Работает",
  error: "Ошибка",
  connected: "Подключено",
  not_connected: "Нет данных",
  NOT_STARTED: "Не начато",
  COMPLETED: "Выполнено",
})[status] || status || "Неизвестно";

const entityLabel = (type) => ({
  company: "Компания",
  account: "Компания",
  contact: "ЛПР",
  deal: "Сделка",
  task: "CRM-задача",
  list: "Список",
})[type] || type;

const getProject = (id) => state.dashboard.find((project) => project.id === id)
  || state.projects.find((project) => project.id === id)
  || null;

const getProjectName = (id) => getProject(id)?.name || "Без проекта";
const openWork = () => state.work.filter((item) => !["done", "cancelled"].includes(item.status));
const crmTasks = () => state.entities.filter((item) => item.entity_type === "task" && !["COMPLETED", "done"].includes(item.status));
const allOpenActions = () => [
  ...openWork().map((item) => ({ ...item, sourceName: "Штаб", kind: "work" })),
  ...crmTasks().map((item) => ({
    id: item.id,
    project_id: item.project_id,
    title: item.display_name || "Задача из CRM",
    status: item.status,
    priority: 2,
    due_at: item.source_updated_at,
    sourceName: "HubSpot",
    external_url: item.external_url,
    kind: "crm",
  })),
].sort((a, b) => Number(a.priority || 3) - Number(b.priority || 3));

const latestSync = () => {
  const dates = state.syncs
    .map((item) => item.finished_at || item.started_at)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a));
  return dates[0] || state.lastLoadedAt;
};

const matchesSearch = (...values) => {
  const query = state.search.trim().toLocaleLowerCase("ru");
  if (!query) return true;
  return values.some((value) => String(value ?? "").toLocaleLowerCase("ru").includes(query));
};

const emptyInline = (text) => `<div class="empty-inline">${esc(text)}</div>`;

function setShellVisibility(authenticated) {
  $("login").classList.toggle("hidden", authenticated);
  $("app").classList.toggle("hidden", !authenticated);
}

function showToast(title, detail = "", type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.innerHTML = `<i></i><span><b>${esc(title)}</b>${detail ? `<small>${esc(detail)}</small>` : ""}</span>`;
  $("toastRegion").append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function setLoading(message = "Синхронизация") {
  $("syncPill").classList.remove("error");
  $("syncPill").querySelector("span").textContent = message;
  $("refresh").disabled = true;
}

function updateSystemState() {
  const hasError = Boolean(state.error);
  $("systemDot").classList.toggle("error", hasError);
  $("systemLabel").textContent = hasError ? "Требуется внимание" : "Система подключена";
  $("systemTime").textContent = hasError
    ? "Ошибка загрузки данных"
    : `Обновлено ${relativeTime(state.lastLoadedAt)}`;
  $("syncPill").classList.toggle("error", hasError);
  $("syncPill").querySelector("span").textContent = hasError
    ? "Ошибка"
    : `Обновлено ${relativeTime(state.lastLoadedAt)}`;
  $("refresh").disabled = false;
  $("navTaskCount").textContent = String(allOpenActions().length);
}

async function loadData({ silent = false } = {}) {
  if (!silent) {
    state.loading = true;
    state.error = null;
    setLoading();
    render();
  }

  const [dashboard, projects, entities, refs, syncs, work] = await Promise.all([
    sb.from("project_dashboard_v1").select("*").order("priority", { ascending: true }),
    sb.from("projects").select("id,slug,name,status,priority,notes,created_at,updated_at").order("priority", { ascending: true }),
    sb.from("external_entities").select("id,project_id,provider,entity_type,display_name,status,external_url,source_updated_at,synced_at").order("synced_at", { ascending: false }).limit(500),
    sb.from("integration_refs").select("id,project_id,provider,external_url,created_at"),
    sb.from("sync_runs").select("id,provider,sync_scope,status,records_seen,records_upserted,started_at,finished_at").order("started_at", { ascending: false }).limit(50),
    sb.from("work_items").select("id,project_id,title,status,priority,due_at,source,created_at,updated_at").order("created_at", { ascending: false }).limit(250),
  ]);

  const failures = [dashboard, projects, entities, refs, syncs, work].filter((result) => result.error);
  if (failures.length) {
    state.loading = false;
    state.error = failures.map((result) => result.error.message).join(" · ");
    updateSystemState();
    render();
    return;
  }

  state.dashboard = dashboard.data || [];
  state.projects = projects.data || [];
  state.entities = entities.data || [];
  state.refs = refs.data || [];
  state.syncs = syncs.data || [];
  state.work = work.data || [];
  state.lastLoadedAt = new Date().toISOString();
  state.loading = false;
  state.error = null;
  if (!state.selectedProjectId && state.dashboard.length) {
    state.selectedProjectId = state.dashboard[0].id;
  }
  populateTaskProjects();
  updateSystemState();
  render();
}

function loadingMarkup() {
  return `<div class="loading-grid">${Array.from({ length: 8 }, () => '<div class="skeleton"></div>').join("")}</div>`;
}

function errorMarkup() {
  return `<section class="error-state"><div><p class="eyebrow">Ошибка загрузки</p><h2>Не удалось получить данные Штаба</h2><p>${esc(state.error)}</p><button class="button button-primary" data-action="retry">Попробовать снова</button></div></section>`;
}

function pageHead(eyebrow, title, subtitle, actions = "") {
  return `<header class="page-head"><div><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div>${actions ? `<div class="page-actions">${actions}</div>` : ""}</header>`;
}

function metricCard(icon, value, label, note) {
  return `<article class="metric-card"><div class="metric-top"><span>${esc(label)}</span><span class="metric-icon">${icon}</span></div><b>${esc(value)}</b><small>${esc(note)}</small></article>`;
}

function taskItem(item) {
  const project = getProjectName(item.project_id);
  const due = item.due_at ? fmtDateOnly(item.due_at) : "Без срока";
  const title = item.external_url
    ? `<a href="${safeUrl(item.external_url)}" target="_blank" rel="noopener noreferrer"><b>${esc(item.title)}</b></a>`
    : `<b>${esc(item.title)}</b>`;
  return `<div class="task-row">
    ${item.kind === "work" ? `<button class="task-check" data-action="complete-task" data-id="${esc(item.id)}" aria-label="Выполнить задачу">✓</button>` : '<span class="task-check" aria-hidden="true">•</span>'}
    <div class="task-copy">${title}<small>${esc(item.sourceName)} · ${esc(project)} · ${esc(due)}</small></div>
    <div class="task-meta"><span class="priority p${Number(item.priority || 3)}">P${Number(item.priority || 3)}</span></div>
  </div>`;
}

function projectCard(project, selected = false) {
  const tasks = openWork().filter((item) => item.project_id === project.id).length
    + crmTasks().filter((item) => item.project_id === project.id).length;
  const last = project.last_synced_at ? `Синхр. ${relativeTime(project.last_synced_at)}` : "Нет синхронизации";
  return `<button class="project-card ${selected ? "selected" : ""}" data-action="open-project" data-id="${esc(project.id)}">
    <div class="project-card-head"><div><h3>${esc(project.name)}</h3><small>P${esc(project.priority)} · ${esc(project.slug)}</small></div><span class="badge ${esc(project.status)}">${esc(statusLabel(project.status))}</span></div>
    <div class="project-card-stats">
      <span><b>${Number(project.hubspot_companies || 0) + Number(project.apollo_accounts || 0)}</b><small>компании</small></span>
      <span><b>${Number(project.hubspot_contacts || 0) + Number(project.apollo_contacts || 0)}</b><small>ЛПР</small></span>
      <span><b>${tasks}</b><small>действия</small></span>
    </div>
    <div class="project-card-foot"><span>${esc(last)}</span><em>Открыть →</em></div>
  </button>`;
}

function integrationStatusRows(limit = 4) {
  const providers = ["hubspot", "apollo"];
  return providers.slice(0, limit).map((provider) => {
    const sync = state.syncs.find((item) => item.provider === provider);
    const ok = sync?.status === "success";
    const meta = providerMeta[provider];
    return `<div class="status-list-item"><span class="status-light ${sync ? (ok ? "" : "error") : "waiting"}"></span><span><b>${meta[0]}</b><small>${sync ? `${sync.records_upserted || 0} записей · ${relativeTime(sync.finished_at || sync.started_at)}` : "Запусков пока нет"}</small></span><span class="badge ${ok ? "success" : sync ? "error" : "waiting"}">${esc(sync ? statusLabel(sync.status) : "Ожидает")}</span></div>`;
  }).join("") + `<div class="status-list-item"><span class="status-light"></span><span><b>Supabase</b><small>Данные доступны</small></span><span class="badge success">Online</span></div>`;
}

function renderOverview() {
  const actions = allOpenActions();
  const focus = actions[0];
  const activeProjects = state.dashboard.filter((project) => project.status === "active").length;
  const companies = state.dashboard.reduce((sum, project) => sum + Number(project.hubspot_companies || 0) + Number(project.apollo_accounts || 0), 0);
  const contacts = state.dashboard.reduce((sum, project) => sum + Number(project.hubspot_contacts || 0) + Number(project.apollo_contacts || 0), 0);
  const deals = state.dashboard.reduce((sum, project) => sum + Number(project.hubspot_deals || 0), 0);
  const healthySyncs = ["hubspot", "apollo"].filter((provider) => state.syncs.find((item) => item.provider === provider)?.status === "success").length + 1;
  const topProjects = state.dashboard.filter((project) => matchesSearch(project.name, project.slug)).slice(0, 4);

  return `
    <section class="hero-card">
      <div class="hero-copy"><p class="eyebrow">Founder control panel</p><h2>Деньги → клиент → выполненное действие.</h2><p>Единая картина проектов, продаж и операционных приоритетов без лишнего шума.</p><div class="hero-meta"><span><i></i> Данные из Supabase</span><span><i></i> ${activeProjects} активных проектов</span><span><i></i> Обновлено ${relativeTime(state.lastLoadedAt)}</span></div></div>
      <aside class="hero-focus"><div class="hero-focus-label"><span>Фокус сейчас</span><span class="priority-orb">${focus ? `P${Number(focus.priority || 3)}` : "✓"}</span></div>${focus ? `<h3>${esc(focus.title)}</h3><p>${esc(focus.sourceName)} · ${esc(getProjectName(focus.project_id))}</p><button class="button button-ghost button-small" data-action="go-tasks" style="margin-top:24px">Открыть центр задач →</button>` : '<h3>Открытых действий нет</h3><p>Операционный контур чист.</p>'}</aside>
    </section>
    <section class="metrics-grid">
      ${metricCard("◇", activeProjects, "Активные проекты", `${state.dashboard.length} всего в портфеле`)}
      ${metricCard("◫", companies, "Компании", "HubSpot + Apollo")}
      ${metricCard("◎", contacts, "ЛПР", "Рабочие контакты")}
      ${metricCard("↗", deals, "Сделки", deals ? "В CRM" : "Сделок пока нет")}
      ${metricCard("✓", actions.length, "Нужно действий", `${openWork().filter((item) => item.priority === 1).length} критичных`)}
    </section>
    <section class="dashboard-grid">
      <article class="content-card"><header class="content-card-header"><h3>Сейчас / следующий шаг</h3><button class="text-button" data-action="go-tasks">Все задачи →</button></header><div class="task-list">${actions.length ? actions.slice(0, 5).map(taskItem).join("") : emptyInline("Открытых действий нет.")}</div></article>
      <article class="content-card"><header class="content-card-header"><h3>Состояние контура</h3><button class="text-button" data-action="go-integrations">Все интеграции →</button></header><div class="status-list">${integrationStatusRows()}</div><p class="muted" style="margin:12px 0 0;font-size:8px">${healthySyncs} источника данных доступны</p></article>
    </section>
    <section class="project-strip">${topProjects.length ? topProjects.map((project) => projectCard(project, project.id === state.selectedProjectId)).join("") : emptyInline("Проекты не найдены.")}</section>`;
}

function renderProjects() {
  const statuses = ["all", "active", "waiting", "paused", "done", "archived"];
  const projects = state.dashboard.filter((project) => (state.projectStatus === "all" || project.status === state.projectStatus) && matchesSearch(project.name, project.slug));
  const filters = `<select id="projectStatusFilter" class="filter-field">${statuses.map((status) => `<option value="${status}" ${state.projectStatus === status ? "selected" : ""}>${status === "all" ? "Все статусы" : statusLabel(status)}</option>`).join("")}</select>`;
  return `${pageHead("Портфель", "Проекты", "Все направления бизнеса, их состояние и следующий операционный шаг.", filters)}<section class="project-grid">${projects.length ? projects.map((project) => projectCard(project, project.id === state.selectedProjectId)).join("") : emptyInline("По выбранным условиям проекты не найдены.")}</section>`;
}

function renderProjectDetail() {
  const project = getProject(state.selectedProjectId);
  if (!project) return `${pageHead("Портфель", "Проект не найден", "Вернитесь к списку проектов.")}<button class="button button-ghost" data-action="go-projects">← Все проекты</button>`;
  const actions = allOpenActions().filter((item) => item.project_id === project.id);
  const entities = state.entities.filter((item) => item.project_id === project.id && item.entity_type !== "task");
  const refs = state.refs.filter((item) => item.project_id === project.id && item.external_url);
  return `
    <section class="project-hero"><div><p class="eyebrow">P${esc(project.priority)} · ${esc(project.slug)}</p><h2>${esc(project.name)}</h2><p>${esc(project.notes || "Цель и описание проекта пока не заполнены.")}</p></div><div class="project-hero-actions"><span class="badge ${esc(project.status)}">${esc(statusLabel(project.status))}</span><button class="button button-ghost" data-action="go-projects">← Все проекты</button><button class="button button-primary" data-action="new-task" data-project="${esc(project.id)}">+ Задача</button></div></section>
    <section class="project-kpis">
      <div class="project-kpi"><b>${Number(project.hubspot_companies || 0) + Number(project.apollo_accounts || 0)}</b><small>Компании</small></div>
      <div class="project-kpi"><b>${Number(project.hubspot_contacts || 0) + Number(project.apollo_contacts || 0)}</b><small>ЛПР</small></div>
      <div class="project-kpi"><b>${Number(project.hubspot_deals || 0)}</b><small>Сделки</small></div>
      <div class="project-kpi"><b>${actions.length}</b><small>Открытые действия</small></div>
      <div class="project-kpi"><b>${Number(project.apollo_lists || 0)}</b><small>Списки Apollo</small></div>
      <div class="project-kpi"><b>${refs.length}</b><small>Интеграции</small></div>
    </section>
    <section class="dashboard-grid">
      <article class="content-card"><header class="content-card-header"><h3>Следующие действия</h3><button class="text-button" data-action="new-task" data-project="${esc(project.id)}">Добавить →</button></header><div>${actions.length ? actions.slice(0, 8).map(taskItem).join("") : emptyInline("У проекта нет открытых действий.")}</div></article>
      <article class="content-card"><header class="content-card-header"><h3>Подключённые системы</h3></header>${refs.length ? refs.map((ref) => `<div class="status-list-item"><span class="status-light"></span><span><b>${esc(providerMeta[ref.provider]?.[0] || ref.provider)}</b><small>Ссылка проекта</small></span><a class="external-link" href="${safeUrl(ref.external_url)}" target="_blank" rel="noopener noreferrer">Открыть ↗</a></div>`).join("") : emptyInline("Для проекта не сохранены ссылки интеграций.")}</article>
    </section>
    <article class="content-card" style="margin-top:14px"><header class="content-card-header"><h3>CRM и лиды проекта</h3><span class="muted" style="font-size:8px">Без раскрытия телефонов, email и сырого payload</span></header>${entities.length ? `<div class="table-card"><table class="data-table"><thead><tr><th>Сущность</th><th>Тип</th><th>Источник</th><th>Статус</th><th>Обновлено</th></tr></thead><tbody>${entities.map(entityRow).join("")}</tbody></table></div>` : emptyInline("Рабочие CRM-сущности для проекта пока не синхронизированы.")}</article>`;
}

function taskTableRow(item) {
  const overdue = item.due_at && new Date(item.due_at) < new Date() && !["done", "cancelled"].includes(item.status);
  return `<tr><td><span class="table-primary">${esc(item.title)}</span><span class="table-secondary">${esc(item.source || "shtab-ui")}</span></td><td>${esc(getProjectName(item.project_id))}</td><td><span class="priority p${Number(item.priority)}">P${Number(item.priority)}</span></td><td><span class="badge ${esc(item.status)}">${esc(statusLabel(item.status))}</span></td><td><span class="${overdue ? "" : "muted"}" style="color:${overdue ? "var(--red)" : ""}">${esc(fmtDateOnly(item.due_at))}</span></td><td><div class="row-actions">${!["done", "cancelled"].includes(item.status) ? `<button class="row-action" data-action="complete-task" data-id="${esc(item.id)}" title="Выполнить">✓</button>` : ""}<button class="row-action" data-action="edit-task" data-id="${esc(item.id)}" title="Редактировать">✎</button><button class="row-action danger" data-action="delete-task" data-id="${esc(item.id)}" title="Удалить">×</button></div></td></tr>`;
}

function renderTasks() {
  const projectOptions = `<option value="all">Все проекты</option>${state.dashboard.map((project) => `<option value="${esc(project.id)}" ${state.taskProject === project.id ? "selected" : ""}>${esc(project.name)}</option>`).join("")}`;
  const statusOptions = [
    ["open", "Открытые"], ["all", "Все статусы"], ["todo", "К выполнению"], ["in_progress", "В работе"], ["waiting", "Ожидают"], ["done", "Выполненные"], ["cancelled", "Отменённые"],
  ];
  const tasks = state.work.filter((item) => {
    const statusMatch = state.taskStatus === "all" || (state.taskStatus === "open" ? !["done", "cancelled"].includes(item.status) : item.status === state.taskStatus);
    const projectMatch = state.taskProject === "all" || item.project_id === state.taskProject;
    return statusMatch && projectMatch && matchesSearch(item.title, getProjectName(item.project_id), item.source);
  });
  const actions = `<select id="taskStatusFilter" class="filter-field">${statusOptions.map(([value, label]) => `<option value="${value}" ${state.taskStatus === value ? "selected" : ""}>${label}</option>`).join("")}</select><select id="taskProjectFilter" class="filter-field">${projectOptions}</select><button class="button button-primary" data-action="new-task">+ Новая задача</button>`;
  return `${pageHead("Центр выполнения", "Задачи", "Единый список собственных задач. CRM-действия отображаются отдельно и остаются в источнике.", actions)}<section class="table-card">${tasks.length ? `<table class="data-table"><thead><tr><th>Задача</th><th>Проект</th><th>Приоритет</th><th>Статус</th><th>Срок</th><th></th></tr></thead><tbody>${tasks.map(taskTableRow).join("")}</tbody></table>` : emptyInline("Задач по выбранным условиям нет.")}</section>${crmTasks().length ? `<article class="content-card" style="margin-top:14px"><header class="content-card-header"><h3>Действия из HubSpot</h3><span class="badge waiting">Только чтение</span></header>${crmTasks().filter((item) => matchesSearch(item.display_name, getProjectName(item.project_id))).map((item) => taskItem({ id: item.id, project_id: item.project_id, title: item.display_name || "CRM-задача", priority: 2, sourceName: "HubSpot", external_url: item.external_url, kind: "crm", due_at: item.source_updated_at })).join("") || emptyInline("Совпадений нет.")}</article>` : ""}`;
}

function entityRow(item) {
  const link = item.external_url ? `<a class="external-link" href="${safeUrl(item.external_url)}" target="_blank" rel="noopener noreferrer">Открыть ↗</a>` : "—";
  return `<tr><td><span class="table-primary">${esc(item.display_name || "Без названия")}</span><span class="table-secondary">${link}</span></td><td>${esc(entityLabel(item.entity_type))}</td><td>${esc(providerMeta[item.provider]?.[0] || item.provider)}</td><td><span class="badge ${item.status === "active" ? "active" : "waiting"}">${esc(statusLabel(item.status))}</span></td><td>${esc(fmtDate(item.synced_at || item.source_updated_at))}</td></tr>`;
}

function renderSales() {
  const records = state.entities.filter((item) => ["company", "account", "contact", "deal"].includes(item.entity_type) && matchesSearch(item.display_name, item.provider, getProjectName(item.project_id)));
  const companies = state.entities.filter((item) => ["company", "account"].includes(item.entity_type)).length;
  const contacts = state.entities.filter((item) => item.entity_type === "contact").length;
  const deals = state.entities.filter((item) => item.entity_type === "deal").length;
  const stages = [
    ["Компании", companies, "Рабочие записи"],
    ["ЛПР", contacts, "Найденные контакты"],
    ["Первый контакт", 0, "Нет подтверждённых данных"],
    ["Встреча", 0, "Нет подтверждённых данных"],
    ["Предложение", 0, "Нет подтверждённых данных"],
    ["Сделка", deals, deals ? "В HubSpot" : "Сделок пока нет"],
  ];
  return `${pageHead("Клиенты и выручка", "Продажи", "Честная воронка на основе сохранённых рабочих сущностей HubSpot и Apollo.")}<section class="content-card"><header class="content-card-header"><h3>Воронка</h3><span class="muted" style="font-size:8px">Сумма и вероятность появятся после синхронизации сделок</span></header><div class="pipeline">${stages.map(([label, value, note], index) => `<div class="pipeline-stage"><div class="pipeline-stage-head"><span>${index + 1}. ${esc(label)}</span><span>→</span></div><b>${value}</b><small>${esc(note)}</small></div>`).join("")}</div></section><section style="margin-top:14px">${records.length ? `<div class="table-card"><table class="data-table"><thead><tr><th>Название</th><th>Тип</th><th>Источник</th><th>Статус</th><th>Синхронизация</th></tr></thead><tbody>${records.map(entityRow).join("")}</tbody></table></div>` : `<div class="agent-empty-card"><div class="empty-state"><div class="empty-orbit">↗</div><h2>Рабочих записей пока нет</h2><p>После следующей синхронизации HubSpot или Apollo здесь появятся компании, ЛПР и сделки.</p></div></div>`}</section>`;
}

function renderAgents() {
  return `${pageHead("Оркестрация", "AI-агенты", "Контур управления автономными исполнителями без фиктивных статусов и запусков.")}<section class="agent-empty-card"><div class="empty-state"><div class="empty-orbit">✦</div><p class="eyebrow">Контур подготовлен</p><h2>Реестр агентов ещё не подключён</h2><p>В Supabase пока нет таблиц реальных агентов и запусков. Поэтому Штаб не изображает работу, которой не было. Следующий этап — подключить реестр агентов, задачи, стоимость, результаты и подтверждения критичных действий.</p><div class="empty-note">Ожидаемые статусы: ожидает · работает · требует подтверждения · завершён · ошибка</div></div></section>`;
}

function integrationCard(provider) {
  const meta = providerMeta[provider] || [provider, provider.slice(0, 2).toUpperCase()];
  const sync = state.syncs.find((item) => item.provider === provider);
  const refs = state.refs.filter((item) => item.provider === provider && item.external_url);
  let status = "not_connected";
  if (provider === "supabase") status = "success";
  else if (sync) status = sync.status;
  else if (refs.length) status = "connected";
  const ok = ["success", "connected"].includes(status);
  const last = sync?.finished_at || sync?.started_at || refs[0]?.created_at;
  return `<article class="integration-card"><header class="integration-head"><div class="integration-brand"><span class="integration-logo">${esc(meta[1])}</span><span><h3>${esc(meta[0])}</h3><small>${esc(last ? `Обновлено ${relativeTime(last)}` : "Синхронизаций нет")}</small></span></div><span class="badge ${ok ? "success" : status === "error" ? "error" : "waiting"}">${esc(statusLabel(status))}</span></header><div class="integration-stats"><span><b>${provider === "supabase" ? state.dashboard.length + state.work.length : Number(sync?.records_seen || 0)}</b><small>${provider === "supabase" ? "рабочих записей" : "получено"}</small></span><span><b>${provider === "supabase" ? "Online" : Number(sync?.records_upserted || 0)}</b><small>${provider === "supabase" ? "Data API" : "обновлено"}</small></span></div><footer class="integration-foot"><span>${esc(sync?.sync_scope || (refs.length ? `${refs.length} ссылок проектов` : "Нет подтверждённых данных"))}</span>${refs[0] ? `<a class="external-link" href="${safeUrl(refs[0].external_url)}" target="_blank" rel="noopener noreferrer">Открыть ↗</a>` : ""}</footer></article>`;
}

function renderIntegrations() {
  const providers = [...new Set(["supabase", "hubspot", "apollo", ...state.refs.map((item) => item.provider), "github", "vercel", "heygen"])];
  return `${pageHead("Состояние системы", "Интеграции", "Здесь показываются только подтверждённые подключения и реальные результаты синхронизаций.")}<section class="integration-grid">${providers.map(integrationCard).join("")}</section>`;
}

function activityFeed() {
  const workEvents = state.work.flatMap((item) => {
    const events = [{
      type: "task",
      title: `Создана задача «${item.title}»`,
      detail: `${getProjectName(item.project_id)} · P${item.priority} · ${statusLabel(item.status)}`,
      time: item.created_at,
    }];
    if (item.updated_at && item.updated_at !== item.created_at) events.push({
      type: "task",
      title: `Обновлена задача «${item.title}»`,
      detail: `${getProjectName(item.project_id)} · ${statusLabel(item.status)}`,
      time: item.updated_at,
    });
    return events;
  });
  const syncEvents = state.syncs.map((item) => ({
    type: "sync",
    title: `${providerMeta[item.provider]?.[0] || item.provider}: синхронизация ${statusLabel(item.status).toLocaleLowerCase("ru")}`,
    detail: `${item.records_seen || 0} получено · ${item.records_upserted || 0} обновлено`,
    time: item.finished_at || item.started_at,
  }));
  return [...workEvents, ...syncEvents]
    .filter((item) => matchesSearch(item.title, item.detail))
    .sort((a, b) => new Date(b.time) - new Date(a.time));
}

function renderActivity() {
  const events = activityFeed();
  return `${pageHead("История операций", "Журнал действий", "Фактические события из задач и синхронизаций. Без выдуманных запусков.")}<article class="content-card"><div class="timeline">${events.length ? events.map((item) => `<div class="timeline-item"><span class="timeline-marker ${item.type === "sync" ? "sync" : ""}"></span><div class="timeline-copy"><b>${esc(item.title)}</b><small>${esc(item.detail)}</small></div><span class="timeline-time">${esc(fmtDate(item.time, true))}</span></div>`).join("") : emptyInline("История пока пуста.")}</div></article>`;
}

function renderSettings() {
  return `${pageHead("Рабочее пространство", "Настройки", "Параметры текущей production-среды и безопасного доступа.")}<section class="settings-grid"><article class="settings-card"><h3>Владелец</h3><p>Доступ к закрытому операционному центру.</p><div class="settings-row"><span><b>${esc(state.session?.user?.email || OWNER_EMAIL)}</b><small>Magic link · Supabase Auth</small></span><span class="badge success">Подтверждён</span></div><div class="settings-row"><span><b>Завершить сеанс</b><small>Удалить локальную сессию на этом устройстве</small></span><button class="button button-ghost button-small" data-action="logout">Выйти</button></div></article><article class="settings-card"><h3>Обновление данных</h3><p>Штаб может автоматически проверять новые данные.</p><div class="settings-row"><span><b>Автообновление</b><small>Каждые 60 секунд</small></span><button id="autoRefreshToggle" class="toggle ${state.autoRefresh ? "on" : ""}" aria-label="Автообновление"></button></div><div class="settings-row"><span><b>Последняя загрузка</b><small>${esc(fmtDate(state.lastLoadedAt, true))}</small></span><button class="button button-ghost button-small" data-action="refresh">Обновить</button></div></article><article class="settings-card"><h3>Среда</h3><p>Текущая инфраструктура приложения.</p><div class="settings-row"><span><b>Vercel Production</b><small>shtab-2-ten.vercel.app</small></span><span class="badge success">Live</span></div><div class="settings-row"><span><b>Supabase</b><small>vnpkczboxrhscplxivvx</small></span><span class="badge success">Online</span></div></article><article class="settings-card"><h3>Безопасность</h3><p>Клиент получает только разрешённые RLS данные.</p><div class="settings-row"><span><b>Row Level Security</b><small>Включена для рабочих таблиц</small></span><span class="badge success">Включена</span></div><div class="settings-row"><span><b>Секретные ключи</b><small>Service role не используется в браузере</small></span><span class="badge success">Защищено</span></div></article></section>`;
}

function render() {
  const meta = viewMeta[state.view] || viewMeta.overview;
  $("pageTitle").textContent = meta[0];
  $("breadcrumb").textContent = meta[1];
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === state.view || (state.view === "project" && item.dataset.view === "projects")));

  if (state.loading) {
    $("view").innerHTML = loadingMarkup();
  } else if (state.error) {
    $("view").innerHTML = errorMarkup();
  } else {
    const renderer = {
      overview: renderOverview,
      projects: renderProjects,
      project: renderProjectDetail,
      tasks: renderTasks,
      sales: renderSales,
      agents: renderAgents,
      integrations: renderIntegrations,
      activity: renderActivity,
      settings: renderSettings,
    }[state.view] || renderOverview;
    $("view").innerHTML = renderer();
  }
  $("view").classList.remove("view-enter");
  requestAnimationFrame(() => $("view").classList.add("view-enter"));
  bindViewEvents();
}

function setView(view, { updateHash = true } = {}) {
  state.view = viewMeta[view] ? view : "overview";
  if (updateHash) history.replaceState(null, "", `#${state.view}`);
  closeSidebar();
  render();
  $("view").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindViewEvents() {
  $("view").querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      if (action === "retry" || action === "refresh") await loadData();
      if (action === "go-tasks") setView("tasks");
      if (action === "go-projects") setView("projects");
      if (action === "go-integrations") setView("integrations");
      if (action === "open-project") {
        state.selectedProjectId = button.dataset.id;
        setView("project");
      }
      if (action === "new-task") openTaskDialog({ projectId: button.dataset.project });
      if (action === "complete-task") await completeTask(button.dataset.id, button);
      if (action === "edit-task") editTask(button.dataset.id);
      if (action === "delete-task") askDeleteTask(button.dataset.id);
      if (action === "logout") await logout();
    });
  });

  $("projectStatusFilter")?.addEventListener("change", (event) => {
    state.projectStatus = event.target.value;
    render();
  });
  $("taskStatusFilter")?.addEventListener("change", (event) => {
    state.taskStatus = event.target.value;
    render();
  });
  $("taskProjectFilter")?.addEventListener("change", (event) => {
    state.taskProject = event.target.value;
    render();
  });
  $("autoRefreshToggle")?.addEventListener("click", () => {
    state.autoRefresh = !state.autoRefresh;
    configureAutoRefresh();
    render();
    showToast(state.autoRefresh ? "Автообновление включено" : "Автообновление выключено");
  });
}

function populateTaskProjects() {
  $("taskProject").innerHTML = state.dashboard.map((project) => `<option value="${esc(project.id)}">${esc(project.name)}</option>`).join("");
}

function openTaskDialog({ task = null, projectId = null } = {}) {
  $("taskForm").reset();
  $("taskId").value = task?.id || "";
  $("taskDialogTitle").textContent = task ? "Редактировать задачу" : "Новая задача";
  $("taskTitle").value = task?.title || "";
  $("taskProject").value = task?.project_id || projectId || state.selectedProjectId || state.dashboard[0]?.id || "";
  $("taskPriority").value = String(task?.priority || 3);
  $("taskStatus").value = task?.status || "todo";
  $("taskDue").value = task?.due_at ? new Date(task.due_at).toISOString().slice(0, 16) : "";
  $("taskFormMessage").textContent = "";
  $("taskFormMessage").classList.remove("error");
  $("saveTask").disabled = false;
  $("taskDialog").showModal();
  requestAnimationFrame(() => $("taskTitle").focus());
}

function closeTaskDialog() {
  $("taskDialog").close();
}

function editTask(id) {
  const task = state.work.find((item) => item.id === id);
  if (task) openTaskDialog({ task });
}

async function saveTask(event) {
  event.preventDefault();
  const id = $("taskId").value;
  const title = $("taskTitle").value.trim();
  const projectId = $("taskProject").value;
  if (!title || !projectId) return;

  const payload = {
    title,
    project_id: projectId,
    priority: Number($("taskPriority").value),
    status: $("taskStatus").value,
    due_at: $("taskDue").value ? new Date($("taskDue").value).toISOString() : null,
    source: "shtab-ui",
  };
  $("saveTask").disabled = true;
  $("taskFormMessage").textContent = "Сохраняем…";
  const result = id
    ? await sb.from("work_items").update(payload).eq("id", id)
    : await sb.from("work_items").insert(payload);

  if (result.error) {
    $("saveTask").disabled = false;
    $("taskFormMessage").textContent = result.error.message;
    $("taskFormMessage").classList.add("error");
    return;
  }
  closeTaskDialog();
  showToast(id ? "Задача обновлена" : "Задача добавлена", `${getProjectName(projectId)} · P${payload.priority}`);
  await loadData({ silent: true });
}

async function completeTask(id, button) {
  button.disabled = true;
  const result = await sb.from("work_items").update({ status: "done" }).eq("id", id);
  if (result.error) {
    button.disabled = false;
    showToast("Не удалось выполнить задачу", result.error.message, "error");
    return;
  }
  showToast("Задача выполнена");
  await loadData({ silent: true });
}

function askConfirm({ title, text, label, handler }) {
  $("confirmTitle").textContent = title;
  $("confirmText").textContent = text;
  $("confirmAction").textContent = label;
  state.confirmHandler = handler;
  $("confirmDialog").showModal();
}

function askDeleteTask(id) {
  const task = state.work.find((item) => item.id === id);
  if (!task) return;
  askConfirm({
    title: "Удалить задачу?",
    text: `«${task.title}» будет удалена из Supabase. Это действие нельзя отменить.`,
    label: "Удалить",
    handler: async () => {
      const result = await sb.from("work_items").delete().eq("id", id);
      if (result.error) {
        showToast("Не удалось удалить задачу", result.error.message, "error");
        return;
      }
      showToast("Задача удалена");
      await loadData({ silent: true });
    },
  });
}

async function logout() {
  await sb.auth.signOut();
  window.location.hash = "";
  window.location.reload();
}

function openSidebar() {
  $("sidebar").classList.add("open");
  $("sidebarScrim").classList.add("open");
}

function closeSidebar() {
  $("sidebar").classList.remove("open");
  $("sidebarScrim").classList.remove("open");
}

function configureAutoRefresh() {
  window.clearInterval(state.refreshTimer);
  if (state.autoRefresh) {
    state.refreshTimer = window.setInterval(() => {
      if (!document.hidden && state.session) loadData({ silent: true });
    }, 60000);
  }
}

async function requestMagicLink() {
  const button = $("magic");
  button.disabled = true;
  $("authmsg").classList.remove("error");
  $("authmsg").textContent = "Отправляем безопасную ссылку…";
  const { error } = await sb.auth.signInWithOtp({
    email: OWNER_EMAIL,
    options: {
      emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
      shouldCreateUser: false,
    },
  });
  button.disabled = false;
  if (error) {
    $("authmsg").textContent = error.message;
    $("authmsg").classList.add("error");
    return;
  }
  $("authmsg").textContent = "Ссылка отправлена. Откройте самое новое письмо.";
}

async function routeSession(session) {
  if (!session) {
    state.session = null;
    setShellVisibility(false);
    return;
  }
  if ((session.user.email || "").toLocaleLowerCase("ru") !== OWNER_EMAIL) {
    await sb.auth.signOut();
    $("authmsg").textContent = "У этого аккаунта нет доступа к Штабу.";
    $("authmsg").classList.add("error");
    setShellVisibility(false);
    return;
  }
  state.session = session;
  setShellVisibility(true);
  const requested = window.location.hash.replace("#", "");
  if (viewMeta[requested]) state.view = requested;
  configureAutoRefresh();
  await loadData();
}

function bindShellEvents() {
  document.querySelectorAll(".nav-item").forEach((item) => item.addEventListener("click", () => setView(item.dataset.view)));
  $("magic").addEventListener("click", requestMagicLink);
  $("refresh").addEventListener("click", () => loadData());
  $("newTaskTop").addEventListener("click", () => openTaskDialog());
  $("profileButton").addEventListener("click", () => setView("settings"));
  $("sidebarLogout").addEventListener("click", logout);
  $("menuButton").addEventListener("click", openSidebar);
  $("sidebarScrim").addEventListener("click", closeSidebar);
  $("taskForm").addEventListener("submit", saveTask);
  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeTaskDialog));
  $("confirmCancel").addEventListener("click", () => $("confirmDialog").close());
  $("confirmAction").addEventListener("click", async () => {
    const handler = state.confirmHandler;
    state.confirmHandler = null;
    $("confirmDialog").close();
    if (handler) await handler();
  });
  $("globalSearch").addEventListener("input", (event) => {
    state.search = event.target.value;
    render();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
      event.preventDefault();
      $("globalSearch").focus();
    }
    if (event.key === "Escape") closeSidebar();
  });
  window.addEventListener("hashchange", () => {
    const requested = window.location.hash.replace("#", "");
    if (viewMeta[requested] && requested !== state.view) setView(requested, { updateHash: false });
  });
}

async function boot() {
  bindShellEvents();
  const { data, error } = await sb.auth.getSession();
  if (error) {
    $("authmsg").textContent = error.message;
    $("authmsg").classList.add("error");
  }
  await routeSession(data?.session || null);
}

sb.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") setShellVisibility(false);
  if (event === "SIGNED_IN" && session && session.access_token !== state.session?.access_token) {
    window.setTimeout(() => routeSession(session), 0);
  }
});

boot();
