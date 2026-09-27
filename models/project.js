const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		trim: true,
		minlength: 2,
		maxlength: 100
	},
	description: {
		type: String,
		trim: true,
		default: '',
		maxlength: 1000
	},
	team: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Team',
		required: true,
		index: true
	},
	createdBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	archived: {
		type: Boolean,
		default: false
	}
}, { timestamps: true });

projectSchema.index({ team: 1, name: 1 });

module.exports = mongoose.model('Project', projectSchema);