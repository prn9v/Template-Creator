import mongoose from 'mongoose';

const PlaceholderSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['text', 'image'], required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  fontSize: { type: Number, default: 16 },
  fontFamily: { type: String, default: 'Arial' },
  color: { type: String, default: '#000000' },
  placeholder: { type: String, default: '' },
  required: { type: Boolean, default: true },
  pageIndex: { type: Number, default: 0 } // New field for PDF page support
});

const TemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String, required: true },
  backgroundImage: { type: String, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  placeholders: [PlaceholderSchema],
  isPdf: { type: Boolean, default: false }, // New field to identify PDF templates
  totalPages: { type: Number, default: 1 }, // New field for PDF page count
  pdfFilePath: { type: String }, // New field to store PDF file path
  isActive: { type: Boolean, default: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for efficient querying
TemplateSchema.index({ category: 1, isActive: 1 });
TemplateSchema.index({ createdBy: 1 });
TemplateSchema.index({ isPdf: 1 });

// Virtual for getting placeholders by page
TemplateSchema.virtual('placeholdersByPage').get(function() {
  if (!this.isPdf) return { 0: this.placeholders };
  
  const pageGroups = {};
  for (let i = 0; i < this.totalPages; i++) {
    pageGroups[i] = this.placeholders.filter(p => p.pageIndex === i);
  }
  return pageGroups;
});

// Method to get placeholders for a specific page
TemplateSchema.methods.getPlaceholdersForPage = function(pageIndex) {
  if (!this.isPdf) return this.placeholders;
  return this.placeholders.filter(p => p.pageIndex === pageIndex);
};

// Method to add placeholder to specific page
TemplateSchema.methods.addPlaceholderToPage = function(placeholder, pageIndex = 0) {
  placeholder.pageIndex = this.isPdf ? pageIndex : 0;
  this.placeholders.push(placeholder);
  return this.save();
};

// Pre-save middleware to update the updatedAt field
TemplateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.models.Template || mongoose.model('Template', TemplateSchema);