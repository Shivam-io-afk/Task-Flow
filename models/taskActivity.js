const mongoose = require('mongoose');

const taskActivitySchema = new mongoose.Schema({
	task: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Task',
		required: true,
		index: true
	},
	actor: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	action: {
		type: String,
		required: true,
		enum: ['created', 'updated', 'status-changed', 'assigned', 'timer-started', 'timer-stopped', 'attachment-added', 'attachment-deleted', 'deleted']
	},
	changes: {
		type: mongoose.Schema.Types.Mixed,
		default: {}
	},
	createdAt: {
		type: Date,
		default: Date.now,
		index: true
	}
});

taskActivitySchema.index({ task: 1, createdAt: -1 });

module.exports = mongoose.model('TaskActivity', taskActivitySchema);