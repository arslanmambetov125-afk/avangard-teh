export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
})[char]);

export const safeUrl = (value) => {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) ? esc(url.href) : "#";
  } catch {
    return "#";
  }
};

export const fmtDate = (value, withYear = false) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export const fmtDateOnly = (value) => value
  ? new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
  : "Без срока";

export const fmtMoney = (value, currency = "RUB") => new Intl.NumberFormat("ru-RU", {
  style: "currency", currency, maximumFractionDigits: 0,
}).format(Number(value || 0));

export const relativeTime = (value) => {
  if (!value) return "нет данных";
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.round(hours / 24)} дн назад`;
};

export const toInputDateTime = (value) => value ? new Date(value).toISOString().slice(0, 16) : "";
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const monthStart = () => `${todayISO().slice(0, 7)}-01`;
export const weekStartISO = () => {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
};

export const statusLabel = (status) => ({
  active: "Активен", waiting: "Ожидает", paused: "Пауза", done: "Выполнено", archived: "Архив",
  todo: "К выполнению", in_progress: "В работе", cancelled: "Отменено", new: "Новое", processed: "Разобрано",
  snoozed: "Отложено", resolved: "Получено", draft: "Черновик", at_risk: "Риск", completed: "Выполнено",
  planned: "План", expected: "Ожидается", actual: "Факт", connected: "Подключено", not_connected: "Не подключено",
  success: "Работает", error: "Ошибка", partial: "Частично", started: "Запущено", failed: "Ошибка",
  strong: "Сильный", stable: "Стабильно", risk: "Риск", critical: "Критично", approval: "Нужно подтверждение",
  working: "Работает", disabled: "Отключён", final: "Зафиксирован", pending: "Ожидает", approved: "Одобрено",
  rejected: "Отклонено", NOT_STARTED: "Не начато", COMPLETED: "Выполнено",
})[status] || status || "Неизвестно";

export const entityLabel = (type) => ({
  company: "Компания", account: "Компания", contact: "ЛПР", deal: "Сделка", task: "CRM-задача", list: "Список",
})[type] || type;

export const isOverdue = (value) => Boolean(value && new Date(value).getTime() < Date.now());

export const taskScore = (task) => (6 - Number(task.priority || 3)) * 4
  + Number(task.impact || 3) * 3
  + Number(task.urgency || 3) * 2
  + (isOverdue(task.due_at) && !["done", "cancelled"].includes(task.status) ? 10 : 0)
  + (task.status === "in_progress" ? 2 : 0);

export const slugify = (value) => String(value || "project")
  .toLocaleLowerCase("ru")
  .replace(/[^a-zа-яё0-9]+/gi, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 48) || "project";
