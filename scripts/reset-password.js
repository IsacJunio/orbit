/**
 * Script para resetar senha do Orbit
 * Executa: node scripts/reset-password.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configurações (mesmo do AuthLocal)
const ITERATIONS = 100000;
const KEY_LEN = 32;
const DIGEST = 'sha256';

// Caminhos dos arquivos de credenciais
const CREDENTIAL_PATHS = [
    path.join(__dirname, '..', 'src', 'main', 'security', 'credentials.json'),
    path.join(__dirname, '..', 'core', 'security', 'credentials.json')
];

// Arquivo local para guardar a senha (NÃO sincroniza com OneDrive)
const LOCAL_PASSWORD_FILE = path.join(
    process.env.LOCALAPPDATA || process.env.APPDATA,
    'Orbit',
    'senha-local.txt'
);

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
    return { salt, hash };
}

function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function saveCredentials(username, password) {
    const { salt, hash } = hashPassword(password);
    const credentials = {
        [username]: { salt, hash }
    };

    let savedPaths = [];

    for (const credPath of CREDENTIAL_PATHS) {
        try {
            ensureDir(credPath);

            // Carrega credenciais existentes se houver
            let existingData = {};
            if (fs.existsSync(credPath)) {
                existingData = JSON.parse(fs.readFileSync(credPath, 'utf8'));
            }

            // Atualiza/adiciona o usuário
            existingData[username] = { salt, hash };

            fs.writeFileSync(credPath, JSON.stringify(existingData, null, 2), { mode: 0o600 });
            savedPaths.push(credPath);
            console.log(`✓ Credenciais salvas em: ${credPath}`);
        } catch (error) {
            console.log(`✗ Erro ao salvar em ${credPath}: ${error.message}`);
        }
    }

    return savedPaths;
}

function saveLocalPasswordFile(username, password) {
    try {
        ensureDir(LOCAL_PASSWORD_FILE);

        const content = `===========================================
CREDENCIAIS DO ORBIT - CONFIDENCIAL
===========================================
Data: ${new Date().toLocaleString('pt-BR')}

Usuário: ${username}
Senha: ${password}

ATENÇÃO: Este arquivo contém sua senha em texto.
Guarde em local seguro ou delete após memorizar.
===========================================
`;

        fs.writeFileSync(LOCAL_PASSWORD_FILE, content, { mode: 0o600 });
        console.log(`\n✓ Senha salva localmente em: ${LOCAL_PASSWORD_FILE}`);
        return true;
    } catch (error) {
        console.error(`✗ Erro ao salvar arquivo local: ${error.message}`);
        return false;
    }
}

function generatePassword(length = 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

async function main() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

    console.log('\n========================================');
    console.log('       ORBIT - RESET DE SENHA          ');
    console.log('========================================\n');

    // Usuário
    let username = await question('Nome de usuário (padrão: admin): ');
    username = username.trim() || 'admin';

    // Senha
    console.log('\nOpções de senha:');
    console.log('  1. Digitar sua própria senha');
    console.log('  2. Gerar senha aleatória segura');

    const option = await question('\nEscolha (1 ou 2): ');

    let password;
    if (option === '2') {
        password = generatePassword(14);
        console.log(`\nSenha gerada: ${password}`);
    } else {
        password = await question('Digite a nova senha: ');
        if (!password || password.length < 4) {
            console.log('\n✗ Senha muito curta. Mínimo 4 caracteres.');
            rl.close();
            process.exit(1);
        }
    }

    console.log('\n----------------------------------------');
    console.log('Salvando credenciais...\n');

    // Salva nos arquivos de credenciais
    const savedPaths = saveCredentials(username, password);

    if (savedPaths.length === 0) {
        console.log('\n✗ Erro: Nenhum arquivo de credencial foi salvo!');
        rl.close();
        process.exit(1);
    }

    // Salva arquivo local com a senha
    saveLocalPasswordFile(username, password);

    console.log('\n========================================');
    console.log('         RESET CONCLUÍDO!              ');
    console.log('========================================');
    console.log(`\nUsuário: ${username}`);
    console.log(`Senha: ${password}`);
    console.log('\nReinicie o aplicativo Orbit para usar a nova senha.');
    console.log('----------------------------------------\n');

    rl.close();
}

main().catch(console.error);
