const crypto = require('crypto');
const User = require('../models/User');
const { sendSPINResetEmail } = require('../services/emailService');

function hashSPIN(spin) {
  return crypto.createHash('sha256').update(spin).digest('hex');
}

async function setupSPIN(req, res, next) {
  try {
    const { spin } = req.body;
    if (!spin || typeof spin !== 'string' || spin.length !== 4) {
      return res.status(400).json({ error: 'S-PIN must be exactly 4 digits.' });
    }
    
    // Auth middleware uses req.user.userId
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.spinHash = hashSPIN(spin);
    user.spinSetAt = new Date();
    user.spinAttempts = 0;
    user.spinLockedUntil = null;
    await user.save();

    return res.json({ message: 'S-PIN set successfully.' });
  } catch (err) {
    next(err);
  }
}

async function setupFace(req, res, next) {
  try {
    const { descriptor } = req.body;
    if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
      return res.status(400).json({ error: 'Invalid face descriptor. Must be an array of 128 numbers.' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.faceDescriptor = descriptor;
    user.faceSetAt = new Date();
    await user.save();

    return res.json({ message: 'Face descriptor registered successfully.' });
  } catch (err) {
    next(err);
  }
}

async function getUserStatus(req, res, next) {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    
    res.json({
      hasSPIN: !!user.spinHash,
      hasFace: !!user.faceDescriptor && user.faceDescriptor.length > 0,
      spinSetAt: user.spinSetAt || null,
      faceSetAt: user.faceSetAt || null,
      username: user.username || ''
    });
  } catch (err) {
    next(err);
  }
}

async function updateUsername(req, res, next) {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required.' });
    
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.username = username;
    await user.save();
    res.json({ message: 'Username updated successfully.' });
  } catch (err) {
    next(err);
  }
}

async function requestSPINReset(req, res, next) {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.spinResetOTP = otp;
    user.spinResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save();

    await sendSPINResetEmail(user.email, otp);
    res.json({ message: 'OTP sent to your email.' });
  } catch (err) {
    next(err);
  }
}

async function confirmSPINReset(req, res, next) {
  try {
    const { otp, newSpin } = req.body;
    if (!otp || !newSpin || newSpin.length !== 4) {
      return res.status(400).json({ error: 'OTP and valid 4-digit S-PIN required.' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (user.spinResetOTP !== otp || !user.spinResetExpires || user.spinResetExpires < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    user.spinHash = hashSPIN(newSpin);
    user.spinSetAt = new Date();
    user.spinAttempts = 0;
    user.spinLockedUntil = null;
    user.spinResetOTP = undefined;
    user.spinResetExpires = undefined;
    await user.save();

    res.json({ message: 'S-PIN successfully reset.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { 
  setupSPIN, 
  setupFace, 
  getUserStatus, 
  updateUsername, 
  requestSPINReset, 
  confirmSPINReset 
};
