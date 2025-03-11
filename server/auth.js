// Authentication module for Twilio Dialer Web App
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwt = require('jsonwebtoken');
const store = require('./memory-store');

// JWT secret key - should be in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRATION = '24h';

// Configure local strategy for username/password authentication
passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      // Find the user by username
      const user = await store.users.getByUsername(username);
      
      // If user not found
      if (!user) {
        return done(null, false, { message: 'Incorrect username or password' });
      }
      
      // Check password
      const isValid = store.verifyPassword(password, user.password);
      
      if (!isValid) {
        return done(null, false, { message: 'Incorrect username or password' });
      }
      
      // Remove password from user object before returning
      const { password: _, ...userWithoutPassword } = user;
      
      return done(null, userWithoutPassword);
    } catch (error) {
      return done(error);
    }
  }
));

// Configure JWT strategy for token authentication
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: JWT_SECRET
};

passport.use(new JwtStrategy(jwtOptions, async (payload, done) => {
  try {
    // Find the user by ID from JWT payload
    const user = await store.users.getById(payload.id);
    
    if (!user) {
      return done(null, false);
    }
    
    // Remove password from user object before returning
    const { password: _, ...userWithoutPassword } = user;
    
    return done(null, userWithoutPassword);
  } catch (error) {
    return done(error, false);
  }
}));

// Generate JWT token for a user
const generateToken = (user) => {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
};

// Middleware to check if user is authenticated
const isAuthenticated = passport.authenticate('jwt', { session: false });

// Middleware to check if user is an admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  
  return res.status(403).json({ message: 'Access denied. Admin role required.' });
};

// Middleware to check if user is an agent
const isAgent = (req, res, next) => {
  if (req.user && (req.user.role === 'agent' || req.user.role === 'admin')) {
    return next();
  }
  
  return res.status(403).json({ message: 'Access denied. Agent role required.' });
};

// Middleware to check if user is accessing their own data or is an admin
const isSelfOrAdmin = (req, res, next) => {
  const userId = parseInt(req.params.userId);
  
  if (req.user && (req.user.id === userId || req.user.role === 'admin')) {
    return next();
  }
  
  return res.status(403).json({ message: 'Access denied. You can only access your own data.' });
};

module.exports = {
  passport,
  generateToken,
  isAuthenticated,
  isAdmin,
  isAgent,
  isSelfOrAdmin
};