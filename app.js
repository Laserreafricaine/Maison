const HUBS = {
  household: {
    name: "Ménage", color: "#9a82b8", slots: ["Matin", "Soir"],
    suggestions: {
      Matin: ["Passer l’aspirateur", "Aérer les chambres", "Lancer une lessive", "Faire les lits", "Nettoyer la salle de bain"],
      Soir: ["Ranger la cuisine", "Plier le linge", "Sortir les poubelles", "Préparer le lave-vaisselle", "Ranger le salon"]
    },
    frequencies: ["Cette fois", "Tous les jours", "Chaque semaine", "Toutes les 2 semaines"]
  },
  maintenance: {
    name: "Entretien", color: "#c47c5a", slots: ["À faire", "Rendez-vous"],
    suggestions: {
      "À faire": ["Nettoyer un filtre", "Vérifier une fuite", "Tester le détecteur", "Relever les compteurs", "Changer une ampoule"],
      "Rendez-vous": ["Appeler un artisan", "Entretien chaudière", "Ramonage", "Plombier", "Électricien"]
    },
    frequencies: ["Cette fois", "Chaque mois", "Chaque trimestre", "Chaque année"]
  },
  garden: {
    name: "Jardinage", color: "#5f927f", slots: ["Matin", "Soir"],
    suggestions: {
      Matin: ["Arroser le potager", "Semer", "Planter", "Désherber", "Récolter"],
      Soir: ["Arroser les pots", "Surveiller les plantes", "Protéger du froid", "Ranger les outils", "Ramasser les feuilles"]
    },
    frequencies: ["Cette fois", "Tous les jours", "Chaque semaine", "Toutes les 2 semaines"]
  },
  vehicles: {
    name: "Véhicules", color: "#477d8a", slots: ["Entretien", "Échéance"],
    suggestions: {
      Entretien: ["Vérifier les pneus", "Faire le plein", "Nettoyer le véhicule", "Faire la vidange", "Prendre rendez-vous au garage"],
      "Échéance": ["Contrôle technique", "Renouveler l’assurance", "Révision", "Carte grise", "Péage ou stationnement"]
    },
    frequencies: ["Cette fois", "Chaque mois", "Chaque trimestre", "Chaque année"]
  }
};

let people = {
  Moi: { name: "Moi", initial: "M", color: "#d38b72" },
  Foyer: { name: "Foyer", initial: "F", color: "#6e9a8a" },
  "À décider": { name: "À décider", initial: "?", color: "#9a9389" }
};

let sequence = 20;
const makeTask = (title, person = "Moi", done = false, frequency = "Cette fois", recurrenceStart = "", recurrenceEnd = "") => ({
  id: `task-${++sequence}`, title, person, done, frequency, recurrenceStart, recurrenceEnd
});

let tasks = {
  household: {
    "2026-06-15|Matin": [makeTask("Passer l’aspirateur"), makeTask("Faire les lits", "Foyer", true)],
    "2026-06-16|Soir": [makeTask("Ranger la cuisine", "Foyer")],
    "2026-06-18|Matin": [makeTask("Nettoyer la salle de bain")],
    "2026-06-20|Matin": [makeTask("Changer les draps", "Foyer")]
  },
  maintenance: {
    "2026-06-17|À faire": [makeTask("Nettoyer le filtre")],
    "2026-06-19|Rendez-vous": [makeTask("Rendez-vous plombier", "Foyer")]
  },
  garden: {
    "2026-06-15|Soir": [makeTask("Arroser les pots")],
    "2026-06-20|Matin": [makeTask("Désherber", "Foyer")]
  },
  vehicles: {
    "2026-06-16|Entretien": [makeTask("Vérifier les pneus")],
    "2026-06-19|Échéance": [makeTask("Renouveler l’assurance", "Foyer")]
  }
};

const STORAGE_KEY = "maison-v4-state";
let preferences = {
  remindersEnabled: true,
  reminderTime: "19:00",
  remindTomorrow: true,
  remindOverdue: true,
  reminderDays: 15
};
let customSuggestions = Object.fromEntries(
  Object.entries(HUBS).map(([hub, config]) => [hub, [...new Set(Object.values(config.suggestions).flat())]])
);
const defaultData = JSON.stringify({ people, tasks, sequence, preferences, customSuggestions });

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !saved.people || !saved.tasks) return;
    people = saved.people;
    tasks = saved.tasks;
    sequence = Number(saved.sequence) || sequence;
    preferences = { ...preferences, ...(saved.preferences || {}) };
    customSuggestions = { ...customSuggestions, ...(saved.customSuggestions || {}) };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ people, tasks, sequence, preferences, customSuggestions }));
}

loadData();

const pad = value => String(value).padStart(2, "0");
const toKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromKey = value => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};
const mondayOf = date => {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  result.setHours(12, 0, 0, 0);
  return result;
};
const addDays = (date, count) => {
  const result = new Date(date);
  result.setDate(result.getDate() + count);
  return result;
};
const sameDay = (a, b) => toKey(a) === toKey(b);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);

const week = document.getElementById("week");
const dialog = document.getElementById("taskDialog");
const calendarDialog = document.getElementById("calendarDialog");
const form = document.getElementById("taskForm");
const taskName = document.getElementById("taskName");
const selectedTime = document.getElementById("selectedTime");
const dialogTitle = document.getElementById("dialogTitle");
const taskSuggestions = document.getElementById("taskSuggestions");
const frequencyHelp = document.getElementById("frequencyHelp");
const toast = document.getElementById("toast");
const monthGrid = document.getElementById("monthGrid");

