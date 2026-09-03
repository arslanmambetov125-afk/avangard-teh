import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.4";
import { esc, fmtDate, relativeTime, toInputDateTime, todayISO, weekStartISO, slugify } from "./lib.js";
import { renderView, viewMeta, getTopTasks, getBrief } from "./views.js";

const SUPABASE_URL = "https://vnpkczboxrhscplxivvx.supabase.co";
const SUPABASE_KEY = "sb_publishable_Giap9iC_aWfhoHN8n9oLJg_DpKYQSGu";
const OWNER_EMAIL = "arslan.mambetov125@gmail.com";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

const state = {
  session: null, loading: true, error: null, view: "overview", search: "", projectStatus: "all", taskStatus: "open",
  taskProject: "all", activitySource: "all", selectedProjectId: null, projectTab: "overview", lastLoadedAt: null,
  refreshTimer: null, confirmHandler: null, workspace: null, profile: null, preferences: null, notifications: null,
  projects: [], dashboard: [], tasks: [], inbox: [], waiting: [], goals: [], keyResults: [], finance: [], budgets: [],
  entities: [], refs: [], syncs: [], connections: [], agents: [], agentRuns: [], approvals: [], activities: [], dailyPlans: [], reviews: [],
};

const workspaceId = () => state.workspace?.id;
const userId = () => state.session?.user?.id;
const projectName = (id) => state.projects.find((item) => item.id === id)?.name || "Без проекта";
const openTasks = () => state.tasks.filter((item) => !["done", "cancelled"].includes(item.status));
const crmTasks = () => state.entities.filter((item) => item.entity_type === "task" && !["COMPLETED", "done"].includes(item.status));

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

function updateSystemState() {
  const hasError = Boolean(state.error);
  $("systemDot").classList.toggle("error", hasError);
  $("systemLabel").textContent = hasError ? "Требуется внимание" : "Система подключена";
  $("systemTime").textContent = hasError ? "Ошибка загрузки данных" : `Обновлено ${relativeTime(state.lastLoadedAt)}`;
  $("syncPill").classList.toggle("error", hasError);
  $("syncPill").querySelector("span").textContent = hasError ? "Ошибка" : `Обновлено ${relativeTime(state.lastLoadedAt)}`;
  $("refresh").disabled = false;
  $("navTaskCount").textContent = String(openTasks().length + crmTasks().length);
  $("navInboxCount").textContent = String(state.inbox.filter((item) => item.status === "new").length);
  $("navWaitingCount").textContent = String(state.waiting.filter((item) => item.status === "waiting").length);
}

function scheduleRefresh() {
  clearInterval(state.refreshTimer);
  const seconds = Number(state.preferences?.auto_refresh_seconds ?? 60);
  if (seconds > 0) state.refreshTimer = window.setInterval(() => loadData({ silent: true }), seconds * 1000);
}

