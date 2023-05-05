import {Bot, BotLoginData, BotSettings, InspectResult} from "./bot"
import {shuffleArray} from "../utils"
import {EventEmitter} from "events";
import {NoBotsAvailable} from "../errors";
import {InspectUrl} from "../inspect/inspect-url";

export type BotStatistics = {
    requests: 0
    errors: 0
    initialErrors: 0
}

type BotEntry = {
    bot: Bot
    statistics: BotStatistics
}

export class BotController extends EventEmitter {
    private readyEvent: boolean = false
    private bots: Array<BotEntry> = []

    constructor() {
        super();
    }

    addBot(loginData: BotLoginData, settings: BotSettings) {
        let bot = new Bot(loginData, settings);
        bot.logIn();

        bot.on('ready', () => {
            if (!this.readyEvent && this.hasBotOnline()) {
                this.readyEvent = true;
                this.emit('ready');
            }
        });

        bot.on('unready', () => {
            if (this.readyEvent && !this.hasBotOnline()) {
                this.readyEvent = false;
                this.emit('unready');
            }
        });

        this.bots.push({
            bot,
            statistics: {
                requests: 0,
                errors: 0,
                initialErrors: 0,
            }
        });
    }

    getFreeBot(): BotEntry | undefined {
        // Shuffle array to evenly distribute requests
        for (const entry of shuffleArray(this.bots)) {
            if (!entry.bot.busy && entry.bot.ready) {
                return entry;
            }
        }

        return undefined;
    }

    hasBotOnline(): boolean {
        for (const {bot} of this.bots) {
            if (bot.ready) {
                return true;
            }
        }

        return false;
    }

    getReadyAmount() {
        let amount = 0;
        for (const {bot} of this.bots) {
            if (bot.ready) {
                amount++;
            }
        }
        return amount;
    }

    getBotsCount() {
        return this.bots.length
    }

    getStatistics(): Array<BotStatistics> {
        return this.bots.map(entry => entry.statistics)
    }

    lookupFloat(data: InspectUrl, attempt: number): Promise<InspectResult> {
        let entry = this.getFreeBot();

        if (!entry) {
            return Promise.reject(NoBotsAvailable);
        }

        return entry.bot.sendFloatRequest(data).then(data => {
            if (attempt > 0) {
                entry!.statistics.initialErrors++
            }
            return Promise.resolve(data)
        }).catch(data => {
            entry!.statistics.errors++
            return Promise.reject(data)
        }).finally(() => {
            entry!.statistics.requests++
        });
    }
}