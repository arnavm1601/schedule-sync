const express = require('express')
const router = express.Router()
const adminController = require('../controllers/adminController')
const { checkAuth, checkRole } = require('../middleware/authMiddleware')

router.use(checkAuth)
router.use(checkRole('admin'))

router.get('/', adminController.getAdminDashboard)
router.post('/api/lectures', adminController.addUpdateLecture)
router.delete('/api/lectures/:teacherEmail/:day/:lectureId', adminController.deleteLecture)
router.get('/api/adjustments/pending', adminController.getPendingAdjustments)
router.post('/api/adjustments/update', adminController.updateAdjustment)

module.exports = router