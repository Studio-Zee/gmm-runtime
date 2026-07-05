const express = require('express');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const runningServers = {};
const serverLogs = {}; 

const EXECUTION_MODE = process.env.EXECUTION_MODE || 'local';

app.post('/api/v1/deploy', (req, res) => {
    const { serverId, zipUrl, envVars } = req.body;

    if (EXECUTION_MODE === 'local') {
        try {
            const shortId = serverId.slice(-4); 
            
            console.log(`\n> [Instalação] Iniciando deploy do projeto (${shortId})...`);
            
            serverLogs[serverId] = []; 
            
            const serversDir = path.join(__dirname, 'servers');
            const serverPath = path.join(serversDir, serverId);

            if (!fs.existsSync(serversDir)) fs.mkdirSync(serversDir);
            if (fs.existsSync(serverPath)) fs.rmSync(serverPath, { recursive: true, force: true });
            fs.mkdirSync(serverPath, { recursive: true });

            console.log(`> [Instalação] Baixando arquivos e dependências. Aguarde...`);

            const setupCommand = `curl -sL "${zipUrl}" -o template.zip && unzip -q -o template.zip && npm install`;
            
            exec(setupCommand, { cwd: serverPath }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`\n> [ERRO] Falha no processo:`);
                    console.error(error.message);
                    return res.status(500).json({ error: "Falha ao preparar os arquivos." });
                }

                console.log(`> [Instalação] Arquivos prontos.`);

                if (runningServers[serverId]) {
                    runningServers[serverId].kill();
                }

                const processEnv = { ...process.env, ...envVars, PORT: '8080' };
                
                console.log(`> [Sistema] Servidor online!`);
                const child = spawn('node', ['server.js'], { cwd: serverPath, env: processEnv });

                runningServers[serverId] = child;

                child.stdout.on('data', (data) => {
                    const msg = data.toString().trim();
                    console.log(`[SV-${shortId}] ${msg}`); 
                    serverLogs[serverId].push(msg);
                    if (serverLogs[serverId].length > 100) serverLogs[serverId].shift();
                });
                
                child.stderr.on('data', (data) => {
                    const msg = data.toString().trim();
                    console.error(`[SV-${shortId} ERRO] ${msg}`);
                    serverLogs[serverId].push(`[ERRO] ${msg}`);
                });

                child.on('close', (code) => {
                    console.log(`> [Sistema] Servidor (${shortId}) desligado.`);
                    delete runningServers[serverId];
                });

                return res.status(200).json({ message: "Servidor iniciado com sucesso!" });
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
});

app.get('/api/v1/server/:id/status', (req, res) => {
    const serverId = req.params.id;
    if (runningServers[serverId]) {
        res.json({ online: true, status: 'running', stats: { memory_usage: "45MB", cpu_usage: "2%" } });
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
    const { action } = req.body; 

    if (runningServers[serverId]) {
        if (action === 'stop' || action === 'restart') {
            runningServers[serverId].kill();
            delete runningServers[serverId];
        }
    }
    res.json({ success: true, message: `Ação ${action} executada` });
});

const PORT = 9090;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\nGMM Motor de Execução\n> Status: ONLINE (Porta ${PORT})\n> Modo: Local (Termux/PC)\n`);
});