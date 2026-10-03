const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const { 
  setupSPIN, 
  setupFace, 
  getUserStatus, 
  updateUsername, 
  requestSPINReset, 
  confirmSPINReset 
} = require('../controllers/settingsController');
const { getBalance, getHistory, transferMoney } = require('../controllers/transactionController');

// All dashboard routes require authentication
router.use(authMiddleware);

// --- Settings ---
// GET /api/dashboard/status
router.get('/status', getUserStatus);

// POST /api/dashboard/settings/username
router.post('/settings/username', updateUsername);

// POST /api/dashboard/settings/spin-reset-request
router.post('/settings/spin-reset-request', requestSPINReset);

// POST /api/dashboard/settings/spin-reset-confirm
router.post('/settings/spin-reset-confirm', confirmSPINReset);

// POST /api/dashboard/settings/spin
router.post('/settings/spin', setupSPIN);

// POST /api/dashboard/settings/face
router.post('/settings/face', setupFace);

// --- Transactions ---
// POST /api/dashboard/transactions/balance
router.post('/transactions/balance', getBalance);

// POST /api/dashboard/transactions/history
router.post('/transactions/history', getHistory);

// POST /api/dashboard/transactions/transfer
router.post('/transactions/transfer', transferMoney);

module.exports = router;
