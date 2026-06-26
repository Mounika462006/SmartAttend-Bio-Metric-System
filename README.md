# Smart Face Biometric Attendance System

**Advanced Biometric Access Solutions**

An enterprise-grade attendance management ERP with AI-driven face biometric verification and secure GPS geo-fencing.

---

## Project Overview

**Purpose**: To automate, secure, and streamline college attendance management using modern biometric and geolocation technologies.

**Problem Statement**: Manual attendance tracking is time-consuming, prone to human error, and susceptible to proxy attendance, leading to inaccurate institutional records.

**Objective**: To provide a robust platform that ensures students are physically present on campus through facial recognition and spatial verification before marking attendance.

**Target Users**: 
- **Students**: To mark attendance and apply for leaves.
- **Staff (Faculty)**: To monitor student attendance and approve leaves.
- **Administrators**: To manage users, configure geo-fencing, and view analytics.

**Benefits**:
- Eliminates proxy attendance completely.
- Real-time attendance analytics and reporting.
- Paperless, automated leave management workflow.

---

## Features

### Implemented Features
- Real-time face biometric registration and verification.
- GPS-based geo-fencing validation.
- Comprehensive attendance analytics and monitoring.
- Automated leave management system.
- Secure, unified serverless deployment structure.

### Admin Features
- Student and Staff approval workflows.
- Geo-fence radius and coordinate configuration.
- Global attendance time window and holiday management.
- Security logs and systemic analytics.

### User Features
- Secure student portal for marking attendance via webcam.
- Staff dashboard for monitoring departmental attendance.
- View personal attendance history and statistics.
- File-based leave application portal.

### Security Features
- Secure session-based authentication using JWT.
- Password hashing using `bcrypt`.
- Role-Based Access Control (RBAC) across all API routes.
- Cloud-based storage for sensitive biometric references.

### Future Scope
- This feature appears to be under development: Real-time SMS/Email notifications for parents regarding student absence.

---

## Tech Stack

| Layer | Technology |
|--------|------------|
| Frontend | React.js, Vite, Tailwind CSS, Framer Motion |
| Backend | Node.js, Express.js |
| Database | Supabase (PostgreSQL) |
| Authentication | JWT, bcrypt |
| Build Tool | Vite, npm |
| Deployment | Vercel |
| Version Control | Git |
| IDE | VS Code |

---

## Project Architecture

**Frontend**: A Single Page Application (SPA) built with React and Vite, utilizing Tailwind CSS for styling and `lucide-react` for iconography. 

**Backend**: A Node.js and Express.js REST API that handles business logic, biometric score thresholding, and database interactions.

**Database**: Supabase (PostgreSQL) is used for relational data storage, while Supabase Storage buckets handle biometric image and leave attachment persistence.

**Request Flow**: Client initiates an action (e.g., face scan) -> Frontend validates GPS -> Request sent to Backend API -> Backend verifies JWT and processes image/data -> Backend queries Supabase -> Backend responds to Client.

**Response Flow**: Database returns payload -> Backend formats response -> Frontend updates local state and renders success/error toast notifications.

**Overall Architecture**: A unified monorepo deployed as a Serverless application on Vercel, integrating external Database-as-a-Service (Supabase) for persistent storage.

---

## Folder Structure

```text
SmartAttend-Bio-Metric-System/
├── api/
│   └── index.js
├── Backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── database/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── utils/
│   ├── .env
│   └── package.json
├── Frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── layouts/
│   │   └── pages/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── package.json
├── README.md
└── vercel.json
```

---

## Installation

```bash
# Clone the repository
git clone <repository_url>
cd SmartAttend-Bio-Metric-System

# Install all dependencies (Frontend & Backend)
npm run install-all

# Initialize the database schema
cd Backend
npm run init-db
cd ..

# Run both Frontend and Backend concurrently
npm run dev
```

---

## Configuration

- `Backend/.env`: Required for server port, database connections, and JWT secrets.
- `vercel.json`: Required for Vercel serverless routing configuration.
- `Frontend/vite.config.js`: Configuration for Vite build and development server proxy.

---

## Environment Variables

| Variable | Purpose | Required | Default Value |
|----------|---------|----------|---------------|
| `PORT` | Backend server port | No | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | Yes | None |
| `SUPABASE_URL` | Supabase project URL | Yes | None |
| `SUPABASE_ANON_KEY` | Supabase API key | Yes | None |
| `JWT_SECRET` | Secret for signing JWTs | Yes | None |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | Yes | None |
| `ADMIN_EMAIL` | Default admin email | No | `admin@college.edu` |
| `ADMIN_PASSWORD` | Default admin password | No | `admin123` |

---

## Database

Tables observed in the schema:
- `admins`
- `departments`
- `staff`
- `students`
- `biometric_data`
- `geo_fencing`
- `attendance_settings`
- `attendance`
- `leaves`

**Relationships**: 
- `students` and `staff` belong to `departments`.
- `biometric_data`, `attendance`, and `leaves` are tied directly to `students` via foreign keys.

**Purpose**: To securely maintain institutional hierarchies, user credentials, biometric face descriptors (128-dimensional arrays), and daily attendance logs.

---

## API Documentation

