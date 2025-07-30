const User = require('../models/User')
const Timetable = require('../models/Timetable')
const Adjustment = require('../models/Adjustment')
const { v4: uuidv4 } = require('uuid')

exports.getAdminDashboard = async (req, res) => {
    try {
        const teachers = await User.find({ role: 'teacher' }) // Get all teachers from MongoDB
        const allTimetablesArr = await Timetable.find({}) // Get all timetables from MongoDB

        const allTimetables = allTimetablesArr.reduce((acc, curr) => {
            acc[curr.userEmail] = curr.timetable
            return acc
        }, {})

        const adjustments = await Adjustment.find({}) // Get all adjustments from MongoDB

        // Helper for default timetable structure, moved here for simplicity as a beginner might do
        function getDefaultTimetableStructure() {
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
            const defaultTimetable = {}
            days.forEach(day => {
                defaultTimetable[day] = Array(7).fill(null)
            })
            return defaultTimetable
        }


        res.render('admin', {
            user: req.session.user,
            teachers: teachers,
            allTimetables: allTimetables,
            timetable: getDefaultTimetableStructure(),
            adjustments: adjustments,
        })
    } catch (error) {
        console.error('Admin dashboard error:', error)
        res.status(500).send('Error loading admin dashboard.')
    }
}

exports.addUpdateLecture = async (req, res) => {
    const { teacherEmail, day, periodIndex, subject, room, startTime, endTime, lectureId } = req.body

    if (!teacherEmail || !day || periodIndex === undefined || !subject || !room || !startTime || !endTime) {
        return res.status(400).json({ message: 'Missing fields.' })
    }

    if (periodIndex < 0 || periodIndex >= 7) {
        return res.status(400).json({ message: 'Invalid period index.' })
    }

    try {
        const timetableDoc = await Timetable.findOne({ userEmail: teacherEmail }) // Find teacher's timetable document

        if (!timetableDoc) {
            return res.status(404).json({ message: 'Teacher not found.' })
        }

        const newLecture = {
            id: lectureId || uuidv4(),
            subject,
            room,
            startTime,
            endTime
        }

        // Update the specific lecture slot in the Mongoose document
        // Ensure the day array exists for safety, though schema should enforce
        if (!timetableDoc.timetable[day]) {
            timetableDoc.timetable[day] = Array(7).fill(null)
        }
        timetableDoc.timetable[day][periodIndex] = newLecture

        await timetableDoc.save() // Save the updated timetable document to MongoDB

        res.status(200).json({ message: 'Lecture saved.', lecture: newLecture })
    } catch (error) {
        console.error('Saving lecture error:', error)
        res.status(500).json({ message: 'Error saving lecture.' })
    }
}

exports.deleteLecture = async (req, res) => {
    const { teacherEmail, day, lectureId } = req.params

    try {
        const timetableDoc = await Timetable.findOne({ userEmail: teacherEmail }) // Find teacher's timetable document

        if (!timetableDoc) {
            return res.status(404).json({ message: 'Teacher not found.' })
        }

        const dayLectures = timetableDoc.timetable[day]

        if (!dayLectures) {
            return res.status(404).json({ message: 'Day not found.' })
        }

        let found = false
        for (let i = 0; i < dayLectures.length; i++) {
            if (dayLectures[i] && dayLectures[i].id === lectureId) {
                dayLectures[i] = null
                found = true
                break
            }
        }

        if (!found) {
            return res.status(404).json({ message: 'Lecture not found.' })
        }

        await timetableDoc.save() // Save the modified timetable document to MongoDB
        res.status(200).json({ message: 'Lecture deleted.' })
    } catch (error) {
        console.error('Deleting lecture error:', error)
        res.status(500).json({ message: 'Error deleting lecture.' })
    }
}

exports.getPendingAdjustments = async (req, res) => {
    try {
        const pendingAdjustments = await Adjustment.find({ status: 'Pending Admin Action' }) // Find pending adjustments
        res.status(200).json(pendingAdjustments)
    } catch (error) {
        console.error('Fetching adjustments error:', error)
        res.status(500).json({ message: 'Error fetching adjustments.' })
    }
}

exports.updateAdjustment = async (req, res) => {
    const { adjustmentId, status, substituteTeacher } = req.body

    if (!adjustmentId || !status) {
        return res.status(400).json({ message: 'Missing ID or status.' })
    }

    try {
        // Find by id and update the document directly
        const updatedAdjustment = await Adjustment.findOneAndUpdate(
            { id: adjustmentId }, // Use 'id' field as it's your custom unique ID
            { status: status, substituteTeacher: substituteTeacher, updatedAt: new Date().toISOString() },
            { new: true } // Return the updated document
        )

        if (!updatedAdjustment) {
            return res.status(404).json({ message: 'Adjustment not found.' })
        }

        res.status(200).json({ message: 'Adjustment updated.', adjustment: updatedAdjustment })
    } catch (error) {
        console.error('Updating adjustment error:', error)
        res.status(500).json({ message: 'Error updating adjustment.' })
    }
}