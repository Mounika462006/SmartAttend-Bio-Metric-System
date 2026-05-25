# Smart Face Biometric Attendance System

Enterprise-grade college attendance management ERP with face biometric verification and GPS geo-fencing.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React.js + Tailwind CSS + Framer Motion |
| Backend | Node.js + Express.js |
| Database | MySQL |
| Authentication | JWT + bcrypt |
| Biometrics | face-api.js + WebCamera API |
| Location Tracking | Browser Geolocation API |

---

## Features

- Face biometric attendance verification
- GPS-based geo-fencing system
- Student, Staff, and Admin dashboards
- Leave management system
- Attendance analytics and monitoring
- Role-based access control (RBAC)
- Secure JWT authentication
- Real-time attendance tracking
- Holiday and attendance settings management

---

## Prerequisites

Before running the project, install:

- Node.js 18+
- MySQL 8.0+

---

# Project Setup

## 1. Database Setup

Run the schema file in MySQL:

```sql
mysql -u root -p < backend/src/database/schema.sql
```

---

## 2. Backend Setup

```bash
cd backend
```

Create a `.env` file inside the `backend` folder and configure your database credentials.

Example:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=smart_attendance_db
JWT_SECRET=your_secret_key
```

Install dependencies and start backend server:

```bash
npm install
npm run seed
npm run dev
```

Backend server runs on:

```bash
http://localhost:5000
```

---

## 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on:

```bash
http://localhost:5173
```

---

## Project Structure

```bash
SmartAttend-Bio-Metric-System/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── routes/
│   │   └── utils/
│   │
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── database/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── uploads/
│   │   └── utils/
│   │
│   ├── package.json
│   └── .env
│
├── README.md
└── .gitignore
```

---

# API Endpoints

## Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | Student registration |
| POST | `/api/auth/logout` | Logout |

---

## Attendance

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/attendance/mark` | Mark attendance |
| GET | `/api/attendance/history` | Attendance history |
| GET | `/api/attendance/stats` | Attendance statistics |

---

## Biometric

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/biometric/register` | Register face biometric |
| GET | `/api/biometric/status` | Biometric status |

---

## Leave Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/leave/apply` | Apply leave |
| GET | `/api/leave/my` | My leave requests |
| PATCH | `/api/leave/:id/review` | Approve or reject leave |

---

## Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Dashboard analytics |
| GET | `/api/admin/students` | Student management |
| GET/PUT | `/api/admin/geo-fencing` | Geo-fencing settings |
| GET/PUT | `/api/admin/attendance-settings` | Attendance settings |

---

# Security Features

- JWT authentication
- Password hashing using bcrypt
- Role-based access control
- API rate limiting
- Helmet.js security headers
- Secure CORS configuration

---

# Face Biometric System

- Face detection using `face-api.js`
- 128-dimensional face descriptor matching
- GPS + face verification for attendance
- Anti-spoofing using live camera verification
- Attendance marked only within campus geo-fence

---

# Important Notes

- Do not upload `.env` files to GitHub
- Do not upload `node_modules`
- Do not upload biometric image files
- Add proper `.gitignore` before pushing repository

---

# Author

**Mounika**
