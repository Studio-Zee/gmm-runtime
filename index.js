const express = require('express');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const runningServers = {};
const serverLogs = {}; // Guarda os logs na memória pro App puxar

const EXECUTION_MODE = process.env.EXECUTION_MODE || 'local';

app.post('/api/v1/deploy', (req, res) => {
    const { serverId, zipUrl, envVars } = req.body;

    if (EXECUTION_MODE === 'local') {
        try {
            console.log(`Recebendo ordem do App...`);
            console.log(`ID do Servidor: ${serverId}`);
            console.log(`URL do Template: ${zipUrl}`);
            
            serverLogs[serverId] = []; 
            
            const serversDir = path.join(__dirname, 'servers');
            const serverPath = path.join(serversDir, serverId);

            if (!fs.existsSync(serversDir)) fs.mkdirSync(serversDir);
            if (fs.existsSync(serverPath)) fs.rmSync(serverPath, { recursive: true, force: true });
            fs.mkdirSync(serverPath, { recursive: true });

            console.log(`Baixando template e instalando dependências...`);
            console.log(`ISSO PODE DEMORAR ALGUNS MINUTOS NO CELULAR. AGUARDE...`);

            const setupCommand = `curl -sL "${zipUrl}" -o template.zip && unzip -q -o template.zip && npm install`;
            
            exec(setupCommand, { cwd: serverPath }, (error, stdout, stderr) => {
                // SE DER ERRO, AGORA ELE MOSTRA NA TELA:
                if (error) {
                    console.error(`\n[ERRO CRÍTICO NO SETUP]`);
                    console.error(error.message);
                    console.error(stderr);
                    return res.status(500).json({ error: "Falha ao preparar os arquivos. Veja o terminal." });
                }

                console.log(`Download e Instalação concluídos!`);

                if (runningServers[serverId]) {
                    console.log(`Derrubando processo antigo...`);
                    runningServers[serverId].kill();
                }

                const processEnv = { ...process.env, ...envVars, PORT: '8080' };
                
                console.log(`Ligando o servidor do jogo...`);
                const child = spawn('node', ['server.js'], { cwd: serverPath, env: processEnv });

                runningServers[serverId] = child;

                // CAPTURA OS LOGS DO JOGO E MOSTRA NO TERMUX E NO APP
                child.stdout.on('data', (data) => {
                    const msg = data.toString().trim();
                    console.log(`[${serverId}] ${msg}`);
                    serverLogs[serverId].push(msg);
                    if (serverLogs[serverId].length > 100) serverLogs[serverId].shift();
                });
                
                child.stderr.on('data', (data) => {
                    const msg = data.toString().trim();
                    console.error(`[${serverId} ERRO] ${msg}`);
                    serverLogs[serverId].push(`[ERRO] ${msg}`);
                });

                child.on('close', (code) => {
                    console.log(`[${serverId} Status] Desligado (Código ${code})`);
                    delete runningServers[serverId];
                });

                return res.status(200).json({ message: "Servidor iniciado com sucesso!" });
            });
        } catch (err) {
            console.error("[Erro Fatal]", err);
            return res.status(500).json({ error: err.message });
        }
    }
});

// 1. Rota de Status (Pro App ficar Verde/Online)
app.get('/api/v1/server/:id/status', (req, res) => {
    const serverId = req.params.id;
    if (runningServers[serverId]) {
        res.json({ online: true, status: 'running', stats: { memory_usage: "45MB", cpu_usage: "2%" } });
    } else {
        res.json({ online: false, status: 'offline' });
    }
});

// 2. Rota de Logs (Pro App pegar o texto do terminal)
app.get('/api/v1/server/:id/logs', (req, res) => {
    const serverId = req.params.id;
    res.json({ logs: serverLogs[serverId] || [] });
});

// 3. Rota de Ação (Parar/Reiniciar)
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