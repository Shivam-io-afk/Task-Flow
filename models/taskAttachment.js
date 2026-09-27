const mongoose = require('mongoose');

const taskAttachmentSchema = new mongoose.Schema({
	task: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Task',
		required: true,
		index: true
	},
	uploadedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	originalName: {
		type: String,
		required: true,
		maxlength: 255
	},
	storedName: {
		type: String,
		required: true,
		unique: true
	},
	mimeType: {
		type: String,
		required: true
	},
	size: {
		type: Number,
		required: true
	}
}, { timestamps: true });

module.exports = mongoose.model('TaskAttachment', taskAttachmentSchema);