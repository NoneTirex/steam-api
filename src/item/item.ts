import {InspectUrl} from "../inspect/inspect-url"

const {ItemInfo} = require("globaloffensive")

export type Sticker = {
    slot: number
    id: number
    wear?: number
    scale?: number
    rotation?: number
}

export type CsgoItem = {
    itemId: bigint
    m: bigint
    d: bigint
    s: bigint

    rarity: number

    origin: number
    quality: number
    paintIndex: number
    paintSeed: number
    defIndex: number

    floatValue: number

    stickers: Array<Sticker>

    lastUpdate: Date
}

export function itemInfoToCsgoItem(inspectUrl: InspectUrl, itemInfo: typeof ItemInfo): CsgoItem {
    const stickers: Array<Sticker> = itemInfo.stickers.map((sticker: any): Sticker => {
        return {
            slot: sticker.slot,
            id: sticker.sticker_id,
            wear: sticker.wear || undefined,
            scale: sticker.scale || undefined,
            rotation: sticker.rotation || undefined,
        }
    })

    const {m, s, d} = inspectUrl.getParameters();
    return {
        itemId: BigInt(itemInfo.itemid),
        m,
        s,
        d,
        rarity: itemInfo.rarity,

        origin: itemInfo.origin,
        quality: itemInfo.quality,
        paintIndex: itemInfo.paintindex,
        paintSeed: itemInfo.paintseed || 0,
        defIndex: itemInfo.defindex,

        floatValue: itemInfo.paintwear,

        stickers,

        lastUpdate: new Date()
    }
}