const currentDay = () => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return date;
};

let activeHub = "household";
let weekStart = currentDay();
let calendarCursor = new Date(currentDay().getFullYear(), currentDay().getMonth(), 1, 12);
let selectedDate = currentDay();
let selectedSlot = "Matin";
let editingTaskId = null;
let editingSourceKey = null;
let quickDate = new Date();
let quickEditingTaskId = null;
let quickEditingSourceKey = null;
let calendarMode = "task";

function formatDay(date) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long" }).format(date);
}

function formatExactDate(date) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function slotKey(date, slot) {
  return `${toKey(date)}|${slot}`;
}

function getSlotTasks(date, slot) {
  return tasks[activeHub][slotKey(date, slot)] || [];
}

function isDateVisible(date) {
  const target = parseDateKey(toKey(date));
  const start = parseDateKey(toKey(weekStart));
  const end = parseDateKey(toKey(addDays(weekStart, 6)));
  return target >= start && target <= end;
}

function parseDateKey(value) {
  return fromKey(value).getTime();
}

function render() {
  const hub = HUBS[activeHub];
  document.documentElement.style.setProperty("--active-hub", hub.color);
  document.querySelectorAll("[data-hub]").forEach(button => button.classList.toggle("active", button.dataset.hub === activeHub));
  document.querySelectorAll("[data-bottom-hub]").forEach(button => button.classList.toggle("active", button.dataset.bottomHub === activeHub));
  renderPersonChoices();
  const quickMode = activeHub === "maintenance" || activeHub === "vehicles";
  document.getElementById("weekPanel").hidden = quickMode;
  document.getElementById("quickPanel").hidden = !quickMode;
  if (quickMode) {
    renderQuickPanel();
    updateClearHubButtons();
    return;
  }

  document.getElementById("hubTitle").textContent = hub.name;
  document.getElementById("firstSlotLabel").textContent = hub.slots[0];
  document.getElementById("secondSlotLabel").textContent = hub.slots[1];

  const weekEnd = addDays(weekStart, 6);
  const rangeFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
  document.getElementById("weekRange").textContent = `${rangeFormat.format(weekStart)} – ${rangeFormat.format(weekEnd)}`;
  document.getElementById("backToToday").hidden = sameDay(weekStart, currentDay());

  week.innerHTML = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const isToday = sameDay(date, currentDay());
    return `
      <article class="day ${isToday ? "today" : ""}">
        <div class="day-head">
          <span class="day-name">${formatDay(date)}</span>
          <span class="day-date">${date.getDate()}</span>
          ${isToday ? '<span class="today-badge">Aujourd’hui</span>' : ""}
        </div>
        <div class="slots">
          ${renderSlot(date, hub.slots[0], "morning")}
          ${renderSlot(date, hub.slots[1], "evening")}
        </div>
      </article>`;
  }).join("");

  bindWeekActions();
  updateClearHubButtons();
}

function hubTaskCount(hub = activeHub) {
  return Object.values(tasks[hub]).reduce((count, list) => count + list.length, 0);
}

function updateClearHubButtons() {
  const disabled = hubTaskCount() === 0;
  document.getElementById("clearWeekHub").disabled = disabled;
  document.getElementById("clearQuickHub").disabled = disabled;
}

function clearActiveHub() {
  const count = hubTaskCount();
  if (!count) return;
  if (!confirm(`Supprimer les ${count} tâche${count > 1 ? "s" : ""} du hub « ${HUBS[activeHub].name} » ? Les autres hubs seront conservés.`)) return;
  tasks[activeHub] = {};
  saveData();
  resetQuickForm();
  render();
  showToast(`Tâches ${HUBS[activeHub].name.toLocaleLowerCase("fr")} supprimées`);
}

