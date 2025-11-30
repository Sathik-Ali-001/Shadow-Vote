let ws;
let stream = null;
let isScanning = false;
let scanIntervalId = null;
let videoElement, canvasElement, scanOverlay, statusBox, startBtn, stopBtn;
let qrNameField, qrIdField, qrAddressField;
let currentAadhaar = null;




/* Wait until DOM loads */
document.addEventListener("DOMContentLoaded", () => {
    // Initialize DOM elements
    videoElement = document.getElementById("video");
    canvasElement = document.getElementById("canvas");
    scanOverlay = document.getElementById("scanOverlay");
    statusBox = document.getElementById("statusBox");
    startBtn = document.getElementById("startBtn");
    stopBtn = document.getElementById("stopBtn");

    qrNameField = document.getElementById("qrName");
    qrIdField = document.getElementById("qrId");
    qrAddressField = document.getElementById("qrAddress");

    // Set initial screen and status
    goTo(1); // Start with screen 1
    if (statusBox) statusBox.textContent = "📷 Ready to scan. Click Start Scanning.";
});

function goTo(screen) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const target = document.getElementById(`screen${screen}`);
    if (target) target.classList.add("active");

    if (screen === 2) setTimeout(() => startScanning(), 150);
    if (screen === 4 && currentAadhaar) setTimeout(() => startFingerprintScan(), 250);
    if (screen === 5) setTimeout(() => initCamera(), 250);
}




/* ---------------- CAMERA + QR SCAN ---------------- */
async function startScanning() {
    try {
        if (!statusBox || !videoElement || !scanOverlay) return;

        statusBox.textContent = "📷 Requesting camera access...";

        const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });

        stream = mediaStream;
        videoElement.srcObject = stream;
        isScanning = true;

        if (startBtn) startBtn.style.display = "none";
        if (stopBtn) stopBtn.style.display = "block";
        scanOverlay.style.display = "block";

        statusBox.className = "status-box detecting show";
        statusBox.textContent = "📷 Position the QR code within the frame";

        videoElement.onloadedmetadata = () => initializeScanning();
    } catch (error) {
        handleCameraError(error);
    }
}


function initializeScanning() {
    if (!canvasElement || !videoElement || !statusBox) return;

    const ctx = canvasElement.getContext("2d");
    if (!ctx) {
        statusBox.className = "status-box error show";
        statusBox.textContent = "⚠️ Canvas error.";
        return;
    }

    scanIntervalId = setInterval(() => {
        if (videoElement.readyState >= 2) {
            canvasElement.width = videoElement.videoWidth;
            canvasElement.height = videoElement.videoHeight;

            ctx.drawImage(videoElement, 0, 0);
            const imageData = ctx.getImageData(
                0,
                0,
                canvasElement.width,
                canvasElement.height
            );

            const qrData = detectQRCode(imageData);
            if (qrData) handleQRCodeDetected(qrData);
        }
    }, 300);
}

function detectQRCode(imageData) {
    if (typeof jsQR === "undefined") return null;

    const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert"
    });

    return code ? code.data : null;
}

/* -------- Send QR to backend instead of parsing locally -------- */
async function handleQRCodeDetected(qrData) {
    if (!statusBox || !qrNameField || !qrIdField || !qrAddressField) return;

    statusBox.className = "status-box detecting show";
    statusBox.textContent = "✓ QR detected, verifying with server...";

    stopScanning();

    try {
        const res = await fetch("/api/verify-qr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ qr_data: qrData })
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
            // Show backend message
            statusBox.className = "status-box error show";
            statusBox.textContent = "❌ " + (data.message || "Verification failed");

            // Special handling for already voted
            if (data.message && data.message.includes("already voted")) {
                setTimeout(() => {
                    goTo(1);
                }, 2000);
            }

            return;
        }

        currentAadhaar = data.aadhaar;   // ? Save Aadhaar globally
	qrNameField.textContent = data.name || "N/A";
	qrIdField.textContent = data.age || "N/A";
	qrAddressField.textContent = data.address || "N/A";



        statusBox.className = "status-box detected show";
        statusBox.textContent = "✔ QR Verified — Redirecting...";

        setTimeout(() => goTo(3), 800);
    } catch (err) {
        statusBox.className = "status-box error show";
        statusBox.textContent = "⚠ Server error — try again";
        console.error(err);
    }
}

/* ---------------- STOP CAMERA ---------------- */
function stopScanning() {
    isScanning = false;

    if (scanIntervalId) clearInterval(scanIntervalId);
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }

    if (videoElement) videoElement.srcObject = null;
    if (startBtn) startBtn.style.display = "block";
    if (stopBtn) stopBtn.style.display = "none";
    if (scanOverlay) scanOverlay.style.display = "none";
}


/* ---------------- ERROR ---------------- */
function handleCameraError(error) {
    if (statusBox) {
        statusBox.className = "status-box error show";
        statusBox.textContent = `⚠️ Camera Error: ${error.message}`;
    }
}

async function startFingerprintScan() {
    const status = document.getElementById("fingerStatus");
    status.textContent = "?? Scanning fingerprint...";
    status.className = "bio-status waiting";

    const res = await fetch("/api/verify-fingerprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aadhar: currentAadhaar })
    });

    const data = await res.json();

    if (data.ok) {
        status.textContent = "Fingerprint verified";
        status.className = "bio-status success";
        setTimeout(() => goTo(5), 800);  // go to face page
    } else {
        status.textContent = "? " + data.message;
        status.className = "bio-status failed";
    }
}


async function initCamera() {
    const video = document.getElementById("faCeVideo");
    const canvas = document.getElementById("faceCanvas");
    const detectionStatus = document.getElementById("detectionStatus");
    const continueBtn = document.getElementById("continueBtn");

    try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });

        video.srcObject = mediaStream;

        video.onloadedmetadata = () => {
            video.play();
        };

        const ctx = canvas.getContext("2d");

        async function verifyLoop() {
            if (!video.videoWidth || !video.videoHeight) {
                return setTimeout(verifyLoop, 250);
            }

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            let dataURL = canvas.toDataURL("image/jpeg");
            if (!dataURL || dataURL.length < 10000) {
                return setTimeout(verifyLoop, 250);
            }

            const res = await fetch("/api/verify-face", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    aadhar: currentAadhaar,
                    image: dataURL
                })
            });
		const data = await res.json();
		if (data.ok) {
                detectionStatus.textContent = "Face verified";
                detectionStatus.classList.remove("detecting");
                detectionStatus.classList.add("success");
                continueBtn.disabled = false;
		video.srcObject.getTracks().forEach(t => t.stop());
	} else {
		detectionStatus.textContent = "Wrong person - try again";
		detectionStatus.classList.remove("detecting");
                detectionStatus.classList.add("failed");
                continueBtn.disabled = true;
		setTimeout(() => {
                    detectionStatus.classList.remove("failed");
                    detectionStatus.classList.add("detecting");
                    detectionStatus.textContent = "Detecting face...";
                }, 1500);

                setTimeout(verifyLoop, 250);
            }
        }

        verifyLoop();
	} catch (err) {
		detectionStatus.textContent = "Camera access denied";
		detectionStatus.classList.remove("detecting");
		detectionStatus.classList.add("failed");
		continueBtn.disabled = true;
		console.error("Camera error:", err);
    }
}


async function castVote() {
    // Send SMS
    await fetch("/api/send-sms", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ aadhar: currentAadhaar })
    });

    goTo(7); // Move to success page
}







