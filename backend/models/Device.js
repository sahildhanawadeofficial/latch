const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    deviceName: {
      type: String,
      required: true, // Human-readable flag (e.g., "Alice's iPhone")
    },
    credentialId: {
      type: String,
      required: true,
      unique: true, // Base64URL credential string from WebAuthn
    },
    publicKey: {
      type: String,
      required: true, // Base64URL public key representation
    },
    counter: {
      type: Number,
      default: 0, // Monotonically increasing signature counter for clone protection
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Device', DeviceSchema);
