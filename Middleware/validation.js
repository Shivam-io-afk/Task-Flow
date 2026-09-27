const Joi = require('joi');

const registrationSchema = Joi.object({
	name: Joi.string().trim().min(2).max(100).required(),
	email: Joi.string().trim().email().max(254).required(),
	password: Joi.string()
		.min(10)
		.max(72)
		.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
		.required()
});

const loginSchema = Joi.object({
	email: Joi.string().trim().email().max(254).required(),
	password: Joi.string().min(1).max(72).required()
});

const teamSchema = Joi.object({
	name: Joi.string().trim().min(2).max(100).required()
});

const teamMemberSchema = Joi.object({
	email: Joi.string().trim().email().max(254).required(),
	role: Joi.string().valid('admin', 'member').default('member')
});

const projectFields = {
	name: Joi.string().trim().min(2).max(100),
	description: Joi.string().trim().max(1000).allow('')
};

const createProjectSchema = Joi.object({
	...projectFields,
	name: projectFields.name.required(),
	description: projectFields.description.default(''),
	teamId: Joi.string().hex().length(24).required()
});

const updateProjectSchema = Joi.object({
	...projectFields,
	archived: Joi.boolean()
}).min(1);

const taskFields = {
	title: Joi.string().trim().min(2).max(120),
	description: Joi.string().trim().max(2000).allow(''),
	status: Joi.string().valid('pending', 'in-progress', 'completed'),
	priority: Joi.string().valid('low', 'medium', 'high'),
	dueDate: Joi.date().iso().allow(null),
	tags: Joi.array().items(Joi.string().trim().lowercase().min(1).max(24)).max(10).unique(),
	project: Joi.string().hex().length(24).allow(null),
	assignedTo: Joi.string().hex().length(24).allow(null),
	recurrence: Joi.object({
		frequency: Joi.string().valid('daily', 'weekly', 'monthly').required(),
		interval: Joi.number().integer().min(1).max(365).default(1)
	}).allow(null),
	dependencies: Joi.array().items(Joi.string().hex().length(24)).max(20).unique(),
	subtasks: Joi.array().items(Joi.object({
		title: Joi.string().trim().min(1).max(120).required(),
		completed: Joi.boolean().default(false)
	})).max(20)
};

const createTaskSchema = Joi.object({
	...taskFields,
	title: taskFields.title.required(),
	description: taskFields.description.default(''),
	status: taskFields.status.default('pending'),
	priority: taskFields.priority.default('medium'),
	dueDate: taskFields.dueDate.default(null),
	tags: taskFields.tags.default([]),
	project: taskFields.project.default(null),
	assignedTo: taskFields.assignedTo.default(null),
	recurrence: taskFields.recurrence.default(null),
	dependencies: taskFields.dependencies.default([]),
	subtasks: taskFields.subtasks.default([])
});

const updateTaskSchema = Joi.object(taskFields).min(1);

const taskQuerySchema = Joi.object({
	status: taskFields.status,
	priority: taskFields.priority,
	tag: Joi.string().trim().lowercase().min(1).max(24),
	project: Joi.string().hex().length(24),
	assignedTo: Joi.string().hex().length(24),
	page: Joi.number().integer().min(1).default(1),
	limit: Joi.number().integer().min(1).max(100).default(20)
});

const calendarQuerySchema = Joi.object({
	month: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).required(),
	status: taskFields.status,
	priority: taskFields.priority,
	tag: taskQuerySchema.extract('tag'),
	project: taskQuerySchema.extract('project'),
	assignedTo: taskQuerySchema.extract('assignedTo')
});

function validateBody(schema) {
	return (req, res, next) => {
		const { error, value } = schema.validate(req.body, {
			abortEarly: false,
			convert: true
		});

		if (error) {
			return res.status(400).json({
				error: 'Invalid request',
				details: error.details.map((detail) => detail.message)
			});
		}

		req.body = value;
		next();
	};
}

module.exports = {
	registrationSchema,
	loginSchema,
	teamSchema,
	teamMemberSchema,
	createProjectSchema,
	updateProjectSchema,
	createTaskSchema,
	updateTaskSchema,
	taskQuerySchema,
	calendarQuerySchema,
	validateBody
};