# Smart Face Biometric Attendance System

Enterprise-grade college attendance management ERP with face biometric verification and GPS geo-fencing.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React.js + Vite + Tailwind CSS + Framer Motion |
| Backend | Node.js + Express.js |
| Database | Supabase (PostgreSQL) |
| File Storage | Supabase Storage (Cloud) |
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

Run the schema initialization script using npm:

```bash
cd Backend
npm run init-db
```
*(Requires `DATABASE_URL` in your `.env` file)*

---

## 2. Backend Setup

```bash
cd backend
```

Create a `.env` file inside the `backend` folder and configure your database credentials.

Example:

```env
PORT=5000
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres"
SUPABASE_URL="https://xxxx.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
JWT_SECRET="your_secret_key"
JWT_REFRESH_SECRET="your_refresh_secret_key"
ADMIN_EMAIL="admin@college.edu"
ADMIN_PASSWORD="admin"
```

Install dependencies and start backend server:

```bash
npm install
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
├── Frontend/
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
├── Backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── database/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── utils/
│   │
│   ├── package.json
│   └── .env
│
├── api/
│   └── index.js (Vercel Entry Point)
├── vercel.json (Vercel config)
├── README.md
└── .gitignore
```

---

# Cloud Deployment (Vercel)

This project is configured for a zero-config deployment on Vercel:

1. Import the repository in Vercel.
2. Leave the **Root Directory** as `/`.
3. Add the environment variables from your `.env` file.
4. Click Deploy. 

Vercel will automatically build the React frontend and host the Express backend as a serverless function on `/api`. File uploads are managed by Supabase Storage to prevent ephemeral data loss.

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

**Mounika Nagarajan**
