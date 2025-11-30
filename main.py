import json
import os
import hashlib
import base64
import face_recognition
import cv2
import numpy as np
from fastapi import Body
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from twilio.rest import Client

# --- your fingerprint imports (kept for later steps) ---
from fingerprint import (
    FingerprintModule,
    CaptureFingerImage,
    ExtractFeatures,
    BUFFER_1,
    get_port_from_user
)

DATABASE_FILE = "user_db.json"
voted = set()

def hash_aadhaar(a: str) -> str:
    return hashlib.sha256(a.encode()).hexdigest()

def load_users_db():
    if not os.path.exists(DATABASE_FILE):
        return {}
    with open(DATABASE_FILE, "r") as f:
        return json.load(f)

# ----------------- FastAPI setup -----------------

app = FastAPI() 


app.mount("/static", StaticFiles(directory="/static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.get("/")
def index(request: Request):
    return templates.TemplateResponse("vote.html", {"request": request})

# ---------- QR VERIFY API (called from frontend) ----------

@app.post("/api/verify-qr")
async def api_verify_qr(payload: dict):
    """
    Expects: { "qr_data": "<raw string from QR>" }
    Where qr_data is JSON like: {"aadhar": "123456789012"}
    """

    qr_raw = payload.get("qr_data")
    if not qr_raw:
        return JSONResponse(
            {"ok": False, "message": "No QR data received"},
            status_code=400
        )

    # QR content should be JSON like {"aadhar": "..."}
    try:
        qr_obj = json.loads(qr_raw)
    except json.JSONDecodeError:
        return JSONResponse(
            {"ok": False, "message": "QR content is not valid JSON"},
            status_code=400
        )
        
        
    def normalize(a):
        return (
        str(a)
        .replace(" ", "")
        .replace("\n", "")
        .replace("\t", "")
        .strip()
    )

    aadhaar = normalize(qr_obj.get("aadhar", ""))
    if not aadhaar:
        return JSONResponse(
            {"ok": False, "message": "QR does not contain 'aadhar' field"},
            status_code=400
        )

    users_db = load_users_db()
    normalized_db = { key.replace(" ", ""): value for key, value in users_db.items() }
    if aadhaar not in normalized_db:
        print("Aadhaar received:", repr(aadhaar))
        print("Available DB keys:", [repr(k) for k in normalized_db.keys()])
        return JSONResponse(
            {"ok": False, "message": "User not found in database"}
        )

    user = normalized_db[aadhaar]

    # duplicate vote check
    hash_v = hash_aadhaar(user.get("aadhar", user.get("aadhaar")))
    if hash_v in voted:
        return JSONResponse(
            {"ok": False, "message": "This voter has already voted"},
        )

    voted.add(hash_v)

    
    return {
        "ok": True,
        "aadhaar": aadhaar,
        "name": user.get("name", "Unknown"),
        "age": user.get("age", "Unknown"),
        "address": user.get("address", "Unknown"),
    }

# ---------- your existing fingerprint logic (kept for later integration) ----------
# AUTO SELECT SERIAL PORT
def get_auto_port():
    ports = list(serial.tools.list_ports.comports())
    if not ports:
        print("No serial ports found")
        return None

    priority_keywords = ["USB", "UART", "CP2102", "Bridge", "FTDI", "Silicon"]
    auto = 0

    for i, p in enumerate(ports):
        desc = f"{p.description} {p.device}".upper()
        if any(k.upper() in desc for k in priority_keywords):
            auto = i
            break
    return ports[auto].device

import time
import traceback

@app.post("/api/verify-fingerprint")
async def api_verify_fingerprint(payload: dict):
    try:
        print("\n?? /api/verify-fingerprint CALLED")

        aadhaar = payload.get("aadhar")
        if not aadhaar:
            return {"ok": False, "message": "Missing Aadhaar"}

        # Normalize Aadhaar before comparing
        def normalize(a):
            return str(a).replace(" ", "").replace("\n", "").replace("\t", "").strip()

        aadhaar = normalize(aadhaar)
        users_db = load_users_db()

        # Find Match
        user = None
        for u in users_db.values():
            db_aadhaar = normalize(u.get("aadhar", u.get("aadhaar", "")))
            if db_aadhaar == aadhaar:
                user = u
                break


        if user is None:
            print("? Aadhaar not matched in DB")
            return {"ok": False, "message": "User not found"}

        pages = user.get("fingerprint_pages", [])
        if not pages:
            return {"ok": False, "message": "No fingerprint pages stored for this user"}

        print("?? Fingerprint pages:", pages)

        module = FingerprintModule("/dev/ttyUSB0")
        if not module.connect():
            return {"ok": False, "message": "Fingerprint module not connected"}

        print("?? Waiting for finger...")

        # Wait up to 5 sec for finger
        for _ in range(50):
            if module.capture_finger_image() == CaptureFingerImage.SUCCESS:
                break
            time.sleep(0.1)
        else:
            module.disconnect()
            return {"ok": False, "message": "No finger detected"}

        print("?? Fingerprint captured extracting features...")

        if module.extract_features(BUFFER_1) != ExtractFeatures.SUCCESS:
            module.disconnect()
            return {"ok": False, "message": "Fingerprint extraction failed"}

        # MATCH LOOP
        for page in pages:
            print(f"?? Matching Page {page}...")
            match = module.search_template(BUFFER_1, page_id=page, template_count=1)

            if match and match.found_match:
                module.disconnect()
                print("?? MATCH DETECTED")
                return {"ok": True, "message": "Fingerprint verified"}

        module.disconnect()
        print("? MISMATCH no stored print matched")
        return {"ok": False, "message": "Fingerprint mismatch"}

    except Exception as e:
        # ?? Print real crash reason
        print("\n? FINGERPRINT ERROR\n", e)
        import traceback
        traceback.print_exc()
        return {"ok": False, "message": f"Internal Error: {str(e)}"}


@app.post("/api/verify-face")
async def api_verify_face(payload: dict):
    aadhaar = payload.get("aadhar")
    image_data = payload.get("image")

    if not aadhaar or not image_data:
        return {"ok": False, "message": "Missing face data"}

    users_db = load_users_db()

    def normalize(a):
        return str(a).replace(" ", "").replace("\n", "").replace("\t", "").strip()

    user = next((u for u in users_db.values() if normalize(u.get("aadhar", u.get("aadhaar"))) == normalize(aadhaar)), None)
    if not user:
        return {"ok": False, "message": "User not found"}

    face_img_path = user.get("face_image")
    if not face_img_path or not os.path.exists(face_img_path):
        return {"ok": False, "message": "Face image missing"}

    # load registered face
    known_img = face_recognition.load_image_file(face_img_path)
    known_encoding = face_recognition.face_encodings(known_img)[0]

    # decode base64
    if "," in image_data:
        image_data = image_data.split(",")[1]

    try:
        jpg_data = base64.b64decode(image_data)
    except:
        return {"ok": False, "message": "Invalid image data"}

    np_arr = np.frombuffer(jpg_data, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    encodings = face_recognition.face_encodings(rgb)

    if not encodings:
        return {"ok": False, "message": "No face detected"}

    match = face_recognition.compare_faces([known_encoding], encodings[0])[0]

    if match:
        return {"ok": True, "message": "Face verified"}
    else:
        return {"ok": False, "message": "Face not matching"}


@app.post("/api/send-sms")
async def send_sms(payload: dict):
    aadhar = payload.get("aadhar")
    if not aadhar:
        return {"ok": False, "message": "Missing Aadhaar"}

    # Load DB
    users = load_users_db()
    def normalize(a): 
        return str(a).replace(" ", "").replace("\n", "").replace("\t", "").strip()
    aadhar = normalize(aadhar)

    # Find user
    user = None
    for u in users.values():
        if normalize(u.get("aadhar", u.get("aadhaar", ""))) == aadhar:
            user = u
            break

    if not user:
        return {"ok": False, "message": "User not found"}

    phone = user.get("phone")
    if not phone:
        return {"ok": False, "message": "Phone number missing"}

    try:
        account_sid = ""
        auth_token = ""
        twilio_number = ""

        client = Client(account_sid, auth_token)
        message = client.messages.create(
            body="Your vote has been counted. Thank you.",
            from_=twilio_number,
            to="+91" + str(phone) 
        )

        print("SMS sent:", message.sid)
        return {"ok": True, "message": "SMS sent"}

    except Exception as e:
        print("SMS Error:", e)
        return {"ok": False, "message": "SMS sending failed"}


