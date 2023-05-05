const inspectUrlRegex = /^steam:\/\/rungame\/730\/\d+\/[+ ]csgo_econ_action_preview ([SM])(\d+)A(\d+)D(\d+)$/

export type InspectUrlParameters = {
    s: bigint
    a: bigint
    d: bigint
    m: bigint
}

export class InspectUrl {
    listingId: bigint
    assetId: bigint
    d: bigint

    marketUrl: boolean

    constructor(listingId: bigint, assetId: bigint, d: bigint, marketUrl: boolean) {
        this.listingId = listingId;
        this.assetId = assetId;
        this.d = d;
        this.marketUrl = marketUrl;
    }

    getParameters(): InspectUrlParameters {
        return {
            s: !this.marketUrl ? this.listingId : BigInt(0),
            a: this.assetId,
            d: this.d,
            m: this.marketUrl ? this.listingId : BigInt(0)
        }
    }

    toString(): string {
        if (this.marketUrl) {
            return `steam://rungame/730/76561202255233023/+csgo_econ_action_preview M${this.listingId}A${this.assetId}D${this.d}`;
        } else {
            return `steam://rungame/730/76561202255233023/+csgo_econ_action_preview S${this.listingId}A${this.assetId}D${this.d}`;
        }
    }

    static parseUrl(url: string): InspectUrl | undefined {
        const link = decodeURI(url)

        const groups = inspectUrlRegex.exec(link);
        if (!groups) {
            return undefined
        }
        const listingId = BigInt(groups[2])
        const assetId = BigInt(groups[3])
        const d = BigInt(groups[4])
        const marketUrl = groups[1] === 'M'

        return new InspectUrl(listingId, assetId, d, marketUrl)
    }

    static parametersToInspectUrl(a: bigint, d: bigint, s?: bigint, m?: bigint): InspectUrl {
        const marketUrl = !!m;
        let listingId;
        if (marketUrl) {
            listingId = m!;
        } else {
            listingId = s!;
        }
        return new InspectUrl(listingId, a, d, marketUrl);
    }
}