export function shuffleArray<T>(array: Array<T>): Array<T> {
    return array.map(value => ({
        value, sort: Math.random()
    })).sort((a, b) => a.sort - b.sort).map(({value}) => value)
}

export function unsigned64ToSigned(num: bigint) {
    const mask = 1n << 63n;
    return (num ^ mask) - mask;
}

export function signed64ToUnsigned(num: bigint) {
    const mask = 1n << 63n;
    return (num + mask) ^ mask;
}
