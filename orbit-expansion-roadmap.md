# 🚀 Orbit Expansion Roadmap

> **Objetivo:** Expandir o Orbit com funcionalidades de produtividade, analytics, automação e gestão.
> **Data:** 2026-01-28
> **Versão Atual:** 1.2.2

---

## 📋 Visão Geral

Este roadmap organiza **35+ funcionalidades** em 7 fases incrementais. Cada fase entrega valor independente e prepara terreno para a próxima.

### Critérios de Sucesso Global
- [ ] Todas as funcionalidades funcionam offline
- [ ] Performance mantida (app inicia < 3s)
- [ ] UI consistente com design atual
- [ ] Zero regressões em funcionalidades existentes

---

## 🗓️ Fases de Implementação

| Fase | Tema | Funcionalidades | Estimativa |
|------|------|-----------------|------------|
| **1** | Quick Wins | 5 features de baixa complexidade | 1-2 dias |
| **2** | Produtividade | Templates, Workflow, Importação | 3-4 dias |
| **3** | Analytics | Relatórios, KPIs, Gráficos | 2-3 dias |
| **4** | Notificações | Alertas, Lembretes, Timeline | 2-3 dias |
| **5** | Automação SAP | Novas transações, Lote, Agendamento | 3-5 dias |
| **6** | Documentos | Preview, OCR, Versionamento | 3-4 dias |
| **7** | Multi-Usuário | Perfis, Sync, Comentários | 5-7 dias |

---

## ⚡ FASE 1: Quick Wins (Prioridade Máxima)

> **Meta:** Funcionalidades simples com alto impacto imediato.

### 1.1 Duplicar Pedido
- **Arquivo:** `src/renderer/src/pages/Orders.tsx`
- **Descrição:** Botão para criar novo pedido baseado em existente
- **INPUT:** Pedido selecionado
- **OUTPUT:** Novo pedido com dados copiados (exceto número e data)
- **VERIFY:** Duplicar pedido → novo pedido aparece na lista com "(Cópia)" no nome
- **Complexidade:** 🟢 Baixa (~30min)

### 1.2 Favoritos
- **Arquivos:** `src/main/db.ts`, `Orders.tsx`, `Suppliers.tsx`
- **Descrição:** Marcar pedidos/fornecedores como favoritos
- **INPUT:** Clique no ícone de estrela
- **OUTPUT:** Item marcado persiste entre sessões
- **VERIFY:** Favoritar → fechar app → reabrir → favorito mantido
- **Complexidade:** 🟢 Baixa (~1h)

### 1.3 Atalhos de Teclado
- **Arquivo:** `src/renderer/src/App.tsx`
- **Descrição:** Navegação rápida (Ctrl+N, Ctrl+S, etc.)
- **Atalhos:**
  - `Ctrl+N` → Novo pedido
  - `Ctrl+T` → Nova tarefa
  - `Ctrl+1-5` → Navegar abas
  - `Ctrl+F` → Focar busca
  - `Esc` → Fechar modal
- **VERIFY:** Pressionar atalho → ação executada
- **Complexidade:** 🟢 Baixa (~1h)

### 1.4 Modo Compacto
- **Arquivos:** `Orders.tsx`, `tailwind.config.js`
- **Descrição:** Toggle para view com mais densidade de informação
- **INPUT:** Toggle no header da página
- **OUTPUT:** Linhas menores, menos padding, mais dados visíveis
- **VERIFY:** Toggle → layout muda instantaneamente
- **Complexidade:** 🟢 Baixa (~1.5h)

### 1.5 Tema Personalizado
- **Arquivos:** `ThemeProvider.tsx`, `Settings.tsx`, `index.css`
- **Descrição:** Escolher cor primária do tema
- **Cores:** Azul, Verde, Roxo, Laranja, Vermelho, Ciano
- **VERIFY:** Mudar cor → toda UI atualiza → persiste após reinício
- **Complexidade:** 🟢 Baixa (~2h)

