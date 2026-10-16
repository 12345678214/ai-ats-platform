const { ZodError } = require('zod');
const multer = require('multer');
const env = require('../config/env');

const notFound = (req, res) => {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}` } });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err instanceof ZodError) {
    status = 422;
    message = 'Validation failed';
    details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? `File is too large. Maximum size is ${env.MAX_UPLOAD_MB} MB.` : err.message;
  } else if (err.code === 'P2002') {
    status = 409;
    message = 'A record with those details already exists';
  } else if (err.code === 'P2025') {
    status = 404;
    message = 'Record not found';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON';
  }

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
    if (env.NODE_ENV === 'production') message = 'Something went wrong on our side. Please try again.';
  }
  res.status(status).json({ error: { message, ...(details ? { details } : {}) } });
};

module.exports = { notFound, errorHandler };
