# 🛰️ Orbit

<p align="center">
  <img src="resources/icon.png" alt="Orbit Logo" width="120" height="120">
</p>

<p align="center">
  <strong>Sistema de Gestão de Pedidos de Compras</strong><br>
  Desenvolvido para Distribuidora Cummins Minas LTDA
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.4.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/platform-Windows-lightgrey.svg" alt="Platform">
  <img src="https://img.shields.io/badge/electron-28.0.0-47848F.svg" alt="Electron">
  <img src="https://img.shields.io/badge/license-Proprietary-red.svg" alt="License">
</p>

---

## 📋 Sobre

**Orbit** é um sistema desktop para gerenciamento de pedidos de compras, desenvolvido com Electron e React. O sistema oferece uma interface moderna e intuitiva para controle de pedidos, fornecedores, tarefas e relatórios.

## ✨ Funcionalidades

### 📦 Gestão de Pedidos
- Cadastro e acompanhamento de pedidos de compra
- Status de entrega (pendente, parcial, entregue)
- Histórico completo de alterações
- Anexos e documentos por pedido
- Templates de pedidos recorrentes

### 👥 Gestão de Fornecedores
- Cadastro completo com código SAP
- Informações de contato (email, telefone)
- Lista de códigos SAP com exportação CSV
- Cópia rápida de códigos SAP

### 📊 Dashboard & Relatórios
- Visão geral de pedidos e tarefas
- Alertas de prazos
- Relatórios em PDF e Excel
- Filtros por período, status e fornecedor

### ⚙️ Configurações
- Backup automático de dados
- Escolha do local do banco de dados
- Inicialização com Windows
- Relatórios semanais programados

## 🛠️ Tecnologias

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Electron | 28.x | Framework desktop |
| React | 18.x | Interface do usuário |
| TypeScript | 5.x | Tipagem estática |
| Vite | 5.x | Build e dev server |
| TailwindCSS | 3.x | Estilização |
| Lucide React | - | Ícones |

## 📁 Estrutura do Projeto

```
orbit/
├── src/
│   ├── main/           # Processo principal Electron
│   │   ├── index.ts    # Entry point
│   │   └── db.ts       # Gerenciador de banco de dados
│   ├── preload/        # Scripts de preload
│   │   ├── index.ts    # API bridge
│   │   └── index.d.ts  # Tipos TypeScript
│   └── renderer/       # Interface React
│       └── src/
│           ├── pages/      # Páginas da aplicação
│           ├── components/ # Componentes reutilizáveis
│           └── services/   # Serviços e utilitários
├── resources/          # Ícones e assets
├── build.bat          # Script de build para Windows
├── package.json       # Dependências e scripts
└── electron.vite.config.ts
```

## 🚀 Desenvolvimento

### Pré-requisitos
- Node.js 18+ 
- npm ou yarn

### Instalação

```bash
# Clonar repositório
git clone https://github.com/seu-usuario/orbit.git

# Instalar dependências
npm install

# Iniciar em modo desenvolvimento
npm run dev
```

### Build

```bash
# Windows - usar script automatizado
build.bat

# Ou manualmente
npm run build
```

Os instaladores serão gerados na pasta `release/`.

## 📝 Changelog

### v1.4.0 (09/02/2026)
- ✅ Campos de email e telefone para fornecedores
- ✅ Botão "Adicionar Todos" na lista de códigos SAP
- ✅ Cópia de código SAP ao clicar no badge
- ✅ Seleção de local do banco de dados
- ✅ Método db.set() para collections

### v1.3.0 (03/02/2026)
- ✅ Lista de códigos SAP com exportação
- ✅ Templates de pedidos
- ✅ Melhorias no dashboard

### v1.2.0
- ✅ Relatórios em PDF e Excel
- ✅ Filtros avançados
- ✅ Alertas de prazo

## 👨‍💻 Autor

**Isac Lima**  
Distribuidora Cummins Minas LTDA

## 📄 Licença

Este software é proprietário e de uso exclusivo da Distribuidora Cummins Minas LTDA.
Todos os direitos reservados.

---

<p align="center">
  Feito com ❤️ para gestão eficiente de compras
</p>