function quickEntries() {
  return Object.entries(tasks[activeHub])
    .flatMap(([key, list]) => {
      const [date, slot] = key.split("|");
      return list.map(task => ({ task, date, slot, sourceKey: key }));
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.task.title.localeCompare(b.task.title, "fr"));
}

function renderQuickPanel() {
  const hub = HUBS[activeHub];
  const entries = quickEntries();
  document.getElementById("quickTitle").textContent = hub.name;
  document.getElementById("quickEyebrow").textContent = activeHub === "maintenance" ? "Travaux et rendez-vous" : "Entretien et échéances";
  document.getElementById("quickCount").textContent = `${entries.length} tâche${entries.length > 1 ? "s" : ""}`;
  document.getElementById("quickTaskName").placeholder = activeHub === "maintenance" ? "Ex. nettoyer le filtre" : "Ex. vérifier les pneus";
  updateQuickDateLabel();
  renderQuickFrequencies();

  const suggestions = customSuggestions[activeHub];
  document.getElementById("quickSuggestions").innerHTML = suggestions.slice(0, 7).map(item =>
    `<button class="suggestion" type="button" data-quick-suggestion="${escapeHtml(item)}">${escapeHtml(item)}</button>`
  ).join("");
  document.querySelectorAll("[data-quick-suggestion]").forEach(button => {
    button.addEventListener("click", () => {
      document.getElementById("quickTaskName").value = button.dataset.quickSuggestion;
      document.getElementById("quickTaskName").focus();
    });
  });

  document.getElementById("quickChecklist").innerHTML = entries.length
    ? entries.map(renderQuickTask).join("")
    : `<div class="quick-empty">Aucune tâche dans cette liste.</div>`;
  bindQuickActions();
}

function renderQuickTask(entry) {
  const actor = people[entry.task.person] || people["À décider"];
  const taskDate = fromKey(entry.date);
  const dayLabel = new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(taskDate).replace(".", "");
  return `
    <article class="quick-task ${entry.task.done ? "done" : ""}">
      <span class="quick-date-marker"><strong>${taskDate.getDate()}</strong><small>${escapeHtml(dayLabel)}</small></span>
      <button class="task-check" data-quick-toggle="${entry.task.id}" data-source-key="${escapeHtml(entry.sourceKey)}" type="button">${entry.task.done ? "✓" : ""}</button>
      <button class="task-text" data-quick-edit="${entry.task.id}" data-source-key="${escapeHtml(entry.sourceKey)}" type="button">
        ${escapeHtml(entry.task.title)}
        <span class="quick-task-date">${formatExactDate(fromKey(entry.date))}</span>
        ${entry.task.frequency !== "Cette fois" ? `<span class="quick-task-frequency">↻ ${escapeHtml(entry.task.frequency)} · jusqu’au ${formatExactDate(fromKey(entry.task.recurrenceEnd))}</span>` : ""}
      </button>
      <span class="actor" title="${escapeHtml(actor.name)}">
        <span class="avatar" style="--avatar-color:${actor.color}">${escapeHtml(actor.initial)}</span>
        <small>${escapeHtml(actor.name)}</small>
      </span>
      <span class="row-actions">
        <button class="edit-action" data-quick-edit="${entry.task.id}" data-source-key="${escapeHtml(entry.sourceKey)}" type="button"><span aria-hidden="true">✎</span> Modifier</button>
        <button class="delete-action" data-quick-delete="${entry.task.id}" data-source-key="${escapeHtml(entry.sourceKey)}" type="button"><span aria-hidden="true">×</span> Supprimer</button>
      </span>
    </article>`;
}

function bindQuickActions() {
  document.querySelectorAll("[data-quick-toggle]").forEach(button => button.addEventListener("click", () => {
    const task = (tasks[activeHub][button.dataset.sourceKey] || []).find(item => item.id === button.dataset.quickToggle);
    if (task) task.done = !task.done;
    saveData();
    render();
  }));
  document.querySelectorAll("[data-quick-edit]").forEach(button => button.addEventListener("click", () => {
    editQuickTask(button.dataset.sourceKey, button.dataset.quickEdit);
  }));
  document.querySelectorAll("[data-quick-delete]").forEach(button => button.addEventListener("click", () => {
    deleteTask(button.dataset.sourceKey.split("|")[0], button.dataset.sourceKey.split("|").slice(1).join("|"), button.dataset.quickDelete);
  }));
}

function editQuickTask(sourceKey, taskId) {
  const task = (tasks[activeHub][sourceKey] || []).find(item => item.id === taskId);
  if (!task) return;
  quickEditingTaskId = taskId;
  quickEditingSourceKey = sourceKey;
  quickDate = fromKey(sourceKey.split("|")[0]);
  document.getElementById("quickTaskName").value = task.title;
  document.querySelectorAll("[data-quick-person]").forEach(button => {
    button.classList.toggle("active", button.dataset.quickPerson === task.person);
  });
  document.getElementById("quickSave").textContent = "Enregistrer les modifications";
  document.getElementById("quickDeleteEditing").hidden = false;
  updateQuickDateLabel();
  renderQuickFrequencies(task.frequency);
  document.getElementById("quickRecurrenceStart").value = task.recurrenceStart || sourceKey.split("|")[0];
  document.getElementById("quickRecurrenceEnd").value = task.recurrenceEnd || toKey(addDays(quickDate, 30));
  updateQuickRecurrence(task.frequency);
  document.getElementById("quickTaskName").focus();
  document.getElementById("quickForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateQuickDateLabel() {
  document.getElementById("quickSelectedDate").textContent = formatExactDate(quickDate);
}

function renderQuickFrequencies(selected = "Cette fois") {
  const group = document.getElementById("quickFrequencies");
  group.innerHTML = HUBS[activeHub].frequencies.map(value =>
    `<button class="choice ${value === selected ? "active" : ""}" data-quick-frequency="${escapeHtml(value)}" type="button">${escapeHtml(value)}</button>`
  ).join("");
  group.querySelectorAll("[data-quick-frequency]").forEach(button => {
    button.addEventListener("click", () => {
      group.querySelectorAll(".choice").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      updateQuickRecurrence(button.dataset.quickFrequency);
    });
  });
  updateQuickRecurrence(selected);
}

function updateQuickRecurrence(frequency) {
  const recurring = frequency !== "Cette fois";
  const period = document.getElementById("quickRecurrencePeriod");
  period.hidden = !recurring;
  document.getElementById("quickRecurrenceStart").required = recurring;
  document.getElementById("quickRecurrenceEnd").required = recurring;
  document.getElementById("quickFrequencyHelp").textContent = recurring
    ? `La tâche reviendra ${frequency.toLocaleLowerCase("fr")} pendant la période choisie.`
    : "La tâche sera ajoutée une seule fois.";
  if (recurring && !document.getElementById("quickRecurrenceStart").value) {
    document.getElementById("quickRecurrenceStart").value = toKey(quickDate);
    document.getElementById("quickRecurrenceEnd").value = toKey(addDays(quickDate, 30));
  }
}

function resetQuickForm() {
  quickEditingTaskId = null;
  quickEditingSourceKey = null;
  document.getElementById("quickTaskName").value = "";
  document.getElementById("quickSave").textContent = "Ajouter à la liste";
  document.getElementById("quickDeleteEditing").hidden = true;
  renderQuickFrequencies();
  document.querySelectorAll("[data-quick-person]").forEach(button => {
    button.classList.toggle("active", button.dataset.quickPerson === "Moi");
  });
}

function renderPersonChoices() {
  const taskGroup = document.querySelector('[data-choice="person"]');
  const quickGroup = document.getElementById("quickPeople");
  const buttons = Object.entries(people).map(([key, person], index) =>
    `<button class="choice ${index === 0 ? "active" : ""}" type="button" data-person-key="${escapeHtml(key)}">${escapeHtml(person.name)}</button>`
  ).join("");
  if (taskGroup && !editingTaskId) {
    taskGroup.innerHTML = buttons.replaceAll("data-person-key", "data-value");
    bindChoiceGroup(taskGroup);
  }
  if (quickGroup && !quickEditingTaskId) {
    quickGroup.innerHTML = buttons.replaceAll("data-person-key", "data-quick-person");
    bindQuickPeople();
  }
}

function bindQuickPeople() {
  document.querySelectorAll("[data-quick-person]").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-quick-person]").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
    });
  });
}

