# Smart Event Safety Platform - Frontend

A modern React frontend for the Smart Event Safety Platform with a futuristic smart-city dark UI design.

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Socket.io-client** - Real-time WebSocket communication
- **Zustand** - State management (optional, can be used for additional state)
- **Lucide React** - Icon library

## Features

- 🔐 Authentication system (Login/Signup)
- 🛡️ Protected routes with role-based access
- 📊 Real-time dashboard with live updates
- 🚨 Alert management system
- 📅 Event management
- 👥 User management
- 📈 System monitoring with real-time metrics
- 🔒 Security settings
- ⚙️ User settings and preferences
- 📱 Fully responsive design
- 🎨 Futuristic smart-city dark UI theme

## Project Structure

```
frontend/
├── src/
│   ├── api/              # API layer with Axios
│   │   ├── axios.js      # Axios instance with interceptors
│   │   ├── auth.js       # Authentication API
│   │   ├── alerts.js     # Alerts API
│   │   ├── events.js     # Events API
│   │   ├── users.js      # Users API
│   │   └── index.js      # API exports
│   ├── components/       # Reusable components
│   │   ├── ProtectedRoute.jsx
│   │   ├── Sidebar.jsx
│   │   └── Navbar.jsx
│   ├── context/          # React Context providers
│   │   ├── AuthContext.jsx
│   │   └── SocketContext.jsx
│   ├── layouts/          # Layout components
│   │   ├── AuthLayout.jsx
│   │   └── DashboardLayout.jsx
│   ├── pages/            # Page components
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Alerts.jsx
│   │   ├── Events.jsx
│   │   ├── Users.jsx
│   │   ├── Monitoring.jsx
│   │   ├── Security.jsx
│   │   └── Settings.jsx
│   ├── services/         # External services
│   │   └── socket.js     # Socket.io service
│   ├── utils/            # Utility functions
│   │   └── cn.js         # Class name utility
│   ├── App.jsx           # Main app with routing
│   ├── main.jsx          # Entry point
│   └── index.css         # Global styles
├── public/               # Static assets
├── index.html            # HTML template
├── tailwind.config.js    # Tailwind configuration
├── vite.config.js        # Vite configuration
├── postcss.config.js     # PostCSS configuration
└── package.json          # Dependencies
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### Tailwind CSS Theme

The theme is configured in `tailwind.config.js` with a futuristic dark color palette:

- Background: `#0a0e17`
- Surface: `#111827`
- Primary: `#3b82f6` (Blue)
- Accent: `#06b6d4` (Cyan)
- Success: `#10b981` (Green)
- Warning: `#f59e0b` (Amber)
- Danger: `#ef4444` (Red)

## API Integration

The API layer is set up with Axios and includes:

- Request/response interceptors
- Automatic token injection
- Error handling
- 401 redirect to login

### Example Usage

```javascript
import { alertsAPI } from './api'

// Get all alerts
const response = await alertsAPI.getAll({ limit: 10 })

// Create a new alert
const newAlert = await alertsAPI.create({ type: 'fire', severity: 'high' })
```

## Socket.io Integration

Real-time communication is handled through the SocketContext:

```javascript
import { useSocket } from './context/SocketContext'

const { isConnected, on, emit } = useSocket()

// Listen for events
useEffect(() => {
  on('new-alert', (data) => {
    console.log('New alert:', data)
  })
}, [on])
```

## Authentication

The AuthContext provides authentication state and methods:

```javascript
import { useAuth } from './context/AuthContext'

const { user, isAuthenticated, login, logout } = useAuth()
```

## Responsive Design

The application is fully responsive with:

- Mobile-first approach
- Collapsible sidebar
- Adaptive grid layouts
- Touch-friendly interactions

## Custom Components

### Glass Effect
```jsx
<div className="glass rounded-lg p-4">
  Content with glass morphism effect
</div>
```

### Neon Glow
```jsx
<div className="shadow-neon">
  Element with neon glow effect
</div>
```

### Border Glow
```jsx
<div className="border-glow">
  Element with glowing border
</div>
```

## License

MIT
