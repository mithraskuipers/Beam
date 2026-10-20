# Beam

Send photos, videos and files from your phone to your computer over the local network. No cloud, no accounts.

## Features

- Take a photo or record a video straight from the phone browser
- Pick or drag in any files (up to 1 GB each)
- Files appear live on the receiver page
- Preview, copy, download as zip, or delete
- QR code on the receiver for quick phone pairing

## Requirements

- Python 3.9+
- Phone and computer on the same Wi-Fi network

## Run

Windows: double-click `start.bat`. It creates a virtual environment, installs dependencies and opens the receiver page.

Manual:

```bash
python -m venv venv
venv\Scripts\activate        # Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
python app.py
```

## Usage

1. Open `http://localhost:5050/receive` on the computer.
2. Scan the QR code, or open the sender URL shown on the page, on your phone.
3. Take a photo, record a video or choose files. They show up on the computer instantly.

## Notes

- Uploads are stored in `uploads/` (git-ignored).
- Most mobile browsers only allow camera access in a secure context. If it is unavailable, file picking still works.
- The server listens on all interfaces on port 5050 with no authentication, so only use it on networks you trust.

## Stack

Flask, Flask-SocketIO, qrcode, vanilla JS.
