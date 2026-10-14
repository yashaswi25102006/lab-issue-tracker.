const express = require('express');
const router = express.Router();
const Issue = require('../models/Issue');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

router.get('/overview', verifyToken, authorizeRoles('management'), async (req, res) => {
  try {
    const { status, labName, year, month } = req.query;
    let filter = {};

    if (status && status !== 'All') filter.status = status;
    if (labName && labName !== 'All') filter.labName = labName;

    if (year && year !== 'All') {
      const selectedYear = parseInt(year);
      let startDate, endDate;

      if (month && month !== 'All') {
        const selectedMonth = parseInt(month) - 1;
        startDate = new Date(selectedYear, selectedMonth, 1);
        endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
      } else {
        startDate = new Date(selectedYear, 0, 1);
        endDate = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
      }
      filter.createdAt = { $gte: startDate, $lte: endDate };
    }

    const issues = await Issue.find(filter).sort({ createdAt: -1 });

    const totalRaised = await Issue.countDocuments();
    const pendingCount = await Issue.countDocuments({ status: 'Pending' });
    const processingCount = await Issue.countDocuments({ status: { $in: ['Accepted', 'Processing'] } });
    const completedCount = await Issue.countDocuments({ status: 'Completed' });

    const labs = await Issue.distinct('labName');

    res.json({
      metrics: {
        totalRaised,
        pendingCount,
        processingCount,
        completedCount,
        resolutionRate: totalRaised > 0 ? Math.round((completedCount / totalRaised) * 100) : 0
      },
      availableLabs: labs,
      issues
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;