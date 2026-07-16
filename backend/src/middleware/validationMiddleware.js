const { validationResult } = require('express-validator');
const { errorResponse } = require('../utils/response');

/**
 * Validate express-validator results and return 422 if errors found
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return errorResponse(
      res,
      'Validation failed. Please check the provided data.',
      422,
      errors.array().map(e => ({ field: e.path, message: e.msg }))
    );
  }
  next();
}

module.exports = { validate };
