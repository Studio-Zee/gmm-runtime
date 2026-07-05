const express = require('express');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const runningServers = {};

const EXECUTION_MODE = process.env.EXECUTION_MODE || 'local';

app.post('/api/v1/deploy', (req, res) => {
    const { serverId, zipUrl, envVars } = req.body;

    if (EXECUTION_MODE === 'local') {
        try {
            console.log(`\n[Deploy Local] Iniciando preparação para: ${serverId}`);
            
            const serversDir = path.join(__dirname, 'servers');
            const serverPath = path.join(serversDir, serverId);

            if (!fs.existsSync(serversDir)) fs.mkdirSync(serversDir);
            
            if (fs.existsSync(serverPath)) {
                fs.rmSync(serverPath, { recursive: true, force: true });
            }
            fs.mkdirSync(serverPath, { recursive: true });

            const setupCommand = `curl -sL "${zipUrl}" -o template.zip && unzip -q -o template.zip && npm install`;
            
            console.log(`[Deploy Local] Baixando template e instalando dependências...`);

            exec(setupCommand, { cwd: serverPath }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`[Erro] Falha no setup: ${error.message}`);
                    return res.status(500).json({ error: "Falha ao preparar os arquivos." });
                }

                if (runningServers[serverId]) {
                    console.log(`[Deploy Local] Derrubando processo antigo do servidor ${serverId}...`);
                    runningServers[serverId].kill();
                    delete runningServers[serverId];
                }

                const processEnv = { ...process.env, ...envVars, PORT: '8080' };

                console.log(`[Deploy Local] Executando 'node server.js'...`);
                const child = spawn('node', ['server.js'], {
                    cwd: serverPath,
                    env: processEnv
                });

                runningServers[serverId] = child;

                child.stdout.on('data', (data) => console.log(`[${serverId} Log] ${data}`.trim()));
                child.stderr.on('data', (data) => console.error(`[${serverId} Erro] ${data}`.trim()));

                child.on('close', (code) => {
                    console.log(`[${serverId} Status] Processo finalizado com código ${code}`);
                    delete runningServers[serverId];
                });

                return res.status(200).json({ message: "Servidor iniciado no Modo Local com sucesso!" });
            });

        } catch (err) {
            console.error("[Erro Fatal]", err);
            return res.status(500).json({ error: err.message });
        }
    } else {
        return res.status(500).json({ error: "Modo Docker em desenvolvimento." });
    }
});

app.get('/api/v1/server/:id/status', (req, res) => {
    const serverId = req.params.id;
    if (runningServers[serverId]) {
        res.json({ online: true, status: 'running' });
    } else {
        res.json({ online: false, status: 'offline' });
    }
});

app.post('/api/v1/server/:id/action', (req, res) => {
    const serverId = req.params.id;
    const { action } = req.body; 

    if (runningServers[serverId]) {
        if (action === 'stop' || action === 'restart') {
            runningServers[serverId].kill();
            delete runningServers[serverId];
            console.log(`[!] Servidor ${serverId} parado via App.`);
        }
    }
    
    res.json({ success: true, message: `Ação ${action} executada` });
});

const PORT = 9090;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`GMM Runtime rodando na porta ${PORT} | MODO: ${EXECUTION_MODE}`);
});