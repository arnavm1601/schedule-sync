const Timetable = require('../models/Timetable')
const Adjustment = require('../models/Adjustment')
const { v4: uuidv4 } = require('uuid')

exports.getTeacherTimetable = async (req, res) => {
    const teacherEmail = req.session.user.email
    try {
        const timetableEntry = await Timetable.findOne({ userEmail: teacherEmail }) // Find timetable from MongoDB

        // Helper for default timetable structure, can be internal or in a utils file
        function getDefaultTimetableStructure() {
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
            const defaultTimetable = {}
            days.forEach(day => {
                defaultTimetable[day] = Array(7).fill(null)
            })
            return defaultTimetable
        }

        const teacherTimetable = timetableEntry ? timetableEntry.timetable : getDefaultTimetableStructure()

        res.render('timetable', {
            user: req.session.user,
            timetable: teacherTimetable,
        })
    } catch (error) {
        console.error('Teacher timetable error:', error)
        res.status(500).send('Error loading timetable.')
    }
}

exports.submitLeaveRequest = async (req, res) => {
    const { leaveDate, reason } = req.body
    const teacherEmail = req.session.user.email
    const teacherName = req.session.user.name

    if (!leaveDate || !reason) {
        return res.status(400).json({ message: 'Date and reason needed.' })
    }

    try {
        const teacherTimetableEntry = await Timetable.findOne({ userEmail: teacherEmail }) // Find teacher's timetable

        if (!teacherTimetableEntry) {
            return res.status(404).json({ message: 'Timetable not found.' })
        }

        const leaveDay = new Date(leaveDate)
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        const leaveDayOfWeek = daysOfWeek[leaveDay.getDay()]

        const lecturesOnLeaveDay = []
        if (teacherTimetableEntry.timetable[leaveDayOfWeek]) {
            teacherTimetableEntry.timetable[leaveDayOfWeek].forEach((lecture, index) => {
                if (lecture && lecture.subject !== "Short Break" && lecture.subject !== "Lunch Break") {
                    lecturesOnLeaveDay.push({
                        periodIndex: index,
                        subject: lecture.subject,
                        room: lecture.room,
                        startTime: lecture.startTime,
                        endTime: lecture.endTime,
                        id: lecture.id
                    })
                }
            })
        }

        // Create new Adjustment document and save to MongoDB
        await Adjustment.create({
            id: uuidv4(),
            teacherEmail,
            teacherName,
            leaveDate,
            reason,
            lectures: lecturesOnLeaveDay,
            status: 'Pending Admin Action',
            substituteTeacher: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })

        res.status(200).json({ message: 'Leave request submitted.' })
    } catch (error) {
        console.error('Submitting leave error:', error)
        res.status(500).json({ message: 'Error submitting leave.' })
    }
}