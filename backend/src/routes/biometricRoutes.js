const express = require('express');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { biometricUpload } = require('../config/multer');
const {
  registerBiometric,
  getBiometricDescriptor,
  getBiometricStatus,
  deleteStudentBiometric,
} = require('../controllers/biometricController');

const router = express.Router();

router.use(authenticate);

router.delete('/students/:studentId', authorize('admin'), deleteStudentBiometric);

router.use(authorize('student'));

router.post(
  '/register',
  biometricUpload.fields([
    { name: 'face_image', maxCount: 1 },
    { name: 'validation_image', maxCount: 1 },
  ]),
  registerBiometric
);

router.get('/descriptor', getBiometricDescriptor);
router.get('/status', getBiometricStatus);

module.exports = router;
