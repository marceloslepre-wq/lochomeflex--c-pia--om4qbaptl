migrate(
  (app) => {
    var locationsId = app.findCollectionByNameOrId('locations').id
    var rentalsCol = app.findCollectionByNameOrId('rentals')

    if (!rentalsCol.fields.getByName('pickup_location')) {
      rentalsCol.fields.add(
        new RelationField({
          name: 'pickup_location',
          collectionId: locationsId,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }

    if (!rentalsCol.fields.getByName('return_location')) {
      rentalsCol.fields.add(
        new RelationField({
          name: 'return_location',
          collectionId: locationsId,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }

    app.save(rentalsCol)
  },
  (app) => {
    try {
      var rentalsCol = app.findCollectionByNameOrId('rentals')
      if (rentalsCol.fields.getByName('pickup_location')) {
        rentalsCol.fields.remove('pickup_location')
      }
      if (rentalsCol.fields.getByName('return_location')) {
        rentalsCol.fields.remove('return_location')
      }
      app.save(rentalsCol)
    } catch (_) {}
  },
)
