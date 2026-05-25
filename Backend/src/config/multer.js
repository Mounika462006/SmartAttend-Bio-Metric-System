const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB

function createStorage(subfolder) {
  return multer.diskStorage({
    destination(req, file, cb) {
      const dest = path.join(__dirname, '../uploads', subfolder);
      fs.mkdirSync(dest, { recursive: true });
      cb(null, dest);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${ext}`);
    },
  });
}

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
  storage: createStorage('biometrics'),
  limits: { fileSize: MAX_SIZE },
  fileFilter: biometricFilter,
});

const leaveUpload = multer({
  storage: createStorage('leaves'),
  limits: { fileSize: MAX_SIZE },
  fileFilter: leaveFilter,
});

module.exports = { biometricUpload, leaveUpload };
