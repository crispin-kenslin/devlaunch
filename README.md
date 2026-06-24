# DevLaunch

**A professional project process manager desktop application.**  
*by Crispin Joe Kenslin A*

---

## What it does

DevLaunch lets you manage all your development projects from one clean dashboard. For each project you define:

- A **working directory**, optional **virtual environment path**, and a **start command**
- Separate **Frontend** and **Backend** services (or just one)

From the dashboard you can **Run**, **Stop**, and **Restart** each service independently or all at once — and watch the live terminal output directly inside the app.

---

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer
- npm (comes with Node.js)

### Install & Run

```bash
# 1. Extract / navigate into the devlaunch folder
cd devlaunch

# 2. Install dependencies
npm install

# 3. Launch the app
npm start
```

### Build a distributable

```bash
# Windows (.exe installer)
npm run build:win

# macOS (.dmg)
npm run build:mac

# Linux (.AppImage)
npm run build:linux
```

The built output lands in the `dist/` folder.

---

## How to use

### Add a project

1. Click the **+** button in the sidebar (or "New Project" on the empty screen).
2. Fill in:
   - **Project Name** — any label you like
   - **Type** — Frontend only / Backend only / Frontend + Backend
   - For each service:
     - **Working Directory** — the folder to `cd` into before running
     - **Virtual Env Path** — the root of your Python/conda env (e.g. `C:\Projects\myapp\venv`). Leave blank if not needed.
     - **Start Command** — exactly what you'd type in a terminal, e.g.:
       - `npm run dev`
       - `python manage.py runserver`
       - `uvicorn main:app --reload`
       - `yarn start`
3. Click **Save Project**.

### Run a project

- Click **Run All** on the project panel to start all services simultaneously.
- Or click **Run** on an individual service card to start only that one.

### Stop / Restart

- **Stop All** kills all services for that project.
- **Restart** stops then restarts all services with a short pause between.
- Individual service **Stop** buttons will stop only that service (the other keeps running).

### Monitor logs

The log panel at the bottom shows real-time output. Use the tabs to switch between:
- **All** — interleaved output from both services
- **Frontend** / **Backend** — output from one service only

Click **Clear** to wipe the log buffer for the current tab.

---

## Virtual environment notes

| OS | Path example | What DevLaunch does |
|----|-------------|----------------------|
| Windows | `C:\Projects\myapp\venv` | Runs `venv\Scripts\activate.bat` then your command |
| macOS / Linux | `/home/user/myapp/venv` | Runs `source venv/bin/activate` then your command |

For **conda** environments, leave the env path blank and put the full activation in the command:
```
conda run -n myenv python manage.py runserver
```

---

## Project data location

Projects are saved to Electron's user data directory:

- **Windows:** `%APPDATA%\devlaunch\projects.json`
- **macOS:** `~/Library/Application Support/devlaunch/projects.json`
- **Linux:** `~/.config/devlaunch/projects.json`

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Close any open modal |

---

*DevLaunch — built with Electron · by Crispin Joe Kenslin A*
