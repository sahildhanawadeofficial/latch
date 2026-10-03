const crypto = require('crypto');
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');

const MAX_SPIN_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
const FACE_MATCH_THRESHOLD = 0.6; // face-api.js recommended threshold

function hashSPIN(spin) {
  return crypto.createHash('sha256').update(spin).digest('hex');
}

function euclideanDistance(v1, v2) {
  if (v1.length !== v2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < v1.length; i++) {
    sum += Math.pow(v1[i] - v2[i], 2);
  }
  return Math.sqrt(sum);
}

/**
 * Helper to verify S-PIN and handle lockouts
 */
async function verifySPIN(user, spin) {
  if (!user.spinHash) {
    throw new Error('S-PIN is not set up on this account.');
  }

  // Check if locked
  if (user.spinLockedUntil && user.spinLockedUntil > new Date()) {
    const minLeft = Math.ceil((user.spinLockedUntil - new Date()) / 60000);
    throw new Error(`Account locked due to too many failed S-PIN attempts. Try again in ${minLeft} minutes.`);
  }

  const incomingHash = hashSPIN(spin);
  if (incomingHash !== user.spinHash) {
    user.spinAttempts += 1;
    if (user.spinAttempts >= MAX_SPIN_ATTEMPTS) {
      user.spinLockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      await user.save();
      throw new Error('S-PIN entered incorrectly 3 times. Account locked for 2 hours.');
    }
    await user.save();
    throw new Error('Incorrect S-PIN.');
  }

  // Success, reset attempts
  if (user.spinAttempts > 0) {
    user.spinAttempts = 0;
    user.spinLockedUntil = null;
    await user.save();
  }
}

/**
 * Helper to fetch or lazily create a user's account
 */
async function getOrCreateAccount(userId) {
  let account = await Account.findOne({ userId });
  if (!account) {
    account = await Account.create({ userId });
  }
  return account;
}

/**
 * POST /api/transactions/balance
 * Body: { spin: "1234" }
 */
async function getBalance(req, res, next) {
  try {
    const { spin } = req.body;
    if (!spin) return res.status(400).json({ error: 'S-PIN required.' });

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    try {
      await verifySPIN(user, spin);
    } catch (err) {
      return res.status(401).json({ error: err.message });
    }

    const account = await getOrCreateAccount(user._id);

    return res.json({ balance: account.balance.toFixed(2), currency: 'INR' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/transactions/history
 * Body: { spin: "1234" }
 */
async function getHistory(req, res, next) {
  try {
    const { spin } = req.body;
    if (!spin) return res.status(400).json({ error: 'S-PIN required.' });

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    try {
      await verifySPIN(user, spin);
    } catch (err) {
      return res.status(401).json({ error: err.message });
    }

    // Query Transactions
    const txs = await Transaction.find({
      $or: [{ senderEmail: user.email }, { receiverEmail: user.email }]
    }).sort({ createdAt: -1 });

    const history = txs.map(tx => {
      const isSender = tx.senderEmail === user.email;
      return {
        id: tx._id,
        date: tx.createdAt.toISOString().split('T')[0],
        description: tx.description,
        amount: (isSender ? '-₹' : '+₹') + tx.amount.toFixed(2),
      };
    });

    return res.json({ history });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/transactions/transfer
 * Body: { spin: "1234", faceDescriptor: [...], amount: "50.00", recipient: "Alice" }
 */
async function transferMoney(req, res, next) {
  try {
    const { spin, faceDescriptor, amount, recipient } = req.body;
    const transferAmount = Number(amount);

    if (!spin || !faceDescriptor || !transferAmount || !recipient) {
      return res.status(400).json({ error: 'Missing required transfer details.' });
    }
    if (transferAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0.' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Step 1: Verify S-PIN
    try {
      await verifySPIN(user, spin);
    } catch (err) {
      return res.status(401).json({ error: err.message });
    }

    // Step 2: Biological Intent (Face Verification)
    if (!user.faceDescriptor || user.faceDescriptor.length !== 128) {
      return res.status(400).json({ error: 'No face descriptor registered for this account.' });
    }
    
    if (!Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return res.status(400).json({ error: 'Invalid face descriptor provided.' });
    }

    const distance = euclideanDistance(user.faceDescriptor, faceDescriptor);
    if (distance > FACE_MATCH_THRESHOLD) {
      return res.status(403).json({ error: `Face mismatch (Distance: ${distance.toFixed(2)}). Transfer denied.` });
    }

    // Step 3: Check Sender Balance
    const senderAccount = await getOrCreateAccount(user._id);
    if (senderAccount.balance < transferAmount) {
      return res.status(400).json({ error: 'Insufficient funds.' });
    }

    // Step 4: Find Recipient
    // Check by email or username
    const receiver = await User.findOne({
      $or: [{ email: recipient }, { username: recipient }]
    });

    // Step 5: Execute Transfer
    senderAccount.balance -= transferAmount;
    await senderAccount.save();

    let receiverEmail = recipient;
    if (receiver) {
      receiverEmail = receiver.email;
      const receiverAccount = await getOrCreateAccount(receiver._id);
      receiverAccount.balance += transferAmount;
      await receiverAccount.save();
    }

    // Log Transaction
    await Transaction.create({
      senderEmail: user.email,
      receiverEmail: receiverEmail,
      amount: transferAmount,
      description: `Transfer to ${recipient}`,
    });

    // Success
    return res.json({ 
      message: 'Transfer successful', 
      receipt: {
        recipient,
        amount: transferAmount,
        date: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getBalance, getHistory, transferMoney };
