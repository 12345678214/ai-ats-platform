const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const RESUME_DIR = path.join(env.UPLOAD_DIR, 'resumes');
fs.mkdirSync(RESUME_DIR, { recursive: true });

const ALLOWED = {
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'],
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, RESUME_DIR),
  // Never trust the client-supplied name on disk: random name + validated extension only.
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  },
});

const resumeUpload = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED[ext] || !ALLOWED[ext].includes(file.mimetype)) {
      return cb(ApiError.badRequest('Only PDF or DOCX resumes are accepted'));
    }
    cb(null, true);
  },
}).single('resume');

// Verifies the file's magic bytes so a renamed .exe/.html cannot slip through.
function hasValidSignature(filePath, ext) {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(5);
  fs.readSync(fd, buf, 0, 5, 0);
  fs.closeSync(fd);
  if (ext === '.pdf') return buf.toString('latin1').startsWith('%PDF');
  if (ext === '.docx') return buf[0] === 0x50 && buf[1] === 0x4b; // "PK" zip container
  return false;
}

module.exports = { resumeUpload, hasValidSignature, RESUME_DIR };
