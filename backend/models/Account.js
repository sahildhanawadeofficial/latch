const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 50000, // ₹50,000 starting balance
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Account', accountSchema);
