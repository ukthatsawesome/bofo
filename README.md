# 💰 Bofo - AI-Powered Personal Finance Manager

Bofo is a sleek, modern, and powerful personal finance application built with **Electron**, **Tailwind CSS**, and **SQLite**. It features AI-driven transaction categorization, beautiful data visualizations, and deep financial forecasting.

![Bofo Logo](assets/icons/icon.png)

---

## ✨ Features

- **🚀 AI Categorization**: Automatically categorize your transactions using local AI (via Ollama).
- **📊 Interactive Dashboards**: Beautiful charts (powered by Chart.js) to visualize your spending and income.
- **🔮 Wealth Forecasting**: Project your future net worth based on your spending habits and financial goals.
- **🎯 Smart Budgets & Goals**: Set category budgets and track progress toward your financial dreams.
- **💵 Bill Tracking**: Manage utilities and recurring bills with cost-per-unit tracking.
- **🔄 Recurring Charges**: Keep track of subscriptions and automatic payments.
- **💾 Data Control**: Export all your data to **JSON** or **Multi-sheet Excel Workbook**, with automatic daily backups.
- **🌓 Modern UI**: Sleek dark/light mode with glassmorphism aesthetics.

---

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript (ESM), Tailwind CSS, Lucide Icons
- **Backend**: Electron (Main/Renderer IPC Architecture)
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

- `src/main`: Electron main process (OS integration, IPC handlers)
- `src/renderer`: Frontend code (Views, Components, Core logic)
- `src/models`: Database models and data operations
- `src/database`: Schema, migrations, and connection logic
- `src/services`: External integrations (AI Service)

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
