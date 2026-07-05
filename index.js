const express = require('express');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const runningServers = {};

const EXECUTION_MODE = process.env.EXECUTION_MODE || 'local';

const serverLogs = {}; 

app.post('/api/v1/deploy', (req, res) => {
    const { serverId, zipUrl, envVars } = req.body;

    if (EXECUTION_MODE === 'local') {
        try {
            console.log(`\n[Deploy Local] Iniciando preparação para: ${serverId}`);
            serverLogs[serverId] = []; // Inicia os logs vazios
            
            const serversDir = path.join(__dirname, 'servers');
            const serverPath = path.join(serversDir, serverId);

            if (!fs.existsSync(serversDir)) fs.mkdirSync(serversDir);
            if (fs.existsSync(serverPath)) fs.rmSync(serverPath, { recursive: true, force: true });
            fs.mkdirSync(serverPath, { recursive: true });

            const setupCommand = `curl -sL "${zipUrl}" -o template.zip && unzip -q -o template.zip && npm install`;
            
            exec(setupCommand, { cwd: serverPath }, (error, stdout, stderr) => {
                if (error) return res.status(500).json({ error: "Falha ao preparar os arquivos." });

                if (runningServers[serverId]) runningServers[serverId].kill();

                const processEnv = { ...process.env, ...envVars, PORT: '8080' };
                const child = spawn('node', ['server.js'], { cwd: serverPath, env: processEnv });

                runningServers[serverId] = child;

                child.stdout.on('data', (data) => {
                    const msg = data.toString().trim();
                    serverLogs[serverId].push(msg);
                    if (serverLogs[serverId].length > 100) serverLogs[serverId].shift();
                });
                
                child.stderr.on('data', (data) => {
                    serverLogs[serverId].push(`[ERRO] ${data.toString().trim()}`);
                });

                return res.status(200).json({ message: "Servidor iniciado!" });
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
});

app.get('/api/v1/server/:id/status', (req, res) => {
    const serverId = req.params.id;
    if (runningServers[serverId]) {
        res.json({ 
            online: true, 
            status: 'running',
            stats: { memory_usage: "45MB", cpu_usage: "2%" } 
        });
    } else {
        res.json({ online: false, status: 'offline' });
    }
});

app.get('/api/v1/server/:id/logs', (req, res) => {
    const serverId = req.params.id;
    res.json({ logs: serverLogs[serverId] || [] });
});

app.post('/api/v1/server/:id/action', (req, res) => {
    const serverId = req.params.id;
    if (runningServers[serverId]) {
        runningServers[serverId].kill();
        delete runningServers[serverId];
    }
    res.json({ success: true });
});

const PORT = 9090;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`GMM Runtime rodando na porta ${PORT} | MODO: ${EXECUTION_MODE}`);
});