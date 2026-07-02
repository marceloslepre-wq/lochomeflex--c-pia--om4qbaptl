migrate(
  (app) => {
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'marceloslepre@gmail.com')
    } catch (_) {
      var users = app.findCollectionByNameOrId('_pb_users_auth_')
      var rec = new Record(users)
      rec.setEmail('marceloslepre@gmail.com')
      rec.setPassword('Skip@Pass')
      rec.setVerified(true)
      rec.set('name', 'Marcelo Lepre')
      app.save(rec)
    }

    var invCol = app.findCollectionByNameOrId('inventory')
    var seeds = [
      {
        name: 'Furadeira de Impacto 750W',
        sku: 'FER-001',
        cat: 'Ferramentas',
        rate: 45.0,
        desc: 'Furadeira de impacto 750W com mandril 13mm',
      },
      {
        name: 'Sistema de Som Profissional 500W',
        sku: 'SOM-002',
        cat: 'Equipamentos de Som',
        rate: 120.0,
        desc: 'Caixa de som ativa 500W com mixer integrado',
      },
      {
        name: 'Projetor 4K UHD 3500 Lumens',
        sku: 'PRO-003',
        cat: 'Audiovisuais',
        rate: 90.0,
        desc: 'Projetor 4K UHD 3500 lumens HDR10',
      },
    ]
    var invIds = []
    for (var i = 0; i < seeds.length; i++) {
      var s = seeds[i]
      try {
        invIds.push(app.findFirstRecordByData('inventory', 'sku', s.sku).id)
      } catch (_) {
        var ir = new Record(invCol)
        ir.set('name', s.name)
        ir.set('sku', s.sku)
        ir.set('category', s.cat)
        ir.set('daily_rate', s.rate)
        ir.set('status', 'available')
        ir.set('description', s.desc)
        app.save(ir)
        invIds.push(ir.id)
      }
    }

    var custCol = app.findCollectionByNameOrId('customers')
    var custId
    try {
      custId = app.findFirstRecordByData('customers', 'email', 'joao.silva@example.com').id
    } catch (_) {
      var cr = new Record(custCol)
      cr.set('name', 'Joao Silva')
      cr.set('email', 'joao.silva@example.com')
      cr.set('phone', '(11) 98765-4321')
      cr.set('document_id', '123.456.789-00')
      cr.set('address', 'Rua das Flores, 123 - Centro, Sao Paulo/SP')
      app.save(cr)
      custId = cr.id
    }

    var rentCol = app.findCollectionByNameOrId('rentals')
    try {
      app.findFirstRecordByData('rentals', 'customer', custId)
    } catch (_) {
      var now = new Date()
      var endD = new Date(now.getTime() + 7 * 86400000)
      var rr = new Record(rentCol)
      rr.set('customer', custId)
      rr.set('items', invIds)
      rr.set('start_date', now.toISOString().split('T')[0])
      rr.set('end_date', endD.toISOString().split('T')[0])
      rr.set('total_price', 1785.0)
      rr.set('status', 'active')
      app.save(rr)
    }
  },
  (app) => {
    try {
      var cust = app.findFirstRecordByData('customers', 'email', 'joao.silva@example.com')
      try {
        var rentals = app.findRecordsByFilter('rentals', 'customer = "' + cust.id + '"', '', 10, 0)
        for (var i = 0; i < rentals.length; i++) {
          app.delete(rentals[i])
        }
      } catch (_) {}
      app.delete(cust)
    } catch (_) {}
    var skus = ['FER-001', 'SOM-002', 'PRO-003']
    for (var j = 0; j < skus.length; j++) {
      try {
        app.delete(app.findFirstRecordByData('inventory', 'sku', skus[j]))
      } catch (_) {}
    }
  },
)
