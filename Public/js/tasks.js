const taskList = document.getElementById('taskList');
const createTaskForm = document.getElementById('createTaskForm');
const taskNotice = document.getElementById('taskNotice');
const taskCount = document.getElementById('taskCount');
const completionTrend = document.getElementById('completionTrend');
const workloadList = document.getElementById('workloadList');
const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const notificationMenu = document.querySelector('.notification-menu');
const notificationToggle = document.getElementById('notificationToggle');
const notificationCount = document.getElementById('notificationCount');
const notificationPanel = document.getElementById('notificationPanel');
const notificationSummary = document.getElementById('notificationSummary');
const notificationFeedback = document.getElementById('notificationFeedback');
const notificationList = document.getElementById('notificationList');
const notificationEmpty = document.getElementById('notificationEmpty');
const browserAlertToggle = document.getElementById('browserAlertToggle');
const soundToggle = document.getElementById('soundToggle');
const searchInput = document.getElementById('taskSearch');
const priorityFilter = document.getElementById('priorityFilter');
const tagFilter = document.getElementById('tagFilter');
const savedFilterName = document.getElementById('savedFilterName');
const savedFilterSelect = document.getElementById('savedFilterSelect');
const saveFilterButton = document.getElementById('saveFilterButton');
const deleteFilterButton = document.getElementById('deleteFilterButton');
const previousPage = document.getElementById('previousPage');
const nextPage = document.getElementById('nextPage');
const pageLabel = document.getElementById('pageLabel');
const projectFilter = document.getElementById('projectFilter');
const assigneeFilter = document.getElementById('assigneeFilter');
const taskProjectSelect = document.getElementById('taskProject');
const taskAssigneeSelect = document.getElementById('taskAssignee');
const taskDependenciesSelect = document.getElementById('taskDependencies');
const repeatFrequencySelect = document.getElementById('repeatFrequency');
const repeatIntervalInput = document.getElementById('repeatInterval');
const teamForm = document.getElementById('teamForm');
const memberForm = document.getElementById('memberForm');
const projectForm = document.getElementById('projectForm');
const memberTeamSelect = document.getElementById('memberTeamSelect');
const projectTeamSelect = document.getElementById('projectTeamSelect');
const teamMemberList = document.getElementById('teamMemberList');
const listViewPanel = document.getElementById('listViewPanel');
const boardViewPanel = document.getElementById('boardViewPanel');
const calendarViewPanel = document.getElementById('calendarViewPanel');
const boardPanel = document.getElementById('boardViewPanel');
const calendarGrid = document.getElementById('calendarGrid');
const calendarMonthLabel = document.getElementById('calendarMonthLabel');

const state = {
	page: 1,
	limit: 20,
	total: 0,
	status: '',
	priority: '',
	tag: '',
	project: '',
	assignedTo: '',
	search: '',
	loadId: 0,
	calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
	view: 'list',
	tasks: [],
	boardTasks: [],
	calendarTasks: [],
	teams: [],
	projects: [],
	knownReminderIds: null,
	soundEnabled: false
};

const currentUserId = document.querySelector('.app-shell').dataset.userId;
const savedFiltersKey = `taskflow:saved-filters:${currentUserId}`;
const reminderSoundKey = `taskflow:reminder-sound:${currentUserId}`;
let tagFilterTimer;
let audioContext;

try {
	state.soundEnabled = localStorage.getItem(reminderSoundKey) === 'on';
} catch {
	state.soundEnabled = false;
}

async function apiRequest(path, options = {}) {
	const isFormData = options.body instanceof FormData;
	const response = await fetch(path, {
		credentials: 'same-origin',
		...options,
		headers: {
			...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
			...options.headers
		}
	});

	if (response.status === 401) {
		window.location.assign('/login');
		throw new Error('Your session expired. Sign in again.');
	}

	if (response.status === 204) return null;

	const result = await response.json();
	if (!response.ok) {
		const detail = result.details?.join(', ');
		throw new Error(detail || result.error || 'The request could not be completed.');
	}
	return result;
}

function showNotice(message = '') {
	taskNotice.textContent = message;
}

function setButtonLoading(button, loading, label) {
	if (!button) return;
	if (loading) {
		button.dataset.idleLabel ??= button.textContent;
		button.disabled = true;
		button.textContent = label;
	} else {
		button.disabled = false;
		if (button.dataset.idleLabel) button.textContent = button.dataset.idleLabel;
	}
}

async function loadTasks() {
	const loadId = ++state.loadId;
	taskList.setAttribute('aria-busy', 'true');
	taskList.hidden = true;
	loadingState.hidden = false;
	emptyState.hidden = true;
	previousPage.disabled = true;
	nextPage.disabled = true;
	showNotice('');

	const query = new URLSearchParams({ page: state.page, limit: state.limit });
	if (state.status) query.set('status', state.status);
	if (state.priority) query.set('priority', state.priority);
	if (state.tag) query.set('tag', state.tag);
	if (state.project) query.set('project', state.project);
	if (state.assignedTo) query.set('assignedTo', state.assignedTo);

	try {
		const result = await apiRequest(`/api/tasks?${query}`);
		if (loadId !== state.loadId) return;
		state.tasks = result.tasks;
		state.total = result.total;
		renderTasks();
	} catch (error) {
		if (loadId !== state.loadId) return;
		if (error.message !== 'Your session expired. Sign in again.') {
			showNotice(error.message);
			taskList.replaceChildren();
			taskCount.textContent = 'Tasks unavailable';
		}
	} finally {
		if (loadId === state.loadId) {
			loadingState.hidden = true;
			taskList.hidden = false;
			taskList.setAttribute('aria-busy', 'false');
		}
	}
}

