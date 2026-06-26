const multer = require('multer');

const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB

// Use memory storage for Serverless / Vercel compatibility
const storage = multer.memoryStorage();

const biometricFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed for biometric data.'), false);
  }
};

const leaveFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and PDF files are allowed for leave attachments.'), false);
  }
};

const biometricUpload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: biometricFilter,
});

const leaveUpload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: leaveFilter,
});

module.exports = { biometricUpload, leaveUpload };
