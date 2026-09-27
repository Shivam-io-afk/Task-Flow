const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');
const TaskAttachment = require('../models/taskAttachment');
const { accessibleTask, recordActivity } = require('./taskController');
const { uploadDirectory } = require('../Middleware/attachmentUpload');

async function listAttachments(req, res, next) {
	try {
		const task = await accessibleTask(req.params.taskId, req.user._id);
		if (!task) return res.status(404).json({ error: 'Task not found' });
		const attachments = await TaskAttachment.find({ task: task._id })
			.populate('uploadedBy', 'name')
			.sort({ createdAt: -1 })
			.lean();
		res.json({ attachments: attachments.map(({ storedName, ...attachment }) => attachment) });
	} catch (error) {
		next(error);
	}
}

async function addAttachment(req, res, next) {
	try {
		const task = await accessibleTask(req.params.taskId, req.user._id);
		if (!task) {
			if (req.file) await fs.unlink(req.file.path).catch(() => {});
			return res.status(404).json({ error: 'Task not found' });
		}
		if (!req.file) return res.status(400).json({ error: 'Choose a file to upload' });

		const attachment = await TaskAttachment.create({
			task: task._id,
			uploadedBy: req.user._id,
			originalName: path.basename(req.file.originalname).slice(0, 255),
			storedName: req.file.filename,
			mimeType: req.file.mimetype,
			size: req.file.size
		});
		await recordActivity(task, req.user._id, 'attachment-added', { name: attachment.originalName });
		res.status(201).json({ attachment: { id: attachment.id, originalName: attachment.originalName, mimeType: attachment.mimeType, size: attachment.size } });
	} catch (error) {
		if (req.file) await fs.unlink(req.file.path).catch(() => {});
		next(error);
	}
}

async function downloadAttachment(req, res, next) {
	try {
		const task = await accessibleTask(req.params.taskId, req.user._id);
		if (!task) return res.status(404).json({ error: 'Task not found' });
		const attachment = await TaskAttachment.findOne({ _id: req.params.attachmentId, task: task._id });
		if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
		return res.download(path.join(uploadDirectory, attachment.storedName), attachment.originalName, (error) => {
			if (error && !res.headersSent) next(error);
		});
	} catch (error) {
		next(error);
	}
}

async function deleteAttachment(req, res, next) {
	try {
		if (!mongoose.isValidObjectId(req.params.attachmentId)) {
			return res.status(400).json({ error: 'Invalid attachment ID' });
		}
		const task = await accessibleTask(req.params.taskId, req.user._id);
		if (!task) return res.status(404).json({ error: 'Task not found' });
		const attachment = await TaskAttachment.findOne({ _id: req.params.attachmentId, task: task._id });
		if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
		if (!attachment.uploadedBy.equals(req.user._id) && !task.owner.equals(req.user._id)) {
			return res.status(403).json({ error: 'Only the uploader or task creator can remove this attachment' });
		}
		await TaskAttachment.deleteOne({ _id: attachment._id });
		await fs.unlink(path.join(uploadDirectory, attachment.storedName)).catch(() => {});
		await recordActivity(task, req.user._id, 'attachment-deleted', { name: attachment.originalName });
		res.status(204).end();
	} catch (error) {
		next(error);
	}
}

module.exports = { listAttachments, addAttachment, downloadAttachment, deleteAttachment };