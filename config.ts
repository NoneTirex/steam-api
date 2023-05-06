import fs from "fs"

const proxies = fs.readFileSync("proxies.txt", "utf-8")
    .split("\n")
    .filter(line => line !== "")
    .map(line => {
        const [address, port, username, password] = line.split(":");
        return `socks5://${username}:${password}@${address}:${port}`
    })

const accounts = fs.readFileSync("accounts.txt", "utf-8")
    .split("\n")
    .filter(line => line !== "")
    .map(line => {
        const [username, password] = line.split(":")
        return {
            username,
            password,
        }
    });

module.exports = {
    // Configuration for the HTTP API server
    http: {
        port: process.env.HTTP_PORT || 80
    },

    // Whether to trust a forwarding proxy's IP (trust X-Forwarded-For)
    trustProxy: !!process.env.TRUST_PROXY || true,

    // List of usernames and passwords for the Steam accounts
    logins: accounts,

    // Optional HTTP/SOCKS5 proxies to auto-rotate for each bot in a round-robin
    proxies: proxies,

    // Bot settings
    botSettings: {
        // Amount of attempts for each request to Valve
        maxAttempts: 3,

        // Amount of milliseconds to wait between subsequent requests to Valve (per bot)
        requestDelay: 1100,

        // Amount of milliseconds to wait until a request to Valve is timed out
        requestTTL: 2000,
    },
    // Logging Level (error, warn, info, verbose, debug, silly)
    logLevel: "debug",

    // Postgres connection string to store results in (ex. postgres://user:pass@127.0.0.1:5432/postgres?sslmode=disable)
    databaseUrl: process.env.DATABASE_URL,

    // OPTIONAL: Maximum queue size allowed before dropping requests
    maxQueueSize: -1,
};
