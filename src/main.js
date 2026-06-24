const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// ── Data persistence ──────────────────────────────────────────────────────────
const DATA_FILE = path.join(app.getPath('userData'), 'projects.json');

function loadProjects() {
  try {
    if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {}
  return [];
}
function saveProjects(projects) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2), 'utf8');
}

// ── Running processes ─────────────────────────────────────────────────────────
const runningProcesses = new Map();

// ── Window ────────────────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    frame: false, titleBarStyle: 'hidden', backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('closed', () => {
    for (const [, procs] of runningProcesses) {
      killProcess(procs.frontend);
      killProcess(procs.backend);
    }
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ── Helpers ───────────────────────────────────────────────────────────────────
function killProcess(proc) {
  if (!proc) return;
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', proc.pid, '/f', '/t']);
    else process.kill(-proc.pid, 'SIGTERM');
  } catch (_) { try { proc.kill('SIGTERM'); } catch (__) {} }
}

function sendLog(projectId, service, text) {
  if (mainWindow) mainWindow.webContents.send('process-log', { projectId, service, text });
}
function sendStatus(projectId, service, status) {
  if (mainWindow) mainWindow.webContents.send('process-status', { projectId, service, status });
}

function spawnService(projectId, service, pythonPath, cwd, command) {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    let cmd, args;

    if (pythonPath) {
      // ── Direct python interpreter mode ──────────────────────────────────
      // Replace any leading "python" / "python3" / "py" token with the chosen exe
      const normalised = command.trim().replace(/^(python3?|py)\s+/i, '').trim();
      cmd = pythonPath;
      args = normalised.split(/\s+/);
    } else {
      // ── Plain command, no env activation needed ─────────────────────────
      if (isWin) {
        cmd = 'cmd.exe';
        args = ['/c', command];
      } else {
        cmd = '/bin/bash';
        args = ['-c', command];
      }
    }

    const proc = spawn(cmd, args, {
      cwd: cwd || undefined,
      detached: false,
      env: { ...process.env },
      shell: false,
    });

    sendLog(projectId, service, `[DevLaunch] Starting ${service}…\n`);
    sendStatus(projectId, service, 'running');

    proc.stdout.on('data', (d) => sendLog(projectId, service, d.toString()));
    proc.stderr.on('data', (d) => sendLog(projectId, service, d.toString()));
    proc.on('error', (err) => {
      sendLog(projectId, service, `[DevLaunch] Error: ${err.message}\n`);
      sendStatus(projectId, service, 'error');
    });
    proc.on('close', (code) => {
      sendLog(projectId, service, `[DevLaunch] Process exited (code ${code})\n`);
      sendStatus(projectId, service, 'stopped');
      const procs = runningProcesses.get(projectId);
      if (procs) procs[service] = null;
    });

    resolve(proc);
  });
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.handle('get-projects', () => loadProjects());

ipcMain.handle('save-project', (_, project) => {
  const projects = loadProjects();
  const idx = projects.findIndex(p => p.id === project.id);
  if (idx >= 0) projects[idx] = project; else projects.push(project);
  saveProjects(projects);
  return projects;
});

ipcMain.handle('delete-project', (_, id) => {
  const procs = runningProcesses.get(id);
  if (procs) { killProcess(procs.frontend); killProcess(procs.backend); runningProcesses.delete(id); }
  const projects = loadProjects().filter(p => p.id !== id);
  saveProjects(projects);
  return projects;
});

ipcMain.handle('browse-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('browse-file', async (_, filters) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('start-project', async (_, project) => {
  if (!runningProcesses.has(project.id)) runningProcesses.set(project.id, { frontend: null, backend: null });
  const procs = runningProcesses.get(project.id);

  if (project.frontend?.command) {
    if (procs.frontend) killProcess(procs.frontend);
    procs.frontend = await spawnService(
      project.id, 'frontend',
      project.frontend.pythonPath || null,
      project.frontend.cwd,
      project.frontend.command
    );
  }
  if (project.backend?.command) {
    if (procs.backend) killProcess(procs.backend);
    procs.backend = await spawnService(
      project.id, 'backend',
      project.backend.pythonPath || null,
      project.backend.cwd,
      project.backend.command
    );
  }
  return { success: true };
});

ipcMain.handle('stop-project', async (_, projectId) => {
  const procs = runningProcesses.get(projectId);
  if (!procs) return { success: true };
  killProcess(procs.frontend); killProcess(procs.backend);
  procs.frontend = null; procs.backend = null;
  sendStatus(projectId, 'frontend', 'stopped');
  sendStatus(projectId, 'backend', 'stopped');
  return { success: true };
});

ipcMain.handle('get-process-status', (_, projectId) => {
  const procs = runningProcesses.get(projectId);
  return { frontend: procs?.frontend ? 'running' : 'stopped', backend: procs?.backend ? 'running' : 'stopped' };
});

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.on('window-close', () => mainWindow?.close());
