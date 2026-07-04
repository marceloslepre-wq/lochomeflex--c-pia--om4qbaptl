migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!users.fields.getByName('role')) {
      users.fields.add(
        new SelectField({
          name: 'role',
          values: ['Administrador', 'Usuario'],
          maxSelect: 1,
        }),
      )
      app.save(users)
    }

    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'gestor@email.com')
      return // already seeded
    } catch (_) {}

    const record = new Record(users)
    record.setEmail('gestor@email.com')
    record.setPassword('senha@123')
    record.setVerified(true)
    record.set('name', 'Gestor')
    record.set('role', 'Administrador')
    app.save(record)
  },
  (app) => {
    try {
      const record = app.findAuthRecordByEmail('_pb_users_auth_', 'gestor@email.com')
      app.delete(record)
    } catch (_) {}
  },
)
