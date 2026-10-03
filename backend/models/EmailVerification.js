const mongoose = require('mongoose');

const EmailVerificationSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true, // SHA-256 hex token from crypto.randomBytes(32)
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  used: {
    type: Boolean,
    default: false, // Single-use: invalidated after the link is clicked
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// MongoDB TTL index — auto-delete unverified tokens after 15 minutes
EmailVerificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 900 });

module.exports = mongoose.model('EmailVerification', EmailVerificationSchema);
