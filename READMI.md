# 🚗 AutoZ - Vehicle Marketplace & Live Auctions
### USA Sponsored Project by Tech Tutor | Solapur Marketplace

AutoZ is a Full-Stack Vehicle Marketplace platform with 3 company-level modules. Built with Django REST Framework + React 19.

> Live Demo UI: OLX Style Listing with Company Filter (Swift, Scorpio, etc.)

---

### 🎯 3 Main Modules (Company Level)

**1. Marketplace Module:**
- Car listing with price (Ex: Swift 3.5L, Scorpio 12.5L)
- Company-wise filter (Maruti, Mahindra, etc.)
- Grid view with Image, Price, Year, KM Driven
- Code: `App.jsx` -> `axios.get('/api/vehicles/')`

**2. Verification Module:**
- Admin checks Engine, Papers, Ownership
- After verification -> Verified Badge (Green Badge in UI)
- Fields: `company_name`, `category`, `model_name`

**3. Live Auction Module:**
- Bidding System + Countdown Timer
- Logic: Bids range 1L - 4.1L (Current bid tracking)
- Real-time price update using React `useState`

---

### 💻 COMPLETE TECH STACK (Latest 2026)

**BACKEND:**
- Django: 6.1.1
- Python: 3.14.7 (Latest)
- DRF: 3.18.1 (REST API)
- Pillow: 12.3.0 (Image Upload)
- Database: SQLite3 (db.sqlite3)
- Libs: django-cors-headers 4.9.0, drf-spectacular

**FRONTEND:**
- Node: 24.20.0 (Runtime for Vite)
- NPM: 11.19.0
- React: 19.2.8 (with Hooks: useState, useEffect)
- Vite: 8.3.0 (Build Tool)
- Axios: 1.20.0 (API Connection)
- CSS: Inline CSS (OLX Style #002f34) + index.css
- Entry: `main.jsx` -> `createRoot` + `StrictMode`



| Tool Name                  | Version  | Kaam (Use)                                  |
| -------------------------- | -------- | ------------------------------------------- |
| **node.js**                | 24.20.0  | Vite + React chalvay sathi (Runtime)        |
| **npm**                    | 11.19.0  | Package install karay sathi                 |
| **react**                  | 19.3.0   | Main UI - Card, Filter banvay sathi        |
| **react-dom**              | 19.3.0   | React la Browser madhe dakhavto            |
| **vite**                   | 8.3.0    | MAIN BUILD TOOL - Project build karto      |
| **axios**                  | 1.20.0   | Django Backend la API call karay sathi     |
| **@vitejs/plugin-react**   | 6.1.1    | Vite la React samjavay sathi               |
| **eslint**                 | 10.11.0  | Code chuk (error) check karay sathi        |
| **@types/react**           | 19.3.0   | Type support sathi (auto aalela)           |
| **@types/react-dom**       | 19.3.0   | Type support sathi (auto aalela)           |

### Language Used
- HTML -> index.html (div id="root")
- CSS  -> index.css + Inline CSS in App.jsx (#002f34)
- JavaScript (ES6+) -> App.jsx (useState, useEffect, filter)

### Build Command
npm run build  -> dist/ folder tayar hoto (Production Build)

### Check Command
npm list --depth=0

**TOOLS:**
- Git: 2.55.0
- VS Code + PowerShell (venv)
- OS: Windows 11



**My Project Database Details:**
Database Name             Version / Details
------------------------- ------------------------
Engine                    django.db.backends.sqlite3
File Name                 db.sqlite3
File Size                 192 KB
Location                  C:\Autoz-Final\db.sqlite3
SQLite Version            3.49.1 (Python 3.14.7 sobat ali)
Type                      File-based / Serverless
No Setup Needed           Yes (Django default)
