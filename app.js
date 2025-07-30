const express = require('express') 
const path = require('path')
const session = require('express-session')

require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3000

const connectDB = require('./config/db')
connectDB()

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))
app.set('view engine', 'ejs')

app.locals.escapeJsString = function(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const sessionConfig = require('./config/session')
app.use(session(sessionConfig))

const authRoutes = require('./routes/authRoutes')
const adminRoutes = require('./routes/adminRoutes')
const teacherRoutes = require('./routes/teacherRoutes')
const messageRoutes = require('./routes/messageRoutes')

app.use('/', authRoutes)
app.use('/admin', adminRoutes)
app.use('/timetable', teacherRoutes)
app.use('/api/messages', messageRoutes)

app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).send('Something broke! Try again later.')
})

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`)
})