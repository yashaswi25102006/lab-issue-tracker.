const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  labName: { type: String, required: true, trim: true },
  systemNumber: { type: String, required: true, trim: true },
  componentType: { 
    type: String, 
    required: true, 
    enum: ['Keyboard', 'Mouse', 'Monitor', 'CPU / Hardware', 'Operating System / Software', 'Internet / Network', 'Other'] 
  },
  description: { type: String, required: true, trim: true },
  priority: { 
    type: String, 
    required: true, 
    enum: ['High', 'Moderate', 'Low'],
    default: 'Moderate' 
  },
  status: { 
    type: String, 
    required: true, 
    enum: ['Pending', 'Accepted', 'Processing', 'Completed'],
    default: 'Pending' 
  },
  student: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  studentName: { type: String, required: true },
  rollNumber: { type: String, required: true },
  technician: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null 
  },
  technicianName: { type: String, default: null },
  resolutionNotes: { type: String, default: '' },
  acceptedAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Issue', issueSchema);