const mongoose = require('mongoose');
const Team = require('../models/team');
const Project = require('../models/project');

async function getUserTeams(userId) {
	return Team.find({ 'members.user': userId }).select('_id owner personal members').lean();
}

async function getAccessibleProjectIds(userId, teamIds) {
	const teams = teamIds || (await getUserTeams(userId)).map((team) => team._id);
	return Project.find({ team: { $in: teams }, archived: false }).distinct('_id');
}

async function getTaskAccessFilter(userId) {
	const teams = await getUserTeams(userId);
	const projectIds = await getAccessibleProjectIds(userId, teams.map((team) => team._id));
	return {
		$or: [
			{ owner: userId },
			{ project: { $in: projectIds } }
		]
	};
}

async function findAccessibleProject(projectId, userId) {
	if (!mongoose.isValidObjectId(projectId)) return null;
	const teams = await getUserTeams(userId);
	return Project.findOne({
		_id: projectId,
		team: { $in: teams.map((team) => team._id) },
		archived: false
	});
}

async function findManageableTeam(teamId, userId) {
	if (!mongoose.isValidObjectId(teamId)) return null;
	return Team.findOne({
		_id: teamId,
		'members.user': userId,
		$or: [
			{ owner: userId },
			{ members: { $elemMatch: { user: userId, role: 'admin' } } }
		]
	});
}

module.exports = { getUserTeams, getAccessibleProjectIds, getTaskAccessFilter, findAccessibleProject, findManageableTeam };