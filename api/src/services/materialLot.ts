import type { PoolClient } from 'pg';

type SourceBatch = {
  id: string;
  crop: string;
  quantity_kg: number | string;
  current_holder_id: string;
  harvest_date: string;
};

export async function ensureSourceMaterialLot(client: PoolClient, batch: SourceBatch): Promise<void> {
  const lotCode = `SRC-${batch.id.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  await client.query(
    `INSERT INTO material_lots (
       lot_code, lot_type, batch_id, product_name, quantity_kg,
       owner_organization_id, status, produced_at
     ) VALUES ($1,'source',$2,$3,$4,$5,'available',$6)
     ON CONFLICT (batch_id) DO NOTHING`,
    [lotCode, batch.id, batch.crop, batch.quantity_kg, batch.current_holder_id, batch.harvest_date]
  );
}