### ✅ Checklist Fase 1
- [ ] 1.1 Duplicar Pedido implementado
- [ ] 1.2 Favoritos funcionando
- [ ] 1.3 Atalhos de teclado ativos
- [ ] 1.4 Modo compacto toggle
- [ ] 1.5 Tema personalizado
- [ ] Testes manuais passando
- [ ] Build sem erros

---

## 📋 FASE 2: Produtividade

> **Meta:** Acelerar criação e gestão de pedidos.

### 2.1 Templates de Pedidos
- **Arquivos:** `db.ts` (nova collection), `Orders.tsx`, novo modal
- **Descrição:** Salvar e reutilizar modelos de pedidos
- **Features:**
  - Salvar pedido atual como template
  - Listar templates disponíveis
  - Criar pedido a partir de template
  - Editar/excluir templates
- **Schema:**
  ```typescript
  interface OrderTemplate {
    id: string
    name: string
    vendor: string
    items: string
    amount?: number
    createdAt: string
  }
  ```
- **VERIFY:** Salvar template → usar template → pedido criado com dados
- **Complexidade:** 🟡 Média (~3h)

### 2.2 Histórico de Alterações
- **Arquivos:** `db.ts`, `index.ts` (IPC), `Orders.tsx`
- **Descrição:** Audit trail de mudanças em pedidos
- **Dados registrados:** campo alterado, valor anterior, valor novo, timestamp
- **UI:** Botão "Ver histórico" no pedido → modal com timeline
- **Schema:**
  ```typescript
  interface AuditLog {
    id: string
    entityType: 'order' | 'task' | 'document'
    entityId: string
    field: string
    oldValue: string
    newValue: string
    timestamp: string
  }
  ```
- **VERIFY:** Editar pedido → histórico mostra alteração
- **Complexidade:** 🟡 Média (~4h)

### 2.3 Importação em Massa
- **Arquivos:** Novo componente `ImportModal.tsx`, `Orders.tsx`
- **Descrição:** Upload de CSV/Excel para criar múltiplos pedidos
- **Formato CSV:** `orderNumber,vendor,items,amount,deliveryDate`
- **Features:**
  - Drag & drop de arquivo
  - Preview antes de importar
  - Validação de dados
  - Relatório de erros
- **Dependências:** Adicionar `xlsx` ou `papaparse` ao package.json
- **VERIFY:** Upload CSV → preview → confirmar → pedidos criados
- **Complexidade:** 🟡 Média (~4h)

### 2.4 Workflow de Aprovações
- **Arquivos:** `db.ts`, `Orders.tsx`, `Settings.tsx`
- **Descrição:** Aprovação obrigatória para pedidos acima de valor X
- **Features:**
  - Configurar valor mínimo para aprovação
  - Status "Aguardando Aprovação"
  - Botões Aprovar/Rejeitar
  - Motivo de rejeição obrigatório
- **VERIFY:** Criar pedido > limite → status "Aguardando Aprovação"
- **Complexidade:** 🔴 Alta (~6h)

### 2.5 Comparação de Períodos
- **Arquivos:** `Dashboard.tsx`, novo componente `PeriodComparison.tsx`
- **Descrição:** Comparar gastos mês a mês
- **UI:** Selector de período + gráfico comparativo
- **VERIFY:** Selecionar 2 meses → gráfico mostra comparação
- **Complexidade:** 🟢 Baixa (~2h)

### ✅ Checklist Fase 2
- [ ] 2.1 Templates de Pedidos
- [ ] 2.2 Histórico de Alterações
- [ ] 2.3 Importação em Massa
- [ ] 2.4 Workflow de Aprovações
- [ ] 2.5 Comparação de Períodos
- [ ] Testes passando
- [ ] Build sem erros

---

## 📊 FASE 3: Analytics & Insights

> **Meta:** Transformar dados em informações acionáveis.

