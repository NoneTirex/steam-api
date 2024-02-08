import {InspectUrl} from "../inspect/inspect-url"
import SteamTotp from "steam-totp"

import {EventEmitter} from "events";

const SteamUser = require("steam-user")
const GlobalOffensive = require("globaloffensive")
const ItemInfo = GlobalOffensive.ItemInfo

const winston = require('winston');

export type BotLoginData = {
    username: string
    password: string,
    auth: string
}

export type BotSettings = {
    maxAttempts: number
    requestDelay: number
    requestTTL: number
    steamUser?: SteamUserSettings
}

export type SteamUserSettings = {
    httpProxy?: string
    socksProxy?: string
    dataDirectory?: string
}

type InspectRequest = {
    s: bigint
    a: bigint
    d: bigint
    m: bigint
    startTime: Date

    handler: (result: InspectResult) => void
}

export type InspectResult = {
    itemInfo: typeof ItemInfo
    delay: number
}

export class Bot extends EventEmitter {
    private readonly loginData: BotLoginData
    private readonly settings: BotSettings

    busy: boolean = false
    private _ready: boolean = false
    private relogin: boolean = false

    private readonly steamClient: typeof SteamUser
    private readonly csgoClient: typeof GlobalOffensive

    private inspectRequest?: InspectRequest

    private ttlTimeout?: NodeJS.Timeout

    /**
     * Sets the ready status and sends a 'ready' or 'unready' event if it has changed
     * @param {*|boolean} val New ready status
     */
    set ready(val) {
        const prev = this.ready;
        this._ready = val;

        if (val !== prev) {
            this.emit(val ? 'ready' : 'unready');
        }
    }

    /**
     * Returns the current ready status
     * @return {*|boolean} Ready status
     */
    get ready() {
        return this._ready || false;
    }

    constructor(loginData: BotLoginData, settings: BotSettings) {
        super();

        this.loginData = loginData;
        this.settings = settings;

        this.steamClient = new SteamUser(Object.assign({
            promptSteamGuardCode: false,
            enablePicsCache: true // Required to check if we own CSGO with ownsApp
        }, this.settings.steamUser));

        this.csgoClient = new GlobalOffensive(this.steamClient);

        // set up event handlers
        this.bindEventHandlers();

        // Variance to apply so that each bot relogins at different times
        const variance = ~~(Math.random() * 4 * 60 * 1000);

        // As of 7/10/2020, GC inspect calls can timeout repeatedly for whatever reason
        setInterval(() => {
            if (this.csgoClient.haveGCSession) {
                this.relogin = true;
                this.steamClient.relog();
            }
        }, 30 * 60 * 1000 + variance);
    }

    logIn() {
        this.ready = false;

        winston.info(`Logging in ${this.loginData.username}`);

        // If there is a steam client, make sure it is disconnected
        if (this.steamClient) {
            this.steamClient.logOff();
        }

        let steamLoginData = {
            accountName: this.loginData.username,
            password: this.loginData.password,
            rememberPassword: true,
            authCode: undefined as string | undefined,
            twoFactorCode: undefined as any
        };

        if (this.loginData.auth && this.loginData.auth !== "") {
            // Check if it is a shared_secret
            if (this.loginData.auth.length <= 5) {
                steamLoginData.authCode = this.loginData.auth;
            } else {
                // Generate the code from the shared_secret
                winston.debug(`${this.loginData.username} Generating TOTP Code from shared_secret`);
                steamLoginData.twoFactorCode = SteamTotp.getAuthCode(this.loginData.auth);
            }
        }

        winston.debug(`${this.loginData.username} About to connect`);
        this.steamClient.logOn(steamLoginData);
    }