function frequencyStep(frequency) {
  return {
    "Tous les jours": { days: 1 },
    "Chaque semaine": { days: 7 },
    "Toutes les 2 semaines": { days: 14 },
    "Chaque mois": { months: 1 },
    "Chaque trimestre": { months: 3 },
    "Chaque année": { years: 1 }
  }[frequency] || null;
}

function recurringDates(frequency, start, end) {
  if (frequency === "Cette fois") return [fromKey(start)];
  const step = frequencyStep(frequency);
  const dates = [];
  let cursor = fromKey(start);
  const limit = fromKey(end);
  while (cursor <= limit && dates.length < 500) {
    dates.push(new Date(cursor));
    if (step.days) cursor = addDays(cursor, step.days);
    else {
      const next = new Date(cursor);
      if (step.months) next.setMonth(next.getMonth() + step.months);
      if (step.years) next.setFullYear(next.getFullYear() + step.years);
      cursor = next;
    }
  }
  return dates;
}

function addTaskSeries(hub, slot, title, person, frequency, start, end) {
  const seriesId = `series-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  recurringDates(frequency, start, end).forEach(date => {
    const key = `${toKey(date)}|${slot}`;
    tasks[hub][key] ||= [];
    const task = makeTask(title, person, false, frequency, start, end);
    task.seriesId = seriesId;
    tasks[hub][key].push(task);
  });
}

function renderSlot(date, slot, className) {
  const entries = getSlotTasks(date, slot);
  return `
    <section class="slot ${className}">
      <div class="slot-head">
        <span class="slot-label">${escapeHtml(slot)}</span>
        <button class="slot-add" data-add-date="${toKey(date)}" data-add-slot="${escapeHtml(slot)}" type="button" aria-label="Ajouter une tâche">＋</button>
      </div>
      <div class="checklist">
        ${entries.length ? entries.map(task => renderChecklistTask(date, slot, task)).join("") : `<button class="empty-add" data-add-date="${toKey(date)}" data-add-slot="${escapeHtml(slot)}" type="button">Ajouter une tâche</button>`}
      </div>
    </section>`;
}

function renderChecklistTask(date, slot, task) {
  const actor = people[task.person] || people["À décider"];
  return `
    <article class="check-task ${task.done ? "done" : ""}">
      <button class="task-check" data-toggle-task="${task.id}" data-date="${toKey(date)}" data-slot="${escapeHtml(slot)}" type="button" aria-label="${task.done ? "Rouvrir" : "Terminer"}">
        ${task.done ? "✓" : ""}
      </button>
      <button class="task-text" data-edit-task="${task.id}" data-date="${toKey(date)}" data-slot="${escapeHtml(slot)}" type="button">${escapeHtml(task.title)}</button>
      <span class="actor" title="${escapeHtml(actor.name)}">
        <span class="avatar" style="--avatar-color:${actor.color}">${escapeHtml(actor.initial)}</span>
        <small>${escapeHtml(actor.name)}</small>
      </span>
      <span class="row-actions">
        <button class="edit-action" data-edit-task="${task.id}" data-date="${toKey(date)}" data-slot="${escapeHtml(slot)}" type="button"><span aria-hidden="true">✎</span> Modifier</button>
        <button class="delete-action" data-delete-task="${task.id}" data-date="${toKey(date)}" data-slot="${escapeHtml(slot)}" type="button"><span aria-hidden="true">×</span> Supprimer</button>
      </span>
    </article>`;
}

function bindWeekActions() {
  week.querySelectorAll("[data-add-date]").forEach(button => button.addEventListener("click", () => {
    openTask(fromKey(button.dataset.addDate), button.dataset.addSlot);
  }));
  week.querySelectorAll("[data-toggle-task]").forEach(button => button.addEventListener("click", () => {
    const list = tasks[activeHub][`${button.dataset.date}|${button.dataset.slot}`] || [];
    const task = list.find(item => item.id === button.dataset.toggleTask);
    if (task) task.done = !task.done;
    saveData();
    render();
  }));
  week.querySelectorAll("[data-edit-task]").forEach(button => button.addEventListener("click", () => {
    openTask(fromKey(button.dataset.date), button.dataset.slot, button.dataset.editTask);
  }));
  week.querySelectorAll("[data-delete-task]").forEach(button => button.addEventListener("click", () => {
    deleteTask(button.dataset.date, button.dataset.slot, button.dataset.deleteTask);
  }));
}

function openTask(date, slot, taskId = null) {
  selectedDate = new Date(date);
  selectedSlot = slot;
  if (!taskId) editingSourceKey = null;
  editingTaskId = taskId;
  const hub = HUBS[activeHub];
  if (taskId && !editingSourceKey) editingSourceKey = slotKey(selectedDate, selectedSlot);
  const existing = taskId
    ? (tasks[activeHub][editingSourceKey] || []).find(task => task.id === taskId)
    : null;
  document.querySelector("#taskDialog .date-label").textContent = hub.name;
  dialogTitle.textContent = existing ? "Modifier la tâche" : `${formatDay(selectedDate)} · ${selectedSlot}`;
  selectedTime.textContent = `${formatExactDate(selectedDate)} · ${selectedSlot}`;
  taskName.value = existing?.title || "";
  document.getElementById("saveTask").textContent = existing ? "Enregistrer les modifications" : "Ajouter au calendrier";
  document.getElementById("deleteTaskInDialog").hidden = !existing;

  const personGroup = document.querySelector('[data-choice="person"]');
  personGroup.querySelectorAll(".choice").forEach(button => {
    button.classList.toggle("active", button.dataset.value === (existing?.person || "Moi"));
  });

  const slotDefaults = hub.suggestions[selectedSlot] || [];
  const suggestions = [...new Set([...slotDefaults, ...customSuggestions[activeHub]])];
  taskSuggestions.innerHTML = suggestions.map(item =>
    `<button class="suggestion" type="button" data-suggestion="${escapeHtml(item)}">${escapeHtml(item)}</button>`
  ).join("");
  taskSuggestions.querySelectorAll("[data-suggestion]").forEach(button => {
    button.addEventListener("click", () => {
      taskName.value = button.dataset.suggestion;
      taskName.focus();
    });
  });

  const frequencyGroup = document.querySelector('[data-choice="frequency"]');
  frequencyGroup.innerHTML = hub.frequencies.map(item =>
    `<button class="choice ${item === (existing?.frequency || "Cette fois") ? "active" : ""}" type="button" data-value="${escapeHtml(item)}">${escapeHtml(item)}</button>`
  ).join("");
  bindChoiceGroup(frequencyGroup);
  updateFrequencyHelp(existing?.frequency || "Cette fois");
  const start = existing?.recurrenceStart || toKey(selectedDate);
  const end = existing?.recurrenceEnd || toKey(addDays(selectedDate, 30));
  document.getElementById("recurrenceStart").value = start;
  document.getElementById("recurrenceEnd").value = end;
  updateRecurrencePeriod(existing?.frequency || "Cette fois");

  if (!dialog.open) dialog.showModal();
  setTimeout(() => taskName.focus(), 60);
}

function bindChoiceGroup(group) {
  group.querySelectorAll(".choice").forEach(button => {
    button.addEventListener("click", () => {
      group.querySelectorAll(".choice").forEach(choice => choice.classList.remove("active"));
      button.classList.add("active");
      if (group.dataset.choice === "frequency") {
        updateFrequencyHelp(button.dataset.value);
        updateRecurrencePeriod(button.dataset.value);
      }
    });
  });
}

function updateFrequencyHelp(value) {
  frequencyHelp.textContent = value === "Cette fois"
    ? "La tâche sera ajoutée uniquement à ce créneau."
    : `Elle reviendra ${value.toLocaleLowerCase("fr")} au même créneau.`;
}

function updateRecurrencePeriod(value) {
  const recurring = value !== "Cette fois";
  const period = document.getElementById("recurrencePeriod");
  period.hidden = !recurring;
  document.getElementById("recurrenceStart").required = recurring;
  document.getElementById("recurrenceEnd").required = recurring;
}

function deleteTask(dateKey, slot, taskId) {
  const key = `${dateKey}|${slot}`;
  const task = (tasks[activeHub][key] || []).find(item => item.id === taskId);
  if (!task || !confirm(`Supprimer « ${task.title} » ?`)) return false;
  tasks[activeHub][key] = tasks[activeHub][key].filter(item => item.id !== taskId);
  if (!tasks[activeHub][key].length) delete tasks[activeHub][key];
  saveData();
  showToast("Tâche supprimée");
  render();
  return true;
}

function openCalendar(preserveEdit = false, mode = "task") {
  calendarMode = mode;
  if (!preserveEdit) {
    editingTaskId = null;
    editingSourceKey = null;
  }
  const targetDate = mode === "quick" ? quickDate : selectedDate;
  calendarCursor = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 12);
  document.getElementById("calendarSlotChoice").hidden = true;
  renderCalendar();
  calendarDialog.showModal();
}

function renderCalendar() {
  document.getElementById("calendarMonth").textContent = new Intl.DateTimeFormat("fr-FR", {
    month: "long", year: "numeric"
  }).format(calendarCursor);
  const first = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1, 12);
  const gridStart = mondayOf(first);
  monthGrid.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const date = addDays(gridStart, index);
    const key = toKey(date);
    const hasTask = Object.entries(tasks[activeHub]).some(([taskKey, list]) => taskKey.startsWith(`${key}|`) && list.length);
    return `
      <button class="calendar-day ${date.getMonth() !== calendarCursor.getMonth() ? "outside" : ""}
        ${sameDay(date, new Date()) ? "today" : ""} ${sameDay(date, calendarMode === "quick" ? quickDate : selectedDate) ? "selected" : ""}
        ${hasTask ? "has-task" : ""}" data-calendar-date="${key}" type="button">${date.getDate()}</button>`;
  }).join("");
  monthGrid.querySelectorAll("[data-calendar-date]").forEach(button => {
    button.addEventListener("click", () => {
      const chosenDate = fromKey(button.dataset.calendarDate);
      if (calendarMode === "quick") {
        quickDate = chosenDate;
        calendarDialog.close();
        document.querySelectorAll("[data-quick-date]").forEach(item => item.classList.remove("active"));
        updateQuickDateLabel();
        return;
      }
      selectedDate = chosenDate;
      renderCalendar();
      showCalendarSlotChoice();
    });
  });
}

