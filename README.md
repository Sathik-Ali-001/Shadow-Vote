🗳️ Voter Verification & Secure Digital Voting System

A fully automated voter authentication and digital voting platform built using:

FastAPI (Python backend)

QR Scanning

Fingerprint Verification

Face Recognition

Secure Duplicate-Vote Prevention using Hash-Chain (ZKP-style)

SMS Confirmation via Twilio

Interactive UI (HTML + CSS + JavaScript)

This system ensures that only the legitimate voter can cast a vote, while preserving privacy, security, and auditability — without storing any personal information directly.




🚀 Key Features

Feature	Status:
QR Code Scan & Identity Fetch	✔
Fingerprint Authentication	✔
Face Recognition & Liveness	✔
Vote Privacy & Anti-Duplicate Log	✔ (Zero-Knowledge Proof style)
SMS Confirmation to Voter	✔
UI optimized for Raspberry Pi touchscreen	✔
Full offline + secure storage	✔



🔐 How Privacy is Guaranteed

The system never stores Aadhaar or personal details anywhere.

This allows the system to:

Detect duplicate voting

Never reveal Aadhaar or identity

Maintain tamper-proof vote logs using a blockchain-like chained hash structure

This design models zk-identity workflows similar to Midnight / Cardano privacy protocols, without requiring their closed SDK.



⚙️ System Workflow

Scan QR → Verify Identity → Fingerprint Match →
Face Match → Cast Vote → SMS Confirmation


📩 SMS Notification Format

After vote submission, the registered mobile number receives:

Your vote has been successfully recorded. Thank you for participating in the election.


📦 Installation & Run

pip install fastapi uvicorn python-multipart twilio face-recognition opencv-python
uvicorn main:app --reload


⚠️ Important Notes / System Requirements

This prototype involves hardware-assisted biometric authentication. To ensure proper functioning of the system, the following requirements and constraints must be acknowledged:

🔹 Hardware Dependencies

The application requires:

A Fingerprint Scanner Module (R307 / GT-511 / compatible serial biometric sensor)

A Web Camera with user permission for live face capture

Without these biometric devices physically connected, the verification flow will not proceed.

🔹 Browser Permissions

The following permissions must be granted by the end user:

Camera access

Autoplay permission for video stream

Face verification will not function if the browser blocks access to camera or if permissions are denied.

🔹 Limited Deployment Behavior

Because biometric devices are connected locally:

The backend must run on the same machine where the fingerprint scanner and camera are connected

The biometric verification process cannot run fully because fingerprint and face authentication require physical hardware access.



NOTE:-

For transparency, this repository includes only the Midnight protocol contract source file inside the "midnight-contract/" folder.
The full Midnight runtime project is excluded due to file size and environment requirements, but this contract represents the exact ZK-verification logic intended for deployment in the Midnight chain.
