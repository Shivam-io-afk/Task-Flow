const express = require('express');
const { requireAuth } = require('../Middleware/auth');
const { validateBody, createProjectSchema, updateProjectSchema } = require('../Middleware/validation');
const { listProjects, createProject, updateProject } = require('../controllers/projectController');

const router = express.Router();

router.use(requireAuth);
router.get('/', listProjects);
router.post('/', validateBody(createProjectSchema), createProject);
router.patch('/:projectId', validateBody(updateProjectSchema), updateProject);

module.exports = router;