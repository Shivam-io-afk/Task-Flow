const mongoose = require('mongoose');
const fs = require('node:fs/promises');
const path = require('node:path');
const Task = require('../models/task');
const Team = require('../models/team');
const TaskActivity = require('../models/taskActivity');
const TaskAttachment = require('../models/taskAttachment');
const { uploadDirectory } = require('../Middleware/attachmentUpload');
const { taskQuerySchema, calendarQuerySchema } = require('../Middleware/validation');
const { getTaskAccessFilter, findAccessibleProject } = require('../Middleware/taskAccess');

function requestError(status, message) {
	const error = new Error(message);
	error.status = status;
	return error;
}

async function accessibleTask(taskId, userId) {
	if (!mongoose.isValidObjectId(taskId)) return null;
	const access = await getTaskAccessFilter(userId);
	return Task.findOne({ $and: [{ _id: taskId }, access] });
}

async function validateProjectAndAssignee(projectId, assigneeId, userId) {
	if (!projectId) {
		if (assigneeId) throw requestError(400, 'Tasks must belong to a project before they can be assigned');
		return null;
	}
	const project = await findAccessibleProject(projectId, userId);
	if (!project) throw requestError(404, 'Project not found');
	if (assigneeId) {
		const isMember = await Team.exists({ _id: project.team, 'members.user': assigneeId });
		if (!isMember) throw requestError(400, 'The assignee must be a member of the project team');
	}
	return project;
}

async function validateDependencies(dependencyIds, taskId, accessFilter) {
	if (!dependencyIds?.length) return;
	if (taskId && dependencyIds.some((id) => String(id) === String(taskId))) {
		throw requestError(400, 'A task cannot depend on itself');
	}
	const dependencies = await Task.find({ $and: [accessFilter, { _id: { $in: dependencyIds } }] })
		.select('_id dependencies')
		.lean();
	if (dependencies.length !== new Set(dependencyIds.map(String)).size) {
		throw requestError(400, 'All dependencies must be tasks you can access');
	}
	if (!taskId) return;

	const pending = dependencies.map((task) => String(task._id));
	const visited = new Set();
	while (pending.length) {
		const currentIds = pending.splice(0, 100);
		for (const id of currentIds) {
			if (id === String(taskId)) throw requestError(400, 'This dependency would create a task cycle');
			if (!visited.has(id)) visited.add(id);
		}
		if (visited.size > 1000) throw requestError(400, 'Dependency chain is too large');
		const children = await Task.find({ $and: [accessFilter, { _id: { $in: currentIds } }] })
			.select('dependencies')
			.lean();
		for (const child of children) {
			for (const dependencyId of child.dependencies || []) {
				if (!visited.has(String(dependencyId))) pending.push(String(dependencyId));
			}
		}
	}
}

async function recordActivity(task, actor, action, changes = {}) {
	await TaskActivity.create({ task: task._id, actor, action, changes });
}

async function listTasks(req, res, next) {
	try {
		const { error, value } = taskQuerySchema.validate(req.query, { convert: true });
		if (error) {
			return res.status(400).json({ error: 'Invalid task filters' });
		}

		const filter = {};
		if (value.status) filter.status = value.status;
		if (value.priority) filter.priority = value.priority;
		if (value.tag) filter.tags = value.tag;
		if (value.project) filter.project = value.project;
		if (value.assignedTo) filter.assignedTo = value.assignedTo;
		const query = { $and: [await getTaskAccessFilter(req.user._id), filter] };

		const skip = (value.page - 1) * value.limit;
		const [tasks, total] = await Promise.all([
			Task.find(query).sort({ createdAt: -1 }).skip(skip).limit(value.limit)
				.populate('assignedTo', 'name email')
				.populate('project', 'name team')
				.populate('dependencies', 'title status')
				.lean(),
			Task.countDocuments(query)
		]);

		res.json({ tasks, page: value.page, limit: value.limit, total });
	} catch (error) {
		next(error);
	}
}

async function listCalendarTasks(req, res, next) {
	try {
		const { error, value } = calendarQuerySchema.validate(req.query);
		if (error) return res.status(400).json({ error: 'A valid month is required (YYYY-MM)' });

		const [year, month] = value.month.split('-').map(Number);
		const start = new Date(Date.UTC(year, month - 1, 1));
		const end = new Date(Date.UTC(year, month, 1));
		const filter = {
			dueDate: { $gte: start, $lt: end }
		};
		if (value.status) filter.status = value.status;
		if (value.priority) filter.priority = value.priority;
		if (value.tag) filter.tags = value.tag;
		if (value.project) filter.project = value.project;
		if (value.assignedTo) filter.assignedTo = value.assignedTo;
		const query = { $and: [await getTaskAccessFilter(req.user._id), filter] };
		const tasks = await Task.find(query).sort({ dueDate: 1, priority: -1 })
			.populate('assignedTo', 'name email')
			.populate('project', 'name team')
			.populate('dependencies', 'title status')
			.lean();

		res.json({ month: value.month, tasks });
	} catch (error) {
		next(error);
	}
}

