import {Pool} from "pg";
import {CsgoItem, Sticker} from "./item";
import {signed64ToUnsigned, unsigned64ToSigned} from "../utils";

const saveQuery = `
    insert into csgo_item (item_id, m, s, d, rarity, origin, quality, paint_index, paint_seed, def_index, float_value,
                           stickers, last_update)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    on conflict (item_id) do update set m           = $2,
                                        s           = $3,
                                        d           = $4,
                                        rarity      = $5,
                                        origin      = $6,
                                        quality     = $7,
                                        paint_index = $8,
                                        paint_seed  = $9,
                                        def_index   = $10,
                                        float_value = $11,
                                        stickers    = $12,
                                        last_update = $13
`

export class ItemRepository {
    private pool: Pool

    constructor(pool: Pool) {
        this.pool = pool;
    }

    async save(item: CsgoItem) {
        await this.pool.query(saveQuery, [
            unsigned64ToSigned(item.itemId),
            unsigned64ToSigned(item.m),
            unsigned64ToSigned(item.s),
            unsigned64ToSigned(item.d),
            item.rarity,
            item.origin,
            item.quality,
            item.paintIndex,
            item.paintSeed,
            item.defIndex,
            item.floatValue,
            JSON.stringify(item.stickers),
            item.lastUpdate
        ])
    }

    async findByAssetId(assetId: bigint): Promise<CsgoItem | null> {
        const {rows} = await this.pool.query("select * from csgo_item where item_id = $1", [
            unsigned64ToSigned(assetId)
        ])
        if (rows.length > 0) {
            const row = rows[0]
            const stickers: Array<Sticker> = row.stickers
            return {
                itemId: signed64ToUnsigned(BigInt(row.item_id)),
                m: signed64ToUnsigned(BigInt(row.m)),
                s: signed64ToUnsigned(BigInt(row.s)),
                d: signed64ToUnsigned(BigInt(row.d)),
                rarity: row.rarity,
                origin: row.origin,
                quality: row.quality,
                paintIndex: row.paint_index,
                paintSeed: row.paint_seed,
                defIndex: row.def_index,
                floatValue: row.float_value,
                stickers,
                lastUpdate: row.last_update
            }
        }
        return null
    }
}