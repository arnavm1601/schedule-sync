const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid'); // Import UUID generator


const app = express();
const PORT = 3000;
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.use(session({
    secret: 'fdshjk7394i', // Changed secret for security
    resave: false,
    saveUninitialized: true
}));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public/uploads'));
    },
    filename: (req, file, cb) => {
        const Name = Date.now() + path.extname(file.originalname);
        cb(null, Name);
    }
});
const upload = multer({ storage });

const userDataPath = path.join(__dirname, 'data', 'users.json');
const timetablePath = path.join(__dirname, 'data', 'timetable.json');
const adjustmentsPath = path.join(__dirname, 'data', 'adjustments.json'); // New path for adjustments
const messagesPath = path.join(__dirname, 'data', 'messages.json'); // New path for messages

// Helper functions for reading/writing JSON files
function readUsers() {
    try {
        const data = fs.readFileSync(userDataPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading users.json:', error);
        return [];
    }
}
function writeUsers(users) {
    try {
        fs.writeFileSync(userDataPath, JSON.stringify(users, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing users.json:', error);
    }
}

function readAllTimetables() {
    try {
        const data = fs.readFileSync(timetablePath, 'utf8');
        return JSON.parse(data);
    }
    catch (error) {
        console.error('Error reading timetable.json:', error);
        return {};
    }
}
function writeAllTimetables(allTimetables) {
    try {
        fs.writeFileSync(timetablePath, JSON.stringify(allTimetables, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing timetable.json:', error);
    }
}

function readAdjustments() {
    try {
        const data = fs.readFileSync(adjustmentsPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading adjustments.json:', error);
        return [];
    }
}

function writeAdjustments(adjustments) {
    try {
        fs.writeFileSync(adjustmentsPath, JSON.stringify(adjustments, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing adjustments.json:', error);
    }
}

function readMessages() {
    try {
        const data = fs.readFileSync(messagesPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading messages.json:', error);
        return [];
    }
}

function writeMessages(messages) {
    try {
        fs.writeFileSync(messagesPath, JSON.stringify(messages, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing messages.json:', error);
    }
}


// Helper to get a default empty timetable for a new teacher
// Now returns an array of nulls for each period, to store lecture objects
function getDefaultTimetable() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const defaultTimetable = {};
    days.forEach(day => {
        defaultTimetable[day] = Array(8).fill(null); // 8 periods, initially null
    });
    return defaultTimetable;
}

// Helper function to escape string for JavaScript literal (MOVED HERE)
function escapeJsString(str) {
    return str.replace(/\\/g, '\\\\') // Escape backslashes
              .replace(/'/g, '\\\'')  // Escape single quotes
              .replace(/"/g, '\\\"')  // Escape double quotes
              .replace(/\n/g, '\\n')  // Escape newlines
              .replace(/\r/g, '\\r')  // Escape carriage returns
              .replace(/\t/g, '\\t')  // Escape tabs
              .replace(/<\/script>/g, '<\\/script>'); // Escape </script>
}


// --- Routes ---

app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect(req.session.user.role === 'admin' ? '/admin' : '/timetable');
    }
    res.render('signup');
});

app.post('/signup', upload.single('profilePic'), (req, res) => {
    const { name, email, password, role } = req.body;
    if (!req.file) {
        return res.send('Profile picture is required.');
    }
    const profilePic = req.file.filename;
    const users = readUsers();
    if (users.find(u => u.email === email)) {
        return res.send('Email already registered, please use a new email.');
    }
    users.push({ name, email, password, role, profilePic });
    writeUsers(users);

    if (role === 'teacher') {
        const allTimetables = readAllTimetables();
        allTimetables[email] = getDefaultTimetable();
        writeAllTimetables(allTimetables);
    }
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect(req.session.user.role === 'admin' ? '/admin' : '/timetable');
    }
    res.render('login');
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const users = readUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.send('Wrong email or password, please try again.');
    }
    req.session.user = user;
    res.redirect(user.role === 'admin' ? '/admin' : '/timetable');
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
app.get('/admin', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }
    const users = readUsers();
    const teachers = users.filter(u => u.role === 'teacher');
    const allTimetables = readAllTimetables();
    const initialTimetable = getDefaultTimetable(); // Default empty timetable for display
    const adjustments = readAdjustments(); // Fetch adjustments for admin dashboard

    // Filter out non-teacher users from the teachers list for the dropdown
    const availableTeachers = users.filter(u => u.role === 'teacher');

    res.render('admin', {
        user: req.session.user,
        teachers: availableTeachers, // Pass filtered teachers
        allTimetables: allTimetables,
        timetable: initialTimetable, // This will be replaced by client-side logic
        adjustments: adjustments, // Pass adjustments to the admin dashboard
        escapeJsString: escapeJsString // Pass the helper function to the EJS template
    });
});

// ADMIN API: Add/Update a single lecture for a teacher
app.post('/api/lectures', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const { teacherEmail, day, periodIndex, subject, room, startTime, endTime, lectureId } = req.body;

    if (!teacherEmail || !day || periodIndex === undefined || !subject || !room || !startTime || !endTime) {
        return res.status(400).json({ message: 'Missing required lecture fields.' });
    }

    const allTimetables = readAllTimetables();
    if (!allTimetables[teacherEmail]) {
        allTimetables[teacherEmail] = getDefaultTimetable();
    }

    const teacherTimetable = allTimetables[teacherEmail];

    // Validate periodIndex
    if (periodIndex < 0 || periodIndex >= 8) {
        return res.status(400).json({ message: 'Invalid period index.' });
    }

    const newLecture = {
        id: lectureId || uuidv4(), // Use existing ID if provided (for update), otherwise generate new
        subject,
        room,
        startTime,
        endTime
    };

    teacherTimetable[day][periodIndex] = newLecture;
    writeAllTimetables(allTimetables);

    res.status(200).json({ message: 'Lecture saved successfully', lecture: newLecture });
});

// ADMIN API: Delete a single lecture for a teacher
app.delete('/api/lectures/:teacherEmail/:day/:periodId', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const { teacherEmail, day, periodId } = req.params;

    const allTimetables = readAllTimetables();
    const teacherTimetable = allTimetables[teacherEmail];

    if (!teacherTimetable || !teacherTimetable[day]) {
        return res.status(404).json({ message: 'Teacher or day not found in timetable.' });
    }

    let found = false;
    for (let i = 0; i < teacherTimetable[day].length; i++) {
        if (teacherTimetable[day][i] && teacherTimetable[day][i].id === periodId) {
            teacherTimetable[day][i] = null; // Set the slot to null
            found = true;
            break;
        }
    }

    if (!found) {
        return res.status(404).json({ message: 'Lecture not found.' });
    }

    writeAllTimetables(allTimetables);
    res.status(200).json({ message: 'Lecture deleted successfully.' });
});


// Teacher Leave Request API
app.post('/api/leave-request', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'teacher') {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const { leaveDate, reason } = req.body;
    const teacherEmail = req.session.user.email;
    const teacherName = req.session.user.name;

    if (!leaveDate || !reason) {
        return res.status(400).json({ message: 'Leave date and reason are required.' });
    }

    const allTimetables = readAllTimetables();
    const teacherTimetable = allTimetables[teacherEmail];

    if (!teacherTimetable) {
        return res.status(404).json({ message: 'Teacher timetable not found.' });
    }

    // Convert leaveDate to a Date object to get the day of the week
    const leaveDay = new Date(leaveDate);
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const leaveDayOfWeek = daysOfWeek[leaveDay.getDay()];

    const lecturesOnLeaveDay = [];
    if (teacherTimetable[leaveDayOfWeek]) {
        teacherTimetable[leaveDayOfWeek].forEach((lecture, index) => {
            if (lecture && lecture.subject !== "Short Break" && lecture.subject !== "Lunch Break") { // Only count actual lectures
                lecturesOnLeaveDay.push({
                    periodIndex: index,
                    subject: lecture.subject,
                    room: lecture.room,
                    startTime: lecture.startTime,
                    endTime: lecture.endTime,
                    lectureId: lecture.id // Include lecture ID for potential future reference
                });
            }
        });
    }

    const adjustments = readAdjustments();
    const newAdjustmentRequest = {
        id: uuidv4(),
        teacherEmail,
        teacherName,
        leaveDate,
        reason,
        lectures: lecturesOnLeaveDay,
        status: 'Pending Admin Action', // Initial status
        substituteTeacher: null,
        createdAt: new Date().toISOString()
    };

    adjustments.push(newAdjustmentRequest);
    writeAdjustments(adjustments);

    res.status(200).json({ message: 'Leave request submitted and adjustments created.', adjustment: newAdjustmentRequest });
});

// Admin API: Fetch pending adjustment requests
app.get('/api/adjustments/pending', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized' });
    }
    const adjustments = readAdjustments();
    const pendingAdjustments = adjustments.filter(adj => adj.status === 'Pending Admin Action');
    res.status(200).json(pendingAdjustments);
});

// Admin API: Update an adjustment request (assign substitute / mark resolved)
app.post('/api/adjustments/update', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const { adjustmentId, status, substituteTeacher } = req.body;

    if (!adjustmentId || !status) {
        return res.status(400).json({ message: 'Adjustment ID and status are required.' });
    }

    const adjustments = readAdjustments();
    const adjustmentIndex = adjustments.findIndex(adj => adj.id === adjustmentId);

    if (adjustmentIndex === -1) {
        return res.status(404).json({ message: 'Adjustment request not found.' });
    }

    adjustments[adjustmentIndex].status = status;
    if (substituteTeacher !== undefined) { // Allow setting to null explicitly
        adjustments[adjustmentIndex].substituteTeacher = substituteTeacher;
    }
    adjustments[adjustmentIndex].updatedAt = new Date().toISOString();

    writeAdjustments(adjustments);
    res.status(200).json({ message: 'Adjustment request updated successfully.', adjustment: adjustments[adjustmentIndex] });
});

