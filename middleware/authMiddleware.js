const checkAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login')
    }
    next()
}

const checkRole = (requiredRole) => (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login')
    }

    if (req.session.user.role !== requiredRole) {
        return res.status(403).send('Unauthorized: You do not have permission.')
    }
    next()
}

module.exports = {
    checkAuth,
    checkRole
}