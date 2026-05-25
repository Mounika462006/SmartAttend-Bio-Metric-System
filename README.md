# Smart Face Biometric Attendance System

Enterprise-grade college attendance management ERP with face biometric verification and GPS geo-fencing.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js + Tailwind CSS + Framer Motion |
| Backend | Node.js + Express.js |
| Database | MySQL |
| Auth | JWT + bcrypt + Refresh Tokens |
| Biometrics | face-api.js + WebCamera API |
| Location | Browser Geolocation API |

## Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.0+

### 1. Database Setup

```sql
-- Run the schema file in MySQL:
mysql -u root -p < backend/src/database/schema.sql
```

### 2. Backend Setup

```bash
cd backend
# Copy and configure environment
cp .env .env.local
# Edit .env: Set DB_PASSWORD to your MySQL password

npm install
npm run seed     # Create default admin account
npm run dev      # Start development server (port 5000)
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev      # Start Vite dev server (port 5173)
```

### 4. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api/health

## Default Credentials

| Role | Email | Password |
|------|-------|---------|
| Admin | admin@college.edu | admin123 |
| Staff | staff@college.edu | staff123 |

> **Note**: Change these passwords immediately after first login in a production environment.

## User Flows

### Student Registration Flow
1. Register at `/register` (multi-step form)
2. Admin approves account at Admin Panel > Students
3. Student logs in and completes biometric face registration
4. Student can mark attendance with GPS + face verification

### Attendance Marking Flow
1. GPS location verified (must be within campus radius)
2. Live camera opened
3. Face captured and compared with stored biometric
4. If match score ≥ 60% AND within campus → attendance marked
5. Duplicate prevention: one entry per session per day

### Leave Management Flow
1. Student applies for leave with reason + document
2. Staff reviews and approves/rejects
3. If approved, attendance records auto-updated as 'leave'
4. Student notified via in-app notifications

## Project Structure

```
Mouni Project/
├── frontend/
│   └── src/
│       ├── api/          # Axios + API service layer
│       ├── components/   # Reusable UI components
│       ├── context/      # React contexts (Auth)
│       ├── hooks/        # Custom hooks
│       ├── layouts/      # Page layouts
│       ├── pages/        # Route pages by role
│       ├── routes/       # Protected route logic
│       └── utils/        # Utility functions
└── backend/
    └── src/
        ├── config/       # DB, JWT, Multer configs
        ├── controllers/  # Business logic
        ├── database/     # Schema SQL + seed script
        ├── middleware/   # Auth, validation, error handler
        ├── routes/       # Express routers
        ├── uploads/      # File storage
        └── utils/        # Geo, response utilities
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login (student/staff/admin) |
| POST | /api/auth/register | Student registration |
| POST | /api/auth/refresh | Refresh access token |
| POST | /api/auth/logout | Logout |

### Attendance
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/attendance/mark | Mark attendance (GPS + Face) |
| GET | /api/attendance/history | Student attendance history |
| GET | /api/attendance/stats | Student attendance statistics |
| GET | /api/attendance/department | Department attendance (Staff/Admin) |

### Biometric
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/biometric/register | Register face biometric |
| GET | /api/biometric/descriptor | Get stored face descriptor |
| GET | /api/biometric/status | Biometric registration status |

### Leave
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/leave/apply | Apply for leave |
| GET | /api/leave/my | Get my leave requests |
| GET | /api/leave/all | Get all leaves (Staff/Admin) |
| PATCH | /api/leave/:id/review | Approve/Reject leave |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/dashboard | Dashboard analytics |
| GET | /api/admin/students | All students with filters |
| PATCH | /api/admin/students/:id/status | Approve/Reject student |
| GET/POST | /api/admin/holidays | Holiday management |
| GET/PUT | /api/admin/geo-fencing | Geo-fencing settings |
| GET/PUT | /api/admin/attendance-settings | Attendance timing |

## Security Features

- JWT access tokens (15min expiry) + refresh tokens (7 days)
- bcrypt password hashing (12 rounds)
- Rate limiting on all API endpoints
- Additional rate limiting on login endpoint
- Role-based access control (RBAC)
- Security audit logs for all auth events
- Helmet.js security headers
- CORS configuration

## Face Biometric System

- Uses face-api.js with TinyFaceDetector + FaceLandmark68 + FaceRecognition models
- 128-dimensional face descriptor stored per student
- Euclidean distance comparison for attendance verification
- Registration requires 2-photo validation (≥70% similarity threshold)
- Attendance requires ≥60% face match score
- Anti-spoofing: live camera only, photo/screenshot detection
