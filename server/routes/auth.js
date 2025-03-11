// Authentication routes for Twilio Dialer Web App
const express = require('express');
const router = express.Router();
const passport = require('passport');
const store = require('../memory-store');
const auth = require('../auth');

// Login route
router.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) {
      console.error('Authentication error:', err);
      return res.status(500).json({ message: 'Authentication error' });
    }
    
    if (!user) {
      return res.status(401).json({ message: info.message || 'Authentication failed' });
    }
    
    // Generate JWT token
    const token = auth.generateToken(user);
    
    // Return user info and token
    return res.json({
      message: 'Authentication successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  })(req, res, next);
});

// Register route (admin only can create new users)
router.post('/register', auth.isAuthenticated, auth.isAdmin, async (req, res) => {
  try {
    const { username, password, full_name, email, role } = req.body;
    
    // Validate required fields
    if (!username || !password || !full_name || !email) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check if username already exists
    const existingUser = await store.users.getByUsername(username);
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    
    // Hash password
    const hashedPassword = store.hashPassword(password);
    
    // Create user
    const result = await store.users.create({
      username,
      password: hashedPassword,
      full_name,
      email,
      role: role || 'agent'
    });
    
    // Initialize agent status if role is agent
    if (role === 'agent' || !role) {
      await store.agentStatus.updateStatus(result.id, 'Offline');
    }
    
    res.status(201).json({
      message: 'User created successfully',
      userId: result.id
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
});

// Change password route
router.post('/change-password', auth.isAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    // Validate required fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new passwords are required' });
    }
    
    // Get user with password
    const user = await store.users.getById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify current password
    const isValid = store.verifyPassword(currentPassword, user.password);
    
    if (!isValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Hash new password
    const hashedPassword = store.hashPassword(newPassword);
    
    // Update password
    await store.users.update(userId, { password: hashedPassword });
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Error changing password' });
  }
});

// Get current user profile
router.get('/profile', auth.isAuthenticated, (req, res) => {
  // Return user info without password
  res.json({
    user: {
      id: req.user.id,
      username: req.user.username,
      full_name: req.user.full_name,
      email: req.user.email,
      role: req.user.role
    }
  });
});

// Update user profile
router.put('/profile', auth.isAuthenticated, async (req, res) => {
  try {
    const { full_name, email } = req.body;
    const userId = req.user.id;
    
    // Update user
    await store.users.update(userId, { full_name, email });
    
    // Get updated user
    const updatedUser = await store.users.getById(userId);
    
    // Return updated user info without password
    const { password: _, ...userWithoutPassword } = updatedUser;
    
    res.json({
      message: 'Profile updated successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// Admin route to update any user
router.put('/users/:userId', auth.isAuthenticated, auth.isAdmin, async (req, res) => {
  try {
    const { full_name, email, role } = req.body;
    const userId = parseInt(req.params.userId);
    
    // Update user
    await store.users.update(userId, { full_name, email, role });
    
    // Get updated user
    const updatedUser = await store.users.getById(userId);
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return updated user info without password
    const { password: _, ...userWithoutPassword } = updatedUser;
    
    res.json({
      message: 'User updated successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user' });
  }
});

// Admin route to reset a user's password
router.post('/reset-password/:userId', auth.isAuthenticated, auth.isAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const userId = parseInt(req.params.userId);
    
    // Validate required fields
    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }
    
    // Get user
    const user = await store.users.getById(userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Hash new password
    const hashedPassword = store.hashPassword(newPassword);
    
    // Update password
    await store.users.update(userId, { password: hashedPassword });
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Error resetting password' });
  }
});

module.exports = router;