### 3.1 Relatórios Avançados
- **Arquivos:** Nova página `Reports.tsx`, `Sidebar.tsx`
- **Tipos de relatório:**
  - Gastos por fornecedor (pizza chart)
  - Gastos por mês (bar chart)
  - Top 10 itens mais pedidos
  - Tempo médio de entrega por fornecedor
- **Dependências:** Adicionar `recharts` ao package.json
- **VERIFY:** Acessar relatórios → gráficos renderizam com dados reais
- **Complexidade:** 🟡 Média (~4h)

### 3.2 KPIs no Dashboard
- **Arquivo:** `Dashboard.tsx`
- **Métricas:**
  - Lead time médio (dias entre criação e entrega)
  - Taxa de entrega no prazo (%)
  - Valor médio por pedido
  - Pedidos por mês (trend)
- **UI:** Cards com ícones e variação vs período anterior
- **VERIFY:** Dashboard mostra KPIs calculados corretamente
- **Complexidade:** 🟡 Média (~3h)

### 3.3 Previsão de Gastos
- **Arquivo:** `Dashboard.tsx` ou `Reports.tsx`
- **Descrição:** Projeção baseada em média móvel (3 meses)
- **UI:** Linha tracejada no gráfico de gastos mensais
- **VERIFY:** Gráfico mostra projeção para próximos 3 meses
- **Complexidade:** 🟡 Média (~2h)

### 3.4 Exportação Programada
- **Arquivos:** `Settings.tsx`, `index.ts` (scheduler)
- **Descrição:** Gerar e salvar relatórios automaticamente
- **Features:**
  - Selecionar tipo de relatório
  - Frequência (diário, semanal, mensal)
  - Pasta de destino
  - Formato (PDF, CSV)
- **VERIFY:** Configurar exportação semanal → arquivo gerado na segunda-feira
- **Complexidade:** 🔴 Alta (~5h)

### ✅ Checklist Fase 3
- [ ] 3.1 Relatórios Avançados
- [ ] 3.2 KPIs no Dashboard
- [ ] 3.3 Previsão de Gastos
- [ ] 3.4 Exportação Programada
- [ ] Gráficos renderizando corretamente
- [ ] Cálculos verificados manualmente

---

## 🔔 FASE 4: Comunicação & Alertas

> **Meta:** Nunca perder um prazo ou evento importante.

### 4.1 Alertas de Vencimento
- **Arquivos:** `index.ts` (notification system existente)
- **Descrição:** Notificação quando entregas estão atrasadas
- **Configuração:** X dias antes do vencimento
- **VERIFY:** Pedido com entrega amanhã → notificação aparece
- **Complexidade:** 🟢 Baixa (~1.5h)

### 4.2 Lembretes Personalizados
- **Arquivos:** `db.ts`, `Orders.tsx`, modal de lembrete
- **Descrição:** Criar lembretes para ações específicas por pedido
- **Schema:**
  ```typescript
  interface Reminder {
    id: string
    orderId: string
    message: string
    remindAt: string
    notified: boolean
  }
  ```
- **VERIFY:** Criar lembrete → notificação no horário correto
- **Complexidade:** 🟡 Média (~3h)

### 4.3 Timeline de Pedido
- **Arquivo:** `Orders.tsx` ou novo modal
- **Descrição:** Visualização cronológica do ciclo de vida
- **Eventos:** Criado, Editado, Status alterado, Documento anexado, Entregue
- **UI:** Timeline vertical com ícones e timestamps
- **VERIFY:** Abrir timeline → todos os eventos do pedido visíveis
- **Complexidade:** 🟡 Média (~3h)

### 4.4 Integração E-mail (Opcional/Avançado)
- **Arquivos:** `index.ts`, `Settings.tsx`
- **Descrição:** Enviar resumos ou alertas por e-mail
- **Configuração:** Servidor SMTP, destinatários
- **Dependências:** `nodemailer`
- **VERIFY:** Configurar SMTP → enviar teste → e-mail recebido
- **Complexidade:** 🔴 Alta (~5h)

