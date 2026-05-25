const { verifyAccessToken } = require('../config/jwt');
const { errorResponse } = require('../utils/response');

/**
 * Authenticate JWT access token from Authorization header
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse(res, 'Authentication required. No token provided.', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded; // { id, role, email }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return errorResponse(res, 'Access token expired. Please refresh.', 401);
    }
    return errorResponse(res, 'Invalid access token.', 401);
  }
}

/**
 * Authorize specific roles
 * @param {...string} roles - Allowed roles: 'student', 'staff', 'admin'
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required.', 401);
    }
    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 'You do not have permission to access this resource.', 403);
    }
    next();
  };
}

module.exports = { authenticate, authorize };
