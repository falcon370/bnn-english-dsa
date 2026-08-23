const mongoose = require('mongoose');

const authorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    bio: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
    email: { type: String, unique: true, sparse: true, lowercase: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Author', authorSchema);