function applyPreferences() {
  const theme = state.preferences?.theme || "dark";
  const density = state.preferences?.density || "comfortable";
  const useLight = theme === "light" || (theme === "system" && window.matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.density = density;
  document.body.classList.toggle("theme-light", useLight);
  document.body.classList.toggle("density-compact", density === "compact");
  scheduleRefresh();
}

function render() {
  const meta = viewMeta[state.view] || viewMeta.overview;
  $("pageTitle").textContent = meta[0];
  $("breadcrumb").textContent = meta[1];
  document.querySelectorAll(".sidebar [data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view || (state.view === "project" && button.dataset.view === "projects")));
  $("view").innerHTML = renderView(state);
  bindViewEvents();
}

function setView(view) {
  state.view = view;
  state.error = null;
  document.body.classList.remove("sidebar-open");
  render();
  $("view").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadData({ silent = false } = {}) {
  if (!silent) {
    state.loading = true;
    state.error = null;
    $("refresh").disabled = true;
    $("syncPill").querySelector("span").textContent = "Синхронизация";
    render();
  }

  const results = await Promise.all([
    sb.from("workspaces").select("*").maybeSingle(),
    sb.from("profiles").select("*").maybeSingle(),
    sb.from("user_preferences").select("*").maybeSingle(),
    sb.from("notification_preferences").select("*").maybeSingle(),
    sb.from("project_dashboard_v2").select("*").order("priority", { ascending: true }),
    sb.from("projects").select("*").order("priority", { ascending: true }),
    sb.from("work_items").select("*").order("created_at", { ascending: false }).limit(500),
    sb.from("inbox_items").select("*").order("created_at", { ascending: false }).limit(300),
    sb.from("waiting_items").select("*").order("created_at", { ascending: false }).limit(300),
    sb.from("goals").select("*").order("created_at", { ascending: false }).limit(300),
    sb.from("key_results").select("*").order("created_at", { ascending: true }).limit(500),
    sb.from("finance_entries").select("*").order("occurred_on", { ascending: false }).limit(500),
    sb.from("budgets").select("*").order("period_start", { ascending: false }).limit(100),
    sb.from("external_entities").select("id,project_id,provider,entity_type,display_name,status,external_url,source_updated_at,synced_at").order("synced_at", { ascending: false }).limit(800),
    sb.from("integration_refs").select("id,project_id,provider,external_url,created_at"),
    sb.from("sync_runs").select("id,provider,sync_scope,status,records_seen,records_upserted,details,started_at,finished_at").order("started_at", { ascending: false }).limit(100),
    sb.from("integration_connections").select("*").order("provider"),
    sb.from("agent_profiles").select("*").order("created_at", { ascending: false }),
    sb.from("agent_runs").select("*").order("created_at", { ascending: false }).limit(200),
    sb.from("agent_approvals").select("*").order("created_at", { ascending: false }).limit(100),
    sb.from("activity_events").select("*").order("created_at", { ascending: false }).limit(200),
    sb.from("daily_plans").select("*").order("plan_date", { ascending: false }).limit(30),
    sb.from("weekly_reviews").select("*").order("week_start", { ascending: false }).limit(52),
  ]);

  const error = results.find((result) => result.error)?.error;
  if (error) {
    state.error = error;
    state.loading = false;
    updateSystemState();
    render();
    if (!silent) showToast("Не удалось загрузить Штаб", error.message, "error");
    return;
  }

  const [workspace, profile, preferences, notifications, dashboard, projects, tasks, inbox, waiting, goals, keyResults,
    finance, budgets, entities, refs, syncs, connections, agents, agentRuns, approvals, activities, dailyPlans, reviews] = results;
  Object.assign(state, {
    workspace: workspace.data, profile: profile.data, preferences: preferences.data, notifications: notifications.data,
    dashboard: dashboard.data || [], projects: projects.data || [], tasks: tasks.data || [], inbox: inbox.data || [],
    waiting: waiting.data || [], goals: goals.data || [], keyResults: keyResults.data || [], finance: finance.data || [],
    budgets: budgets.data || [], entities: entities.data || [], refs: refs.data || [], syncs: syncs.data || [],
    connections: connections.data || [], agents: agents.data || [], agentRuns: agentRuns.data || [], approvals: approvals.data || [],
    activities: activities.data || [], dailyPlans: dailyPlans.data || [], reviews: reviews.data || [], loading: false,
    error: null, lastLoadedAt: new Date().toISOString(),
  });
  if (!state.selectedProjectId && state.projects.length) state.selectedProjectId = state.projects[0].id;
  applyPreferences();
  updateSystemState();
  render();
}

async function logActivity(eventType, title, description = "", extra = {}) {
  if (!workspaceId() || !userId()) return;
  const payload = {
    owner_id: userId(), workspace_id: workspaceId(), actor_type: "user", event_type: eventType,
    title, description, source: "shtab-ui", ...extra,
  };
  const { error } = await sb.from("activity_events").insert(payload);
  if (error) console.warn("Activity log failed", error.message);
}

function projectOptions(selected = "", allowEmpty = true) {
  const head = allowEmpty ? `<option value="" ${!selected ? "selected" : ""}>Без проекта</option>` : "";
  return head + state.projects.map((item) => `<option value="${item.id}" ${item.id === selected ? "selected" : ""}>${esc(item.name)}</option>`).join("");
}

function openTaskDialog(task = null, presetProject = "") {
  $("taskDialogTitle").textContent = task ? "Редактировать задачу" : "Новая задача";
  $("taskId").value = task?.id || "";
  $("taskTitle").value = task?.title || "";
  $("taskDescription").value = task?.description || "";
  $("taskProject").innerHTML = projectOptions(task?.project_id || presetProject || state.selectedProjectId || "", false);
  $("taskPriority").value = String(task?.priority || 3);
  $("taskStatus").value = task?.status || "todo";
  $("taskDue").value = toInputDateTime(task?.due_at);
  $("taskImpact").value = String(task?.impact || 3);
  $("taskUrgency").value = String(task?.urgency || 3);
  $("taskAssignee").value = task?.assignee_name || "Арслан";
  $("taskTags").value = (task?.tags || []).join(", ");
  $("taskFormMessage").textContent = "";
  $("taskDialog").showModal();
  window.setTimeout(() => $("taskTitle").focus(), 30);
}

const entitySchemas = {
  project: {
    table: "projects", title: "Проект", eyebrow: "Портфель бизнеса",
    fields: [
      ["name", "Название", "text", true], ["description", "Описание", "textarea"], ["goal", "Главная цель", "textarea"],
      ["next_step", "Следующий измеримый шаг", "textarea"],
      ["status", "Статус", "select", true, [["active", "Активен"], ["waiting", "Ожидает"], ["paused", "Пауза"], ["done", "Готово"], ["archived", "Архив"]]],
      ["priority", "Приоритет", "select", true, [[1, "P1"], [2, "P2"], [3, "P3"], [4, "P4"], [5, "P5"]]],
      ["health", "Здоровье", "select", true, [["strong", "Сильный"], ["stable", "Стабильно"], ["risk", "Риск"], ["critical", "Критично"]]],
      ["stage", "Стадия", "text"], ["revenue_target", "Цель по выручке", "number"], ["budget", "Бюджет", "number"],
      ["currency", "Валюта", "select", true, [["RUB", "RUB"], ["EUR", "EUR"], ["USD", "USD"], ["TRY", "TRY"]]],
      ["target_date", "Целевая дата", "date"], ["color", "Цвет проекта", "color"],
    ],
  },
  inbox: {
    table: "inbox_items", title: "Входящее", eyebrow: "Inbox",
    fields: [["title", "Название", "text", true], ["body", "Контекст", "textarea"], ["project_id", "Проект", "project"],
      ["item_type", "Тип", "select", true, [["note", "Заметка"], ["idea", "Идея"], ["task", "Задача"], ["integration", "Интеграция"], ["ai_suggestion", "Предложение AI"]]],
      ["source", "Источник", "text"], ["status", "Статус", "select", true, [["new", "Новое"], ["processed", "Разобрано"], ["snoozed", "Отложено"], ["archived", "Архив"]]], ["snoozed_until", "Отложить до", "datetime"]],
  },
  waiting: {
    table: "waiting_items", title: "Ожидание", eyebrow: "Жду",
    fields: [["title", "Что ожидаем", "text", true], ["counterparty", "От кого", "text"], ["project_id", "Проект", "project"], ["notes", "Контекст", "textarea"],
      ["status", "Статус", "select", true, [["waiting", "Ожидаем"], ["resolved", "Получено"], ["cancelled", "Отменено"]]], ["due_at", "Срок ответа", "datetime"], ["follow_up_at", "Следующий follow-up", "datetime"]],
  },
  finance: {
    table: "finance_entries", title: "Финансовая запись", eyebrow: "Деньги",
    fields: [["description", "Описание", "text", true], ["project_id", "Проект", "project"], ["entry_type", "Тип", "select", true, [["income", "Доход"], ["expense", "Расход"]]],
      ["amount", "Сумма", "number", true], ["currency", "Валюта", "select", true, [["RUB", "RUB"], ["EUR", "EUR"], ["USD", "USD"], ["TRY", "TRY"]]],
      ["status", "Состояние", "select", true, [["actual", "Факт"], ["expected", "Ожидается"], ["planned", "План"], ["cancelled", "Отменено"]]],
      ["category", "Категория", "text"], ["occurred_on", "Дата", "date", true], ["source", "Источник", "text"]],
  },
  goal: {
    table: "goals", title: "Цель", eyebrow: "Результат",
    fields: [["title", "Название", "text", true], ["description", "Описание", "textarea"], ["project_id", "Проект", "project"],
      ["status", "Статус", "select", true, [["draft", "Черновик"], ["active", "Активна"], ["at_risk", "В риске"], ["completed", "Выполнена"], ["cancelled", "Отменена"]]],
      ["progress", "Прогресс, %", "number", true], ["target_value", "Целевое значение", "number"], ["current_value", "Текущее значение", "number"], ["unit", "Единица", "text"], ["due_at", "Срок", "datetime"]],
  },
  agent: {
    table: "agent_profiles", title: "AI-агент", eyebrow: "Оркестрация",
    fields: [["name", "Название", "text", true], ["role", "Роль и зона ответственности", "textarea", true], ["project_id", "Проект", "project"],
      ["status", "Статус", "select", true, [["disabled", "Отключён"], ["waiting", "Ожидает"], ["working", "Работает"], ["approval", "Нужно подтверждение"], ["completed", "Завершён"], ["error", "Ошибка"]]],
      ["autonomy_level", "Автономность", "select", true, [[0, "L0 — рекомендации"], [1, "L1 — черновики"], [2, "L2 — с подтверждением"], [3, "L3 — разрешённая автономия"]]],
      ["monthly_limit", "Месячный лимит", "number"], ["currency", "Валюта", "select", true, [["RUB", "RUB"], ["EUR", "EUR"], ["USD", "USD"]]]],
  },
  review: {
    table: "weekly_reviews", title: "Weekly review", eyebrow: "Обзор недели",
    fields: [["week_start", "Начало недели", "date", true], ["summary", "Краткий итог", "textarea"], ["wins", "Что получилось", "textarea"],
      ["misses", "Что не выполнено", "textarea"], ["risks", "Риски и проблемы", "textarea"], ["next_week", "Фокус следующей недели", "textarea"],
      ["status", "Статус", "select", true, [["draft", "Черновик"], ["final", "Зафиксирован"]]]],
  },
};

const recordMap = () => ({ project: state.projects, inbox: state.inbox, waiting: state.waiting, finance: state.finance, goal: state.goals, agent: state.agents, review: state.reviews });
const defaultStatus = (kind) => ({ project: "active", inbox: "new", waiting: "waiting", finance: "actual", goal: "active", agent: "disabled", review: "draft" })[kind];

function dynamicField(field, record, preset) {
  const [name, label, type, required, options] = field;
  const defaults = {
    status: defaultStatus(preset.kind), currency: state.workspace?.currency || "RUB", occurred_on: todayISO(), week_start: weekStartISO(),
    progress: 0, source: "manual", color: "#8fa4ff", priority: 3, health: "stable", stage: "development",
    item_type: preset.item_type || "note", autonomy_level: 0,
  };
  let value = record?.[name] ?? preset[name] ?? defaults[name] ?? "";
  if (type === "datetime") value = toInputDateTime(value);
  if (type === "project") return `<label class="field-label"><span>${esc(label)}</span><select class="field" name="${name}" ${required ? "required" : ""}>${projectOptions(value)}</select></label>`;
  if (type === "textarea") return `<label class="field-label field-full"><span>${esc(label)}</span><textarea class="field field-textarea" name="${name}" ${required ? "required" : ""}>${esc(value)}</textarea></label>`;
  if (type === "select") return `<label class="field-label"><span>${esc(label)}</span><select class="field" name="${name}" ${required ? "required" : ""}>${options.map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${String(value) === String(optionValue) ? "selected" : ""}>${esc(optionLabel)}</option>`).join("")}</select></label>`;
  return `<label class="field-label"><span>${esc(label)}</span><input class="field" name="${name}" type="${type}" value="${esc(value)}" ${type === "number" ? "step=\"0.01\" min=\"0\"" : ""} ${required ? "required" : ""} /></label>`;
}

function openEntityDialog(kind, id = "", preset = {}) {
  const schema = entitySchemas[kind];
  if (!schema) return;
  const record = id ? recordMap()[kind]?.find((item) => item.id === id) : null;
  const fullPreset = { ...preset, kind };
  $("entityKind").value = kind;
  $("entityId").value = id;
  $("entityEyebrow").textContent = schema.eyebrow;
  $("entityDialogTitle").textContent = `${record ? "Редактировать" : "Добавить"}: ${schema.title.toLocaleLowerCase("ru")}`;
  $("entityFields").innerHTML = schema.fields.map((field) => dynamicField(field, record, fullPreset)).join("");
  $("entityFormMessage").textContent = "";
  $("entityDialog").showModal();
  window.setTimeout(() => $("entityFields").querySelector("input,textarea,select")?.focus(), 30);
}

async function saveTask(event) {
  event.preventDefault();
  const id = $("taskId").value;
  const payload = {
    owner_id: userId(), workspace_id: workspaceId(), project_id: $("taskProject").value,
    title: $("taskTitle").value.trim(), description: $("taskDescription").value.trim() || null,
    status: $("taskStatus").value, priority: Number($("taskPriority").value),
    due_at: $("taskDue").value ? new Date($("taskDue").value).toISOString() : null,
    impact: Number($("taskImpact").value), urgency: Number($("taskUrgency").value), assignee_name: $("taskAssignee").value.trim() || null,
    tags: $("taskTags").value.split(",").map((value) => value.trim()).filter(Boolean), source: "shtab-ui", updated_at: new Date().toISOString(),
  };
  if (payload.status === "done") payload.completed_at = new Date().toISOString();
  $("saveTask").disabled = true;
  const result = id ? await sb.from("work_items").update(payload).eq("id", id) : await sb.from("work_items").insert(payload);
  $("saveTask").disabled = false;
  if (result.error) { $("taskFormMessage").textContent = result.error.message; return; }
  await logActivity(id ? "task_updated" : "task_created", id ? "Задача обновлена" : "Создана задача", payload.title, { project_id: payload.project_id, entity_type: "work_item", entity_id: id || null });
  $("taskDialog").close();
  showToast(id ? "Задача обновлена" : "Задача добавлена", payload.title);
  await loadData({ silent: true });
}

function normalizePayload(kind, formData, isNew) {
  const payload = {};
  for (const [key, value] of formData.entries()) payload[key] = value === "" ? null : value;
  const numeric = { project: ["priority", "budget", "revenue_target"], finance: ["amount"], goal: ["progress", "target_value", "current_value"], agent: ["autonomy_level", "monthly_limit"] }[kind] || [];
  numeric.forEach((key) => { if (payload[key] !== null) payload[key] = Number(payload[key]); });
  ["due_at", "follow_up_at", "snoozed_until"].forEach((key) => { if (payload[key]) payload[key] = new Date(payload[key]).toISOString(); });
  if (isNew) { payload.owner_id = userId(); payload.workspace_id = workspaceId(); }
  if (kind === "project" && isNew) payload.slug = `${slugify(payload.name)}-${Date.now().toString().slice(-4)}`;
  payload.updated_at = new Date().toISOString();
  return payload;
}

async function saveEntity(event) {
  event.preventDefault();
  const kind = $("entityKind").value;
  const id = $("entityId").value;
  const schema = entitySchemas[kind];
  const payload = normalizePayload(kind, new FormData(event.currentTarget), !id);
  $("saveEntity").disabled = true;
  const result = id ? await sb.from(schema.table).update(payload).eq("id", id) : await sb.from(schema.table).insert(payload);
  $("saveEntity").disabled = false;
  if (result.error) { $("entityFormMessage").textContent = result.error.message; return; }
  const title = payload.name || payload.title || payload.description || schema.title;
  await logActivity(`${kind}_${id ? "updated" : "created"}`, `${schema.title} ${id ? "обновлён" : "создан"}`, String(title), { project_id: payload.project_id || null, entity_type: kind, entity_id: id || null });
  $("entityDialog").close();
  showToast(`${schema.title} ${id ? "обновлён" : "создан"}`, String(title));
  await loadData({ silent: true });
}

function askConfirm(title, text, actionLabel, handler) {
  $("confirmTitle").textContent = title;
  $("confirmText").textContent = text;
  $("confirmAction").textContent = actionLabel;
  state.confirmHandler = handler;
  $("confirmDialog").showModal();
}

async function updateRecord(table, id, payload, success, activity = null) {
  const result = await sb.from(table).update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id);
  if (result.error) { showToast("Не удалось сохранить", result.error.message, "error"); return false; }
  if (activity) await logActivity(activity.type, activity.title, activity.description || "", activity.extra || {});
  showToast(success);
  await loadData({ silent: true });
  return true;
}

async function saveSettings(form) {
  const kind = form.dataset.settings;
  const data = new FormData(form);
  let table; let key; let payload;
  if (kind === "profile") { table = "profiles"; key = ["user_id", userId()]; payload = { display_name: data.get("display_name"), timezone: data.get("timezone"), currency: data.get("currency") }; }
  if (kind === "workspace") { table = "workspaces"; key = ["id", workspaceId()]; payload = { name: data.get("name"), description: data.get("description"), workday_start: data.get("workday_start"), currency: data.get("currency") }; }
  if (kind === "preferences") { table = "user_preferences"; key = ["user_id", userId()]; payload = { theme: data.get("theme"), density: data.get("density"), auto_refresh_seconds: Number(data.get("auto_refresh_seconds")) }; }
  if (kind === "notifications") { table = "notification_preferences"; key = ["user_id", userId()]; payload = Object.fromEntries(["deadlines", "overdue_tasks", "follow_ups", "integration_errors", "ai_approvals", "daily_brief", "weekly_review"].map((name) => [name, data.has(name)])); }
  payload.updated_at = new Date().toISOString();
  const result = await sb.from(table).update(payload).eq(key[0], key[1]);
  if (result.error) { showToast("Настройки не сохранены", result.error.message, "error"); return; }
  await logActivity("settings_updated", "Настройки обновлены", kind);
  showToast("Настройки сохранены");
  await loadData({ silent: true });
}

async function saveDailyPlan() {
  const tasks = getTopTasks(state);
  const risks = state.dashboard.filter((item) => ["risk", "critical"].includes(item.health) || !item.next_step).map((item) => `${item.name}: ${item.next_step || "нет следующего шага"}`);
  const opportunities = state.finance.filter((item) => item.status === "expected" && item.entry_type === "income").map((item) => item.description);
  const payload = { owner_id: userId(), workspace_id: workspaceId(), plan_date: todayISO(), top_task_ids: tasks.map((item) => item.id), briefing: getBrief(state), risks, opportunities, status: "final", updated_at: new Date().toISOString() };
  const result = await sb.from("daily_plans").upsert(payload, { onConflict: "workspace_id,plan_date" });
  if (result.error) return showToast("План не сохранён", result.error.message, "error");
  await logActivity("daily_plan_saved", "План дня зафиксирован", `${tasks.length} ключевых задач`);
  showToast("План дня зафиксирован", `${tasks.length} ключевых задач`);
  await loadData({ silent: true });
}

function exportData() {
  const payload = {
    exported_at: new Date().toISOString(), version: "2.1", workspace: state.workspace, profile: state.profile,
    projects: state.projects, tasks: state.tasks, inbox: state.inbox, waiting: state.waiting, goals: state.goals,
    key_results: state.keyResults, finance_entries: state.finance, budgets: state.budgets, agents: state.agents,
    agent_runs: state.agentRuns, activities: state.activities, daily_plans: state.dailyPlans, weekly_reviews: state.reviews,
    preferences: state.preferences, notifications: state.notifications,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `shtab-2-1-backup-${todayISO()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Экспорт подготовлен", link.download);
}

async function handleAction(button) {
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action === "refresh") return loadData();
  if (action === "logout") return logout();
  if (action === "export") return exportData();
  if (action === "save-daily") return saveDailyPlan();
  if (action === "edit-task") return openTaskDialog(state.tasks.find((item) => item.id === id));
  if (action === "toggle-task") {
    const task = state.tasks.find((item) => item.id === id);
    const done = task.status !== "done";
    return updateRecord("work_items", id, { status: done ? "done" : "todo", completed_at: done ? new Date().toISOString() : null }, done ? "Задача выполнена" : "Задача возвращена", { type: done ? "task_completed" : "task_reopened", title: done ? "Задача выполнена" : "Задача возвращена", description: task.title, extra: { project_id: task.project_id, entity_type: "work_item", entity_id: id } });
  }
  if (action === "process-inbox") return updateRecord("inbox_items", id, { status: "processed" }, "Входящее разобрано", { type: "inbox_processed", title: "Входящее разобрано", description: state.inbox.find((item) => item.id === id)?.title });
  if (action === "resolve-waiting") return updateRecord("waiting_items", id, { status: "resolved" }, "Ожидание закрыто", { type: "waiting_resolved", title: "Получен ожидаемый результат", description: state.waiting.find((item) => item.id === id)?.title });
  if (action === "inbox-to-task") {
    const item = state.inbox.find((entry) => entry.id === id);
    const fallbackProject = item.project_id || state.projects[0]?.id;
    if (!fallbackProject) return showToast("Сначала создайте проект", "Задача должна принадлежать проекту.", "error");
    const result = await sb.from("work_items").insert({ owner_id: userId(), workspace_id: workspaceId(), project_id: fallbackProject, title: item.title, description: item.body, status: "todo", priority: 3, impact: 3, urgency: 3, source: `inbox:${item.source}` });
    if (result.error) return showToast("Не удалось создать задачу", result.error.message, "error");
    await sb.from("inbox_items").update({ status: "processed", updated_at: new Date().toISOString() }).eq("id", id);
    await logActivity("inbox_to_task", "Входящее превращено в задачу", item.title, { project_id: fallbackProject });
    showToast("Создана задача", item.title);
    return loadData({ silent: true });
  }
  if (action === "decide-approval") {
    const decision = button.dataset.decision;
    askConfirm(decision === "approved" ? "Одобрить действие?" : "Отклонить действие?", "Решение сохранится в журнале AI-агента.", decision === "approved" ? "Одобрить" : "Отклонить", async () => {
      const result = await sb.from("agent_approvals").update({ status: decision, decided_at: new Date().toISOString() }).eq("id", id);
      if (result.error) return showToast("Решение не сохранено", result.error.message, "error");
      await logActivity("agent_approval_decided", `Действие AI: ${decision}`, "");
      showToast("Решение сохранено");
      await loadData({ silent: true });
    });
  }
}

function bindViewEvents() {
  $("view").querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $("view").querySelectorAll("[data-open-project]").forEach((button) => button.addEventListener("click", () => { state.selectedProjectId = button.dataset.openProject; state.projectTab = "overview"; setView("project"); }));
  $("view").querySelectorAll("[data-project-tab]").forEach((button) => button.addEventListener("click", () => { state.projectTab = button.dataset.projectTab; render(); }));
  $("view").querySelectorAll("[data-project-status]").forEach((button) => button.addEventListener("click", () => { state.projectStatus = button.dataset.projectStatus; render(); }));
  $("view").querySelectorAll("[data-task-status]").forEach((button) => button.addEventListener("click", () => { state.taskStatus = button.dataset.taskStatus; render(); }));
  $("view").querySelectorAll("[data-activity-source]").forEach((button) => button.addEventListener("click", () => { state.activitySource = button.dataset.activitySource; render(); }));
  $("taskProjectFilter")?.addEventListener("change", (event) => { state.taskProject = event.target.value; render(); });
  $("view").querySelectorAll("[data-create]").forEach((button) => button.addEventListener("click", () => {
    const preset = { project_id: button.dataset.project || "", item_type: button.dataset.type || undefined };
    if (button.dataset.create === "task") openTaskDialog(null, preset.project_id);
    else openEntityDialog(button.dataset.create, button.dataset.id || "", preset);
  }));
  $("view").querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openEntityDialog(button.dataset.edit, button.dataset.id)));
  $("view").querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => handleAction(button)));
  $("view").querySelectorAll("form[data-settings]").forEach((form) => form.addEventListener("submit", (event) => { event.preventDefault(); saveSettings(form); }));
}

