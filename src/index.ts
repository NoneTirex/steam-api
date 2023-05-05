import {NextFunction, Request, Response} from "express";

import {InspectUrl} from './inspect/inspect-url';
import {Job} from "./job"
import Express from "express";
import {ApiError, DatabaseError} from "./errors";
import {Queue} from "./queue";
import {BotController} from "./bot/bot-controller";
import {itemInfoToCsgoItem} from "./item/item";
import {BotSettings} from "./bot/bot";
import {Pool} from "pg";
import {ItemRepository} from "./item/item-repository"

const bodyParser = require("body-parser");

// @ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString()
}

const optionDefinitions = [
    {name: 'config', alias: 'c', type: String, defaultValue: '../config'}, // Config file location
    {name: 'steam_data', alias: 's', type: String} // Steam data directory
];

const winston = require('winston'),
    args = require('command-line-args')(optionDefinitions),
    botController = new BotController(),
    CONFIG = require(args.config),
    errors = require('./errors');

winston.level = CONFIG.logLevel || 'debug';

if (CONFIG.logins.length === 0) {
    console.log('There are no bot logins. Please add some in config.json');
    process.exit(1);
}

if (args.steam_data) {
    CONFIG.botSettings.steam_user.dataDirectory = args.steam_data;
}

for (let [i, loginData] of CONFIG.logins.entries()) {
    const settings: BotSettings = {
        maxAttempts: CONFIG.botSettings.maxAttempts,
        requestDelay: CONFIG.botSettings.requestDelay,
        requestTTL: CONFIG.botSettings.requestTTL
    }

    if (CONFIG.proxies && CONFIG.proxies.length > 0) {
        const proxy = CONFIG.proxies[i % CONFIG.proxies.length];

        if (proxy.startsWith('http://')) {
            settings.steamUser = {
                httpProxy: proxy
            }
        } else if (proxy.startsWith('socks5://')) {
            settings.steamUser = {
                socksProxy: proxy
            }
        } else {
            console.log(`Invalid proxy '${proxy}' in config, must prefix with http:// or socks5://`);
            process.exit(1);
        }
    }

    botController.addBot(loginData, settings);
}

const pool = new Pool({
    connectionString: CONFIG.databaseUrl
})

pool.connect().then(() => {
    console.log("connected to database")
}).catch(error => {
    console.error("problem while connect to database: " + error)
    process.exit(1)
});

const itemRepository = new ItemRepository(pool)

// Setup and configure express
const app = Express();
app.use(function (req: ApiRequest, res, next) {
    if (req.method === 'POST') {
        // Default content-type
        req.headers['content-type'] = 'application/json';
    }
    next();
});
app.use(bodyParser.json({limit: '5mb'}));

app.use(function (error: any, req: ApiRequest, res: Response, next: NextFunction) {
    // Handle bodyParser errors
    if (error instanceof SyntaxError) {
        errors.BadBody.handle(res);
    } else {
        next();
    }
});


if (CONFIG.trustProxy) {
    app.enable('trust proxy');
}

async function handleJob(job: Job) {
    // See which items have already been cached
    const item = await itemRepository.findByAssetId(job.url.assetId)
    if (item) {
        job.setResult(item)
        return;
    }

    if (!botController.hasBotOnline()) {
        return job.setError(errors.SteamOffline);
    }

    if (CONFIG.maxQueueSize > 0 && queue.size() + 1 > CONFIG.maxQueueSize) {
        return job.setError(errors.MaxQueueSize);
    }

    queue.addJob(job, CONFIG.botSettings.maxAttempts);
}

interface RequestQuery {
    url?: string
    s?: bigint
    a?: bigint
    d?: bigint
    m?: bigint
}

type ApiRequest = Request<any, any, any, RequestQuery>

app.get("/inspect", function (request: ApiRequest, response: Response) {
    const query = request.query

    let link;
    if (query.url) {
        link = InspectUrl.parseUrl(query.url)
    } else if (query.a && query.d && (query.s || query.m)) {
        link = InspectUrl.parametersToInspectUrl(query.a, query.d, query.s, query.m)
    }

    if (!link) {
        return errors.InvalidInspect.handle(response);
    }

    const job = new Job(response, link);

    try {
        statistics.requests++
        handleJob(job).catch(data => {
            statistics.errors++
            return Promise.reject(data);
        })
    } catch (e) {
        winston.warn(e);
        errors.GenericBad.handle(response);
    }
});

const statistics = {
    requests: 0,
    errors: 0
}
app.get("/", (request: Request, response: Response) => {
    response.json({
        status: 'OK',
        botsOnline: botController.getReadyAmount(),
        botsTotal: botController.getBotsCount(),
        queueSize: queue.size(),
        queueWorkers: queue.getWorkers(),
        statistics: statistics,
        bots: botController.getStatistics(),
    });
});

const httpServer = require('http').Server(app);
httpServer.listen(CONFIG.http.port);
winston.info('Listening for HTTP on port: ' + CONFIG.http.port);

const queue = new Queue(CONFIG.logins.length, botController, async (job: Job, attempt: number): Promise<number> => {
    const link = job.url;
    const result = await botController.lookupFloat(link, attempt);
    winston.debug(`Received itemData for ${link.assetId}`);

    const item = itemInfoToCsgoItem(link, result.itemInfo)

    await itemRepository.save(item).catch(error => {
        job.setError(DatabaseError)
        winston.warn(`Failed to save inspect url ${link}: ${error}`)
    })

    job.setResult(item)

    return result.delay;
});
queue.start()

queue.on('failed', (job: Job, err?: ApiError) => {
    winston.warn(`Failed to inspect url ${job.url}: ${err || ''}`);

    statistics.errors++
    job.setError(errors.TTLExceeded);
});
