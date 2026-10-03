const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    senderEmail: {
      type: String,
      required: true,
    },
    receiverEmail: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
  },
  { timestamps: true } // Creates 'createdAt' and 'updatedAt' automatically
);

module.exports = mongoose.model('Transaction', transactionSchema);
