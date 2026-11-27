import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function eraseCustomer(shopper) {
  const file = resolve(
    process.env.ORDER_DATABASE_PATH || '../../.data/orders.sqlite',
  );
  if (!existsSync(file)) return;
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
    const hasTable = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    );
    if (hasTable.get('commerce_records')) {
      db.prepare('DELETE FROM commerce_records WHERE scope=?').run(
        'customer:' + shopper,
      );
    }
    if (hasTable.get('commerce_orders')) {
      const orders = db
        .prepare('SELECT reference,data FROM commerce_orders WHERE shopper=?')
        .all(shopper);
      const anonymize = db.prepare(
        "UPDATE commerce_orders SET shopper='deleted',guest='',data=? WHERE reference=?",
      );
      for (const order of orders) {
        anonymize.run(
          JSON.stringify({
            ...JSON.parse(order.data),
            name: '',
            email: '',
            phone: '',
            accessToken: '',
            address: { line: '', city: '', postalCode: '' },
          }),
          order.reference,
        );
      }
    }
    db.exec('COMMIT');
  } finally {
    db.close();
  }
}
