FROM node:20-alpine

# Cria e define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia os arquivos de configuração do Node.js primeiro
COPY package*.json ./

# Instala apenas as dependências necessárias para produção
RUN npm install --omit=dev

# Copia o restante do código do projeto
COPY . .

# Define a variável de ambiente com a porta padrão
ENV PORT=8080

# Expõe a porta para que os jogadores possam conectar
EXPOSE 8080

# Comando que será executado quando o contêiner ligar
CMD ["npm", "start"]
