const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { leaveUpload } = require('../config/multer');
const { getAllLeaves, getMyLeaves, applyLeave, reviewLeave } = require('../controllers/leaveController');

const router = express.Router();

router.use(authenticate);

router.get('/my', authorize('student'), getMyLeaves);
router.post('/apply', authorize('student'), leaveUpload.single('attachment'), applyLeave);
router.get('/all', authorize('staff', 'admin'), getAllLeaves);
router.patch('/:id/review', authorize('staff', 'admin'), reviewLeave);

module.exports = router;
