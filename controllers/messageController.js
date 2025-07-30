const User = require('../models/User')
const Message = require('../models/Message')
const { v4: uuidv4 } = require('uuid')

exports.sendMessage = async (req, res) => {
    const { recipient, subject, body } = req.body
    const senderEmail = req.session.user.email
    const senderName = req.session.user.name
    const senderRole = req.session.user.role

    const users = await User.find({}) // Get all users from MongoDB to validate recipient

    if (senderRole === 'teacher' && recipient !== 'admin') {
        return res.status(403).json({ message: 'Teachers send only to admin.' })
    }
    if (senderRole === 'admin' && recipient === 'admin') {
        return res.status(400).json({ message: 'Admin cant send to self.' })
    }
    if (recipient !== 'admin') {
        const recipientUser = users.find(u => u.email === recipient)
        if (!recipientUser) {
            return res.status(400).json({ message: 'Recipient email bad.' })
        }
    }

    if (!recipient || !subject || !body) {
        return res.status(400).json({ message: 'All message fields needed.' })
    }

    try {
        // Create a new Message document and save it to MongoDB
        const newMessage = await Message.create({
            id: uuidv4(),
            senderEmail,
            senderName,
            senderRole,
            recipient,
            subject,
            body,
            timestamp: new Date().toISOString(),
            read: false
        })

        res.status(200).json({ message: 'Message sent.', message: newMessage })
    } catch (error) {
        console.error('Sending message error:', error)
        res.status(500).json({ message: 'Error sending message.' })
    }
}

exports.getMessages = async (req, res) => {
    const currentUserEmail = req.session.user.email
    const currentUserRole = req.session.user.role

    try {
        const allMessages = await Message.find({}) // Get all messages from MongoDB
        let userMessages = []

        if (currentUserRole === 'admin') {
            userMessages = allMessages.filter(msg =>
                msg.recipient === 'admin' || msg.senderRole === 'teacher' || (msg.recipient === currentUserEmail && msg.senderRole === 'admin')
            )
        } else if (currentUserRole === 'teacher') {
            userMessages = allMessages.filter(msg =>
                (msg.recipient === currentUserEmail && msg.senderRole === 'admin') ||
                (msg.senderEmail === currentUserEmail && msg.recipient === 'admin')
            )
        } else {
            return res.status(403).json({ message: 'Bad user role.' })
        }

        userMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

        res.status(200).json(userMessages)
    } catch (error) {
        console.error('Fetching messages error:', error)
        res.status(500).json({ message: 'Error fetching messages.' })
    }
}

exports.markMessageAsRead = async (req, res) => {
    const messageId = req.params.id
    const currentUserEmail = req.session.user.email
    const currentUserRole = req.session.user.role

    try {
        // Find the message by its custom 'id' field, and update its 'read' status
        const updatedMessage = await Message.findOneAndUpdate(
            { id: messageId },
            { read: true },
            { new: true } // Return the updated document
        )

        if (!updatedMessage) {
            return res.status(404).json({ message: 'Message not found.' })
        }

        const messageToUpdate = updatedMessage // Use the updated document returned by findOneAndUpdate

        const isRecipient = messageToUpdate.recipient === currentUserEmail
        const isAdminForAdminMessage = (currentUserRole === 'admin' && messageToUpdate.recipient === 'admin')

        if (isRecipient || isAdminForAdminMessage) {
            return res.status(200).json({ message: 'Message read.', updatedMessage: messageToUpdate })
        } else {
            return res.status(403).json({ message: 'Not authorized to read.' })
        }
    } catch (error) {
        console.error('Marking read error:', error)
        res.status(500).json({ message: 'Error marking read.' })
    }
}