const mongoose = require('mongoose');

const subtaskSchema = new mongoose.Schema({
	title: {
		type: String,
		required: true,
		trim: true,
		maxlength: 120
	},
	completed: {
		type: Boolean,
		default: false
	}
}, { _id: true });

const recurrenceSchema = new mongoose.Schema({
	frequency: {
		type: String,
		enum: ['daily', 'weekly', 'monthly'],
		required: true
	},
	interval: {
		type: Number,
		min: 1,
		max: 365,
		default: 1
	}
}, { _id: false });

const timeEntrySchema = new mongoose.Schema({
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	startedAt: {
		type: Date,
		required: true
	},
	stoppedAt: {
		type: Date,
		default: null
	},
	durationSeconds: {
		type: Number,
		default: 0,
		min: 0
	}
}, { timestamps: true });

const taskSchema = new mongoose.Schema({
	owner: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
		index: true
	},
	project: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Project',
		default: null,
		index: true
	},
	assignedTo: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		default: null,
		index: true
	},
	title: {
		type: String,
		required: true,
		trim: true,
		maxlength: 120
	},
	description: {
		type: String,
		trim: true,
		default: '',
		maxlength: 2000
	},
	status: {
		type: String,
		enum: ['pending', 'in-progress', 'completed'],
		default: 'pending'
	},
	priority: {
		type: String,
		enum: ['low', 'medium', 'high'],
		default: 'medium'
	},
	dueDate: {
		type: Date,
		default: null
	},
	tags: {
		type: [{ type: String, trim: true, lowercase: true, maxlength: 24 }],
		default: []
	},
	subtasks: {
		type: [subtaskSchema],
		default: []
	},
	dependencies: {
		type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
		default: []
	},
	recurrence: {
		type: recurrenceSchema,
		default: null
	},
	recurrenceSeriesId: {
		type: mongoose.Schema.Types.ObjectId,
		default: null
	},
	recurrenceIndex: {
		type: Number,
		default: 1,
		min: 1
	},
	timeEntries: {
		type: [timeEntrySchema],
		default: []
	}
}, { timestamps: true });

taskSchema.index({ owner: 1, createdAt: -1 });
taskSchema.index({ project: 1, dueDate: 1 });
taskSchema.index(
	{ recurrenceSeriesId: 1, recurrenceIndex: 1 },
	{ unique: true, partialFilterExpression: { recurrenceSeriesId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('Task', taskSchema);