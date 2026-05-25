const { errorResponse } = require('../utils/response');

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return errorResponse(res, 'File size exceeds the allowed limit of 5MB.', 413);
  }
  if (err.name === 'MulterError') {
    return errorResponse(res, err.message, 400);
  }

  // MySQL errors
  if (err.code === 'ER_DUP_ENTRY') {
    const field = err.message.match(/for key '(.+?)'/)?.[1] || 'field';
    return errorResponse(res, `Duplicate entry: a record with this ${field} already exists.`, 409);
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return errorResponse(res, 'Referenced record does not exist.', 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'Invalid token.', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 'Token has expired.', 401);
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An internal server error occurred.'
    : err.message;

  return errorResponse(res, message, statusCode);
}

module.exports = { errorHandler };
