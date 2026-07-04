migrate(
  (app) => {
    var locCol = app.findCollectionByNameOrId('locations')

    var seeds = [
      {
        name: 'Sede Principal',
        address: 'Rua Manoel Vivacqua, 616',
        city: 'Vitoria',
        state: 'ES',
        zip: '29072-045',
      },
      {
        name: 'Filial Centro',
        address: 'Av. Jeronimo Monteiro, 100',
        city: 'Vitoria',
        state: 'ES',
        zip: '29055-300',
      },
      {
        name: 'Galpao',
        address: 'Rodovia BR-101, Km 5',
        city: 'Cariacica',
        state: 'ES',
        zip: '29140-000',
      },
      {
        name: 'Loja Vila Velha',
        address: 'Av. Expedito Garcia, 500',
        city: 'Vila Velha',
        state: 'ES',
        zip: '29110-000',
      },
      {
        name: 'Loja Serra',
        address: 'Av. Eldes Scherrer Souza, 200',
        city: 'Serra',
        state: 'ES',
        zip: '29160-000',
      },
    ]

    for (var i = 0; i < seeds.length; i++) {
      var s = seeds[i]
      try {
        app.findFirstRecordByData('locations', 'name', s.name)
      } catch (_) {
        var rec = new Record(locCol)
        rec.set('name', s.name)
        rec.set('address', s.address)
        rec.set('city', s.city)
        rec.set('state', s.state)
        rec.set('zip_code', s.zip)
        rec.set('active', true)
        app.save(rec)
      }
    }
  },
  (app) => {
    var names = ['Sede Principal', 'Filial Centro', 'Galpao', 'Loja Vila Velha', 'Loja Serra']
    for (var i = 0; i < names.length; i++) {
      try {
        var rec = app.findFirstRecordByData('locations', 'name', names[i])
        app.delete(rec)
      } catch (_) {}
    }
  },
)