function showCalendarSlotChoice() {
  const hub = HUBS[activeHub];
  const box = document.getElementById("calendarSlotChoice");
  document.getElementById("calendarChosenDate").textContent = formatExactDate(selectedDate);
  const buttons = document.getElementById("calendarSlotButtons");
  buttons.innerHTML = hub.slots.map(slot =>
    `<button class="choice" data-calendar-slot="${escapeHtml(slot)}" type="button">${escapeHtml(slot)}</button>`
  ).join("");
  buttons.querySelectorAll("[data-calendar-slot]").forEach(button => {
    button.addEventListener("click", () => {
      selectedSlot = button.dataset.calendarSlot;
      if (!isDateVisible(selectedDate)) weekStart = new Date(selectedDate);
      calendarDialog.close();
      render();
      openTask(selectedDate, selectedSlot, editingTaskId);
    });
  });
  box.hidden = false;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

document.querySelectorAll("[data-hub]").forEach(button => {
  button.addEventListener("click", () => {
    activeHub = button.dataset.hub;
    selectedSlot = HUBS[activeHub].slots[0];
    quickEditingTaskId = null;
    quickEditingSourceKey = null;
    document.getElementById("quickTaskName").value = "";
    document.getElementById("quickSave").textContent = "Ajouter à la liste";
    document.getElementById("quickDeleteEditing").hidden = true;
    render();
  });
});
document.querySelectorAll("[data-bottom-hub]").forEach(button => {
  button.addEventListener("click", () => {
    activeHub = button.dataset.bottomHub;
    selectedSlot = HUBS[activeHub].slots[0];
    quickEditingTaskId = null;
    quickEditingSourceKey = null;
    document.getElementById("quickTaskName").value = "";
    document.getElementById("quickSave").textContent = "Ajouter à la liste";
    document.getElementById("quickDeleteEditing").hidden = true;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});
document.querySelectorAll(".week-arrow")[0].addEventListener("click", () => {
  weekStart = addDays(weekStart, -7);
  render();
});
document.querySelectorAll(".week-arrow")[1].addEventListener("click", () => {
  weekStart = addDays(weekStart, 7);
  render();
});
document.getElementById("backToToday").addEventListener("click", () => {
  weekStart = currentDay();
  render();
});
bindChoiceGroup(document.querySelector('[data-choice="person"]'));
bindQuickPeople();
document.querySelectorAll("[data-quick-date]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-quick-date]").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    const base = new Date();
    base.setHours(12, 0, 0, 0);
    quickDate = button.dataset.quickDate === "tomorrow" ? addDays(base, 1) : base;
    updateQuickDateLabel();
  });
});
document.getElementById("quickCalendar").addEventListener("click", () => openCalendar(false, "quick"));
document.getElementById("closeDialog").addEventListener("click", () => {
  dialog.close();
  editingTaskId = null;
  editingSourceKey = null;
});
document.getElementById("deleteTaskInDialog").addEventListener("click", () => {
  if (!editingTaskId || !editingSourceKey) return;
  const [dateKey, ...slotParts] = editingSourceKey.split("|");
  if (deleteTask(dateKey, slotParts.join("|"), editingTaskId)) {
    dialog.close();
    editingTaskId = null;
    editingSourceKey = null;
  }
});
document.getElementById("quickDeleteEditing").addEventListener("click", () => {
  if (!quickEditingTaskId || !quickEditingSourceKey) return;
  const [dateKey, ...slotParts] = quickEditingSourceKey.split("|");
  if (deleteTask(dateKey, slotParts.join("|"), quickEditingTaskId)) resetQuickForm();
});
document.getElementById("closeCalendar").addEventListener("click", () => calendarDialog.close());
document.getElementById("openCalendar").addEventListener("click", () => openCalendar(false, "task"));
document.getElementById("changeDate").addEventListener("click", () => openCalendar(true, "task"));
document.getElementById("clearWeekHub").addEventListener("click", clearActiveHub);
document.getElementById("clearQuickHub").addEventListener("click", clearActiveHub);
document.getElementById("previousMonth").addEventListener("click", () => {
  calendarCursor.setMonth(calendarCursor.getMonth() - 1);
  renderCalendar();
});
document.getElementById("nextMonth").addEventListener("click", () => {
  calendarCursor.setMonth(calendarCursor.getMonth() + 1);
  renderCalendar();
});
document.getElementById("todayMonth").addEventListener("click", () => {
  calendarCursor = new Date();
  if (calendarMode === "quick") quickDate = new Date();
  else selectedDate = new Date();
  renderCalendar();
});

