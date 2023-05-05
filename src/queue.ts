import {Job} from "./job";
import {EventEmitter} from "events"
import {BotController} from "./bot/bot-controller";
import {ApiError, NoBotsAvailable} from "./errors";

type QueueJob = {
    data: Job
    attempts: number
    maxAttempts: number
}

export type QueueHandler = (job: Job, attempt: number) => Promise<number>

export class Queue extends EventEmitter {
    private jobs: Array<QueueJob> = []
    private running: boolean = false

    private workers: number
    private controller: BotController
    private handler: QueueHandler

    private processing: number = 0


    constructor(workers: number, controller: BotController, handler: QueueHandler) {
        super();
        this.workers = workers;
        this.controller = controller;
        this.handler = handler;
    }

    getWorkers() {
        return this.workers
    }

    size() {
        return this.jobs.length
    }

    addJob(job: Job, maxAttempts: number) {
        this.jobs.push({
            data: job,
            attempts: 0,
            maxAttempts,
        });
        this.checkQueue();
    }

    start() {
        if (this.running) {
            return
        }
        this.running = true;
        this.checkQueue();

        // Monkey patch to ensure queue processing size is roughly equal to amount of bots ready
        setInterval(() => {
            // Update concurrency level, possible bots went offline or otherwise
            const oldConcurrency = this.workers;
            this.workers = this.controller.getReadyAmount();

            if (this.workers > oldConcurrency) {
                for (let i = 0; i < this.workers - oldConcurrency; i++) {
                    this.checkQueue();
                }
            }

        }, 50);
    }

    private checkQueue() {
        if (!this.running || this.jobs.length < 1 || this.processing >= this.workers) {
            return;
        }
        const job = this.jobs.shift();
        if (!job || job.data.done) {
            return;
        }

        this.processing += 1;
        this.handler(job.data, job.attempts).then((delay) => {
            return new Promise((resolve, _reject) => {
                setTimeout(() => {
                    resolve(undefined);
                }, delay);
            });
        }).catch((err: ApiError) => {
            if (err !== NoBotsAvailable) {
                job.attempts++;
            }

            if (job.attempts === job.maxAttempts) {
                // job failed
                this.emit('failed', job.data, err);
            } else {
                // try again
                this.jobs.unshift(job);
            }
        }).finally(() => {
            this.processing -= 1;
            this.checkQueue();
        });
    }

    pause() {
        if (this.running) {
            this.running = false;
        }
    }
}