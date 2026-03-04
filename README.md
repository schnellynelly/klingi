# Klingi - Smart Doorbell System

A modern, AI-powered smart doorbell application with real-time video streaming, facial recognition, and two-way audio communication.

![Status](https://img.shields.io/badge/status-production--ready-brightgreen)
![Python](https://img.shields.io/badge/python-3.9+-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 📋 Features

### Core Functionality
- **📹 Live Video Streaming** - Real-time camera feed with 50ms polling
- **🎤 Two-Way Audio** - Talk to visitors using phone microphone
- **👤 Facial Recognition** - AI-powered face detection and identification
- **🔓 Auto-Unlock** - Automatically unlock when recognized person detected
- **📱 Mobile-First UI** - Responsive design optimized for smartphones
- **⚙️ Face Management** - Enroll/delete recognized faces with liveness detection
- **🔐 PIN Authentication** - Secondary unlock with custom PIN
- **📋 Activity Logging** - Real-time event tracking and history
- **🎥 Face Tracking** - Visual bounding box overlay on detected faces
- **⏱️ Motion Detection** - Monitor and alert on motion events

### Security
- Liveness detection (blink & head movement) during enrollment
- Admin PIN protection for settings access
- Secure facial embedding storage
- WebSocket real-time event broadcasting

## 🛠️ Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **OpenCV** - Computer vision and image processing
- **InsightFace** - Deep learning facial recognition
- **NumPy** - Numerical computing
- **MQTT** - IoT messaging for door lock control
- **WebSocket** - Real-time bi-directional communication

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with gradients and animations
- **Vanilla JavaScript** - No frameworks, lightweight
- **MediaRecorder API** - Audio capture for two-way communication
- **Blob URLs** - Efficient image streaming

## 🚀 Installation

### Prerequisites
- Python 3.9 or higher
- pip package manager
- Camera/webcam connected
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Backend Setup

1. **Clone the repository**
```bash
git clone https://github.com/schnellynelly/klingi.git
cd klingi
```

2. **Create virtual environment**
```bash
python -m venv venv

# On Windows:
venv\Scripts\activate

# On Linux/macOS:
source venv/bin/activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Run the server**
```bash
cd backend
python main.py
```

Or with uvicorn directly:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The server will be available at `http://localhost:8000`

## 📱 Running Locally

### Desktop Browser
```
http://localhost:8000
```

### Frontend React (development)

This repo includes a new React + Vite frontend in `frontend-react/`.

1. Install node deps:

```bash
cd frontend-react
npm install
```

2. Run React dev server (proxies /api and /frame.jpg to backend:8000):

```bash
npm run dev
# opens at http://localhost:5173
```

3. Run backend as usual (uvicorn on port 8000) in a separate terminal.

To build for production:

```bash
cd frontend-react
npm run build
# copy/build output will be in frontend-react/dist and served by backend
```

### Mobile Device
1. Find your computer's IP address:
   - **Windows**: `ipconfig` → IPv4 Address
   - **Linux/macOS**: `ifconfig` → inet address

2. On mobile phone, visit:
   ```
   http://[YOUR_IP]:8000
   ```

### HTTPS for Production
For two-way audio on production, HTTPS is required:

```bash
# Using ngrok (temporary HTTPS tunnel):
ngrok http 8000
# Copy the https://xxxxx.ngrok.io URL

# Or with self-signed certificate:
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365
uvicorn app.main:app --ssl-keyfile=key.pem --ssl-certfile=cert.pem
```

**👉 See [HTTPS_SETUP.md](HTTPS_SETUP.md) for detailed setup instructions**

## 📂 Folder Structure

```
klingi/
├── backend/
│   └── app/
│       ├── main.py              # FastAPI application entry point
│       ├── api/
│       │   └── routes.py         # API endpoints
│       ├── database/
│       │   └── db.py             # Database operations
│       ├── camera/
│       │   └── stream.py         # Camera streaming
│       ├── face/
│       │   ├── engine.py         # Face detection/recognition
│       │   └── store.py          # Face embedding storage
│       ├── audio/
│       │   └── tts.py            # Text-to-speech
│       ├── mqtt/
│       │   └── client.py         # MQTT door lock control
│       ├── security/
│       │   └── pin.py            # PIN verification
│       ├── services/
│       │   └── events.py         # Event utilities
│       └── ws/
│           └── hub.py            # WebSocket broadcast
│
├── frontend/
│   ├── templates/
│   │   └── index.html            # Single-page app
│   └── static/
│       ├── app.js                # Frontend logic
│       └── style.css             # Styling
│
├── requirements.txt              # Python dependencies
├── .gitignore                    # Git ignore rules
├── README.md                     # This file
└── .env.example                  # Example environment variables
```

## ⚙️ Configuration

Create a `.env` file (copy from `.env.example`):

```env
# Camera
CAM_INDEX=0

# MQTT (door lock control)
MQTT_HOST=127.0.0.1
MQTT_PORT=1883
MQTT_BASE=klingi

# Admin
PIN=1234

# Face Recognition
FACE_THRESHOLD=0.28
```

## 📚 Documentation Guides

### [HTTPS Setup Guide](HTTPS_SETUP.md)
Complete guide for setting up HTTPS:
- **ngrok** for quick testing (recommended)
- **Self-signed certificates** for localhost
- **Let's Encrypt** for production domains
- Troubleshooting microphone access
- Cloud hosting options (AWS, Heroku, Linode)

### [Face Enrollment Guide](FACE_ENROLLMENT.md)
Step-by-step face registration:
- How to enroll new people
- Liveness detection (blink & movement)
- View and delete enrolled faces
- Testing face recognition
- Troubleshooting enrollment issues
- Tips for best recognition accuracy

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/pin` - Unlock with PIN
- `POST /api/door/unlock` - Manual unlock

### Face Management
- `GET /api/faces` - List enrolled faces
- `POST /api/faces/enroll` - Enroll new face
- `DELETE /api/faces/{id}` - Delete enrolled face
- `POST /api/liveness/check` - Verify liveness (blink detection)

### Recognition
- `POST /api/ring` - Trigger face recognition
- `GET /api/detect` - Get current face bounding box

### Streaming
- `GET /frame.jpg` - Single JPEG frame
- `GET /stream.mjpg` - MJPEG video stream
- `POST /api/audio` - Upload two-way audio

### System
- `GET /api/health` - Health check
- `GET /api/logs` - Event logs
- `GET /api/cam_status` - Camera diagnostics

## 🎬 Demo Flow

1. **Home Page** - Live camera feed with action buttons
2. **Recognition** - Tap "Recognize" to detect faces
3. **Enrollment** - Go to Settings → Enroll New Face
4. **Talk** - Use microphone button for two-way audio
5. **Activity** - Check Activity tab for event history

**👉 See [ENROLLMENT.md](ENROLLMENT.md) for detailed enrollment documentation**

## 🔒 Security Notes

⚠️ **Important for Production**:
- Change default PIN (currently `1234`)
- Use HTTPS/SSL certificates
- Implement proper authentication
- Don't expose MQTT port publicly
- Store sensitive keys in environment variables
- Implement rate limiting

## 🚨 Troubleshooting

### Camera not showing
- Check camera permissions
- Verify camera is not in use by another app
- Try different camera index in `.env`
- Check `/api/cam_status` endpoint

### Microphone not working
- **HTTPS required** for audio on production
- Check browser microphone permissions
- Try ngrok for HTTPS tunnel on localhost

### Face not detected
- Ensure good lighting
- Look directly at camera
- Try again with different angle
- Check `/api/health` to verify backend

### Bounding box misaligned
- Wait for naturalWidth/Height to load
- Refresh camera frame
- Check browser console for errors

## 📊 Performance

- **Frame polling**: 50ms (20 FPS)
- **Face tracking**: 200ms (5 Hz)
- **Audio recording**: 30s max auto-stop
- **Activity log**: Last 50 events in memory
- **Database**: SQLite3 local

## 🔄 WebSocket Events

Real-time events broadcasted to connected clients:

```javascript
// Recognized face
{ event: 'recognized', detail: 'John', bbox: [...], ts: '...' }

// Unknown face
{ event: 'deny', detail: 'unknown face', bbox: [...], ts: '...' }

// Face enrolled
{ event: 'face_enrolled', detail: 'John', ts: '...' }

// Door unlocked
{ event: 'unlock', detail: 'PIN accepted', ts: '...' }

// Audio communication
{ event: 'audio_call', detail: 'two-way audio from mobile', ts: '...' }
```

## 🎯 Future Improvements

- [ ] Dashboard with analytics
- [ ] Multi-device support
- [ ] Cloud backup for face embeddings
- [ ] Package doorbell API for third-party integrations
- [ ] Mobile app (iOS/Android native)
- [ ] Push notifications
- [ ] Video recording/playback
- [ ] Advanced motion zones
- [ ] Night vision support
- [ ] Integration with smart home systems (Home Assistant, etc.)
- [ ] Machine learning model optimization
- [ ] Distributed architecture for multiple doors

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📧 Support

For issues and questions:
- GitHub Issues: [github.com/schnellynelly/klingi/issues](https://github.com/schnellynelly/klingi/issues)
- Email: support@klingi.local

## 🙏 Acknowledgments

- InsightFace for facial recognition models
- FastAPI for web framework
- OpenCV for computer vision
- Community contributions and feedback

---

**Made with ❤️ for smart home security**

**Status**: Production-Ready | **Version**: 1.0.0 | **Last Updated**: 2026