async function listDueNotifications(req, res, next) {
	try {
		const today = new Date();
		today.setUTCHours(0, 0, 0, 0);
		const dueBefore = new Date(today);
		dueBefore.setUTCDate(dueBefore.getUTCDate() + 7);
		const filter = {
			status: { $ne: 'completed' },
			dueDate: { $ne: null, $lte: dueBefore }
		};
		const query = { $and: [await getTaskAccessFilter(req.user._id), filter] };
		const [tasks, count] = await Promise.all([
			Task.find(query)
				.select('title dueDate status priority')
				.sort({ dueDate: 1 })
				.limit(20)
				.lean(),
			Task.countDocuments(query)
		]);
		const todayKey = today.toISOString().slice(0, 10);
		const notifications = tasks.map((task) => {
			const dueDate = task.dueDate.toISOString().slice(0, 10);
			return {
				taskId: task._id,
				title: task.title,
				dueDate,
				status: task.status,
				priority: task.priority,
				type: dueDate < todayKey ? 'overdue' : dueDate === todayKey ? 'due-today' : 'upcoming'
			};
		});

		res.json({ notifications, count });
	} catch (error) {
		next(error);
	}
}

async function getTask(req, res, next) {
	try {
		if (!mongoose.isValidObjectId(req.params.taskId)) {
			return res.status(400).json({ error: 'Invalid task ID' });
		}

		const task = await accessibleTask(req.params.taskId, req.user._id);
		if (!task) return res.status(404).json({ error: 'Task not found' });
		await task.populate([{ path: 'assignedTo', select: 'name email' }, { path: 'project', select: 'name team' }, { path: 'dependencies', select: 'title status' }]);
		res.json({ task: task.toObject() });
	} catch (error) {
		next(error);
	}
}

async function createTask(req, res, next) {
	try {
		if (req.body.recurrence && !req.body.dueDate) {
			throw requestError(400, 'Recurring tasks need a due date');
		}
		await validateProjectAndAssignee(req.body.project, req.body.assignedTo, req.user._id);
		const accessFilter = await getTaskAccessFilter(req.user._id);
		await validateDependencies(req.body.dependencies, null, accessFilter);
		const task = await Task.create({ ...req.body, owner: req.user._id });
		if (task.recurrence) {
			task.recurrenceSeriesId = task._id;
			task.recurrenceIndex = 1;
			await task.save();
		}
		await recordActivity(task, req.user._id, 'created', { title: task.title });
		res.status(201).json({ task });
	} catch (error) {
		if (error.status) return res.status(error.status).json({ error: error.message });
		next(error);
	}
}

async function updateTask(req, res, next) {
	try {
		if (!mongoose.isValidObjectId(req.params.taskId)) {
			return res.status(400).json({ error: 'Invalid task ID' });
		}

		const task = await accessibleTask(req.params.taskId, req.user._id);
		if (!task) return res.status(404).json({ error: 'Task not found' });
		const projectId = req.body.project === undefined ? task.project : req.body.project;
		const assigneeId = req.body.assignedTo === undefined ? task.assignedTo : req.body.assignedTo;
		await validateProjectAndAssignee(projectId, assigneeId, req.user._id);
		const dueDate = req.body.dueDate === undefined ? task.dueDate : req.body.dueDate;
		const recurrence = req.body.recurrence === undefined ? task.recurrence : req.body.recurrence;
		if (recurrence && !dueDate) throw requestError(400, 'Recurring tasks need a due date');
		const accessFilter = await getTaskAccessFilter(req.user._id);
		const dependencies = req.body.dependencies || task.dependencies;
		await validateDependencies(dependencies, task._id, accessFilter);
		if (req.body.status === 'completed' && dependencies.length) {
			const blockingTasks = await Task.find({
				$and: [accessFilter, { _id: { $in: dependencies }, status: { $ne: 'completed' } }]
			}).select('title').lean();
			if (blockingTasks.length) {
				return res.status(409).json({
					error: 'Complete all dependency tasks first',
					blockingTasks: blockingTasks.map((blockingTask) => blockingTask.title)
				});
			}
		}

		const changes = {};
		for (const [field, value] of Object.entries(req.body)) {
			if (JSON.stringify(task[field]) !== JSON.stringify(value)) changes[field] = { from: task[field], to: value };
			task.set(field, value);
		}
		if (task.recurrence && !task.recurrenceSeriesId) {
			task.recurrenceSeriesId = task._id;
			task.recurrenceIndex = 1;
		} else if (!task.recurrence) {
			task.recurrenceSeriesId = null;
			task.recurrenceIndex = 1;
		}
		await task.save();
		const action = req.body.status && changes.status ? 'status-changed' : 'updated';
		if (Object.keys(changes).length) await recordActivity(task, req.user._id, action, changes);
		res.json({ task });
	} catch (error) {
		if (error.status) return res.status(error.status).json({ error: error.message });
		next(error);
	}
}

