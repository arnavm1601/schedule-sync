const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    senderEmail: {
        type: String,
        required: true
    },
    senderName: {
        type: String,
        required: true
    },
    senderRole: {
        type: String,
        enum: ['admin', 'teacher'],
        required: true
    },
    recipient: {
        type: String, // Can be 'admin' or a teacher's email
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    body: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    read: {
        type: Boolean,
        default: false
    }
})

module.exports = mongoose.model('Message', messageSchema)