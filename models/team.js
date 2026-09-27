const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	role: {
		type: String,
		enum: ['owner', 'admin', 'member'],
		default: 'member'
	},
	joinedAt: {
		type: Date,
		default: Date.now
	}
}, { _id: false });

const teamSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		trim: true,
		minlength: 2,
		maxlength: 100
	},
	owner: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
		index: true
	},
	personal: {
		type: Boolean,
		default: false
	},
	members: {
		type: [memberSchema],
		default: []
	}
}, { timestamps: true });

teamSchema.index({ 'members.user': 1 });
teamSchema.index({ owner: 1, personal: 1 }, { unique: true, partialFilterExpression: { personal: true } });

module.exports = mongoose.model('Team', teamSchema);