const mongoose = require('mongoose')

const lectureSchema = new mongoose.Schema({
    id: {
        type: String,
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
    }
}, { _id: false }) // Don't create default _id for subdocuments unless explicitly needed

const timetableSchema = new mongoose.Schema({
    userEmail: { // This links to the teacher's email
        type: String,
        required: true,
        unique: true
    },
    timetable: {
        monday: [lectureSchema],
        tuesday: [lectureSchema],
        wednesday: [lectureSchema],
        thursday: [lectureSchema],
        friday: [lectureSchema],
        saturday: [lectureSchema]
    }
})

module.exports = mongoose.model('Timetable', timetableSchema)