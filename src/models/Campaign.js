const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    status: {
      type: String,
      enum: ['planning', 'active', 'paused', 'completed', 'cancelled'],
      default: 'planning',
    },
    goals: [{ type: String, trim: true }],
    targetAudience: {
      ageRange: { min: Number, max: Number },
      interests: [{ type: String }],
      locations: [{ type: String }],
    },
    budget: {
      total: { type: Number, default: 0 },
      spent: { type: Number, default: 0 },
      currency: { type: String, default: 'USD' },
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    channels: [{ type: String, enum: ['email', 'social', 'blog', 'seo', 'paid', 'other'] }],
    metrics: {
      reach: { type: Number, default: 0 },
      impressions: { type: Number, default: 0 },
      clicks: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Campaign', campaignSchema);
