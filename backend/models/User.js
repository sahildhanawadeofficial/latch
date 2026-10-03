const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    recoveryCodeHash: {
      type: String,
      required: true, // SHA-256 hash of the active 16-character emergency code
    },
    refreshTokenHash: {
      type: String,
      default: null, // SHA-256 hash of the active refresh token (for rotation invalidation)
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
    },
    disabledUntil: {
      type: Date,
      default: null, // Timestamp defining when a 30-minute lockout expires
    },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },

    // --- Profile Data ---
    username: { type: String },

    // --- S-PIN (2-Step Auth) ---
    spinHash: { type: String }, // Bcrypt hash of the 4-digit S-PIN
    spinSetAt: { type: Date }, // Timestamp when S-PIN was last set/reset
    spinAttempts: { type: Number, default: 0 },
    spinLockedUntil: { type: Date },
    spinResetOTP: { type: String }, // 6-digit OTP for forgetting S-PIN
    spinResetExpires: { type: Date }, // Expiration for the OTP

    // --- Face Descriptor (2-Step Auth) ---
    faceDescriptor: { type: [Number] }, // 128-d Float32Array stored as an array of numbers
    faceSetAt: { type: Date }, // Timestamp when face vector was registered
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);
