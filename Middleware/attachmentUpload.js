const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');

const uploadDirectory = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'private_uploads'));
const allowedMimeTypes = new Set([
	'application/pdf',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'text/plain',
	'image/jpeg',
	'image/png',
	'image/webp'
]);

const storage = multer.diskStorage({
	destination(req, file, callback) {
		fs.mkdir(uploadDirectory, { recursive: true }, (error) => callback(error, uploadDirectory));
	},
	filename(req, file, callback) {
		const extension = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
		callback(null, `${crypto.randomUUID()}${extension}`);
	}
});

const uploadAttachment = multer({
	storage,
	limits: { fileSize: 10 * 1024 * 1024, files: 1 },
	fileFilter(req, file, callback) {
		if (!allowedMimeTypes.has(file.mimetype)) {
			const error = new Error('Unsupported file type');
			error.status = 415;
			return callback(error);
		}
		callback(null, true);
	}
});

module.exports = { uploadAttachment, uploadDirectory };