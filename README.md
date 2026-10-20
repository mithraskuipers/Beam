# Beam

Send files between devices on your local network from any browser. No cloud, no accounts.

## Features

- Pick or drag in any files (up to 1 GB each)
- Files appear live on the receive page
- Preview, copy images, download singly, as a selection, or all at once as a zip
- QR code on the receive page for quick pairing with another device

## Requirements

- Python 3.9+
- Both devices on the same network

## Run

Windows: double-click `start.bat`. It creates a virtual environment, installs dependencies and opens the receive page.

Manual:

```bash
python -m venv venv
venv\Scripts\activate        # Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
python app.py
```

## Usage

1. Open `http://localhost:5050/receive` on the receiving device.
2. On the sending device, open the send URL shown in the terminal, or click "Add device" for a QR code.
3. Choose files. They show up on the receive page instantly.

## Notes

- Uploads are stored in `uploads/` (git-ignored).
- Zip downloads are built in memory, so very large batches need enough free RAM.
- The server listens on all interfaces on port 5050 with no authentication, so only use it on networks you trust.

## Stack

Flask, Flask-SocketIO, qrcode, vanilla JS.