    bindEventHandlers() {
        this.steamClient.on('error', (err: any) => {
            winston.error(`Error logging in ${this.loginData.username}:`, err);

            let loginErrorMessages: Record<string, string> = {
                61: 'Invalid Password',
                63: 'Account login denied due to 2nd factor authentication failure. ' +
                    'If using email auth, an email has been sent.',
                65: 'Account login denied due to auth code being invalid',
                66: 'Account login denied due to 2nd factor auth failure and no mail has been sent'
            };

            if (err.eresult && err.eresult in loginErrorMessages) {
                let eresult = err.eresult as string;
                let message = loginErrorMessages[eresult] as string;
                winston.error(`${this.loginData.username}: ${message}`)
            }

            // Yes, checking for string errors sucks, but we have no other attributes to check
            // this error against.
            if (err.toString().includes('Proxy connection timed out') || err.toString().includes("Socks5")) {
                this.logIn();
            }
        });

        this.steamClient.on('disconnected', (eresult: any, msg: any) => {
            winston.warn(`${this.loginData.username} Logged off, reconnecting! (${eresult}, ${msg})`);
        });

        this.steamClient.on('loggedOn', (details: any, parental: any) => {
            winston.info(`${this.loginData.username} Log on OK`);

            // Fixes reconnecting to CS:GO GC since node-steam-user still assumes we're playing 730
            // and never sends the appLaunched event to node-globaloffensive
            this.steamClient.gamesPlayed([], true);

            if (this.relogin) {
                // Don't check ownership cache since the event isn't always emitted on relogin
                winston.info(`${this.loginData.username} Initiating GC Connection, Relogin`);
                this.steamClient.gamesPlayed([730], true);
                return;
            }

            // Ensure we own CSGO
            // We have to wait until app ownership is cached to safely check
            this.steamClient.once('ownershipCached', () => {
                if (!this.steamClient.ownsApp(730)) {
                    winston.info(`${this.loginData.username} doesn't own CS:GO, retrieving free license`);

                    // Request a license for CS:GO
                    this.steamClient.requestFreeLicense([730], (err: any, grantedPackages: any, grantedAppIDs: any) => {
                        winston.debug(`${this.loginData.username} Granted Packages`, grantedPackages);
                        winston.debug(`${this.loginData.username} Granted App IDs`, grantedAppIDs);

                        if (err) {
                            winston.error(`${this.loginData.username} Failed to obtain free CS:GO license`);
                        } else {
                            winston.info(`${this.loginData.username} Initiating GC Connection`);
                            this.steamClient.gamesPlayed([730], true);
                        }
                    });
                } else {
                    winston.info(`${this.loginData.username} Initiating GC Connection`);
                    this.steamClient.gamesPlayed([730], true);
                }
            });
        });

        this.csgoClient.on('inspectItemInfo', (itemInfo: typeof ItemInfo) => {
            if (!this.inspectRequest) {
                return;
            }
            if (itemInfo.itemid !== this.inspectRequest.a.toString()) {
                return;
            }

            // GC requires a delay between subsequent requests
            // Figure out how long to delay until this bot isn't busy anymore
            let endTime = new Date();
            let offset = endTime.getTime() - this.inspectRequest.startTime.getTime();
            let delay = Math.max(0, this.settings.requestDelay - offset);

            const result: InspectResult = {
                itemInfo,
                delay
            }

            // Clear any TTL timeout
            if (this.ttlTimeout) {
                clearTimeout(this.ttlTimeout);
                this.ttlTimeout = undefined;
            }

            this.inspectRequest.handler(result);
            this.inspectRequest = undefined;

            setTimeout(() => {
                // We're no longer busy (satisfied request delay)
                this.busy = false;
            }, delay);
        });

        this.csgoClient.on('connectedToGC', () => {
            winston.info(`${this.loginData.username} CSGO Client Ready!`);

            this.ready = true;
        });

        this.csgoClient.on('disconnectedFromGC', (reason: any) => {
            winston.warn(`${this.loginData.username} CSGO unready (${reason}), trying to reconnect!`);
            this.ready = false;
        });

        this.csgoClient.on('connectionStatus', (status: any) => {
            winston.debug(`${this.loginData.username} GC Connection Status Update ${status}`);
        });

        // @ts-ignore
        this.csgoClient.on("debug", (msg: any) => {
            winston.debug(msg);
        });
    }

    sendFloatRequest(link: InspectUrl): Promise<InspectResult> {
        return new Promise((resolve, reject) => {
            this.busy = true;

            const params = link.getParameters();
            winston.debug(`${this.loginData.username} Fetching for ${params.a}`);

            this.inspectRequest = {
                s: params.s,
                a: params.a,
                d: params.d,
                m: params.m,
                startTime: new Date(),
                handler: resolve
            }

            if (!this.ready) {
                reject('This bot is not ready');
            } else {
                // The first param (owner) depends on the type of inspect link
                let ms = params.s === BigInt(0) ? params.m : params.s;
                this.csgoClient.inspectItem(ms.toString(), params.a.toString(), params.d.toString());
            }

            // Set a timeout in case the GC takes too long to respond
            this.ttlTimeout = setTimeout(() => {
                // GC didn't respond in time, reset and reject
                this.busy = false;
                this.inspectRequest = undefined;
                reject('ttl exceeded');
            }, this.settings.requestTTL);
        });
    }
}
