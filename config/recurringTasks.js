const cron = require('node-cron');
const Task = require('../models/task');
const TaskActivity = require('../models/taskActivity');

function nextOccurrenceDate(dueDate, recurrence, now) {
	const nextDate = new Date(dueDate || now);
	let attempts = 0;
	do {
		if (recurrence.frequency === 'daily') {
			nextDate.setUTCDate(nextDate.getUTCDate() + recurrence.interval);
		} else if (recurrence.frequency === 'weekly') {
			nextDate.setUTCDate(nextDate.getUTCDate() + (7 * recurrence.interval));
		} else {
			const originalDay = nextDate.getUTCDate();
			nextDate.setUTCDate(1);
			nextDate.setUTCMonth(nextDate.getUTCMonth() + recurrence.interval);
			const monthEnd = new Date(Date.UTC(nextDate.getUTCFullYear(), nextDate.getUTCMonth() + 1, 0)).getUTCDate();
			nextDate.setUTCDate(Math.min(originalDay, monthEnd));
		}
		attempts += 1;
	} while (nextDate <= now && attempts < 1000);
	if (attempts >= 1000) throw new Error('Recurring schedule is too far behind to advance safely');
	return nextDate;
}

async function processRecurringTasks(now = new Date()) {
	const completed = await Task.find({
		status: 'completed',
		recurrence: { $ne: null },
		recurrenceSeriesId: { $type: 'objectId' }
	}).limit(500);
	let created = 0;

	for (const task of completed) {
		const occurrenceIndex = task.recurrenceIndex + 1;
		const alreadyCreated = await Task.exists({
			recurrenceSeriesId: task.recurrenceSeriesId,
			recurrenceIndex: occurrenceIndex
		});
		if (alreadyCreated) continue;

		try {
			const nextTask = await Task.create({
				owner: task.owner,
				project: task.project,
				assignedTo: task.assignedTo,
				title: task.title,
				description: task.description,
				priority: task.priority,
				status: 'pending',
				dueDate: nextOccurrenceDate(task.dueDate, task.recurrence, now),
				tags: task.tags,
				subtasks: task.subtasks.map((subtask) => ({ title: subtask.title, completed: false })),
				dependencies: [],
				recurrence: task.recurrence,
				recurrenceSeriesId: task.recurrenceSeriesId,
				recurrenceIndex: occurrenceIndex
			});
			await TaskActivity.create({
				task: nextTask._id,
				actor: task.owner,
				action: 'created',
				changes: { recurring: true, sourceTaskId: task._id }
			});
			created += 1;
		} catch (error) {
			if (error.code !== 11000) throw error;
		}
	}
	return created;
}

function startRecurringTaskScheduler() {
	return cron.schedule('*/15 * * * *', () => {
		processRecurringTasks().catch((error) => console.error('Recurring task processing failed:', error.message));
	}, { timezone: process.env.TZ || 'UTC' });
}

module.exports = { processRecurringTasks, startRecurringTaskScheduler, nextOccurrenceDate };