const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

function removeUploadedFile(fileUrl) {
  if (!fileUrl || !fileUrl.startsWith('/uploads/biometrics/')) return;
  const filename = path.basename(fileUrl);
  const filePath = path.join(__dirname, '../uploads/biometrics', filename);
  fs.promises.unlink(filePath).catch(() => {});
}

/**
 * Register biometric face data
 * POST /api/biometric/register
 */
async function registerBiometric(req, res, next) {
  try {
    const studentId = req.user.id;
    const { face_descriptor, similarity_score } = req.body;

    // Validate files
    const files = req.files;
    if (!files || !files.face_image || !files.validation_image) {
      return errorResponse(res, 'Both face images are required for biometric registration.', 400);
    }

    // Validate face descriptor
    let descriptor;
    try {
      descriptor = typeof face_descriptor === 'string' ? JSON.parse(face_descriptor) : face_descriptor;
      if (!Array.isArray(descriptor) || descriptor.length !== 128) {
        throw new Error('Invalid descriptor');
      }
    } catch {
      return errorResponse(res, 'Invalid face descriptor data. Please retry registration.', 400);
    }

    const similarityScore = parseFloat(similarity_score) || 0;
    const REGISTRATION_THRESHOLD = 70;

    if (similarityScore < REGISTRATION_THRESHOLD) {
      return errorResponse(
        res,
        `Face similarity too low (${similarityScore.toFixed(1)}%). Both images must belong to the same person. Please retake photos.`,
        400
      );
    }

    const faceImageUrl = `/uploads/biometrics/${files.face_image[0].filename}`;
    const validationImageUrl = `/uploads/biometrics/${files.validation_image[0].filename}`;

    // Check for existing biometric entry
    const [existing] = await db.query('SELECT id FROM biometric_data WHERE student_id = ?', [studentId]);

    if (existing.length > 0) {
      await db.query(
        `UPDATE biometric_data
         SET face_descriptor = ?, face_image_url = ?, validation_image_url = ?,
             similarity_score = ?, registered_at = NOW()
         WHERE student_id = ?`,
        [JSON.stringify(descriptor), faceImageUrl, validationImageUrl, similarityScore, studentId]
      );
    } else {
      await db.query(
        `INSERT INTO biometric_data (student_id, face_descriptor, face_image_url, validation_image_url, similarity_score)
         VALUES (?, ?, ?, ?, ?)`,
        [studentId, JSON.stringify(descriptor), faceImageUrl, validationImageUrl, similarityScore]
      );
    }

    // Mark student as biometric registered
    await db.query('UPDATE students SET biometric_registered = TRUE WHERE id = ?', [studentId]);

    return successResponse(res, { biometric_registered: true }, 'Biometric registration completed successfully.');
  } catch (err) {
    next(err);
  }
}

/**
 * Get biometric descriptor for verification (used in attendance marking)
 * GET /api/biometric/descriptor
 */
async function getBiometricDescriptor(req, res, next) {
  try {
    const studentId = req.user.id;

    const [rows] = await db.query(
      'SELECT face_descriptor, face_image_url FROM biometric_data WHERE student_id = ?',
      [studentId]
    );

    if (!rows.length) {
      return errorResponse(res, 'No biometric data found. Please complete face registration.', 404);
    }

    return successResponse(res, {
      face_descriptor: typeof rows[0].face_descriptor === 'string'
        ? JSON.parse(rows[0].face_descriptor)
        : rows[0].face_descriptor,
      face_image_url: rows[0].face_image_url,
    }, 'Biometric data fetched.');
  } catch (err) {
    next(err);
  }
}

/**
 * Get biometric status for student
 * GET /api/biometric/status
 */
async function getBiometricStatus(req, res, next) {
  try {
    const studentId = req.user.id;

    const [rows] = await db.query(
      'SELECT biometric_registered FROM students WHERE id = ?',
      [studentId]
    );

    return successResponse(res, {
      biometric_registered: !!rows[0]?.biometric_registered,
    }, 'Biometric status fetched.');
  } catch (err) {
    next(err);
  }
}

/**
 * Delete a student's biometric data (admin only)
 * DELETE /api/biometric/students/:studentId
 */
async function deleteStudentBiometric(req, res, next) {
  try {
    const { studentId } = req.params;

    const [students] = await db.query('SELECT id, name FROM students WHERE id = ?', [studentId]);
    if (!students.length) {
      return errorResponse(res, 'Student not found.', 404);
    }

    const [biometrics] = await db.query(
      'SELECT face_image_url, validation_image_url FROM biometric_data WHERE student_id = ?',
      [studentId]
    );

    if (!biometrics.length) {
      await db.query('UPDATE students SET biometric_registered = 0 WHERE id = ?', [studentId]);
      return successResponse(res, null, 'No biometric data found. Student status reset.');
    }

    await db.query('DELETE FROM biometric_data WHERE student_id = ?', [studentId]);
    await db.query('UPDATE students SET biometric_registered = 0 WHERE id = ?', [studentId]);

    removeUploadedFile(biometrics[0].face_image_url);
    removeUploadedFile(biometrics[0].validation_image_url);

    return successResponse(res, null, 'Biometric data deleted successfully.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerBiometric,
  getBiometricDescriptor,
  getBiometricStatus,
  deleteStudentBiometric,
};
