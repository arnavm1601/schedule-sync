const mongoose = require('mongoose')

const affectedLectureSchema = new mongoose.Schema({
    periodIndex: {
        type: Number,
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    room: {
        type: String,
        required: true
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        required: true
    },
    id: {
        type: String,
        required: true
    }
}, { _id: false })

const adjustmentSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    teacherEmail: {
        type: String,
        required: true
    },
    teacherName: {
        type: String,
        required: true
    },
    leaveDate: {
        type: Date, // Store as Date type
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    lectures: [affectedLectureSchema], // Array of affected lectures
    status: {
        type: String,
        enum: ['Pending Admin Action', 'Approved', 'Rejected', 'Resolved'],
        default: 'Pending Admin Action'
    },
    substituteTeacher: {
        type: String, // Stores email of substitute teacher
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model('Adjustment', adjustmentSchema)