function commandItems() {
  return [
    ...Object.entries(viewMeta).filter(([key]) => key !== "project").map(([key, value]) => ({ icon: "→", label: value[0], hint: value[1], action: "view", value: key })),
    { icon: "+", label: "Новая задача", hint: "Добавить рабочее действие", action: "create", value: "task" },
    { icon: "↓", label: "Новое входящее", hint: "Сохранить мысль или сигнал", action: "create", value: "inbox" },
    { icon: "◷", label: "Новое ожидание", hint: "Контролировать обещание", action: "create", value: "waiting" },
    { icon: "₽", label: "Доход или расход", hint: "Добавить финансовый факт", action: "create", value: "finance" },
  ];
}

function renderCommands() {
  const query = $("commandInput").value.trim().toLocaleLowerCase("ru");
  const items = commandItems().filter((item) => !query || `${item.label} ${item.hint}`.toLocaleLowerCase("ru").includes(query));
  $("commandResults").innerHTML = items.map((item) => `<button data-command-action="${item.action}" data-command-value="${item.value}"><span>${esc(item.icon)}</span><span><b>${esc(item.label)}</b><small>${esc(item.hint)}</small></span><kbd>↵</kbd></button>`).join("");
  $("commandResults").querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
    $("commandDialog").close();
    if (button.dataset.commandAction === "view") setView(button.dataset.commandValue);
    else if (button.dataset.commandValue === "task") openTaskDialog();
    else openEntityDialog(button.dataset.commandValue);
  }));
}

