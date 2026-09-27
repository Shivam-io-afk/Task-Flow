const bcrypt = require('bcrypt');
const User = require('../models/user');

function publicUser(user) {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role
	};
}

function establishSession(req, user) {
	return new Promise((resolve, reject) => {
		req.logIn(user, (error) => error ? reject(error) : resolve());
	});
}

async function register(req, res, next) {
	try {
		const passwordHash = await bcrypt.hash(req.body.password, 12);
		const user = await User.create({
			name: req.body.name,
			email: req.body.email,
			passwordHash
		});

		await establishSession(req, user);
		res.status(201).json({ user: publicUser(user) });
	} catch (error) {
		if (error.code === 11000) {
			return res.status(409).json({ error: 'An account with that email already exists' });
		}
		next(error);
	}
}

async function login(req, res, next) {
	try {
		const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
		const passwordMatches = user?.passwordHash
			? await bcrypt.compare(req.body.password, user.passwordHash)
			: false;

		if (!user || !user.isActive || !passwordMatches) {
			return res.status(401).json({ error: 'Invalid email or password' });
		}

		await establishSession(req, user);
		res.json({ user: publicUser(user) });
	} catch (error) {
		next(error);
	}
}

function logout(req, res, next) {
	const cookieName = process.env.NODE_ENV === 'production' ? '__Host-taskmanager.sid' : 'taskmanager.sid';

	req.logout((logoutError) => {
		if (logoutError) return next(logoutError);

		req.session.destroy((sessionError) => {
			if (sessionError) return next(sessionError);
			res.clearCookie(cookieName, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: process.env.NODE_ENV === 'production'
			});
			if (req.is('application/x-www-form-urlencoded')) {
				return res.redirect(303, '/login');
			}
			res.status(204).end();
		});
	});
}

function currentUser(req, res) {
	res.json({ user: publicUser(req.user) });
}

module.exports = { register, login, logout, currentUser };