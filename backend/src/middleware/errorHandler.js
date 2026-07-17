const { errorResponse } = require('../utils/response');

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Enhanced telemetry logging for production debugging
  console.error('================================================');
  console.error('[API Error Telemetry]');
  console.error(`Timestamp:    ${new Date().toISOString()}`);
  console.error(`Request:      ${req.method} ${req.originalUrl}`);
  console.error(`IP:           ${req.ip}`);
  console.error(`Params:       `, JSON.stringify(req.params || {}));
  console.error(`Query:        `, JSON.stringify(req.query || {}));
  console.error(`Body Fields:  `, Object.keys(req.body || {}));
  console.error(`Error Code:   ${err.code || 'N/A'}`);
  console.error(`Error Msg:    ${err.message}`);
  if (err.stack) {
    console.error(`Stack Trace:\n${err.stack}`);
  }
  console.error('================================================');

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
