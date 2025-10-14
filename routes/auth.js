import express from "express";
import dotenv from "dotenv";
import User from "../models/User.js";
import twilio from "twilio";
import { authenticator } from "otplib";

dotenv.config();
const router = express.Router();

// Initialize Twilio client
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);

// In-memory OTP store: { phone: { otp, expiresAt } }
let otpStore = {};

// ---------------- SEND OTP FOR SIGNUP ----------------
router.post("/send-otp-signup", async (req, res) => {
  const { phone } = req.body;
  if (!phone || !phone.startsWith("+")) {
    return res.status(400).json({ success: false, error: "Invalid phone format" });
  }

  try {
    const existingUser = await User.findOne({ mobile: phone });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, error: "Phone already registered. Login instead." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStore[phone] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };

    await client.messages.create({
      body: `Your REVA AI OTP for signup is ${otp}`,
      from: process.env.TWILIO_PHONE,
      to: phone,
    });

    res.json({ success: true, message: "OTP sent successfully!" });
  } catch (err) {
    console.error("Twilio error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------- SEND OTP FOR LOGIN ----------------
// ---------------- SEND OTP FOR LOGIN ----------------
router.post("/send-otp-login", async (req, res) => {
  const { phone } = req.body;
  if (!phone || !phone.startsWith("+")) {
    return res.status(400).json({ success: false, error: "Invalid phone format" });
  }

  try {
    const user = await User.findOne({ mobile: phone });
    if (!user) {
      return res.status(400).json({ success: false, error: "Phone not registered. Signup first." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStore[phone] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };

    // --- MOCK SMS ---
    await client.messages.create({
  body: `Your REVA AI OTP for login is ${otp}`,
  from: process.env.TWILIO_PHONE,
  to: phone,
});


    res.json({ success: true, message: "OTP sent successfully!", otp }); // send otp in response for local testing
  } catch (err) {
    console.error("Send OTP error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ---------------- VERIFY OTP ----------------
router.post("/verify-otp", async (req, res) => {
  const { name, email, phone, otp } = req.body;
  const record = otpStore[phone];

  if (!record) return res.status(400).json({ success: false, message: "OTP not found" });
  if (record.expiresAt < Date.now()) {
    delete otpStore[phone];
    return res.status(400).json({ success: false, message: "OTP expired" });
  }
  if (record.otp != otp) return res.status(400).json({ success: false, message: "Invalid OTP" });

  delete otpStore[phone];

  try {
    let user = await User.findOne({ mobile: phone });

    if (!user) {
      if (!name || !email) {
        return res.status(400).json({ success: false, message: "Name and email required" });
      }

      // ✅ Generate 32-char base32 secret for new users
      const secret = authenticator.generateSecret(32);

      user = new User({
        name,
        email,
        mobile: phone,
        totpSecret: secret,
      });
      await user.save();

      return res.json({
        success: true,
        message: "Signup successful",
        user,
        secret, // frontend can display QR or key
      });
    } else {
      return res.json({ success: true, message: "Login successful", user });
    }
  } catch (err) {
    console.error("DB Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------- VERIFY 2FA TOTP ----------------
router.post("/verify-totp", async (req, res) => {
  const { email, phone, code } = req.body;

  try {
    const user = email
      ? await User.findOne({ email })
      : await User.findOne({ mobile: phone });

    if (!user || !user.totpSecret)
      return res.status(400).json({ success: false, error: "TOTP not set" });

    const isValid = authenticator.check(code, user.totpSecret);

    if (!isValid) return res.status(400).json({ success: false, message: "Invalid TOTP code" });

    res.json({ success: true, message: "2FA verified successfully" });
  } catch (err) {
    console.error("Verify TOTP error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------- GET CURRENT TOTP ----------------
router.get("/current-totp", async (req, res) => {
  const { email, phone } = req.query;

  if (!email && !phone)
    return res.status(400).json({ success: false, error: "Email or phone required" });

  try {
    const user = email
      ? await User.findOne({ email })
      : await User.findOne({ mobile: phone });

    if (!user || !user.totpSecret)
      return res.status(400).json({ success: false, error: "TOTP not set for this user" });

    // ✅ Generate TOTP using saved secret
    const code = authenticator.generate(user.totpSecret);
    res.json({ success: true, code });
  } catch (err) {
    console.error("Current TOTP error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
router.get("/get-secret", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ success: false, error: "Email required" });

  try {
    const user = await User.findOne({ email });
    if (!user || !user.totpSecret)
      return res.status(400).json({ success: false, error: "TOTP secret not set" });

    res.json({ success: true, secret: user.totpSecret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});
export default router;
