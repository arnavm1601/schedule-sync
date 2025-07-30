const User = require('../models/User')
const Timetable = require('../models/Timetable')
const { v4: uuidv4 } = require('uuid')
const fs = require('fs')
const path = require('path')

const uploadsDir = path.join(__dirname, '../public/uploads')

exports.getSignupPage = (req, res) => {
    if (req.session.user) {
        return res.redirect(req.session.user.role === 'admin' ? '/admin' : '/timetable')
    }
    res.render('signup')
}

exports.signupUser = async (req, res) => {
    const { name, email, password, role } = req.body
    const profilePic = req.file ? req.file.filename : null

    if (!profilePic) {
        return res.send('Profile picture is required.')
    }

    try {
        const existingUser = await User.findOne({ email: email })

        if (existingUser) {
            fs.unlink(path.join(uploadsDir, profilePic), (err) => {
                if (err) console.error('Error deleting pic:', err)
            })
            return res.send('Email already registered.')
        }

        // STORE PLAIN TEXT PASSWORD - THIS IS INSECURE
        const newUser = await User.create({
            id: uuidv4(),
            name,
            email,
            password: password, // Storing plain text password
            role,
            profilePic
        })

        if (role === 'teacher') {
            function getDefaultTimetableStructure() {
                const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
                const defaultTimetable = {}
                days.forEach(day => {
                    defaultTimetable[day] = Array(7).fill(null)
                })
                return defaultTimetable
            }
            await Timetable.create({
                userEmail: email,
                timetable: getDefaultTimetableStructure()
            })
        }

        res.redirect('/login')
    } catch (error) {
        console.error('Signup error:', error)
        if (profilePic) {
            fs.unlink(path.join(uploadsDir, profilePic), (err) => {
                if (err) console.error('Error deleting pic:', err)
            })
        }
        res.status(500).send('Error registering user.')
    }
}

exports.getLoginPage = (req, res) => {
    if (req.session.user) {
        return res.redirect(req.session.user.role === 'admin' ? '/admin' : '/timetable')
    }
    res.render('login')
}

exports.loginUser = async (req, res) => {
    const { email, password } = req.body
    try {
        const user = await User.findOne({ email: email })

        if (!user) {
            return res.send('Wrong email or password.')
        }

        // COMPARE PLAIN TEXT PASSWORDS - THIS IS INSECURE
        const passwordMatch = (password === user.password)

        if (!passwordMatch) {
            return res.send('Wrong email or password.')
        }

        req.session.user = user
        res.redirect(user.role === 'admin' ? '/admin' : '/timetable')
    } catch (error) {
        console.error('Login error:', error)
        res.status(500).send('Error logging in.')
    }
}

exports.logoutUser = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err)
            return res.send('Error logging out.')
        }
        res.clearCookie('connect.sid')
        res.redirect('/login')
    })
}