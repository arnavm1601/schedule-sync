const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const session = require('express-session');


const app = express();
const PORT = 3000;
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.use(session({
    secret: 'azesxdrctfvgybhunijmko,p',
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
    } catch (error) {
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
function getDefaultTimetable() {
    return {
        monday: Array(8).fill(''),
        tuesday: Array(8).fill(''),
        wednesday: Array(8).fill(''),
        thursday: Array(8).fill(''),
        friday: Array(8).fill(''),
        saturday: Array(8).fill('')
    };
}
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
app.get('/admin', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }
    const users = readUsers();
    const teachers = users.filter(u => u.role === 'teacher');
    const allTimetables = readAllTimetables();
    const initialTimetable = getDefaultTimetable();
    res.render('admin', {
        user: req.session.user,
        teachers,
        allTimetables: allTimetables,
        timetable: initialTimetable
    });
});
app.post('/admin/timetable', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }
    const { selectedTeacherEmail } = req.body;
    if (!selectedTeacherEmail) {
        return res.send('No teacher selected for timetable update.');
    }
    const allTimetables = readAllTimetables();
    const updatedTimetableForTeacher = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (const day of days) {
        const value = req.body[day];
        if (Array.isArray(value)) {
            updatedTimetableForTeacher[day] = value.map(item => item.trim());
        } else if (typeof value === 'string') {
            updatedTimetableForTeacher[day] = value.split(',').map(item => item.trim());
        } else {
            updatedTimetableForTeacher[day] = [];
        }
    }
    allTimetables[selectedTeacherEmail] = updatedTimetableForTeacher;
    writeAllTimetables(allTimetables);
    res.redirect('/admin');
});
app.get('/timetable', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'teacher') {
        return res.redirect('/login');
    }
    const teacherEmail = req.session.user.email;
    const allTimetables = readAllTimetables();
    const teacherTimetable = allTimetables[teacherEmail] || getDefaultTimetable();

    res.render('timetable', { user: req.session.user, timetable: teacherTimetable });
});
app.listen(PORT, () => {
    console.log(`Server running at port : ${PORT}`);
});