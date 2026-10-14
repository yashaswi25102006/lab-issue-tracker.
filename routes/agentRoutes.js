const express = require('express');
const router = express.Router();
const Issue = require('../models/Issue');

router.post('/analyze', async (req, res) => {
  try {
    const { query, studentId } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    const normalized = query.toLowerCase().trim();

    if (
      normalized.includes('resolve') || 
      normalized.includes('status') || 
      normalized.includes('my issue') || 
      normalized.includes('fixed or not')
    ) {
      if (!studentId) {
        return res.json({
          type: 'faq',
          botReply: 'Please sign in to your student account to check your live ticket status!'
        });
      }

      const issues = await Issue.find({ student: studentId }).sort({ createdAt: -1 });
      if (!issues.length) {
        return res.json({
          type: 'faq',
          botReply: 'You have no active reported issues. All systems are operational!'
        });
      }

      const statusList = issues.map((iss, i) => `${i + 1}. ${iss.labName} (${iss.systemNumber}) — Status: **${iss.status}**`).join('\n');
      return res.json({
        type: 'faq',
        botReply: `Here is your ticket status:\n${statusList}`
      });
    }

    return res.json({
      type: 'faq',
      botReply: 'I am your LabFix Assistant. Tell me any workstation malfunction or ask me about your ticket status!'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;