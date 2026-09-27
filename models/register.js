const mongoose = require('mongoose');
const Joi = require('joi');


const registrationSchema = new mongoose.Schema(
	{
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
			lowercase: true
		},

		password: {
			type: String,
			required: true,
			minlength: 6
		}
	},
	{
		timestamps: true
	}
);




const registrationValidationSchema = Joi.object({
	name: Joi.string()
		.trim()
		.min(2)
		.max(100)
		.required(),

	email: Joi.string()
		.trim()
		.email()
		.required(),

	password: Joi.string()
		.min(6)
		.max(128)
		.required()
});



module.exports = require('./user');







