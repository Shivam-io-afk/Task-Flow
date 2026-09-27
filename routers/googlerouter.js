const express = require('express');
const Router = express.Router();
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const { requireAuth, requireGuest } = require('../Middleware/auth');
const { register, login, logout, currentUser } = require('../controllers/authController');
const { registrationSchema, loginSchema, validateBody } = require('../Middleware/validation');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' }
});

Router.post('/register', requireGuest, authLimiter, validateBody(registrationSchema), register);
Router.post('/login', requireGuest, authLimiter, validateBody(loginSchema), login);
Router.post('/logout', requireAuth, logout);
Router.get('/me', requireAuth, currentUser);

Router.get('/google', requireGuest, (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALLBACK) {
    return res.status(503).json({ error: 'Google sign-in is not configured' });
  }
  next();
}, passport.authenticate('google', { scope: ['profile', 'email'], state: true }));

Router.get('/google/callback', requireGuest, (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_CALLBACK) {
    return res.redirect('/login?error=google_not_configured');
  }
  next();
}, passport.authenticate('google', { failureRedirect: '/login?error=google_auth_failed' }), (req, res) => {
  res.redirect('/');
});



module.exports = Router;