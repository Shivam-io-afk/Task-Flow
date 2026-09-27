const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user');

const googleConfigured = process.env.GOOGLE_CLIENT_ID
    && process.env.GOOGLE_CLIENT_SECRET
    && process.env.GOOGLE_CALLBACK;

if (googleConfigured) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const emailProfile = profile.emails?.find((entry) => entry.value);
            const emailVerified = profile._json?.email_verified === true || emailProfile?.verified === true;
            const email = emailProfile?.value?.trim().toLowerCase();

            if (!email || !emailVerified) {
                return done(null, false, { message: 'A verified Google email is required' });
            }

            let user = await User.findOne({ googleId: profile.id });
            if (user) {
                return done(null, user.isActive ? user : false);
            }

            user = await User.findOne({ email });
            if (user) {
                if (!user.isActive || (user.googleId && user.googleId !== profile.id)) {
                    return done(null, false);
                }
                user.googleId = profile.id;
                await user.save();
                return done(null, user);
            }

            user = await User.create({
                name: profile.displayName || email.split('@')[0],
                email,
                googleId: profile.id
            });
            return done(null, user);
        } catch (error) {
            return done(error);
        }
    }));
}

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user?.isActive ? user : false);
    } catch (error) {
        done(error);
    }
});

module.exports = passport;