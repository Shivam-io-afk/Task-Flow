function requireAuth(req, res, next) {
	if (!req.isAuthenticated?.() || !req.user?.isActive) {
		return res.status(401).json({ error: 'Authentication required' });
	}

	next();
}

function requireRole(...roles) {
	return (req, res, next) => {
		if (!req.isAuthenticated?.() || !req.user?.isActive) {
			return res.status(401).json({ error: 'Authentication required' });
		}

		if (!roles.includes(req.user.role)) {
			return res.status(403).json({ error: 'Insufficient permissions' });
		}

		next();
	};
}

function redirectAuthenticated(req, res, next) {
	if (req.isAuthenticated?.()) return res.redirect('/');
	next();
}

function requireGuest(req, res, next) {
	if (req.isAuthenticated?.()) {
		return res.status(409).json({ error: 'You are already signed in' });
	}
	next();
}

module.exports = { requireAuth, requireRole, redirectAuthenticated, requireGuest };