const mongoose = require('mongoose');

const PairingTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true, // UUID v4 pairing token
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// MongoDB TTL index: auto-delete documents 120 seconds after createdAt
PairingTokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 120 });

module.exports = mongoose.model('PairingToken', PairingTokenSchema);
