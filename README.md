# Lead Manager Application

A complete full-stack application for managing leads and multi-tenant support.

## Features

- Multi-tenant architecture
- Role-based access control (Admin, Editor, Viewer)
- User authentication with JWT
- Multi-device session management
- Activity logging
- Queue jobs system

## Tech Stack

**Backend:**
- Node.js with Express
- PostgreSQL
- JWT authentication
- bcryptjs for password hashing

**Frontend:**
- React.js
- Tailwind CSS
- Lucide React icons
- Context API for state management

## Database Schema

The application includes the following tables:
- tenants
- users, roles, permissions, role_has_permissions
- password_resets, sessions
- jobs

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- Supabase account

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Update the `.env` file with your credentials:
```
PORT=3001
JWT_SECRET=your_strong_random_secret
DATABASE_URL="postgresql://user:password@host:port/db_name?schema=public" 
```
5. Run migrate command 
```bash 
npx prisma generate
```
6. Run migrate command 
```bash 
npx prisma migrate dev
```

7. Seed the database with default user:
```bash
npm run seed
```

8. Start the backend server:
```bash
npm start
```

The backend will run on http://localhost:3001

### Frontend Setup

1. Navigate to the project root directory

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on http://localhost:5173

## Default Login Credentials

After running the seed script, use these credentials to log in:

- Email: `admin@example.com`
- Password: `admin123`

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login with email and password
- `POST /api/auth/logout` - Logout (requires authentication)
- `GET /api/auth/me` - Get current user info (requires authentication)

## Project Structure

```
project/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── supabase.js
│   │   ├── controllers/
│   │   │   └── authController.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── routes/
│   │   │   └── authRoutes.js
│   │   ├── index.js
│   │   └── seed.js
│   └── package.json
├── src/
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── pages/
│   │   ├── Login.jsx
│   │   └── Dashboard.jsx
│   ├── App.jsx
│   └── main.jsx
└── package.json
```

## Security Features

- Password hashing with bcrypt
- JWT-based authentication
- Row Level Security (RLS) on all tables
- Tenant isolation
- Session tracking with IP and user agent
- Activity logging

## Development

To run both frontend and backend in development mode:

1. Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

2. Terminal 2 (Frontend):
```bash
npm run dev
```

## Building for Production

Frontend:
```bash
npm run build
```

Backend:
```bash
cd backend
npm start
```

## License

MIT
