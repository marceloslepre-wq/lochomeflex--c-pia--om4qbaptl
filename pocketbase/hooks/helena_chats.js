routerAdd(
  'GET',
  '/backend/v1/helena/chats',
  (e) => {
    const userId = e.auth && e.auth.id
    if (!userId) return e.unauthorizedError('auth required')
    const limit = parseInt((e.requestInfo().query && e.requestInfo().query.limit) || '20', 10) || 20
    return e.json(200, $ai.agent('helena').listConversations({ user_id: userId, limit: limit }))
  },
  $apis.requireAuth(),
)
