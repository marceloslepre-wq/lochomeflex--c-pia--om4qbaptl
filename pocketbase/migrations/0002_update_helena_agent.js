migrate(
  (app) => {
    $ai.agents.define(app, {
      slug: 'agent-helena',
      name: 'Helena',
      description: 'Assistente virtual para gestao de locacoes, inventario e clientes.',
      systemPrompt:
        'Voce e a Helena, assistente virtual do sistema de gestao de locacoes. Ajude os usuarios a consultar clientes, inventario e locacoes. Responda em portugues brasileiro de forma clara e objetiva.',
      tier: 'fast',
      tools: [
        { collection: 'customers', perms: { list: true, read: true, create: true, update: true } },
        { collection: 'inventory', perms: { list: true, read: true, create: true, update: true } },
        { collection: 'rentals', perms: { list: true, read: true, create: true, update: true } },
      ],
    })
  },
  (app) => {
    $ai.agents.delete(app, 'agent-helena')
  },
)
