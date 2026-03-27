const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "HelpRequest", required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderName: { type: String, required: true },
    text: { type: String, required: true, trim: true },
    type: { type: String, enum: ["text", "location", "system"], default: "text" },
  },
  { timestamps: true }
);

MessageSchema.index({ requestId: 1, createdAt: 1 });

module.exports = mongoose.models.Message || mongoose.model("Message", MessageSchema);
