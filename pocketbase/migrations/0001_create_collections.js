migrate(
  (app) => {
    if (!app.hasTable('customers')) {
      app.save(
        new Collection({
          name: 'customers',
          type: 'base',
          listRule: "@request.auth.id != ''",
          viewRule: "@request.auth.id != ''",
          createRule: "@request.auth.id != ''",
          updateRule: "@request.auth.id != ''",
          deleteRule: "@request.auth.id != ''",
          fields: [
            { name: 'name', type: 'text', required: true },
            { name: 'email', type: 'text' },
            { name: 'phone', type: 'text' },
            { name: 'document_id', type: 'text' },
            { name: 'address', type: 'text' },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
          indexes: [
            "CREATE UNIQUE INDEX idx_customers_email ON customers (email) WHERE email != ''",
          ],
        }),
      )
    }

    if (!app.hasTable('inventory')) {
      app.save(
        new Collection({
          name: 'inventory',
          type: 'base',
          listRule: "@request.auth.id != ''",
          viewRule: "@request.auth.id != ''",
          createRule: "@request.auth.id != ''",
          updateRule: "@request.auth.id != ''",
          deleteRule: "@request.auth.id != ''",
          fields: [
            { name: 'name', type: 'text', required: true },
            { name: 'description', type: 'text' },
            { name: 'sku', type: 'text' },
            { name: 'category', type: 'text' },
            { name: 'daily_rate', type: 'number', required: true },
            {
              name: 'status',
              type: 'select',
              values: ['available', 'rented', 'maintenance', 'lost'],
              maxSelect: 1,
            },
            {
              name: 'image',
              type: 'file',
              maxSelect: 1,
              maxSize: 5242880,
              mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
            },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
          indexes: [
            "CREATE UNIQUE INDEX idx_inventory_sku ON inventory (sku) WHERE sku != ''",
            'CREATE INDEX idx_inventory_status ON inventory (status)',
            'CREATE INDEX idx_inventory_category ON inventory (category)',
          ],
        }),
      )
    }

    var customersId = app.findCollectionByNameOrId('customers').id
    var inventoryId = app.findCollectionByNameOrId('inventory').id

    if (!app.hasTable('rentals')) {
      app.save(
        new Collection({
          name: 'rentals',
          type: 'base',
          listRule: "@request.auth.id != ''",
          viewRule: "@request.auth.id != ''",
          createRule: "@request.auth.id != ''",
          updateRule: "@request.auth.id != ''",
          deleteRule: "@request.auth.id != ''",
          fields: [
            {
              name: 'customer',
              type: 'relation',
              required: true,
              collectionId: customersId,
              maxSelect: 1,
              cascadeDelete: false,
            },
            { name: 'items', type: 'relation', collectionId: inventoryId, maxSelect: 999 },
            { name: 'start_date', type: 'date', required: true },
            { name: 'end_date', type: 'date' },
            { name: 'total_price', type: 'number' },
            {
              name: 'status',
              type: 'select',
              values: ['pending', 'active', 'completed', 'cancelled'],
              maxSelect: 1,
            },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
          indexes: ['CREATE INDEX idx_rentals_status ON rentals (status)'],
        }),
      )
    }

    var rentalsId = app.findCollectionByNameOrId('rentals').id

    if (!app.hasTable('contracts')) {
      app.save(
        new Collection({
          name: 'contracts',
          type: 'base',
          listRule: "@request.auth.id != ''",
          viewRule: "@request.auth.id != ''",
          createRule: "@request.auth.id != ''",
          updateRule: "@request.auth.id != ''",
          deleteRule: "@request.auth.id != ''",
          fields: [
            {
              name: 'rental',
              type: 'relation',
              required: true,
              collectionId: rentalsId,
              maxSelect: 1,
              cascadeDelete: true,
            },
            {
              name: 'contract_file',
              type: 'file',
              maxSelect: 1,
              maxSize: 10485760,
              mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
            },
            { name: 'signed_at', type: 'date' },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
        }),
      )
    }

    if (!app.hasTable('billing')) {
      app.save(
        new Collection({
          name: 'billing',
          type: 'base',
          listRule: "@request.auth.id != ''",
          viewRule: "@request.auth.id != ''",
          createRule: "@request.auth.id != ''",
          updateRule: "@request.auth.id != ''",
          deleteRule: "@request.auth.id != ''",
          fields: [
            {
              name: 'rental',
              type: 'relation',
              required: true,
              collectionId: rentalsId,
              maxSelect: 1,
              cascadeDelete: true,
            },
            { name: 'amount', type: 'number', required: true },
            { name: 'due_date', type: 'date', required: true },
            { name: 'status', type: 'select', values: ['unpaid', 'paid', 'overdue'], maxSelect: 1 },
            { name: 'payment_method', type: 'text' },
            { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
          ],
          indexes: ['CREATE INDEX idx_billing_status ON billing (status)'],
        }),
      )
    }
  },
  (app) => {
    var names = ['billing', 'contracts', 'rentals', 'inventory', 'customers']
    for (var i = 0; i < names.length; i++) {
      try {
        app.delete(app.findCollectionByNameOrId(names[i]))
      } catch (_) {}
    }
  },
)
