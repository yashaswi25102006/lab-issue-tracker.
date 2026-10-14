const express = require('express');
const router = express.Router();
const Issue = require('../models/Issue');
const { verifyToken, authorizeRoles } = require('../middleware/auth');

// 1. PUBLIC: Live unresolved issues for the BookMyShow floor map (so EVERYONE sees Red & Yellow seats)
router.get('/active-map', async (req, res) => {
  try {
    const activeIssues = await Issue.find({ status: { $ne: 'Completed' } })
      .select('labName systemNumber componentType priority status student studentName rollNumber createdAt technicianName');
    res.json(activeIssues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Student raises a new issue (Turns workstation RED)
router.post('/', verifyToken, authorizeRoles('student'), async (req, res) => {
  try {
    const { labName, systemNumber, componentType, description, priority } = req.body;

    const existing = await Issue.findOne({
      labName: new RegExp(`^${labName.trim()}$`, 'i'),
      systemNumber: new RegExp(`^${systemNumber.trim()}$`, 'i'),
      status: { $ne: 'Completed' }
    });

    if (existing) {
      return res.status(400).json({ 
        error: `Workstation ${systemNumber} in ${labName} already has an active issue reported (${existing.componentType}). Please do not submit duplicate complaints.` 
      });
    }

    const newIssue = new Issue({
      labName,
      systemNumber,
      componentType,
      description,
      priority: priority || 'Moderate',
      status: 'Pending',
      student: req.user._id,
      studentName: req.user.name,
      rollNumber: req.user.rollNumber || 'N/A'
    });

    await newIssue.save();
    res.status(201).json({ message: 'Issue reported successfully.', issue: newIssue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Student views their raised issues
router.get('/my-issues', verifyToken, authorizeRoles('student'), async (req, res) => {
  try {
    const issues = await Issue.find({ student: req.user._id }).sort({ createdAt: -1 });
    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Technician views all issues feed
router.get('/technician-feed', verifyToken, authorizeRoles('technician'), async (req, res) => {
  try {
    const { priority, status } = req.query;
    let query = {};
    if (priority && priority !== 'All') query.priority = priority;
    if (status && status !== 'All') query.status = status;

    const issues = await Issue.find(query).sort({ status: 1, createdAt: -1 });

    const priorityWeight = { 'High': 1, 'Moderate': 2, 'Low': 3 };
    issues.sort((a, b) => (priorityWeight[a.priority] || 4) - (priorityWeight[b.priority] || 4));

    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Technician accepts issue (Turns workstation YELLOW)
router.put('/:id/accept', verifyToken, authorizeRoles('technician'), async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Issue not found.' });

    issue.status = 'Accepted';
    issue.technician = req.user._id;
    issue.technicianName = req.user.name;
    issue.acceptedAt = new Date();
    await issue.save();

    res.json({ message: 'Issue accepted by technician. Workstation turned Yellow.', issue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Technician updates status (Processing = YELLOW | Completed = GREEN)
router.put('/:id/status', verifyToken, authorizeRoles('technician'), async (req, res) => {
  try {
    const { status, resolutionNotes } = req.body;
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Issue not found.' });

    if (!['Processing', 'Completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    issue.status = status;
    if (resolutionNotes) issue.resolutionNotes = resolutionNotes;
    if (status === 'Completed') issue.resolvedAt = new Date();

    await issue.save();
    res.json({ message: `Issue marked as ${status}. Workstation restored to Green.`, issue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Student cancels issue (Turns workstation back to GREEN)
router.put('/:id/cancel', verifyToken, authorizeRoles('student'), async (req, res) => {
  try {
    const issue = await Issue.findOne({ _id: req.params.id, student: req.user._id });
    if (!issue) return res.status(404).json({ error: 'Issue not found or unauthorized.' });

    issue.status = 'Completed';
    issue.resolutionNotes = 'Withdrawn / Cancelled by student';
    issue.resolvedAt = new Date();
    await issue.save();

    res.json({ message: 'Issue cancelled. Workstation restored to Green.', issue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;