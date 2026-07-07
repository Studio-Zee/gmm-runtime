#!/bin/bash

echo "========================================"
echo "Instalando o GMM Runtime..."
echo "========================================"

echo ""
echo "[1/4] Atualizando o Termux e instalando pacotes..."

pkg update -y && pkg upgrade -y
pkg install nodejs curl unzip -y

echo ""
echo "[2/4] Criando o ambiente do GMM..."

mkdir -p ~/gmm-runtime
cd ~/gmm-runtime

echo ""
echo "[3/4] Baixando os arquivos do servidor..."

curl -sL "https://raw.githubusercontent.com/Studio-Zee/gmm-runtime/main/index.js" -o index.js
curl -sL "https://raw.githubusercontent.com/Studio-Zee/gmm-runtime/main/package.json" -o package.json

echo ""
echo "[4/4] Instalando dependências..."

npm install

echo ""
echo "========================================"
echo "Instalação Concluída com Sucesso!"
echo "========================================"
echo "Iniciando o motor GMM..."
echo ""

node index.js