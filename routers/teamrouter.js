const express = require('express');
const { requireAuth } = require('../Middleware/auth');
const { validateBody, teamSchema, teamMemberSchema } = require('../Middleware/validation');
const { listTeams, createTeam, addMember, removeMember } = require('../controllers/teamController');

const router = express.Router();

router.use(requireAuth);
router.get('/', listTeams);
router.post('/', validateBody(teamSchema), createTeam);
router.post('/:teamId/members', validateBody(teamMemberSchema), addMember);
router.delete('/:teamId/members/:userId', removeMember);

module.exports = router;