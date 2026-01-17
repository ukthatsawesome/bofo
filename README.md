# 💰 Bofo - AI-Powered Personal Finance Manager

Bofo is a sleek, modern, and powerful personal finance application built with **Electron**, **Tailwind CSS**, and **SQLite**. It features AI-driven transaction categorization, beautiful data visualizations, and deep financial forecasting.

![Bofo Logo](assets/icons/icon.png)

---

## ✨ Features

- **🚀 AI Insights & Categorization**: Local AI (Ollama) automatically categorizes transactions and provides personalized financial advice tailored to your spending habits.
- **🧪 Financial Sandbox**: Simulate future scenarios (e.g., "Buying a car", "Salary hike") to see how they impact your net worth over time.
- **📊 Interactive Dashboard**: A reimagined dashboard with AI-driven summaries, quick transaction entry, and real-time spending breakdowns.
- **🧾 Advanced Bill Tracking**: Dedicated tracking for utility bills with usage history, cost-per-unit analysis, and payment reminders.
- **🔮 Wealth Forecasting**: Projection engine that visualizes your financial future based on current trends and recurring expenses.
- **🎯 Smart Goals**: Set specific savings targets and track progress visually.
- **🔄 Recurring Subscriptions**: Manage fixed monthly commitments and spot creeping costs.
- **💾 Data Control**: Full export/import capabilities (JSON/Excel) with specialized settings for backup management.
- **🌓 Modern Aesthetics**: A polished Glassmorphism UI with comprehensive dark/light mode support.


---

## ⚡ System Improvements (v1.1)

Recent updates have significantly hardened the application architecture:

### 🛡️ Security
- **Path Validation**: All file operations (backups, imports) pass through a strict `validateSafePath` filter to prevent directory traversal attacks.
- **SQLCipher**: Database is encrypted at rest using AES-256.

### 🚀 Performance
- **Pagination**: Transaction lists use an efficient `LIMIT/OFFSET` strategy, defaulting to 100 items per page.
- **Backend Analytics**: Heavy computations (Forecasts, Net Worth) are offloaded to SQLite aggregations, ensuring instant UI rendering even with 100k+ records.

### 🛡️ Resilience
- **Global Error Handling**: The IPC layer automatically catches crashes and returns standardized error codes.
- **Timeout Protection**: All API calls have a 5-second fuse to prevent UI freezes.

---

## 🛠️ Technology Stack

- **Frontend**: TypeScript / JavaScript (ESM), Tailwind CSS, Lucide Icons
- **Backend**: Electron (Main/Renderer IPC Architecture) with TypeScript logic
- **Database**: SQLCipher (AES-256 encrypted SQLite)
- **Visualization**: Chart.js
- **AI Integration**: Ollama (REST API)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16+ recommended)
- [npm](https://www.npmjs.com/)
- [Ollama](https://ollama.com/) (Optional, for AI features)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/bofo.git
   cd bofo
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the application:
   ```bash
   npm start
   ```

---

## 🏗️ Building for Production

To create a distributable installer for your platform:

**Windows (.exe)**
```bash
npm run dist:win
```

**macOS (.dmg)**
```bash
npm run dist:mac
```

**Linux (.AppImage / .deb)**
```bash
npm run dist:linux
```

---

## 📁 Project Structure

Bofo follows a strict separation between the **Main** (Backend) and **Renderer** (Frontend) processes.

- `src/main/`: Electron main process, Database, AI services, and IPC handlers.
- `src/renderer/`: Frontend UI built with Vanilla TS + Tailwind CSS.
- `src/shared/`: Common types and constants shared across processes.

For a detailed breakdown, see [DIRECTORY_STRUCTURE.md](DIRECTORY_STRUCTURE.md).

---

## 📚 Documentation

- [Developer Guide](DEVELOPER_GUIDE.md) - Architecture and contribution rules.
- [Security Guide](SECURITY.md) - How we protect your data.
- [Directory Structure](DIRECTORY_STRUCTURE.md) - Detailed file layout.
- [Fix Report](FIX_REPORT.md) - History of important bug fixes.

---

## 🛡️ Data & Privacy

Bofo is designed with privacy in mind. **All your data stays on your machine.**
- 🔒 **Encrypted database** using SQLCipher (AES-256 encryption at rest).
- 🔐 **OS-Level Security**: Uses Electron's `safeStorage` API (DPAPI/Keychain) to protect encryption keys.
- 🤖 Local AI processing via Ollama.
- 🔤 Self-hosted fonts for 100% offline usage.
- ☁️ No cloud storage or third-party tracking.

For more details, see [SECURITY.md](SECURITY.md).

---

## 📄 License

This project is licensed under the ISC License.

---

*Made with ❤️ for better financial habits.*
