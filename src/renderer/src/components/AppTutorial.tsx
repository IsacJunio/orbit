import { useEffect, useRef, useCallback } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useLocation } from 'react-router-dom'

interface DriveStep {
    element: string
    popover: {
        title: string
        description: string
        side?: string
        align?: string
    }
}

interface TutorialConfig {
    steps: DriveStep[]
    storageKey: string
}

const TUTORIAL_STEPS: Record<string, TutorialConfig> = {
    '/dashboard': {
        storageKey: 'orbit_tutorial_seen_dashboard_v1',
        steps: [
            {
                element: '#sidebar',
                popover: {
                    title: 'Bem-vindo ao Orbit!',
                    description: 'Este é o seu novo sistema de gestão. Aqui no menu lateral você tem acesso rápido a todas as funcionalidades.',
                    side: 'right',
                    align: 'center'
                }
            },
            {
                element: '#global-search',
                popover: {
                    title: 'Busca Global',
                    description: 'Pressione Ctrl+K ou clique aqui para buscar qualquer coisa no sistema (pedidos, clientes, docs).',
                    side: 'right',
                    align: 'center'
                }
            },
            {
                element: '#dashboard-stats',
                popover: {
                    title: 'Indicadores',
                    description: 'Acompanhe o volume financeiro, pedidos pendentes e o lead time médio da sua operação em tempo real.',
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '#btn-new-order',
                popover: {
                    title: 'Acesso Rápido',
                    description: 'Botões de ação rápida para criar novos pedidos ou tarefas sem sair do dashboard.',
                    side: 'left',
                    align: 'center'
                }
            }
        ]
    },
    '/orders': {
        storageKey: 'orbit_tutorial_seen_orders_v1',
        steps: [
            {
                element: '#orders-search',
                popover: {
                    title: 'Busca de Pedidos',
                    description: 'Pesquise por número do pedido, nome do fornecedor ou código SAP. Use Ctrl+F para focar rapidamente.',
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '#orders-filters',
                popover: {
                    title: 'Filtros Avançados',
                    description: 'Filtre seus pedidos por status (Pendente, Aprovado, Entregue) ou por período de data.',
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '#orders-new-btn-container',
                popover: {
                    title: 'Novo Pedido',
                    description: 'Crie novos pedidos de compra aqui. Clique na seta para ver opções adicionais.',
                    side: 'left',
                    align: 'center'
                }
            },
            {
                element: '#orders-export-btn',
                popover: {
                    title: 'Relatórios e Exportação',
                    description: 'Exporte seus pedidos para PDF ou Excel. Gere relatórios de pendências com um clique.',
                    side: 'left',
                    align: 'center'
                }
            }
        ]
    },
    '/tasks': {
        storageKey: 'orbit_tutorial_seen_tasks_v1',
        steps: [
            {
                element: '#tasks-week-nav',
                popover: {
                    title: 'Navegação Semanal',
                    description: 'Navegue entre as semanas para ver suas tarefas passadas ou futuras. O botão "Hoje" retorna para a semana atual.',
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '#tasks-new-btn',
                popover: {
                    title: 'Nova Tarefa',
                    description: 'Adicione lembretes, reuniões ou prazos importantes.',
                    side: 'left',
                    align: 'center'
                }
            },
            {
                element: '#tasks-grid',
                popover: {
                    title: 'Calendário de Tarefas',
                    description: 'Suas tarefas aparecem aqui. Você pode arrastar e soltar (drag & drop) para reagendar tarefas facilmente entre os dias.',
                    side: 'top',
                    align: 'center'
                }
            }
        ]
    },
    '/documents': {
        storageKey: 'orbit_tutorial_seen_documents_v1',
        steps: [
            {
                element: '#docs-header',
                popover: {
                    title: 'Gestão de Documentos',
                    description: 'Centralize seus arquivos, contratos e notas fiscais aqui.',
                    side: 'bottom',
                    align: 'center'
                }
            },
            {
                element: '#docs-new-folder-btn',
                popover: {
                    title: 'Organização',
                    description: 'Crie novas pastas para organizar seus documentos por categorias ou projetos.',
                    side: 'left',
                    align: 'center'
                }
            },
            {
                element: '#docs-folder-list',
                popover: {
                    title: 'Suas Pastas',
                    description: 'Pastas de pedidos SAP são criadas automaticamente. Clique em uma pasta para ver e gerenciar os arquivos.',
                    side: 'top',
                    align: 'center'
                }
            }
        ]
    },
    '/suppliers': {
        storageKey: 'orbit_tutorial_seen_suppliers_v1',
        steps: [
            {
                element: '#suppliers-new-btn',
                popover: {
                    title: 'Cadastro de Fornecedores',
                    description: 'Cadastre novos fornecedores e mantenha seus contatos organizados.',
                    side: 'left',
                    align: 'center'
                }
            },
            {
                element: '#suppliers-grid',
                popover: {
                    title: 'Lista de Fornecedores',
                    description: 'Visualize todos os seus fornecedores. Clique no código SAP para copiar rapidamente.',
                    side: 'top',
                    align: 'center'
                }
            },
            {
                element: '#suppliers-sap-list',
                popover: {
                    title: 'Gerador de Listas',
                    description: 'Selecione vários fornecedores para gerar listas de códigos SAP ou exportar contatos em CSV/Excel.',
                    side: 'top',
                    align: 'center'
                }
            }
        ]
    }
}

export default function AppTutorial() {
    const location = useLocation()
    const driverObj = useRef<any>(null)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    // Função para iniciar o tutorial
    const startTutorial = useCallback((config: TutorialConfig) => {
        // Verifica se os elementos existem antes de iniciar
        const firstElement = document.querySelector(config.steps[0].element)
        if (!firstElement) {
            // Tenta novamente em 1 segundo se não encontrar
            console.log(`[Tutorial] Elemento ${config.steps[0].element} não encontrado, tentando novamente...`)
            setTimeout(() => {
                const retryElement = document.querySelector(config.steps[0].element)
                if (retryElement) {
                    runDriver(config)
                }
            }, 1000)
            return
        }

        runDriver(config)
    }, [])

    function runDriver(config: TutorialConfig) {
        driverObj.current = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            doneBtnText: 'Entendi',
            nextBtnText: 'Próximo',
            prevBtnText: 'Voltar',
            progressText: 'Dica {{current}} de {{total}}',
            steps: config.steps as any,
            onDestroyStarted: () => {
                if (!driverObj.current.hasNextStep() || confirm('Pular as dicas desta tela?')) {
                    driverObj.current.destroy()
                    localStorage.setItem(config.storageKey, 'true')
                }
            }
        })

        driverObj.current.drive()
    }

    useEffect(() => {
        // Limpa timer anterior
        if (timerRef.current) clearTimeout(timerRef.current)

        // Se já houver um driver ativo, destrói para evitar sobreposição
        if (driverObj.current) {
            try {
                driverObj.current.destroy()
            } catch (e) {
                // Ignore destruction errors
            }
        }

        const currentPath = location.pathname
        const config = TUTORIAL_STEPS[currentPath] || (currentPath === '/' ? TUTORIAL_STEPS['/dashboard'] : null)

        if (config) {
            const hasSeen = localStorage.getItem(config.storageKey)

            if (!hasSeen) {
                // Delay para garantir que a página renderizou completamente
                timerRef.current = setTimeout(() => {
                    startTutorial(config)
                }, 1000)
            }
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
            if (driverObj.current) {
                try {
                    driverObj.current.destroy()
                } catch (e) {
                    // Ignore destruction errors
                }
            }
        }
    }, [location.pathname, startTutorial])

    return null
}