async function deleteTask(req, res, next) {
	try {
		if (!mongoose.isValidObjectId(req.params.taskId)) {
			return res.status(400).json({ error: 'Invalid task ID' });
		}

		const task = await accessibleTask(req.params.taskId, req.user._id);
		if (!task) return res.status(404).json({ error: 'Task not found' });
		await recordActivity(task, req.user._id, 'deleted', { title: task.title });
		const attachments = await TaskAttachment.find({ task: task._id }).select('storedName').lean();
		await TaskAttachment.deleteMany({ task: task._id });
		for (const attachment of attachments) {
			await fs.unlink(path.join(uploadDirectory, attachment.storedName)).catch(() => {});
		}
		await task.deleteOne();
		res.status(204).end();
	} catch (error) {
		next(error);
	}
}

async function listTaskActivity(req, res, next) {
	try {
		const task = await accessibleTask(req.params.taskId, req.user._id);
		if (!task) return res.status(404).json({ error: 'Task not found' });
		const activity = await TaskActivity.find({ task: task._id })
			.populate('actor', 'name email')
			.sort({ createdAt: -1 })
			.limit(100)
			.lean();
		res.json({ activity });
	} catch (error) {
		next(error);
	}
}

async function startTimer(req, res, next) {
	try {
		const task = await accessibleTask(req.params.taskId, req.user._id);
		if (!task) return res.status(404).json({ error: 'Task not found' });
		if (task.timeEntries.some((entry) => entry.user.equals(req.user._id) && !entry.stoppedAt)) {
			return res.status(409).json({ error: 'A timer is already running for this task' });
		}
		const entry = task.timeEntries.create({ user: req.user._id, startedAt: new Date() });
		task.timeEntries.push(entry);
		await task.save();
		await recordActivity(task, req.user._id, 'timer-started', { entryId: entry._id });
		res.status(201).json({ entry });
	} catch (error) {
		next(error);
	}
}

async function stopTimer(req, res, next) {
	try {
		const task = await accessibleTask(req.params.taskId, req.user._id);
		if (!task) return res.status(404).json({ error: 'Task not found' });
		const entry = [...task.timeEntries].reverse().find((timeEntry) => timeEntry.user.equals(req.user._id) && !timeEntry.stoppedAt);
		if (!entry) return res.status(409).json({ error: 'No timer is running for this task' });
		entry.stoppedAt = new Date();
		entry.durationSeconds = Math.max(1, Math.floor((entry.stoppedAt - entry.startedAt) / 1000));
		await task.save();
		await recordActivity(task, req.user._id, 'timer-stopped', { durationSeconds: entry.durationSeconds });
		res.json({ entry });
	} catch (error) {
		next(error);
	}
}

async function getTaskAnalytics(req, res, next) {
	try {
		const accessFilter = await getTaskAccessFilter(req.user._id);
		const now = new Date();
		const dueSoon = new Date(now);
		dueSoon.setUTCDate(dueSoon.getUTCDate() + 7);
		const trendStart = new Date(now);
		trendStart.setUTCDate(trendStart.getUTCDate() - 41);
		const [total, overdue, dueSoonCount, statuses, trend, timeTotals, workload] = await Promise.all([
			Task.countDocuments(accessFilter),
			Task.countDocuments({ $and: [accessFilter, { status: { $ne: 'completed' }, dueDate: { $lt: now } }] }),
			Task.countDocuments({ $and: [accessFilter, { status: { $ne: 'completed' }, dueDate: { $gte: now, $lte: dueSoon } }] }),
			Task.aggregate([{ $match: accessFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
			Task.aggregate([
				{ $match: { $and: [accessFilter, { status: 'completed', updatedAt: { $gte: trendStart } }] } },
				{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } }, count: { $sum: 1 } } },
				{ $sort: { _id: 1 } }
			]),
			Task.aggregate([
				{ $match: accessFilter },
				{ $unwind: '$timeEntries' },
				{ $group: { _id: null, seconds: { $sum: { $cond: [{ $eq: ['$timeEntries.stoppedAt', null] }, { $divide: [{ $subtract: [now, '$timeEntries.startedAt'] }, 1000] }, '$timeEntries.durationSeconds'] } } } }
			]),
			Task.aggregate([
				{ $match: { $and: [accessFilter, { assignedTo: { $ne: null }, status: { $ne: 'completed' } }] } },
				{ $group: { _id: '$assignedTo', openTasks: { $sum: 1 } } },
				{ $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'assignee' } },
				{ $unwind: '$assignee' },
				{ $project: { _id: 0, userId: '$_id', name: '$assignee.name', openTasks: 1 } },
				{ $sort: { openTasks: -1, name: 1 } }
			])
		]);
		res.json({
			total,
			overdue,
			dueSoon: dueSoonCount,
			statuses: Object.fromEntries(statuses.map((status) => [status._id, status.count])),
			completedByDay: trend,
			workload,
			timeTrackedSeconds: Math.floor(timeTotals[0]?.seconds || 0)
		});
	} catch (error) {
		next(error);
	}
}

module.exports = {
	listTasks,
	listCalendarTasks,
	listDueNotifications,
	getTask,
	createTask,
	updateTask,
	deleteTask,
	listTaskActivity,
	startTimer,
	stopTimer,
	getTaskAnalytics,
	accessibleTask,
	recordActivity
};