require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const passport = require('passport');
const connectDb = require('./config/mongoose');
const Task = require('./models/task');
const { startRecurringTaskScheduler, processRecurringTasks } = require('./config/recurringTasks');
const authRouter = require('./routers/googlerouter');
const taskRouter = require('./routers/taskrouter');
const teamRouter = require('./routers/teamrouter');
const projectRouter = require('./routers/projectrouter');
const { redirectAuthenticated } = require('./Middleware/auth');

require('./config/googleAuthPassport');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
let middlewareConfigured = false;

app.set('view engine', 'ejs');
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: true, limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'Public')));

function configureAuthMiddleware() {
    if (middlewareConfigured) return;
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
        throw new Error('SESSION_SECRET must be set to a random value of at least 32 characters');
    }

    app.set('trust proxy', isProduction ? 1 : false);
    app.use(session({
        name: isProduction ? '__Host-taskmanager.sid' : 'taskmanager.sid',
        secret: process.env.SESSION_SECRET,
        store: MongoStore.create({
            mongoUrl: process.env.CONNECT,
            collectionName: 'sessions',
            ttl: 7 * 24 * 60 * 60
        }),
        resave: false,
        saveUninitialized: false,
        rolling: true,
        cookie: {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        }
    }));
    app.use(passport.initialize());
    app.use(passport.session());
    app.get('/login', redirectAuthenticated, (req, res) => {
        res.render('Login');
    });
    app.get('/register', redirectAuthenticated, (req, res) => {
        res.render('register');
    });
    app.get('/', (req, res) => {
        if (!req.isAuthenticated()) return res.redirect('/login');
        res.render('home', { user: req.user });
    });
    app.use('/auth', authRouter);
    app.use('/api/teams', teamRouter);
    app.use('/api/projects', projectRouter);
    app.use('/api/tasks', taskRouter);
    app.use((error, req, res, next) => {
        console.error(error);
        if (res.headersSent) return next(error);
        const status = error.status || (error.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
        res.status(status).json({ error: status === 500 ? 'An unexpected server error occurred' : error.message });
    });
    middlewareConfigured = true;
}

async function start() {
    await connectDb();
    await Task.init();
    await processRecurringTasks();
    startRecurringTaskScheduler();
    configureAuthMiddleware();
    const port = Number(process.env.PORT) || 3000;
    return app.listen(port, () => console.log(`Server listening on port ${port}`));
}

if (require.main === module) {
    start().catch((error) => {
        console.error('Application startup failed:', error.message);
        process.exitCode = 1;
    });
}

module.exports = app;