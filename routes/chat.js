const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const HelpRequest = require("../models/HelpRequest");
const User = require("../models/User");
const verifyFirebaseToken = require("../middleware/verifyFirebaseToken");
const { Expo } = require("expo-server-sdk");

const expo = new Expo();

// ─────────────────────────────────────────────
// Helper: Send push notification
// ─────────────────────────────────────────────
async function sendPushNotification(pushToken, title, body, data = {}) {
  if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;
  try {
    await expo.sendPushNotificationsAsync([
      {
        to: pushToken,
        sound: "default",
        title,
        body,
        data,
      },
    ]);
  } catch (err) {
    console.error("Push notification error:", err.message);
  }
}

// ─────────────────────────────────────────────
// GET /api/chat/:requestId — Get all messages for a request
// ─────────────────────────────────────────────
router.get("/:requestId", verifyFirebaseToken, async (req, res) => {
  try {
    const { requestId } = req.params;

    // Verify user is part of this request
    const request = await HelpRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    const isRequester = request.userId.toString() === req.user._id.toString();
    const isHelper = request.acceptedBy?.toString() === req.user._id.toString();

    if (!isRequester && !isHelper) {
      return res.status(403).json({ message: "Not authorized to view this chat" });
    }

    const messages = await Message.find({ requestId }).sort({ createdAt: 1 });

    // Format messages
    const formatted = messages.map((m) => ({
      id: m._id.toString(),
      requestId: m.requestId.toString(),
      senderId: m.senderId.toString(),
      senderName: m.senderName,
      text: m.text,
      type: m.type,
      timestamp: m.createdAt.getTime(),
    }));

    // Also return request info so both sides know who they're chatting with
    const otherUserId = isRequester ? request.acceptedBy : request.userId;
    const otherUser = await User.findById(otherUserId).select("name profession rating isVerified");

    res.json({
      messages: formatted,
      request: {
        id: request._id.toString(),
        category: request.category,
        description: request.description,
        status: request.status,
        isPaid: request.isPaid,
        budget: request.budget,
        userId: request.userId.toString(),
        acceptedBy: request.acceptedBy?.toString(),
      },
      otherUser: otherUser
        ? {
            id: otherUser._id.toString(),
            name: otherUser.name,
            profession: otherUser.profession,
            rating: otherUser.rating,
            isVerified: otherUser.isVerified,
          }
        : null,
    });
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// POST /api/chat/:requestId — Send a message
// ─────────────────────────────────────────────
router.post("/:requestId", verifyFirebaseToken, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { text, type } = req.body;

    if (!text?.trim()) return res.status(400).json({ message: "Message text required" });

    const request = await HelpRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    const isRequester = request.userId.toString() === req.user._id.toString();
    const isHelper = request.acceptedBy?.toString() === req.user._id.toString();

    if (!isRequester && !isHelper) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Save message
    const message = await Message.create({
      requestId,
      senderId: req.user._id,
      senderName: req.user.name,
      text: text.trim(),
      type: type || "text",
    });

    // Send push notification to other user
    const otherUserId = isRequester ? request.acceptedBy : request.userId;
    if (otherUserId) {
      const otherUser = await User.findById(otherUserId).select("expoPushToken");
      if (otherUser?.expoPushToken) {
        await sendPushNotification(
          otherUser.expoPushToken,
          `${req.user.name} sent a message`,
          text.trim(),
          { screen: "chat", requestId }
        );
      }
    }

    res.status(201).json({
      message: {
        id: message._id.toString(),
        requestId: message.requestId.toString(),
        senderId: message.senderId.toString(),
        senderName: message.senderName,
        text: message.text,
        type: message.type,
        timestamp: message.createdAt.getTime(),
      },
    });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// PATCH /api/chat/:requestId/decline — Helper declines accepted request
// Request goes back to active, helper can't see it again
// ─────────────────────────────────────────────
router.patch("/:requestId/decline", verifyFirebaseToken, async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await HelpRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    const isHelper = request.acceptedBy?.toString() === req.user._id.toString();
    if (!isHelper) return res.status(403).json({ message: "Only the helper can decline" });

    // Store declined helper so they never see this request again
    await HelpRequest.findByIdAndUpdate(requestId, {
      $set: {
        status: "active",
        acceptedBy: null,
        acceptedAt: null,
      },
      $addToSet: { declinedBy: req.user._id }, // track who declined
    });

    // Revert helper karma/stats (undo the accept)
    await User.findByIdAndUpdate(req.user._id, {
      $inc: {
        helpGivenCount: -1,
        totalHelps: -1,
      },
    });

    // Notify requester that helper declined
    const requester = await User.findById(request.userId).select("expoPushToken name");
    if (requester?.expoPushToken) {
      await sendPushNotification(
        requester.expoPushToken,
        "Helper declined your request",
        "Don't worry! Your request is visible to others nearby again.",
        { screen: "home" }
      );
    }

    // Delete chat messages for this declined session
    await Message.deleteMany({ requestId });

    res.json({ message: "Request declined and back to active" });
  } catch (err) {
    console.error("Decline error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
module.exports.sendPushNotification = sendPushNotification;
