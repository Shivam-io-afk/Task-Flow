const mongoose = require('mongoose');
const Project = require('../models/project');
const { getUserTeams, findAccessibleProject, findManageableTeam } = require('../Middleware/taskAccess');

async function listProjects(req, res, next) {
	try {
		const teams = await getUserTeams(req.user._id);
		const projects = await Project.find({
			team: { $in: teams.map((team) => team._id) },
			archived: false
		}).populate('team', 'name personal').sort({ name: 1 }).lean();
		res.json({ projects });
	} catch (error) {
		next(error);
	}
}

async function createProject(req, res, next) {
	try {
		const team = await findManageableTeam(req.body.teamId, req.user._id);
		if (!team) return res.status(404).json({ error: 'Team not found or you cannot manage projects' });
		const project = await Project.create({
			name: req.body.name,
			description: req.body.description,
			team: team._id,
			createdBy: req.user._id
		});
		res.status(201).json({ project });
	} catch (error) {
		next(error);
	}
}

async function updateProject(req, res, next) {
	try {
		if (!mongoose.isValidObjectId(req.params.projectId)) {
			return res.status(400).json({ error: 'Invalid project ID' });
		}
		const project = await findAccessibleProject(req.params.projectId, req.user._id);
		if (!project) return res.status(404).json({ error: 'Project not found' });
		const team = await findManageableTeam(project.team, req.user._id);
		if (!team) return res.status(403).json({ error: 'Only team owners and admins can edit projects' });

		for (const field of ['name', 'description', 'archived']) {
			if (req.body[field] !== undefined) project[field] = req.body[field];
		}
		await project.save();
		res.json({ project });
	} catch (error) {
		next(error);
	}
}

module.exports = { listProjects, createProject, updateProject };