document.getElementById("quickForm").addEventListener("submit", event => {
  event.preventDefault();
  const title = document.getElementById("quickTaskName").value.trim();
  if (!title) return;
  const person = document.querySelector("[data-quick-person].active").dataset.quickPerson;
  const frequency = document.querySelector("[data-quick-frequency].active").dataset.quickFrequency;
  const recurrenceStart = frequency === "Cette fois" ? "" : document.getElementById("quickRecurrenceStart").value;
  const recurrenceEnd = frequency === "Cette fois" ? "" : document.getElementById("quickRecurrenceEnd").value;
  if (frequency !== "Cette fois" && (!recurrenceStart || !recurrenceEnd || recurrenceEnd < recurrenceStart)) {
    showToast("Vérifiez les dates de début et de fin");
    return;
  }
  const targetKey = `${toKey(quickDate)}|Liste`;
  const targetList = tasks[activeHub][targetKey] || [];
  const existing = quickEditingTaskId
    ? (tasks[activeHub][quickEditingSourceKey] || []).find(task => task.id === quickEditingTaskId)
    : null;
  if (existing) {
    existing.title = title;
    existing.person = person;
    existing.frequency = frequency;
    existing.recurrenceStart = recurrenceStart;
    existing.recurrenceEnd = recurrenceEnd;
    if (quickEditingSourceKey !== targetKey) {
      tasks[activeHub][quickEditingSourceKey] = tasks[activeHub][quickEditingSourceKey].filter(task => task.id !== quickEditingTaskId);
      if (!tasks[activeHub][quickEditingSourceKey].length) delete tasks[activeHub][quickEditingSourceKey];
      targetList.push(existing);
      tasks[activeHub][targetKey] = targetList;
    }
  } else {
    addTaskSeries(activeHub, "Liste", title, person, frequency, frequency === "Cette fois" ? toKey(quickDate) : recurrenceStart, frequency === "Cette fois" ? toKey(quickDate) : recurrenceEnd);
  }
  const message = existing ? "Tâche modifiée" : "Tâche ajoutée";
  resetQuickForm();
  saveData();
  render();
  showToast(message);
});