| Method | Endpoint | Purpose | Authentication |
|--------|----------|---------|----------------|
| `POST` | `/api/auth/login` | Authenticate user and issue JWT | No |
| `POST` | `/api/auth/register` | Register a new student account | No |
| `POST` | `/api/auth/logout` | Invalidate current session | Yes |
| `POST` | `/api/attendance/mark` | Validate GPS and Face, record attendance | Yes |
| `GET` | `/api/attendance/history` | Retrieve user attendance logs | Yes |
| `POST` | `/api/biometric/register` | Upload and process baseline face descriptors | Yes |
| `POST` | `/api/leave/apply` | Submit leave request with attachment | Yes |
| `PATCH` | `/api/leave/:id/review` | Admin/Staff approve or reject leave | Yes |
| `GET` | `/api/admin/dashboard` | Fetch institutional metrics | Yes |
| `PUT` | `/api/admin/geo-fencing` | Update campus GPS coordinates and radius | Yes |

---

## Authentication

Authentication is implemented using **JSON Web Tokens (JWT)**. Users provide credentials which are verified against `bcrypt` hashed passwords in the database. Upon success, an HttpOnly token is issued to manage the session securely.

---

## User Roles

- **Student**: Can register biometrics, mark daily attendance, view personal history, and apply for leaves.
- **Staff**: Can monitor attendance and manage leave requests for students within their specific department.
- **Admin**: Has global access to manage all users, adjust geo-fencing parameters, and view system-wide analytics.

---

## Application Workflow

1. Admin configures the global Geo-fencing coordinates and Attendance time windows.
2. Student registers for an account, which is then approved by an Admin.
3. Student logs in and performs a one-time Biometric Registration using their webcam to capture facial descriptors.
4. Daily, the student clicks "Mark Attendance". The system validates their browser GPS against the Admin's geo-fence.
5. If within bounds, the webcam captures a live frame, extracts the face descriptor, and compares it to the registered baseline.
6. If the similarity score passes the threshold, attendance is marked.
7. Staff and Admins review the daily metrics on their respective dashboards.

---

## Validation

- **Frontend validation**: Input constraints and regex matching (e.g., `.edu` or `@gmail.com` email requirements) enforced before submission.
- **Backend validation**: Express middleware strictly validates payload formats and prevents invalid states.
- **Database validation**: PostgreSQL constraints (`UNIQUE`, `FOREIGN KEY`, `CHECK`) maintain referential integrity.

---

## Security

- **Password hashing**: Implemented using `bcryptjs` with a high salt round.
- **JWT**: Implemented for stateless session verification.
- **Role-Based Access**: Middleware blocks unauthorized roles from accessing restricted endpoints.
- **XSS prevention**: Automatically handled by React DOM escaping in the frontend.
- **Rate limiting**: Not implemented.
- **CSRF**: Not explicitly implemented beyond standard CORS configuration.

---

## Error Handling

Standard HTTP status codes (`400`, `401`, `403`, `404`, `500`) are strictly utilized by the Express backend. The frontend captures these responses and displays user-friendly error messages via `react-hot-toast` notifications.

---

## Logging

Not implemented beyond standard Node.js development console logging.

---

## Performance

- Monorepo structure configured for optimized serverless deployment on Vercel.
- Supabase Edge infrastructure ensures rapid database queries.
- Heavy biometric processing (`face-api.js`) is offloaded to the client's browser to reduce server CPU load.

---

## Testing

Not available in the current project.

---

## Deployment

This project is configured for a zero-config serverless deployment on **Vercel**. The root `vercel.json` proxies frontend and API traffic seamlessly, utilizing the `api/index.js` entry point.

---

## Screenshots

- `[Screenshot: Login Interface Placeholder]`
- `[Screenshot: Admin Dashboard Placeholder]`
- `[Screenshot: Student Face Verification Placeholder]`

---

## Known Limitations

- Real-time parental SMS notifications: This feature appears to be under development.
- Automated Testing: Not available in the current project.
- Rate Limiting: Not implemented, which may expose the API to brute-force attempts.

---

## Future Improvements

- **Recommendations**: Implement comprehensive E2E testing (e.g., Cypress/Playwright).
- **Recommendations**: Add express-rate-limit to secure authentication endpoints.
- **Recommendations**: Introduce a real-time WebSocket connection for instant admin notifications when an unauthorized access attempt occurs.

---

## Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

No license file found.

---

## Author

**Name**: Mounika Nagarajan  

---

## Acknowledgements

- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Express](https://expressjs.com/)
- [Supabase](https://supabase.com/)
- [face-api.js](https://github.com/justadudewhohacks/face-api.js/)
- [Tailwind CSS](https://tailwindcss.com/)

---

## FAQ

**Q: Can I use this without a webcam?**
A: No, the system strictly requires a webcam for live facial recognition.

**Q: Are there automated tests?**
A: Testing is not available in the current project.

**Q: Does it work if the student fakes their GPS location?**
A: The system relies on the Browser Geolocation API. While spoofing is possible, advanced mobile restrictions and continuous tracking are recommended for high-security deployments.

---

## Conclusion

The Smart Face Biometric Attendance System is a highly secure, modern platform that effectively prevents proxy attendance. By combining live facial recognition with spatial geolocation, it provides a trustworthy and automated ecosystem for academic institutions.
