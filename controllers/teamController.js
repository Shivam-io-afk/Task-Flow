const mongoose = require('mongoose');
const User = require('../models/user');
const Team = require('../models/team');
const Project = require('../models/project');
const { findManageableTeam } = require('../Middleware/taskAccess');

async function ensurePersonalTeam(userId) {
	let team = await Team.findOne({ owner: userId, personal: true });
	if (!team) {
		try {
			team = await Team.create({
				name: 'Personal',
				owner: userId,
				personal: true,
				members: [{ user: userId, role: 'owner' }]
			});
		} catch (error) {
			if (error.code !== 11000) throw error;
			team = await Team.findOne({ owner: userId, personal: true });
		}
	}
	return team;
}

async function listTeams(req, res, next) {
	try {
		await ensurePersonalTeam(req.user._id);
		const teams = await Team.find({ 'members.user': req.user._id })
			.populate('members.user', 'name email')
			.sort({ personal: -1, name: 1 })
			.lean();
		const projects = await Project.find({ team: { $in: teams.map((team) => team._id) }, archived: false })
			.sort({ name: 1 })
			.lean();
		res.json({ teams, projects });
	} catch (error) {
		next(error);
	}
}

async function createTeam(req, res, next) {
	try {
		const team = await Team.create({
			name: req.body.name,
			owner: req.user._id,
			members: [{ user: req.user._id, role: 'owner' }]
		});
		res.status(201).json({ team });
	} catch (error) {
		next(error);
	}
}

async function addMember(req, res, next) {
	try {
		const team = await findManageableTeam(req.params.teamId, req.user._id);
		if (!team) return res.status(404).json({ error: 'Team not found or you cannot manage it' });
		if (team.personal) return res.status(400).json({ error: 'Personal teams cannot have additional members' });

		const member = await User.findOne({ email: req.body.email, isActive: true }).select('_id name email');
		if (!member) return res.status(404).json({ error: 'An active account with that email was not found' });
		if (team.members.some((entry) => entry.user.equals(member._id))) {
			return res.status(409).json({ error: 'That person is already on the team' });
		}

		team.members.push({ user: member._id, role: req.body.role });
		await team.save();
		res.status(201).json({ member: { id: member.id, name: member.name, email: member.email, role: req.body.role } });
	} catch (error) {
		next(error);
	}
}

async function removeMember(req, res, next) {
	try {
		if (!mongoose.isValidObjectId(req.params.userId)) {
			return res.status(400).json({ error: 'Invalid user ID' });
		}
		const team = await findManageableTeam(req.params.teamId, req.user._id);
		if (!team) return res.status(404).json({ error: 'Team not found or you cannot manage it' });
		if (String(team.owner) === req.params.userId) return res.status(400).json({ error: 'The team owner cannot be removed' });
		const previousLength = team.members.length;
		team.members = team.members.filter((member) => String(member.user) !== req.params.userId);
		if (team.members.length === previousLength) return res.status(404).json({ error: 'Team member not found' });
		await team.save();
		res.status(204).end();
	} catch (error) {
		next(error);
	}
}

module.exports = { listTeams, createTeam, addMember, removeMember };