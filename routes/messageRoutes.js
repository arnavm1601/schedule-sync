const express = require('express')
const router = express.Router()
const messageController = require('../controllers/messageController')
const { checkAuth } = require('../middleware/authMiddleware')

router.use(checkAuth)

router.post('/', messageController.sendMessage)
router.get('/', messageController.getMessages)
router.put('/:id/read', messageController.markMessageAsRead)

module.exports = router
