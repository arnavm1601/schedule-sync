const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

// --- File Paths for Data Storage ---
const dataDir = path.join(__dirname, 'data');
const usersFilePath = path.join(dataDir, 'users.json');
const timetablesFilePath = path.join(dataDir, 'timetables.json');
const adjustmentsFilePath = path.join(dataDir, 'adjustments.json');
const messagesFilePath = path.join(dataDir, 'messages.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Initialize data files if they don't exist
const initializeFile = (filePath, defaultContent) => {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2));
    }
};

initializeFile(usersFilePath, []);
initializeFile(timetablesFilePath, []);
initializeFile(adjustmentsFilePath, []);
initializeFile(messagesFilePath, []);

// --- Helper Functions for File Operations ---

async function readJsonFile(filePath) {
    try {
        const data = await fs.promises.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return []; // File not found, return empty array
        }
        console.error(`Error reading ${filePath}:`, error);
        throw error;
    }
}

async function writeJsonFile(filePath, data) {
    try {
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Error writing to ${filePath}:`, error);
        throw error;
    }
}

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.use(session({
    secret: 'fdshjk7394i',
    resave: false,
    saveUninitialized: true
}));

// Multer storage for profile pictures
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });


// Helper to get a default empty timetable for a new teacher (7 periods)
function getDefaultTimetableStructure() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const defaultTimetable = {};
    days.forEach(day => {
        defaultTimetable[day] = Array(7).fill(null); // 7 periods
    });
    return defaultTimetable;
}

// --- Routes ---

app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect(req.session.user.role === 'admin' ? '/admin' : '/timetable');
    }
    res.render('signup');
});

app.post('/signup', upload.single('profilePic'), async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!req.file) {
        return res.send('Profile picture is required.');
    }
    const profilePic = req.file.filename;

    try {
        const users = await readJsonFile(usersFilePath);
        const existingUser = users.find(user => user.email === email);
        if (existingUser) {
            // Clean up uploaded file if user already exists
            fs.unlink(path.join(uploadsDir, profilePic), (err) => {
                if (err) console.error('Error deleting redundant profile pic:', err);
            });
            return res.send('Email already registered, please use a new email.');
        }

        const newUser = { id: uuidv4(), name, email, password, role, profilePic };
        users.push(newUser);
        await writeJsonFile(usersFilePath, users);

        if (role === 'teacher') {
            const timetables = await readJsonFile(timetablesFilePath);
            const newTimetable = {
                userEmail: email,
                timetable: getDefaultTimetableStructure()
            };
            timetables.push(newTimetable);
            await writeJsonFile(timetablesFilePath, timetables);
        }
        res.redirect('/login');
    } catch (error) {
        console.error('Error during signup:', error);
        // Clean up uploaded file on database error
        fs.unlink(path.join(uploadsDir, profilePic), (err) => {
            if (err) console.error('Error deleting profile pic on signup error:', err);
        });
        res.status(500).send('Error registering user.');
    }
});

app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect(req.session.user.role === 'admin' ? '/admin' : '/timetable');
    }
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const users = await readJsonFile(usersFilePath);
        const user = users.find(u => u.email === email && u.password === password);
        if (!user) {
            return res.send('Wrong email or password, please try again.');
        }
        req.session.user = user;
        res.redirect(user.role === 'admin' ? '/admin' : '/timetable');
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Error logging in.');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.send('Error logging out.');
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

// --- Admin Routes ---
app.get('/admin', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }
    try {
        const users = await readJsonFile(usersFilePath);
        const teachers = users.filter(user => user.role === 'teacher');
        const allTimetablesArr = await readJsonFile(timetablesFilePath);
        // Convert array to object for easier lookup in EJS
        const allTimetables = allTimetablesArr.reduce((acc, curr) => {
            acc[curr.userEmail] = curr.timetable;
            return acc;
        }, {});

        const adjustments = await readJsonFile(adjustmentsFilePath); // Fetch all adjustments for admin

        res.render('admin', {
            user: req.session.user,
            teachers: teachers,
            allTimetables: allTimetables,
            timetable: getDefaultTimetableStructure(), // Default empty timetable for display
            adjustments: adjustments,
        });
    } catch (error) {
        console.error('Error rendering admin dashboard:', error);
        res.status(500).send('Error loading admin dashboard.');
    }
});

// ADMIN API: Add/Update a single lecture for a teacher
app.post('/api/lectures', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const { teacherEmail, day, periodIndex, subject, room, startTime, endTime, lectureId } = req.body;

    if (!teacherEmail || !day || periodIndex === undefined || !subject || !room || !startTime || !endTime) {
        return res.status(400).json({ message: 'Missing required lecture fields.' });
    }

    // Validate periodIndex (0 to 6 for 7 periods)
    if (periodIndex < 0 || periodIndex >= 7) {
        return res.status(400).json({ message: 'Invalid period index.' });
    }

    try {
        const timetables = await readJsonFile(timetablesFilePath);
        const timetableIndex = timetables.findIndex(t => t.userEmail === teacherEmail);

        if (timetableIndex === -1) {
            return res.status(404).json({ message: 'Teacher timetable not found.' });
        }

        const currentTimetable = timetables[timetableIndex].timetable;

        const newLecture = {
            id: lectureId || uuidv4(),
            subject,
            room,
            startTime,
            endTime
        };

        // Update the specific lecture slot
        currentTimetable[day][periodIndex] = newLecture;

        await writeJsonFile(timetablesFilePath, timetables);

        res.status(200).json({ message: 'Lecture saved successfully', lecture: newLecture });
    } catch (error) {
        console.error('Error saving lecture:', error);
        res.status(500).json({ message: 'Error saving lecture.' });
    }
});

// ADMIN API: Delete a single lecture for a teacher
app.delete('/api/lectures/:teacherEmail/:day/:lectureId', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const { teacherEmail, day, lectureId } = req.params;

    try {
        const timetables = await readJsonFile(timetablesFilePath);
        const timetableIndex = timetables.findIndex(t => t.userEmail === teacherEmail);

        if (timetableIndex === -1) {
            return res.status(404).json({ message: 'Teacher timetable not found.' });
        }

        const currentTimetable = timetables[timetableIndex].timetable;
        const dayLectures = currentTimetable[day];

        if (!dayLectures) {
            return res.status(404).json({ message: 'Day not found in timetable.' });
        }

        let found = false;
        for (let i = 0; i < dayLectures.length; i++) {
            if (dayLectures[i] && dayLectures[i].id === lectureId) {
                dayLectures[i] = null; // Set the slot to null
                found = true;
                break;
            }
        }

        if (!found) {
            return res.status(404).json({ message: 'Lecture not found.' });
        }

        await writeJsonFile(timetablesFilePath, timetables);
        res.status(200).json({ message: 'Lecture deleted successfully.' });
    } catch (error) {
        console.error('Error deleting lecture:', error);
        res.status(500).json({ message: 'Error deleting lecture.' });
    }
});


// Teacher Leave Request API
app.post('/api/leave-request', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'teacher') {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const { leaveDate, reason } = req.body;
    const teacherEmail = req.session.user.email;
    const teacherName = req.session.user.name;

    if (!leaveDate || !reason) {
        return res.status(400).json({ message: 'Leave date and reason are required.' });
    }

    try {
        const timetables = await readJsonFile(timetablesFilePath);
        const teacherTimetableEntry = timetables.find(t => t.userEmail === teacherEmail);

        if (!teacherTimetableEntry) {
            return res.status(404).json({ message: 'Teacher timetable not found.' });
        }

        const leaveDay = new Date(leaveDate);
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const leaveDayOfWeek = daysOfWeek[leaveDay.getDay()];

        const lecturesOnLeaveDay = [];
        if (teacherTimetableEntry.timetable[leaveDayOfWeek]) {
            teacherTimetableEntry.timetable[leaveDayOfWeek].forEach((lecture, index) => {
                if (lecture && lecture.subject !== "Short Break" && lecture.subject !== "Lunch Break") {
                    lecturesOnLeaveDay.push({
                        periodIndex: index,
                        subject: lecture.subject,
                        room: lecture.room,
                        startTime: lecture.startTime,
                        endTime: lecture.endTime,
                        id: lecture.id // Include lecture ID
                    });
                }
            });
        }

        const adjustments = await readJsonFile(adjustmentsFilePath);
        const newAdjustmentRequest = {
            id: uuidv4(),
            teacherEmail,
            teacherName,
            leaveDate,
            reason,
            lectures: lecturesOnLeaveDay,
            status: 'Pending Admin Action',
            substituteTeacher: null,
            createdAt: new Date().toISOString(), // Store as ISO string
            updatedAt: new Date().toISOString()
        };
        adjustments.push(newAdjustmentRequest);
        await writeJsonFile(adjustmentsFilePath, adjustments);

        res.status(200).json({ message: 'Leave request submitted and adjustments created.', adjustment: newAdjustmentRequest });
    } catch (error) {
        console.error('Error submitting leave request:', error);
        res.status(500).json({ message: 'Error submitting leave request.' });
    }
});

// Admin API: Fetch pending adjustment requests
app.get('/api/adjustments/pending', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    try {
        const adjustments = await readJsonFile(adjustmentsFilePath);
        const pendingAdjustments = adjustments.filter(adj => adj.status === 'Pending Admin Action');
        res.status(200).json(pendingAdjustments);
    } catch (error) {
        console.error('Error fetching pending adjustments:', error);
        res.status(500).json({ message: 'Error fetching adjustments.' });
    }
});

// Admin API: Update an adjustment request (assign substitute / mark resolved)
app.post('/api/adjustments/update', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const { adjustmentId, status, substituteTeacher } = req.body;

    if (!adjustmentId || !status) {
        return res.status(400).json({ message: 'Adjustment ID and status are required.' });
    }

    try {
        const adjustments = await readJsonFile(adjustmentsFilePath);
        const adjustmentIndex = adjustments.findIndex(adj => adj.id === adjustmentId);

        if (adjustmentIndex === -1) {
            return res.status(404).json({ message: 'Adjustment request not found.' });
        }

        const updatedAdjustment = {
            ...adjustments[adjustmentIndex],
            status: status,
            substituteTeacher: substituteTeacher || null,
            updatedAt: new Date().toISOString()
        };
        adjustments[adjustmentIndex] = updatedAdjustment;
        await writeJsonFile(adjustmentsFilePath, adjustments);

        res.status(200).json({ message: 'Adjustment request updated successfully.', adjustment: updatedAdjustment });
    } catch (error) {
        console.error('Error updating adjustment:', error);
        res.status(500).json({ message: 'Error updating adjustment.' });
    }
});

// API: Send a message
app.post('/api/messages', async (req, res) => {
    if (!req.session.user) {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const { recipient, subject, body } = req.body;
    const senderEmail = req.session.user.email;
    const senderName = req.session.user.name;
    const senderRole = req.session.user.role;

    const users = await readJsonFile(usersFilePath);

    // Validate recipient based on sender role
    if (senderRole === 'teacher' && recipient !== 'admin') {
        return res.status(403).json({ message: 'Teachers can only send messages to the admin.' });
    }
    if (senderRole === 'admin' && recipient === 'admin') {
        return res.status(400).json({ message: 'Admin cannot send messages to themselves as "admin". Select a specific teacher.' });
    }
    if (recipient !== 'admin') {
        const recipientUser = users.find(u => u.email === recipient);
        if (!recipientUser) {
            return res.status(400).json({ message: 'Invalid recipient email.' });
        }
    }

    if (!recipient || !subject || !body) {
        return res.status(400).json({ message: 'Recipient, subject, and body are required.' });
    }

    try {
        const messages = await readJsonFile(messagesFilePath);
        const newMessage = {
            id: uuidv4(),
            senderEmail,
            senderName,
            senderRole,
            recipient,
            subject,
            body,
            timestamp: new Date().toISOString(),
            read: false
        };
        messages.push(newMessage);
        await writeJsonFile(messagesFilePath, messages);
        res.status(200).json({ message: 'Message sent successfully.', message: newMessage });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Error sending message.' });
    }
});

// API: Get messages for the current user
app.get('/api/messages', async (req, res) => {
    if (!req.session.user) {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const currentUserEmail = req.session.user.email;
    const currentUserRole = req.session.user.role;

    try {
        const allMessages = await readJsonFile(messagesFilePath);
        let userMessages = [];

        if (currentUserRole === 'admin') {
            userMessages = allMessages.filter(msg =>
                msg.recipient === 'admin' || msg.senderRole === 'teacher'
            );
        } else if (currentUserRole === 'teacher') {
            userMessages = allMessages.filter(msg =>
                (msg.recipient === currentUserEmail && msg.senderRole === 'admin') ||
                (msg.senderEmail === currentUserEmail && msg.recipient === 'admin')
            );
        } else {
            return res.status(403).json({ message: 'Invalid user role.' });
        }
        
        // Sort by timestamp descending
        userMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.status(200).json(userMessages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Error fetching messages.' });
    }
});

// API: Mark message as read
app.put('/api/messages/:id/read', async (req, res) => {
    if (!req.session.user) {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const messageId = req.params.id;
    const currentUserEmail = req.session.user.email;
    const currentUserRole = req.session.user.role;

    try {
        const messages = await readJsonFile(messagesFilePath);
        const messageIndex = messages.findIndex(msg => msg.id === messageId);

        if (messageIndex === -1) {
            return res.status(404).json({ message: 'Message not found.' });
        }

        const messageToUpdate = messages[messageIndex];

        // Only allow the recipient to mark as read
        if (messageToUpdate.recipient === currentUserEmail || (currentUserRole === 'admin' && messageToUpdate.recipient === 'admin')) {
            messageToUpdate.read = true;
            messages[messageIndex] = messageToUpdate;
            await writeJsonFile(messagesFilePath, messages);
            return res.status(200).json({ message: 'Message marked as read.', updatedMessage: messageToUpdate });
        } else {
            return res.status(403).json({ message: 'You are not authorized to mark this message as read.' });
        }
    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({ message: 'Error marking message as read.' });
    }
});


// --- Frontend Render Routes ---
app.post('/admin/timetable', (req, res) => {
    // This route will be deprecated or repurposed as lecture updates will happen via API
    // For now, it will just redirect.
    res.redirect('/admin');
});

app.get('/timetable', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'teacher') {
        return res.redirect('/login');
    }
    const teacherEmail = req.session.user.email;
    try {
        const timetables = await readJsonFile(timetablesFilePath);
        const timetableEntry = timetables.find(t => t.userEmail === teacherEmail);
        const teacherTimetable = timetableEntry ? timetableEntry.timetable : getDefaultTimetableStructure();

        res.render('timetable', {
            user: req.session.user,
            timetable: teacherTimetable,
        });
    } catch (error) {
        console.error('Error rendering teacher timetable:', error);
        res.status(500).send('Error loading teacher timetable.');
    }
});


app.listen(PORT, () => {
    console.log(`Server running at port : ${PORT}`);
});