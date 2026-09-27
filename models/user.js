const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		trim: true,
		minlength: 2,
		maxlength: 100
	},
	email: {
		type: String,
		required: true,
		unique: true,
		trim: true,
		lowercase: true,
		maxlength: 254
	},
	passwordHash: {
		type: String,
		select: false
	},
	googleId: {
		type: String,
		unique: true,
		sparse: true
	},
	role: {
		type: String,
		enum: ['user', 'admin'],
		default: 'user'
	},
	isActive: {
		type: Boolean,
		default: true
	}
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);