// API: Send a message
app.post('/api/messages', (req, res) => {
    if (!req.session.user) {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const { recipient, subject, body } = req.body; // recipient can be an email or 'admin'
    const senderEmail = req.session.user.email;
    const senderName = req.session.user.name;
    const senderRole = req.session.user.role;

    // Validate recipient based on sender role
    if (senderRole === 'teacher' && recipient !== 'admin') {
        return res.status(403).json({ message: 'Teachers can only send messages to the admin.' });
    }
    if (senderRole === 'admin' && recipient === 'admin') {
        return res.status(400).json({ message: 'Admin cannot send messages to themselves as "admin". Select a specific teacher.' });
    }
    const users = readUsers();
    if (recipient !== 'admin' && !users.some(u => u.email === recipient)) {
        return res.status(400).json({ message: 'Invalid recipient email.' });
    }

    if (!recipient || !subject || !body) {
        return res.status(400).json({ message: 'Recipient, subject, and body are required.' });
    }

    const messages = readMessages();
    const newMessage = {
        id: uuidv4(),
        senderEmail,
        senderName,
        senderRole,
        recipient, // Can be a teacher's email or 'admin'
        subject,
        body,
        timestamp: new Date().toISOString(),
        read: false // New: Message is unread by default
    };

    messages.push(newMessage);
    writeMessages(messages);

    res.status(200).json({ message: 'Message sent successfully.', message: newMessage });
});

// API: Get messages for the current user
app.get('/api/messages', (req, res) => {
    if (!req.session.user) {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const currentUserEmail = req.session.user.email;
    const currentUserRole = req.session.user.role;
    const allMessages = readMessages();

    let userMessages = [];

    if (currentUserRole === 'admin') {
        // Admin gets all messages where recipient is 'admin' OR sender is a teacher
        userMessages = allMessages.filter(msg =>
            msg.recipient === 'admin' || msg.senderRole === 'teacher'
        );
    } else if (currentUserRole === 'teacher') {
        // Teacher gets messages where recipient is their email OR sender is their email AND recipient is 'admin'
        userMessages = allMessages.filter(msg =>
            (msg.recipient === currentUserEmail && msg.senderRole === 'admin') || // Admin to this teacher
            (msg.senderEmail === currentUserEmail && msg.recipient === 'admin')    // This teacher to admin
        );
    } else {
        return res.status(403).json({ message: 'Invalid user role.' });
    }

    // Sort messages by timestamp, newest first
    userMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.status(200).json(userMessages);
});

// API: Mark message as read
app.put('/api/messages/:id/read', (req, res) => {
    if (!req.session.user) {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const messageId = req.params.id;
    const currentUserEmail = req.session.user.email;
    const currentUserRole = req.session.user.role;

    const messages = readMessages();
    const messageIndex = messages.findIndex(msg => msg.id === messageId);

    if (messageIndex === -1) {
        return res.status(404).json({ message: 'Message not found.' });
    }

    const messageToUpdate = messages[messageIndex];

    // Only allow the recipient to mark as read
    if (messageToUpdate.recipient === currentUserEmail || (currentUserRole === 'admin' && messageToUpdate.recipient === 'admin')) {
        messageToUpdate.read = true;
        writeMessages(messages);
        return res.status(200).json({ message: 'Message marked as read.', updatedMessage: messageToUpdate });
    } else {
        return res.status(403).json({ message: 'You are not authorized to mark this message as read.' });
    }
});


// --- Frontend Render Routes (unchanged for now, will be updated in later phases) ---
app.post('/admin/timetable', (req, res) => {
    // This route will be deprecated or repurposed as lecture updates will happen via API
    // For now, it will just redirect.
    res.redirect('/admin');
});

app.get('/timetable', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'teacher') {
        return res.redirect('/login');
    }
    const teacherEmail = req.session.user.email;
    const allTimetables = readAllTimetables();
    const teacherTimetable = allTimetables[teacherEmail] || getDefaultTimetable();

    res.render('timetable', {
        user: req.session.user,
        timetable: teacherTimetable,
        escapeJsString: escapeJsString // Pass the helper function to the EJS template
    });
});


app.listen(PORT, () => {
    console.log(`Server running at port : ${PORT}`);
});