form.addEventListener("submit", event => {
  event.preventDefault();
  const title = taskName.value.trim();
  if (!title) return;
  const person = document.querySelector('[data-choice="person"] .choice.active').dataset.value;
  const frequency = document.querySelector('[data-choice="frequency"] .choice.active').dataset.value;
  const recurrenceStart = frequency === "Cette fois" ? "" : document.getElementById("recurrenceStart").value;
  const recurrenceEnd = frequency === "Cette fois" ? "" : document.getElementById("recurrenceEnd").value;
  if (frequency !== "Cette fois" && (!recurrenceStart || !recurrenceEnd || recurrenceEnd < recurrenceStart)) {
    showToast("Vérifiez les dates de début et de fin");
    return;
  }
  const key = slotKey(selectedDate, selectedSlot);
  const list = tasks[activeHub][key] || [];
  const existing = editingTaskId
    ? (tasks[activeHub][editingSourceKey] || []).find(task => task.id === editingTaskId)
    : null;
  if (existing) {
    existing.title = title;
    existing.person = person;
    existing.frequency = frequency;
    existing.recurrenceStart = recurrenceStart;
    existing.recurrenceEnd = recurrenceEnd;
    if (editingSourceKey !== key) {
      tasks[activeHub][editingSourceKey] = tasks[activeHub][editingSourceKey].filter(task => task.id !== editingTaskId);
      if (!tasks[activeHub][editingSourceKey].length) delete tasks[activeHub][editingSourceKey];
      list.push(existing);
      tasks[activeHub][key] = list;
    }
  } else {
    addTaskSeries(activeHub, selectedSlot, title, person, frequency, frequency === "Cette fois" ? toKey(selectedDate) : recurrenceStart, frequency === "Cette fois" ? toKey(selectedDate) : recurrenceEnd);
  }
  dialog.close();
  editingTaskId = null;
  editingSourceKey = null;
  if (!isDateVisible(selectedDate)) weekStart = new Date(selectedDate);
  saveData();
  render();
  showToast(existing ? "Tâche modifiée" : "Tâche ajoutée");
});

const settingsDialog = document.getElementById("settingsDialog");

function renderMembers() {
  document.getElementById("memberList").innerHTML = Object.entries(people).map(([key, person]) => `
    <div class="member-row">
      <span class="avatar" style="--avatar-color:${person.color}">${escapeHtml(person.initial)}</span>
      <strong>${escapeHtml(person.name)}</strong>
      ${Object.keys(people).length > 1 && key !== "À décider" ? `<button data-remove-member="${escapeHtml(key)}" type="button" aria-label="Supprimer">×</button>` : ""}
    </div>`).join("");
  document.querySelectorAll("[data-remove-member]").forEach(button => button.addEventListener("click", () => {
    const key = button.dataset.removeMember;
    if (!confirm(`Supprimer ${people[key].name} ? Ses tâches seront attribuées à « À décider ».`)) return;
    Object.values(tasks).forEach(hub => Object.values(hub).forEach(list => list.forEach(task => {
      if (task.person === key) task.person = "À décider";
    })));
    delete people[key];
    saveData();
    renderMembers();
    render();
  }));
}

function renderReminderSettings() {
  document.getElementById("remindersEnabled").checked = preferences.remindersEnabled;
  document.getElementById("reminderTime").value = preferences.reminderTime;
  document.getElementById("remindTomorrow").checked = preferences.remindTomorrow;
  document.getElementById("remindOverdue").checked = preferences.remindOverdue;
  document.querySelectorAll("[data-reminder-days]").forEach(button => {
    button.classList.toggle("active", Number(button.dataset.reminderDays) === Number(preferences.reminderDays));
  });
}

