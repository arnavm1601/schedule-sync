const express = require('express')
const router = express.Router()
const authController = require('../controllers/authController')
const upload = require('../middleware/multerMiddleware')

router.get('/', authController.getSignupPage)
router.post('/signup', upload.single('profilePic'), authController.signupUser)
router.get('/login', authController.getLoginPage)
router.post('/login', authController.loginUser)
router.get('/logout', authController.logoutUser)

module.exports = router