### ✅ Checklist Fase 4
- [ ] 4.1 Alertas de Vencimento
- [ ] 4.2 Lembretes Personalizados
- [ ] 4.3 Timeline de Pedido
- [ ] 4.4 Integração E-mail (opcional)
- [ ] Notificações funcionando
- [ ] Timers não vazam memória

---

## 🤖 FASE 5: Automação SAP Avançada

> **Meta:** Automatizar mais processos SAP e em escala.

### 5.1 Novas Transações
- **Arquivos:** `SapAutomation.tsx`, `scripts/` (VBScript)
- **Transações:**
  - `ME51N` - Criar Requisição de Compra
  - `ME53N` - Exibir Requisição
  - `ME52N` - Modificar Requisição
  - `MIGO` - Entrada de Mercadoria
  - `MIRO` - Verificação de Fatura
- **VERIFY:** Executar cada transação → abre corretamente no SAP
- **Complexidade:** 🟡 Média (~4h total)

### 5.2 Automação em Lote
- **Arquivo:** `SapAutomation.tsx`
- **Descrição:** Executar mesma transação para múltiplos pedidos
- **UI:** Checkbox para selecionar pedidos + botão "Executar em Lote"
- **Features:**
  - Progresso visual
  - Log por item
  - Parar em caso de erro (configurável)
- **VERIFY:** Selecionar 5 pedidos → executar → todos processados
- **Complexidade:** 🔴 Alta (~6h)

### 5.3 Agendamento SAP
- **Arquivos:** `SapAutomation.tsx`, `Settings.tsx`, `index.ts`
- **Descrição:** Agendar scripts para horários específicos
- **Features:**
  - Selecionar script e parâmetros
  - Definir horário (cron-like)
  - Histórico de execuções
- **VERIFY:** Agendar para daqui 5min → executa automaticamente
- **Complexidade:** 🔴 Alta (~5h)

### 5.4 Logs Persistentes
- **Arquivos:** `db.ts`, `SapAutomation.tsx`
- **Descrição:** Salvar histórico de automações
- **Dados:** Script, parâmetros, resultado, timestamp, duração
- **UI:** Aba "Histórico" com filtros
- **VERIFY:** Executar script → log aparece no histórico
- **Complexidade:** 🟢 Baixa (~2h)

### 5.5 Macros Customizadas (Futuro)
- **Descrição:** Gravar sequências de ações SAP
- **Complexidade:** 🔴🔴 Muito Alta - Requer pesquisa adicional

### ✅ Checklist Fase 5
- [ ] 5.1 Novas Transações (ME51N, ME53N, MIGO, MIRO)
- [ ] 5.2 Automação em Lote
- [ ] 5.3 Agendamento SAP
- [ ] 5.4 Logs Persistentes
- [ ] Scripts VBScript funcionando
- [ ] Tratamento de erros SAP

---

## 📁 FASE 6: Gestão de Documentos

> **Meta:** Visualizar, organizar e extrair dados de documentos.

### 6.1 Preview de Documentos
- **Arquivos:** `Documents.tsx`, novo componente `DocumentPreview.tsx`
- **Descrição:** Visualizar PDFs e imagens no app
- **Suporte:** PDF, PNG, JPG, GIF
- **UI:** Painel lateral ou modal com preview
- **VERIFY:** Clicar em documento → preview renderiza
- **Complexidade:** 🟡 Média (~3h)

### 6.2 OCR Automático Aprimorado
- **Arquivos:** `src/main/services/DocumentParser.ts`
- **Descrição:** Extrair mais dados de documentos
- **Dados:** Número NF, CNPJ, Data, Itens, Valores
- **Já existe:** Tesseract.js no projeto
- **VERIFY:** Anexar NF → dados extraídos automaticamente
- **Complexidade:** 🟡 Média (~4h)