function renderSuggestionSettings() {
  document.getElementById("suggestionSettings").innerHTML = Object.entries(HUBS).map(([hub, config]) => `
    <div class="suggestion-group" style="--group-color:${config.color}">
      <h4>${escapeHtml(config.name)}</h4>
      <div class="suggestion-chips">
        ${customSuggestions[hub].map((item, index) => `
          <span class="suggestion-setting-chip">
            <span>${escapeHtml(item)}</span>
            <button data-remove-suggestion="${hub}" data-suggestion-index="${index}" type="button" aria-label="Supprimer">×</button>
          </span>`).join("")}
      </div>
      <div class="suggestion-add">
        <input data-new-suggestion="${hub}" placeholder="Nouvelle suggestion">
        <button data-add-suggestion="${hub}" type="button">Ajouter</button>
      </div>
    </div>`).join("");
  document.querySelectorAll("[data-remove-suggestion]").forEach(button => button.addEventListener("click", () => {
    customSuggestions[button.dataset.removeSuggestion].splice(Number(button.dataset.suggestionIndex), 1);
    saveData();
    renderSuggestionSettings();
  }));
  document.querySelectorAll("[data-add-suggestion]").forEach(button => button.addEventListener("click", () => {
    const hub = button.dataset.addSuggestion;
    const input = document.querySelector(`[data-new-suggestion="${hub}"]`);
    const value = input.value.trim();
    if (!value || customSuggestions[hub].some(item => item.toLocaleLowerCase("fr") === value.toLocaleLowerCase("fr"))) return;
    customSuggestions[hub].push(value);
    saveData();
    renderSuggestionSettings();
  }));
  document.querySelectorAll("[data-new-suggestion]").forEach(input => input.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    document.querySelector(`[data-add-suggestion="${input.dataset.newSuggestion}"]`).click();
  }));
}

function openSettings() {
  renderMembers();
  renderReminderSettings();
  renderSuggestionSettings();
  settingsDialog.showModal();
}

function exportData() {
  const blob = new Blob([JSON.stringify({ app: "MAISON", version: 4, people, tasks, sequence, preferences, customSuggestions }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `maison-v4-${toKey(new Date())}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.getElementById("openSettings").addEventListener("click", openSettings);
document.getElementById("closeSettings").addEventListener("click", () => settingsDialog.close());
["remindersEnabled", "reminderTime", "remindTomorrow", "remindOverdue"].forEach(id => {
  document.getElementById(id).addEventListener("change", event => {
    const key = {
      remindersEnabled: "remindersEnabled",
      reminderTime: "reminderTime",
      remindTomorrow: "remindTomorrow",
      remindOverdue: "remindOverdue"
    }[id];
    preferences[key] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    saveData();
  });
});
document.querySelectorAll("[data-reminder-days]").forEach(button => button.addEventListener("click", () => {
  preferences.reminderDays = Number(button.dataset.reminderDays);
  saveData();
  renderReminderSettings();
}));
document.getElementById("addMember").addEventListener("click", () => {
  const input = document.getElementById("newMemberName");
  const name = input.value.trim();
  if (!name) return;
  let key = name;
  let suffix = 2;
  while (people[key]) key = `${name} ${suffix++}`;
  const colors = ["#d38b72", "#6e9a8a", "#8174a6", "#b48a55", "#5d8795"];
  people[key] = { name, initial: name.charAt(0).toLocaleUpperCase("fr"), color: colors[Object.keys(people).length % colors.length] };
  input.value = "";
  saveData();
  renderMembers();
  render();
});
document.getElementById("exportData").addEventListener("click", exportData);
document.getElementById("importData").addEventListener("click", () => document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", event => {
  const [file] = event.target.files;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.app !== "MAISON" || !data.people || !data.tasks) throw new Error();
      people = data.people;
      tasks = data.tasks;
      sequence = Number(data.sequence) || sequence;
      preferences = { ...preferences, ...(data.preferences || {}) };
      customSuggestions = { ...customSuggestions, ...(data.customSuggestions || {}) };
      saveData();
      settingsDialog.close();
      render();
      showToast("Sauvegarde importée");
    } catch {
      showToast("Fichier invalide");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
});
document.getElementById("resetData").addEventListener("click", () => {
  if (!confirm("Réinitialiser toutes les données de MAISON ?")) return;
  const defaults = JSON.parse(defaultData);
  people = defaults.people;
  tasks = defaults.tasks;
  sequence = defaults.sequence;
  preferences = defaults.preferences;
  customSuggestions = defaults.customSuggestions;
  saveData();
  settingsDialog.close();
  render();
});

document.getElementById("clearCompleted").addEventListener("click", () => {
  const count = Object.values(tasks).reduce((total, hub) =>
    total + Object.values(hub).reduce((sum, list) => sum + list.filter(task => task.done).length, 0), 0);
  if (!count) return showToast("Aucune tâche terminée");
  if (!confirm(`Supprimer les ${count} tâche${count > 1 ? "s" : ""} terminée${count > 1 ? "s" : ""} ?`)) return;
  Object.keys(tasks).forEach(hub => {
    Object.keys(tasks[hub]).forEach(key => {
      tasks[hub][key] = tasks[hub][key].filter(task => !task.done);
      if (!tasks[hub][key].length) delete tasks[hub][key];
    });
  });
  saveData();
  settingsDialog.close();
  render();
  showToast("Tâches terminées supprimées");
});

document.getElementById("resetCurrentHub").addEventListener("click", () => {
  if (!hubTaskCount()) return showToast("Ce hub est déjà vide");
  if (!confirm(`Réinitialiser uniquement le hub « ${HUBS[activeHub].name} » ?`)) return;
  tasks[activeHub] = {};
  saveData();
  settingsDialog.close();
  render();
  showToast("Hub réinitialisé");
});

render();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}