function monthKey(date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

async function loadBoard() {
	const statuses = ['pending', 'in-progress', 'completed'];
	boardPanel.setAttribute('aria-busy', 'true');
	try {
		const requests = statuses.map(async (status) => {
			const query = new URLSearchParams({ status, page: 1, limit: 100 });
			if (state.priority) query.set('priority', state.priority);
			if (state.tag) query.set('tag', state.tag);
			if (state.project) query.set('project', state.project);
			if (state.assignedTo) query.set('assignedTo', state.assignedTo);
			return apiRequest(`/api/tasks?${query}`);
		});
		const results = await Promise.all(requests);
		state.boardTasks = results.flatMap((result) => result.tasks);
		renderBoard();
	} catch (error) {
		if (error.message !== 'Your session expired. Sign in again.') showNotice(error.message);
	} finally {
		boardPanel.setAttribute('aria-busy', 'false');
	}
}

async function loadCalendar() {
	calendarViewPanel.setAttribute('aria-busy', 'true');
	calendarMonthLabel.textContent = new Intl.DateTimeFormat(undefined, {
		month: 'long',
		year: 'numeric'
	}).format(state.calendarMonth);
	try {
		const query = new URLSearchParams({ month: monthKey(state.calendarMonth) });
	if (state.status) query.set('status', state.status);
	if (state.priority) query.set('priority', state.priority);
		if (state.tag) query.set('tag', state.tag);
		if (state.project) query.set('project', state.project);
		if (state.assignedTo) query.set('assignedTo', state.assignedTo);
		const result = await apiRequest(`/api/tasks/calendar?${query}`);
		state.calendarTasks = result.tasks;
		renderCalendar();
	} catch (error) {
		if (error.message !== 'Your session expired. Sign in again.') showNotice(error.message);
	} finally {
		calendarViewPanel.setAttribute('aria-busy', 'false');
	}
}

function refreshCurrentView() {
	if (state.view === 'board') return loadBoard();
	if (state.view === 'calendar') return loadCalendar();
	return loadTasks();
}

async function refreshDashboard() {
	await Promise.all([refreshCurrentView(), loadNotifications(), loadAnalytics()]);
}

function appendOption(select, value, label, selected = false) {
	const option = makeElement('option', '', label);
	option.value = value;
	option.selected = selected;
	select.append(option);
}

function teamCanManage(team) {
	return String(team.owner) === currentUserId || team.members.some((member) =>
		String(member.user?._id || member.user) === currentUserId && member.role === 'admin'
	);
}

function populateTeamSelect(select, selectedValue = '') {
	select.replaceChildren();
	for (const team of state.teams) appendOption(select, team._id, team.name, String(team._id) === String(selectedValue));
}

function populateProjectSelect(select, selectedValue = '', includeAll = false) {
	select.replaceChildren();
	appendOption(select, '', includeAll ? 'All projects' : 'Personal task', !selectedValue);
	for (const project of state.projects) {
		appendOption(select, project._id, project.name, String(project._id) === String(selectedValue));
	}
}

function populateAssigneeSelect(select, projectId = '', selectedValue = '', includeAll = false) {
	select.replaceChildren();
	appendOption(select, '', includeAll ? 'Anyone' : 'Unassigned', !selectedValue);
	const project = state.projects.find((entry) => String(entry._id) === String(projectId));
	const team = state.teams.find((entry) => String(entry._id) === String(project?.team));
	const members = projectId
		? (team?.members || [])
		: includeAll
			? state.teams.flatMap((entry) => entry.members)
			: state.teams.flatMap((entry) => entry.members).filter((member) => String(member.user?._id || member.user) === currentUserId);
	const users = new Map();
	for (const member of members) {
		const user = member.user;
		if (user?._id) users.set(String(user._id), user);
	}
	for (const [id, user] of users) appendOption(select, id, `${user.name} (${user.email})`, id === String(selectedValue));
}

function populateDependencies(select, selectedValues = [], excludeTaskId = '') {
	select.replaceChildren();
	const taskMap = new Map();
	for (const task of [...state.tasks, ...state.boardTasks, ...state.calendarTasks]) {
		if (task._id !== excludeTaskId && task.title) taskMap.set(String(task._id), task);
	}
	for (const task of taskMap.values()) {
		appendOption(select, task._id, `${task.title} · ${task.status}`, selectedValues.some((value) => String(value._id || value) === String(task._id)));
	}
}

function renderTeamMembers() {
	const team = state.teams.find((entry) => String(entry._id) === String(memberTeamSelect.value));
	if (!team) {
		teamMemberList.replaceChildren(makeElement('li', '', 'No team selected'));
		return;
	}
	teamMemberList.replaceChildren(...team.members.map((member) => {
		const user = member.user;
		const label = user ? `${user.name} · ${member.role}` : `Unknown account · ${member.role}`;
		const item = makeElement('li', '', label);
		if (teamCanManage(team) && String(user?._id) !== String(team.owner) && !team.personal) {
			const remove = makeElement('button', 'member-remove', 'Remove');
			remove.type = 'button';
			remove.dataset.action = 'remove-member';
			remove.dataset.teamId = team._id;
			remove.dataset.userId = user?._id || '';
			item.append(' ', remove);
		}
		return item;
	}));
	const canManage = teamCanManage(team) && !team.personal;
	memberForm.querySelectorAll('input,select,button').forEach((control) => {
		if (control !== memberTeamSelect) control.disabled = !canManage;
	});
}

async function loadWorkspaceData() {
	try {
		const result = await apiRequest('/api/teams');
		state.teams = result.teams;
		state.projects = result.projects;
		const currentTeamId = memberTeamSelect.value;
		populateTeamSelect(memberTeamSelect, currentTeamId || state.teams[0]?._id);
		populateTeamSelect(projectTeamSelect, currentTeamId || state.teams[0]?._id);
		populateProjectSelect(projectFilter, state.project, true);
		populateProjectSelect(taskProjectSelect);
		populateAssigneeSelect(assigneeFilter, '', state.assignedTo, true);
		populateAssigneeSelect(taskAssigneeSelect, taskProjectSelect.value);
		renderTeamMembers();
	} catch (error) {
		if (error.message !== 'Your session expired. Sign in again.') showNotice(error.message);
	}
}

async function loadAnalytics() {
	try {
		const analytics = await apiRequest('/api/tasks/analytics');
		document.getElementById('metricTotal').textContent = String(analytics.total);
		document.getElementById('metricInProgress').textContent = String(analytics.statuses['in-progress'] || 0);
		document.getElementById('metricOverdue').textContent = String(analytics.overdue);
		document.getElementById('metricTime').textContent = formatDuration(analytics.timeTrackedSeconds);
		const completedByDay = new Map(analytics.completedByDay.map((entry) => [entry._id, entry.count]));
		const days = [];
		for (let index = 0; index < 42; index += 1) {
			const date = new Date();
			date.setUTCHours(0, 0, 0, 0);
			date.setUTCDate(date.getUTCDate() - (41 - index));
			const dateKey = date.toISOString().slice(0, 10);
			const count = completedByDay.get(dateKey) || 0;
			const bar = makeElement('div', 'trend-day');
			bar.title = `${dateKey}: ${count} completed`;
			const fill = makeElement('span', 'trend-bar');
			fill.style.height = `${count ? Math.max(6, Math.min(42, count * 8)) : 2}px`;
			bar.append(fill);
			days.push(bar);
		}
		completionTrend.replaceChildren(...days);
		completionTrend.setAttribute('aria-label', `Completed tasks in the last six weeks. Total: ${analytics.completedByDay.reduce((total, day) => total + day.count, 0)}`);
		workloadList.replaceChildren(...(analytics.workload.length
			? analytics.workload.map((entry) => {
				const item = makeElement('li');
				item.append(makeElement('span', '', entry.name), makeElement('strong', '', String(entry.openTasks)));
				return item;
			})
			: [makeElement('li', '', 'No assigned open tasks')]));
	} catch (error) {
		if (error.message !== 'Your session expired. Sign in again.') showNotice(error.message);
	}
}

function makeNotificationItem(notification) {
	const item = makeElement('li', 'notification-item');
	const marker = makeElement('span', 'notification-marker');
	marker.dataset.type = notification.type;
	marker.setAttribute('aria-hidden', 'true');
	const content = makeElement('div');
	const title = makeElement('p', 'notification-item-title', notification.title);
	const dueDate = formatDueDate(notification.dueDate);
	let dueLabel = `Due ${dueDate}`;
	if (notification.type === 'overdue') dueLabel = `Overdue · ${dueDate}`;
	if (notification.type === 'due-today') dueLabel = 'Due today';
	if (notification.type === 'upcoming') {
		const daysUntilDue = Math.round((Date.parse(`${notification.dueDate}T00:00:00Z`) - Date.parse(`${localDateString()}T00:00:00Z`)) / 86400000);
		dueLabel = `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'} · ${dueDate}`;
	}
	content.append(title, makeElement('p', 'notification-item-detail', dueLabel));
	item.append(marker, content);
	return item;
}

async function loadNotifications() {
	notificationFeedback.textContent = 'Loading reminders...';
	notificationFeedback.hidden = false;
	notificationEmpty.hidden = true;
	notificationList.replaceChildren();

	try {
		const result = await apiRequest('/api/tasks/notifications');
		const reminderIds = new Set(result.notifications.map((item) => String(item.taskId)));
		if (state.knownReminderIds) {
			for (const notification of result.notifications) {
				if (state.knownReminderIds.has(String(notification.taskId))) continue;
				if ('Notification' in window && Notification.permission === 'granted') {
					new Notification('Task due reminder', {
						body: `${notification.title} · ${notification.type === 'overdue' ? 'Overdue' : notification.type === 'due-today' ? 'Due today' : `Due ${formatDueDate(notification.dueDate)}`}`,
						tag: `task-${notification.taskId}`
					});
				}
				if (state.soundEnabled) playReminderSound();
			}
		}
		state.knownReminderIds = reminderIds;
		const count = result.count;
		notificationCount.textContent = count > 99 ? '99+' : String(count);
		notificationCount.hidden = count === 0;
		notificationToggle.setAttribute('aria-label', `Due reminders, ${count} unfinished task${count === 1 ? '' : 's'}`);
		notificationSummary.textContent = count === 0
			? 'No tasks due in the next seven days'
			: `${count} task${count === 1 ? '' : 's'} need attention`;
		notificationList.replaceChildren(...result.notifications.map(makeNotificationItem));
		notificationFeedback.hidden = true;
		notificationEmpty.hidden = count !== 0;
	} catch (error) {
		if (error.message === 'Your session expired. Sign in again.') return;
		notificationCount.hidden = true;
		notificationFeedback.textContent = 'Reminders could not be loaded.';
	}
}

function updateBrowserAlertControl() {
	if (!('Notification' in window)) {
		browserAlertToggle.textContent = 'Browser alerts unavailable';
		browserAlertToggle.disabled = true;
		return;
	}
	if (Notification.permission === 'granted') {
		browserAlertToggle.textContent = 'Browser alerts enabled';
		browserAlertToggle.disabled = true;
	} else if (Notification.permission === 'denied') {
		browserAlertToggle.textContent = 'Browser alerts blocked';
		browserAlertToggle.disabled = true;
	} else {
		browserAlertToggle.textContent = 'Enable browser alerts';
		browserAlertToggle.disabled = false;
	}
}

function updateSoundToggle() {
	soundToggle.textContent = state.soundEnabled ? 'Sound on' : 'Sound off';
	soundToggle.setAttribute('aria-pressed', String(state.soundEnabled));
}

function playReminderSound() {
	const AudioContextClass = window.AudioContext || window.webkitAudioContext;
	if (!AudioContextClass) return;
	try {
		audioContext ??= new AudioContextClass();
		if (audioContext.state === 'suspended') audioContext.resume();
		const oscillator = audioContext.createOscillator();
		const gain = audioContext.createGain();
		const now = audioContext.currentTime;
		oscillator.type = 'sine';
		oscillator.frequency.setValueAtTime(660, now);
		oscillator.frequency.setValueAtTime(880, now + 0.14);
		gain.gain.setValueAtTime(0, now);
		gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
		gain.gain.setValueAtTime(0.1, now + 0.14);
		gain.gain.linearRampToValueAtTime(0, now + 0.32);
		oscillator.connect(gain);
		gain.connect(audioContext.destination);
		oscillator.start(now);
		oscillator.stop(now + 0.33);
	} catch {
		showNotice('Reminder sound is unavailable in this browser.');
	}
}

function makeElement(tag, className, text) {
	const element = document.createElement(tag);
	if (className) element.className = className;
	if (text !== undefined) element.textContent = text;
	return element;
}

function localDateString() {
	const today = new Date();
	const month = String(today.getMonth() + 1).padStart(2, '0');
	const day = String(today.getDate()).padStart(2, '0');
	return `${today.getFullYear()}-${month}-${day}`;
}

function formatDueDate(date) {
	return new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(new Date(`${date}T00:00:00Z`));
}

function formatDuration(seconds) {
	const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function makeLabeledInput(labelText, name, value, options = {}) {
	const label = makeElement('label');
	const labelTextElement = makeElement('span', '', labelText);
	const input = document.createElement(options.type === 'select' ? 'select' : options.type === 'textarea' ? 'textarea' : 'input');
	input.name = name;
	input.value = value ?? '';
	if (options.type && options.type !== 'select' && options.type !== 'textarea') input.type = options.type;
	if (options.maxlength) input.maxLength = options.maxlength;

	if (options.type === 'select') {
		for (const [optionValue, optionLabel] of options.values) {
			const option = makeElement('option', '', optionLabel);
			option.value = optionValue;
			input.append(option);
		}
	}
	if (options.type === 'textarea') {
		input.rows = 2;
		input.maxLength = 2000;
	}

	label.append(labelTextElement, input);
	return { label, input };
}

function makeTaskCard(task, draggable = false) {
	const card = makeElement('article', 'task-card');
	card.dataset.status = task.status;
	card.dataset.taskId = task._id;
	card.draggable = draggable;
	const mainRow = makeElement('div', 'task-main-row');
	const content = makeElement('div', 'task-content');
	const title = makeElement('h3', 'task-title', task.title);
	content.append(title);
	if (task.description) content.append(makeElement('p', 'task-description', task.description));

	const badges = makeElement('div', 'task-badges');
	const statusLabels = {
		pending: 'Pending',
		'in-progress': 'In progress',
		completed: 'Completed'
	};
	const statusBadge = makeElement('span', 'status-badge', statusLabels[task.status]);
	statusBadge.dataset.status = task.status;
	const priority = makeElement('span', 'priority-badge', `${task.priority} priority`);
	priority.dataset.priority = task.priority;
	badges.append(statusBadge, priority);
	if (task.dueDate) {
		const dueDate = task.dueDate.slice(0, 10);
		const dueBadge = makeElement('span', 'due-date', `Due ${formatDueDate(dueDate)}`);
		if (dueDate < localDateString() && task.status !== 'completed') dueBadge.classList.add('is-overdue');
		badges.append(dueBadge);
	}
	content.append(badges);
	if (task.tags?.length) {
		const tagList = makeElement('div', 'tag-list');
		for (const tag of task.tags) tagList.append(makeElement('span', 'tag-chip', `#${tag}`));
		content.append(tagList);
	}
	if (task.project?.name) content.append(makeElement('p', 'task-project-label', `Project · ${task.project.name}`));
	if (task.assignedTo?.name) content.append(makeElement('p', 'task-assignee-label', `Assigned to · ${task.assignedTo.name}`));
	if (task.recurrence) {
		content.append(makeElement('p', 'task-recurrence-label', `Repeats ${task.recurrence.frequency}${task.recurrence.interval > 1 ? ` · every ${task.recurrence.interval}` : ''}`));
	}
	const blockedBy = (task.dependencies || []).filter((dependency) => dependency.status !== 'completed');
	if (blockedBy.length) {
		const dependencyList = makeElement('div', 'task-badges');
		dependencyList.append(makeElement('span', 'dependency-chip is-blocked', `Blocked by ${blockedBy.map((dependency) => dependency.title).join(', ')}`));
		content.append(dependencyList);
	}
	if (task.subtasks?.length) {
		const completedCount = task.subtasks.filter((subtask) => subtask.completed).length;
		const progress = makeElement('div', 'checklist-progress');
		progress.append(makeElement('span', '', `${completedCount}/${task.subtasks.length} checklist items`));
		const progressBar = document.createElement('progress');
		progressBar.max = task.subtasks.length;
		progressBar.value = completedCount;
		progressBar.setAttribute('aria-label', 'Checklist completion');
		progress.append(progressBar);
		content.append(progress);

		const checklist = makeElement('details', 'task-checklist');
		checklist.append(makeElement('summary', '', 'Show checklist'));
		const subtaskList = makeElement('ul', 'subtask-list');
		task.subtasks.forEach((subtask, index) => {
			const item = makeElement('li');
			const label = makeElement('label');
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.checked = subtask.completed;
			checkbox.dataset.action = 'subtask';
			checkbox.dataset.taskId = task._id;
			checkbox.dataset.subtaskIndex = String(index);
			const subtaskTitle = makeElement('span', '', subtask.title);
			label.append(checkbox, subtaskTitle);
			item.append(label);
			subtaskList.append(item);
		});
		checklist.append(subtaskList);
		content.append(checklist);
	}

	const status = makeElement('select', 'task-status-select');
	status.setAttribute('aria-label', `Status for ${task.title}`);
	status.dataset.action = 'status';
	status.dataset.taskId = task._id;
	for (const [value, label] of [
		['pending', 'Pending'],
		['in-progress', 'In progress'],
		['completed', 'Completed']
	]) {
		const option = makeElement('option', '', label);
		option.value = value;
		option.selected = task.status === value;
		status.append(option);
	}

	const actions = makeElement('div', 'task-actions');
	const editButton = makeElement('button', 'edit-toggle', 'Edit');
	editButton.type = 'button';
	editButton.dataset.action = 'toggle-edit';
	editButton.dataset.taskId = task._id;
	const deleteButton = makeElement('button', 'delete-button', 'Delete');
	deleteButton.type = 'button';
	deleteButton.dataset.action = 'delete';
	deleteButton.dataset.taskId = task._id;
	actions.append(editButton, deleteButton);
	mainRow.append(content, status, actions);

	const taskExtra = makeElement('details', 'task-extra');
	taskExtra.dataset.taskId = task._id;
	taskExtra.append(makeElement('summary', '', 'Activity, files, and time'));
	taskExtra.addEventListener('toggle', () => {
		if (taskExtra.open && taskExtra.dataset.loaded !== 'true') loadTaskExtra(task._id, taskExtra);
	});
	const extraContent = makeElement('div', 'task-extra-content');
	const timeSection = makeElement('section', 'task-extra-section');
	timeSection.append(makeElement('h4', '', 'Time tracking'));
	const totalSeconds = (task.timeEntries || []).reduce((total, entry) => {
		const elapsed = entry.stoppedAt ? entry.durationSeconds : Math.max(0, Math.floor((Date.now() - new Date(entry.startedAt)) / 1000));
		return total + (entry.user?._id === currentUserId || String(entry.user) === currentUserId ? elapsed : 0);
	}, 0);
	timeSection.append(makeElement('p', 'task-time-total', `Your tracked time · ${formatDuration(totalSeconds)}`));
	const timerButton = makeElement('button', 'secondary-button', (task.timeEntries || []).some((entry) => (entry.user?._id || entry.user) === currentUserId && !entry.stoppedAt) ? 'Stop timer' : 'Start timer');
	timerButton.type = 'button';
	timerButton.dataset.action = timerButton.textContent === 'Stop timer' ? 'timer-stop' : 'timer-start';
	timerButton.dataset.taskId = task._id;
	timeSection.append(timerButton);
	extraContent.append(timeSection);

	const attachmentSection = makeElement('section', 'task-extra-section');
	attachmentSection.append(makeElement('h4', '', 'Attachments'));
	const fileInput = document.createElement('input');
	fileInput.type = 'file';
	fileInput.dataset.action = 'attachment-upload';
	fileInput.dataset.taskId = task._id;
	fileInput.setAttribute('aria-label', `Upload an attachment to ${task.title}`);
	attachmentSection.append(fileInput);
	const attachmentList = makeElement('ul', 'attachment-list');
	attachmentList.dataset.attachmentList = task._id;
	attachmentSection.append(attachmentList);
	extraContent.append(attachmentSection);

	const activitySection = makeElement('section', 'task-extra-section');
	activitySection.append(makeElement('h4', '', 'Recent activity'));
	const activityList = makeElement('ul', 'activity-list');
	activityList.dataset.activityList = task._id;
	activitySection.append(activityList);
	extraContent.append(activitySection);
	taskExtra.append(extraContent);

	const editPanel = makeElement('div', 'edit-panel');
	editPanel.hidden = true;
	const editForm = makeElement('form', 'edit-form');
	editForm.dataset.taskId = task._id;
	const titleField = makeLabeledInput('Title', 'title', task.title, { type: 'text', maxlength: 120 });
	titleField.input.minLength = 2;
	titleField.input.required = true;
	const descriptionField = makeLabeledInput('Description', 'description', task.description, { type: 'textarea' });
	const tagsField = makeLabeledInput('Tags', 'tags', task.tags?.join(', '), { type: 'text', maxlength: 260 });
	const subtasksField = makeLabeledInput('Checklist items', 'subtasks', task.subtasks?.map((subtask) => subtask.title).join('\n'), { type: 'textarea' });
	const priorityField = makeLabeledInput('Priority', 'priority', task.priority, {
		type: 'select',
		values: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]
	});
	const dueDateField = makeLabeledInput('Due date', 'dueDate', task.dueDate?.slice(0, 10), { type: 'date' });
	const projectField = makeLabeledInput('Project', 'project', '', { type: 'select', values: [] });
	populateProjectSelect(projectField.input, task.project?._id || task.project || '');
	const assigneeField = makeLabeledInput('Assign to', 'assignedTo', '', { type: 'select', values: [] });
	populateAssigneeSelect(assigneeField.input, task.project?._id || task.project || '', task.assignedTo?._id || task.assignedTo || '');
	projectField.input.addEventListener('change', () => populateAssigneeSelect(assigneeField.input, projectField.input.value));
	const recurrenceField = makeLabeledInput('Repeat', 'repeatFrequency', task.recurrence?.frequency || '', {
		type: 'select',
		values: [['', 'Does not repeat'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']]
	});
	const intervalField = makeLabeledInput('Every', 'repeatInterval', task.recurrence?.interval || 1, { type: 'number' });
	intervalField.input.min = '1';
	intervalField.input.max = '365';
	const dependenciesField = makeLabeledInput('Blocked by', 'dependencies', '', { type: 'select', values: [] });
	dependenciesField.input.multiple = true;
	dependenciesField.input.size = 3;
	populateDependencies(dependenciesField.input, task.dependencies || [], task._id);
	const editActions = makeElement('div', 'edit-actions');
	const saveButton = makeElement('button', 'primary-button', 'Save');
	saveButton.type = 'submit';
	const cancelButton = makeElement('button', 'edit-cancel', 'Cancel');
	cancelButton.type = 'button';
	cancelButton.dataset.action = 'cancel-edit';
	cancelButton.dataset.taskId = task._id;
	editActions.append(saveButton, cancelButton);
	editForm.append(titleField.label, descriptionField.label, priorityField.label, dueDateField.label, tagsField.label, subtasksField.label, projectField.label, assigneeField.label, recurrenceField.label, intervalField.label, dependenciesField.label, editActions);
	editPanel.append(editForm);

	card.append(mainRow, taskExtra, editPanel);
	return card;
}

async function loadTaskExtra(taskId, details) {
	const activityList = details.querySelector(`[data-activity-list="${taskId}"]`);
	const attachmentList = details.querySelector(`[data-attachment-list="${taskId}"]`);
	try {
		const [activityResult, attachmentResult] = await Promise.all([
			apiRequest(`/api/tasks/${taskId}/activity`),
			apiRequest(`/api/tasks/${taskId}/attachments`)
		]);
		activityList.replaceChildren(...activityResult.activity.map((entry) => {
			const item = makeElement('li');
			const actor = entry.actor?.name || 'A team member';
			const action = entry.action.replaceAll('-', ' ');
			item.textContent = `${actor} ${action} · ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.createdAt))}`;
			return item;
		}));
		attachmentList.replaceChildren(...attachmentResult.attachments.map((attachment) => {
			const item = makeElement('li');
			const link = makeElement('a', '', `${attachment.originalName} · ${Math.ceil(attachment.size / 1024)} KB`);
			link.href = `/api/tasks/${taskId}/attachments/${attachment._id}`;
			const remove = makeElement('button', 'delete-button', 'Remove');
			remove.type = 'button';
			remove.dataset.action = 'delete-attachment';
			remove.dataset.taskId = taskId;
			remove.dataset.attachmentId = attachment._id;
			item.append(link, ' ', remove);
			return item;
		}));
		details.dataset.loaded = 'true';
	} catch (error) {
		showNotice(error.message);
	}
}

function renderTasks() {
	const visibleTasks = state.tasks.filter(matchesSearch);
	taskList.replaceChildren(...visibleTasks.map(makeTaskCard));
	populateDependencies(taskDependenciesSelect);
	const shownStart = state.total === 0 ? 0 : (state.page - 1) * state.limit + 1;
	const shownEnd = Math.min(state.page * state.limit, state.total);
	taskCount.textContent = state.total === 0
		? 'No tasks yet'
		: `Showing ${shownStart}-${shownEnd} of ${state.total} task${state.total === 1 ? '' : 's'}`;
	pageLabel.textContent = `Page ${state.page}`;
	previousPage.disabled = state.page <= 1;
	nextPage.disabled = state.page * state.limit >= state.total;
	emptyState.hidden = visibleTasks.length > 0;

	if (visibleTasks.length === 0) {
		const title = emptyState.querySelector('h3');
		const description = emptyState.querySelector('p:last-child');
		const searching = Boolean(state.search || state.status || state.priority || state.tag);
		title.textContent = searching ? 'No matching tasks' : 'No tasks yet';
		description.textContent = searching
			? 'Try a different search or adjust the filters.'
			: 'Add a task above to get started.';
	}
}

function matchesSearch(task) {
	const searchTerm = state.search.toLocaleLowerCase();
	return !searchTerm || `${task.title} ${task.description} ${(task.tags || []).join(' ')}`.toLocaleLowerCase().includes(searchTerm);
}

function renderBoard() {
	for (const status of ['pending', 'in-progress', 'completed']) {
		const column = boardPanel.querySelector(`[data-board-column="${status}"]`);
		const dropzone = column.querySelector('.board-dropzone');
		const tasks = state.boardTasks.filter((task) => task.status === status && matchesSearch(task));
		column.hidden = Boolean(state.status && state.status !== status);
		column.querySelector('.board-count').textContent = String(tasks.length);
		if (tasks.length) {
			dropzone.replaceChildren(...tasks.map((task) => makeTaskCard(task, true)));
		} else {
			dropzone.replaceChildren(makeElement('p', 'board-empty', 'Drop a task here'));
		}
	}
}

function renderCalendar() {
	const monthStart = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth(), 1);
	const offset = (monthStart.getDay() + 6) % 7;
	const gridStart = new Date(monthStart);
	gridStart.setDate(monthStart.getDate() - offset);
	const today = localDateString();
	const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
	const weekdays = Array.from({ length: 7 }, (_, index) => {
		const day = new Date(2024, 0, 1 + index);
		return makeElement('div', 'calendar-weekday', weekdayFormatter.format(day));
	});
	const days = [];
	for (let index = 0; index < 42; index += 1) {
		const date = new Date(gridStart);
		date.setDate(gridStart.getDate() + index);
		const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
		const cell = makeElement('div', 'calendar-day');
		cell.setAttribute('role', 'gridcell');
		if (date.getMonth() !== state.calendarMonth.getMonth()) cell.classList.add('is-outside-month');
		if (dateKey === today) cell.classList.add('is-today');
		cell.append(makeElement('p', 'calendar-date', String(date.getDate())));
		const dueTasks = state.calendarTasks.filter((task) => task.dueDate?.slice(0, 10) === dateKey && matchesSearch(task));
		for (const task of dueTasks.slice(0, 3)) {
			const event = makeElement('div', 'calendar-task', task.title);
			event.dataset.status = task.status;
			event.title = task.tags?.length ? `${task.title} · ${task.tags.map((tag) => `#${tag}`).join(' ')}` : task.title;
			cell.append(event);
		}
		if (dueTasks.length > 3) cell.append(makeElement('p', 'calendar-overflow', `+${dueTasks.length - 3} more`));
		days.push(cell);
	}
	calendarGrid.replaceChildren(...weekdays, ...days);
}

function parseTags(value) {
	return [...new Set(value.split(',').map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean))].slice(0, 10);
}

function parseSubtasks(value, previous = []) {
	return value.split(/\r?\n/).map((title) => title.trim()).filter(Boolean).slice(0, 20)
		.map((title, index) => ({ title, completed: previous[index]?.completed ?? false }));
}

function recurrenceFromForm(formData) {
	const frequency = formData.get('repeatFrequency');
	return frequency ? { frequency, interval: Number(formData.get('repeatInterval')) || 1 } : null;
}

function findTask(taskId) {
	return [...state.tasks, ...state.boardTasks, ...state.calendarTasks].find((task) => task._id === taskId);
}

createTaskForm.addEventListener('submit', async (event) => {
	event.preventDefault();
	const formData = new FormData(createTaskForm);
	const payload = {
		title: formData.get('title'),
		description: formData.get('description'),
		priority: formData.get('priority'),
		dueDate: formData.get('dueDate') || null,
		tags: parseTags(formData.get('tags')),
		subtasks: parseSubtasks(formData.get('subtasks')),
		project: formData.get('project') || null,
		assignedTo: formData.get('assignedTo') || null,
		recurrence: recurrenceFromForm(formData),
		dependencies: formData.getAll('dependencies')
	};
	const submitButton = createTaskForm.querySelector('button[type="submit"]');
	setButtonLoading(submitButton, true, 'Adding...');

	try {
		await apiRequest('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
		createTaskForm.reset();
		state.page = 1;
		state.status = '';
		state.priority = '';
		state.tag = '';
		state.search = '';
		searchInput.value = '';
		tagFilter.value = '';
		priorityFilter.value = '';
		populateProjectSelect(projectFilter, state.project, true);
		populateAssigneeSelect(assigneeFilter, state.project, state.assignedTo, true);
		document.querySelectorAll('[data-status-filter]').forEach((button) => {
			const isActive = button.dataset.statusFilter === '';
			button.classList.toggle('is-active', isActive);
			button.setAttribute('aria-pressed', String(isActive));
		});
		await refreshDashboard();
		showNotice('Task added.');
	} catch (error) {
		showNotice(error.message);
	} finally {
		setButtonLoading(submitButton, false);
	}
});

document.addEventListener('change', async (event) => {
	const fileInput = event.target.closest('[data-action="attachment-upload"]');
	if (fileInput) {
		const file = fileInput.files[0];
		if (!file) return;
		fileInput.disabled = true;
		const formData = new FormData();
		formData.append('file', file);
		try {
			await apiRequest(`/api/tasks/${fileInput.dataset.taskId}/attachments`, { method: 'POST', body: formData });
			fileInput.value = '';
			const details = fileInput.closest('.task-extra');
			if (details) {
				details.dataset.loaded = 'false';
				await loadTaskExtra(fileInput.dataset.taskId, details);
			}
			showNotice('Attachment uploaded.');
		} catch (error) {
			showNotice(error.message);
		} finally {
			if (fileInput.isConnected) fileInput.disabled = false;
		}
		return;
	}
	const control = event.target.closest('[data-action="status"], [data-action="subtask"]');
	if (!control) return;

	control.disabled = true;
	try {
		let payload;
		if (control.dataset.action === 'subtask') {
			const task = findTask(control.dataset.taskId);
			if (!task) throw new Error('Task not found. Refresh the page and try again.');
			payload = {
				subtasks: task.subtasks.map((subtask, index) => ({
					title: subtask.title,
					completed: index === Number(control.dataset.subtaskIndex) ? control.checked : subtask.completed
				}))
			};
		} else {
			payload = { status: control.value };
		}
		await apiRequest(`/api/tasks/${control.dataset.taskId}`, {
			method: 'PATCH',
			body: JSON.stringify(payload)
		});
		await refreshDashboard();
		showNotice(control.dataset.action === 'subtask' ? 'Checklist updated.' : 'Task status updated.');
	} catch (error) {
		await refreshCurrentView();
		showNotice(error.message);
	} finally {
		if (control.isConnected) control.disabled = false;
	}
});

document.addEventListener('click', async (event) => {
	const control = event.target.closest('[data-action]');
	if (!control) return;
	if (control.dataset.action === 'remove-member') {
		if (!window.confirm('Remove this person from the team?')) return;
		try {
			await apiRequest(`/api/teams/${control.dataset.teamId}/members/${control.dataset.userId}`, { method: 'DELETE' });
			await loadWorkspaceData();
			showNotice('Team member removed.');
		} catch (error) {
			showNotice(error.message);
		}
		return;
	}
	const card = control.closest('.task-card');
	const panel = card?.querySelector('.edit-panel');
	if (control.dataset.action === 'timer-start' || control.dataset.action === 'timer-stop') {
		const action = control.dataset.action === 'timer-start' ? 'start' : 'stop';
		setButtonLoading(control, true, action === 'start' ? 'Starting...' : 'Stopping...');
		try {
			await apiRequest(`/api/tasks/${control.dataset.taskId}/timer/${action}`, { method: 'POST' });
			await refreshDashboard();
			showNotice(action === 'start' ? 'Timer started.' : 'Timer stopped.');
		} catch (error) {
			showNotice(error.message);
		} finally {
			if (control.isConnected) setButtonLoading(control, false);
		}
		return;
	}
	if (control.dataset.action === 'delete-attachment') {
		try {
			await apiRequest(`/api/tasks/${control.dataset.taskId}/attachments/${control.dataset.attachmentId}`, { method: 'DELETE' });
			const details = control.closest('.task-extra');
			if (details) {
				details.dataset.loaded = 'false';
				await loadTaskExtra(control.dataset.taskId, details);
			}
			showNotice('Attachment removed.');
		} catch (error) {
			showNotice(error.message);
		}
		return;
	}

	if (control.dataset.action === 'toggle-edit' && panel) {
		panel.hidden = !panel.hidden;
		if (!panel.hidden) panel.querySelector('input[name="title"]').focus();
		return;
	}
	if (control.dataset.action === 'cancel-edit' && panel) {
		panel.hidden = true;
		return;
	}
	if (control.dataset.action === 'delete') {
		if (!window.confirm('Delete this task? This cannot be undone.')) return;
		setButtonLoading(control, true, 'Deleting...');
		try {
			await apiRequest(`/api/tasks/${control.dataset.taskId}`, { method: 'DELETE' });
			if (state.page > 1 && (state.page - 1) * state.limit >= state.total - 1) state.page -= 1;
			await refreshDashboard();
			showNotice('Task deleted.');
		} catch (error) {
			showNotice(error.message);
		} finally {
			if (control.isConnected) setButtonLoading(control, false);
		}
	}
});

document.addEventListener('submit', async (event) => {
	const form = event.target.closest('.edit-form');
	if (!form) return;
	event.preventDefault();
	const formData = new FormData(form);
	const task = findTask(form.dataset.taskId);
	const payload = {
		title: formData.get('title'),
		description: formData.get('description'),
		priority: formData.get('priority'),
		dueDate: formData.get('dueDate') || null,
		tags: parseTags(formData.get('tags')),
		subtasks: parseSubtasks(formData.get('subtasks'), task?.subtasks || []),
		project: formData.get('project') || null,
		assignedTo: formData.get('assignedTo') || null,
		recurrence: recurrenceFromForm(formData),
		dependencies: formData.getAll('dependencies')
	};
	const saveButton = form.querySelector('button[type="submit"]');
	setButtonLoading(saveButton, true, 'Saving...');

	try {
		await apiRequest(`/api/tasks/${form.dataset.taskId}`, {
			method: 'PATCH',
			body: JSON.stringify(payload)
		});
		await refreshDashboard();
		showNotice('Task updated.');
	} catch (error) {
		showNotice(error.message);
	} finally {
		if (saveButton.isConnected) setButtonLoading(saveButton, false);
	}
});

document.querySelectorAll('[data-status-filter]').forEach((button) => {
	button.addEventListener('click', () => {
		state.status = button.dataset.statusFilter;
		state.page = 1;
		document.querySelectorAll('[data-status-filter]').forEach((filterButton) => {
			const isActive = filterButton === button;
			filterButton.classList.toggle('is-active', isActive);
			filterButton.setAttribute('aria-pressed', String(isActive));
		});
		state.page = 1;
		refreshCurrentView();
	});
});

priorityFilter.addEventListener('change', () => {
	state.priority = priorityFilter.value;
	state.page = 1;
	refreshCurrentView();
});

tagFilter.addEventListener('input', () => {
	state.tag = tagFilter.value.trim().toLocaleLowerCase();
	state.page = 1;
	window.clearTimeout(tagFilterTimer);
	tagFilterTimer = window.setTimeout(refreshCurrentView, 220);
});

projectFilter.addEventListener('change', () => {
	state.project = projectFilter.value;
	state.assignedTo = '';
	populateAssigneeSelect(assigneeFilter, state.project, '', true);
	state.page = 1;
	refreshCurrentView();
});

assigneeFilter.addEventListener('change', () => {
	state.assignedTo = assigneeFilter.value;
	state.page = 1;
	refreshCurrentView();
});

taskProjectSelect.addEventListener('change', () => {
	populateAssigneeSelect(taskAssigneeSelect, taskProjectSelect.value);
});

memberTeamSelect.addEventListener('change', renderTeamMembers);

async function submitManagementForm(form, path, successMessage, reloadWorkspace = false, bodyOverride = null) {
	const button = form.querySelector('button[type="submit"]');
	const previousMemberTeam = memberTeamSelect.value;
	const previousProjectTeam = projectTeamSelect.value;
	setButtonLoading(button, true, 'Saving...');
	try {
		const body = bodyOverride || Object.fromEntries(new FormData(form));
		const result = await apiRequest(path, { method: 'POST', body: JSON.stringify(body) });
		form.reset();
		if (reloadWorkspace) {
			await loadWorkspaceData();
			const teamId = form === teamForm ? result.team?._id : body.teamId || previousMemberTeam;
			if (teamId && state.teams.some((team) => String(team._id) === String(teamId))) {
				memberTeamSelect.value = teamId;
				projectTeamSelect.value = teamId;
				renderTeamMembers();
			}
			if (form === projectForm) projectTeamSelect.value = body.teamId || previousProjectTeam;
		}
		await refreshDashboard();
		showNotice(successMessage);
	} catch (error) {
		showNotice(error.message);
	} finally {
		setButtonLoading(button, false);
	}
}

teamForm.addEventListener('submit', (event) => {
	event.preventDefault();
	submitManagementForm(teamForm, '/api/teams', 'Team created.', true);
});

memberForm.addEventListener('submit', (event) => {
	event.preventDefault();
	const data = new FormData(memberForm);
	const teamId = data.get('teamId');
	submitManagementForm(memberForm, `/api/teams/${teamId}/members`, 'Team member added.', true, {
		email: data.get('email'),
		role: data.get('role')
	});
});

projectForm.addEventListener('submit', (event) => {
	event.preventDefault();
	submitManagementForm(projectForm, '/api/projects', 'Project created.', true);
});

searchInput.addEventListener('input', () => {
	state.search = searchInput.value.trim();
	if (state.view === 'board') renderBoard();
	else if (state.view === 'calendar') renderCalendar();
	else renderTasks();
});

previousPage.addEventListener('click', () => {
	if (state.page <= 1) return;
	state.page -= 1;
	refreshCurrentView();
});

nextPage.addEventListener('click', () => {
	if (state.page * state.limit >= state.total) return;
	state.page += 1;
	refreshCurrentView();
});

document.querySelectorAll('[data-view]').forEach((button) => {
	button.addEventListener('click', () => {
		state.view = button.dataset.view;
		for (const tab of document.querySelectorAll('[data-view]')) {
			const isActive = tab === button;
			tab.classList.toggle('is-active', isActive);
			tab.setAttribute('aria-selected', String(isActive));
			tab.tabIndex = isActive ? 0 : -1;
		}
		listViewPanel.hidden = state.view !== 'list';
		boardViewPanel.hidden = state.view !== 'board';
		calendarViewPanel.hidden = state.view !== 'calendar';
		refreshCurrentView();
	});
});

document.getElementById('previousMonth').addEventListener('click', () => {
	state.calendarMonth.setMonth(state.calendarMonth.getMonth() - 1);
	loadCalendar();
});

document.getElementById('nextMonth').addEventListener('click', () => {
	state.calendarMonth.setMonth(state.calendarMonth.getMonth() + 1);
	loadCalendar();
});

function readSavedFilters() {
	try {
		const saved = JSON.parse(localStorage.getItem(savedFiltersKey) || '[]');
		return Array.isArray(saved) ? saved.filter((item) => item && typeof item.name === 'string' && item.filters) : [];
	} catch {
		return [];
	}
}

function renderSavedFilters() {
	const selectedId = savedFilterSelect.value;
	const savedFilters = readSavedFilters();
	savedFilterSelect.replaceChildren(makeElement('option', '', 'Choose a saved view'));
	savedFilterSelect.firstElementChild.value = '';
	for (const savedFilter of savedFilters) {
		const option = makeElement('option', '', savedFilter.name);
		option.value = savedFilter.id;
		savedFilterSelect.append(option);
	}
	if (savedFilters.some((item) => item.id === selectedId)) savedFilterSelect.value = selectedId;
	deleteFilterButton.disabled = !savedFilterSelect.value;
}

saveFilterButton.addEventListener('click', () => {
	const name = savedFilterName.value.trim();
	if (!name) {
		showNotice('Enter a name for this saved view.');
		savedFilterName.focus();
		return;
	}
	const savedFilters = readSavedFilters();
	const filter = {
		id: `${Date.now()}`,
		name,
		filters: {
			status: state.status,
			priority: state.priority,
			tag: state.tag,
			project: state.project,
			assignedTo: state.assignedTo,
			search: state.search
		}
	};
	savedFilters.push(filter);
	localStorage.setItem(savedFiltersKey, JSON.stringify(savedFilters));
	savedFilterName.value = '';
	renderSavedFilters();
	savedFilterSelect.value = filter.id;
	deleteFilterButton.disabled = false;
	showNotice('View saved on this device.');
});

savedFilterSelect.addEventListener('change', () => {
	const filter = readSavedFilters().find((item) => item.id === savedFilterSelect.value);
	deleteFilterButton.disabled = !filter;
	if (!filter) return;
	state.status = filter.filters.status || '';
	state.priority = filter.filters.priority || '';
	state.tag = filter.filters.tag || '';
	state.project = filter.filters.project || '';
	state.assignedTo = filter.filters.assignedTo || '';
	state.search = filter.filters.search || '';
	state.page = 1;
	searchInput.value = state.search;
	priorityFilter.value = state.priority;
	tagFilter.value = state.tag;
	populateProjectSelect(projectFilter, state.project, true);
	populateAssigneeSelect(assigneeFilter, state.project, state.assignedTo, true);
	document.querySelectorAll('[data-status-filter]').forEach((button) => {
		const isActive = button.dataset.statusFilter === state.status;
		button.classList.toggle('is-active', isActive);
		button.setAttribute('aria-pressed', String(isActive));
	});
	refreshCurrentView();
});

deleteFilterButton.addEventListener('click', () => {
	const selectedId = savedFilterSelect.value;
	if (!selectedId) return;
	localStorage.setItem(savedFiltersKey, JSON.stringify(readSavedFilters().filter((item) => item.id !== selectedId)));
	savedFilterSelect.value = '';
	renderSavedFilters();
});

boardPanel.addEventListener('dragstart', (event) => {
	const card = event.target.closest('.task-card[draggable="true"]');
	if (!card) return;
	event.dataTransfer.setData('text/plain', card.dataset.taskId);
	event.dataTransfer.effectAllowed = 'move';
});

boardPanel.addEventListener('dragover', (event) => {
	const dropzone = event.target.closest('[data-board-status]');
	if (!dropzone) return;
	event.preventDefault();
	event.dataTransfer.dropEffect = 'move';
	dropzone.classList.add('is-drag-over');
});

boardPanel.addEventListener('dragleave', (event) => {
	const dropzone = event.target.closest('[data-board-status]');
	if (dropzone && !dropzone.contains(event.relatedTarget)) dropzone.classList.remove('is-drag-over');
});

boardPanel.addEventListener('drop', async (event) => {
	const dropzone = event.target.closest('[data-board-status]');
	if (!dropzone) return;
	event.preventDefault();
	dropzone.classList.remove('is-drag-over');
	const taskId = event.dataTransfer.getData('text/plain');
	const task = findTask(taskId);
	const status = dropzone.dataset.boardStatus;
	if (!task || task.status === status) return;
	try {
		await apiRequest(`/api/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
		await refreshDashboard();
		showNotice('Task moved.');
	} catch (error) {
		showNotice(error.message);
	}
});

browserAlertToggle.addEventListener('click', async () => {
	if (!('Notification' in window)) return;
	try {
		await Notification.requestPermission();
		updateBrowserAlertControl();
		if (Notification.permission === 'granted') showNotice('Browser alerts enabled for new due reminders.');
	} catch {
		showNotice('Browser notification permission could not be requested.');
	}
});

soundToggle.addEventListener('click', () => {
	state.soundEnabled = !state.soundEnabled;
	try {
		localStorage.setItem(reminderSoundKey, state.soundEnabled ? 'on' : 'off');
	} catch {
		showNotice('Sound preference could not be saved on this device.');
	}
	updateSoundToggle();
	if (state.soundEnabled) playReminderSound();
});

notificationToggle.addEventListener('click', () => {
	const isExpanded = notificationToggle.getAttribute('aria-expanded') === 'true';
	notificationToggle.setAttribute('aria-expanded', String(!isExpanded));
	notificationPanel.hidden = isExpanded;
	if (!isExpanded) loadNotifications();
});

document.addEventListener('click', (event) => {
	if (notificationMenu.contains(event.target)) return;
	notificationPanel.hidden = true;
	notificationToggle.setAttribute('aria-expanded', 'false');
});

document.addEventListener('keydown', (event) => {
	if (event.key !== 'Escape' || notificationPanel.hidden) return;
	notificationPanel.hidden = true;
	notificationToggle.setAttribute('aria-expanded', 'false');
	notificationToggle.focus();
});

renderSavedFilters();
updateBrowserAlertControl();
updateSoundToggle();
async function initializeDashboard() {
	await loadWorkspaceData();
	await Promise.all([loadTasks(), loadNotifications(), loadAnalytics()]);
}

initializeDashboard();
window.setInterval(loadNotifications, 5 * 60 * 1000);