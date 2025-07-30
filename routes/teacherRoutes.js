const express = require('express')
const router = express.Router()
const teacherController = require('../controllers/teacherController')
const { checkAuth, checkRole } = require('../middleware/authMiddleware')

router.use(checkAuth)
router.use(checkRole('teacher'))

router.get('/', teacherController.getTeacherTimetable)
router.post('/api/leave-request', teacherController.submitLeaveRequest)

module.exports = router