### 6.3 Versionamento de Documentos
- **Arquivos:** `db.ts`, `Documents.tsx`
- **Descrição:** Manter versões antigas ao substituir
- **Schema:**
  ```typescript
  interface DocumentVersion {
    id: string
    documentId: string
    version: number
    path: string
    createdAt: string
  }
  ```
- **UI:** Dropdown "Versões anteriores"
- **VERIFY:** Substituir documento → versão antiga acessível
- **Complexidade:** 🟡 Média (~3h)

### 6.4 Tags/Labels
- **Arquivos:** `db.ts`, `Documents.tsx`
- **Descrição:** Categorizar documentos com tags
- **Features:**
  - Criar/editar/excluir tags
  - Cores personalizadas
  - Filtrar por tag
- **VERIFY:** Adicionar tag → filtrar → apenas docs com tag aparecem
- **Complexidade:** 🟢 Baixa (~2h)

### 6.5 Busca por Conteúdo
- **Arquivos:** `index.ts`, `Documents.tsx`
- **Descrição:** Pesquisar texto dentro de PDFs
- **Dependências:** Usar `pdf-parse` (já existe!)
- **Features:**
  - Indexar conteúdo de PDFs
  - Busca full-text
  - Highlight de resultados
- **VERIFY:** Buscar termo → documento encontrado → termo destacado
- **Complexidade:** 🔴 Alta (~5h)

### ✅ Checklist Fase 6
- [ ] 6.1 Preview de Documentos
- [ ] 6.2 OCR Automático Aprimorado
- [ ] 6.3 Versionamento de Documentos
- [ ] 6.4 Tags/Labels
- [ ] 6.5 Busca por Conteúdo
- [ ] Preview renderiza corretamente
- [ ] OCR extrai dados com precisão

---

## 👥 FASE 7: Multi-Usuário (Futuro)

> **Meta:** Preparar o app para uso em equipe.

### 7.1 Perfis de Usuário
- **Descrição:** Diferentes permissões
- **Níveis:** Visualizador, Editor, Admin
- **Complexidade:** 🔴 Alta

### 7.2 Comentários em Pedidos
- **Descrição:** Adicionar notas/comentários
- **Complexidade:** 🟢 Baixa (~2h)

### 7.3 Atribuição de Tarefas
- **Descrição:** Delegar tarefas para outros usuários
- **Complexidade:** 🟡 Média

### 7.4 Sincronização
- **Descrição:** Sync via pasta compartilhada
- **Complexidade:** 🔴🔴 Muito Alta

### 7.5 Restaurar da Lixeira
- **Descrição:** Soft delete com recuperação
- **Complexidade:** 🟡 Média (~3h)

### ✅ Checklist Fase 7
- [ ] 7.1 Perfis de Usuário
- [ ] 7.2 Comentários em Pedidos
- [ ] 7.3 Atribuição de Tarefas
- [ ] 7.4 Sincronização
- [ ] 7.5 Restaurar da Lixeira

---

## 📦 Dependências Novas Necessárias

```json
{
  "dependencies": {
    "recharts": "^2.x",      // Gráficos (Fase 3)
    "papaparse": "^5.x",     // CSV parsing (Fase 2.3)
    "nodemailer": "^6.x",    // E-mail (Fase 4.4, opcional)
    "react-pdf": "^7.x"      // Preview PDF (Fase 6.1)
  }
}
```

---

## 🏁 FASE X: Verificação Final (Por Fase)

Após cada fase:
1. `npm run build` → Sem erros
2. `npm run dev` → Testar funcionalidades
3. Verificar performance (app inicia < 3s)
4. Testar modo claro/escuro
5. Marcar checkboxes como `[x]`

---

## 📝 Próximos Passos

1. **Confirmar prioridade** das fases
2. **Iniciar Fase 1** - Quick Wins
3. **Iterar** - Completar uma fase antes de iniciar outra

---

> **Quer começar pela Fase 1?** Posso implementar as 5 funcionalidades de Quick Wins agora.