function openCommands() {
  $("commandInput").value = "";
  renderCommands();
  $("commandDialog").showModal();
  window.setTimeout(() => $("commandInput").focus(), 30);
}

async function logout() {
  await sb.auth.signOut();
  window.location.reload();
}

function bindShell() {
  document.querySelectorAll(".sidebar [data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $("menuButton").addEventListener("click", () => document.body.classList.toggle("sidebar-open"));
  $("sidebarScrim").addEventListener("click", () => document.body.classList.remove("sidebar-open"));
  $("refresh").addEventListener("click", () => loadData());
  $("newTaskTop").addEventListener("click", openCommands);
  $("profileButton").addEventListener("click", () => setView("settings"));
  $("sidebarLogout").addEventListener("click", logout);
  $("globalSearch").addEventListener("input", (event) => { state.search = event.target.value; render(); });
  $("taskForm").addEventListener("submit", saveTask);
  $("entityForm").addEventListener("submit", saveEntity);
  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => $("taskDialog").close()));
  document.querySelectorAll("[data-close-entity]").forEach((button) => button.addEventListener("click", () => $("entityDialog").close()));
  $("confirmCancel").addEventListener("click", () => $("confirmDialog").close());
  $("confirmAction").addEventListener("click", async () => { const handler = state.confirmHandler; state.confirmHandler = null; $("confirmDialog").close(); if (handler) await handler(); });
  $("commandInput").addEventListener("input", renderCommands);
  document.addEventListener("keydown", (event) => {
    const tag = document.activeElement?.tagName;
    if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) { event.preventDefault(); $("globalSearch").focus(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openCommands(); }
    if (event.key === "Escape" && $("commandDialog").open) $("commandDialog").close();
  });
}

async function boot() {
  const { data, error } = await sb.auth.getSession();
  if (error) { $("authmsg").textContent = error.message; return; }
  const session = data.session;
  if (!session) { setShellVisibility(false); return; }
  if ((session.user.email || "").toLocaleLowerCase("ru") !== OWNER_EMAIL) {
    await sb.auth.signOut();
    setShellVisibility(false);
    $("authmsg").textContent = "У этого адреса нет доступа к Штабу.";
    return;
  }
  state.session = session;
  setShellVisibility(true);
  await loadData();
  $("profileButton").textContent = (state.profile?.display_name || "Арслан Мамбетов").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toLocaleUpperCase("ru");
}

$("magic").addEventListener("click", async () => {
  $("magic").disabled = true;
  $("authmsg").textContent = "Отправляем безопасную ссылку…";
  const { error } = await sb.auth.signInWithOtp({ email: OWNER_EMAIL, options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}`, shouldCreateUser: false } });
  $("magic").disabled = false;
  $("authmsg").textContent = error ? error.message : "Ссылка отправлена. Откройте самое новое письмо.";
});

sb.auth.onAuthStateChange((_event, session) => {
  if (session && !state.session) window.setTimeout(boot, 0);
});

bindShell();
boot();
