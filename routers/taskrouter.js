const express = require('express');
const { requireAuth } = require('../Middleware/auth');
const { validateBody, createTaskSchema, updateTaskSchema } = require('../Middleware/validation');
const {
	listTasks,
	listCalendarTasks,
	listDueNotifications,
	getTaskAnalytics,
	getTask,
	createTask,
	updateTask,
	deleteTask,
	listTaskActivity,
	startTimer,
	stopTimer
} = require('../controllers/taskController');
const { uploadAttachment } = require('../Middleware/attachmentUpload');
const {
	listAttachments,
	addAttachment,
	downloadAttachment,
	deleteAttachment
} = require('../controllers/attachmentController');

const router = express.Router();

router.use(requireAuth);
router.get('/', listTasks);
router.get('/calendar', listCalendarTasks);
router.get('/notifications', listDueNotifications);
router.get('/analytics', getTaskAnalytics);
router.post('/', validateBody(createTaskSchema), createTask);
router.get('/:taskId/activity', listTaskActivity);
router.post('/:taskId/timer/start', startTimer);
router.post('/:taskId/timer/stop', stopTimer);
router.get('/:taskId/attachments', listAttachments);
router.post('/:taskId/attachments', uploadAttachment.single('file'), addAttachment);
router.get('/:taskId/attachments/:attachmentId', downloadAttachment);
router.delete('/:taskId/attachments/:attachmentId', deleteAttachment);
router.get('/:taskId', getTask);
router.patch('/:taskId', validateBody(updateTaskSchema), updateTask);
router.delete('/:taskId', deleteTask);

module.exports = router;