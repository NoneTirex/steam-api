import {Response} from "express";

export class ApiError {
    message: string
    code: number
    statusCode: number

    constructor(message: string, code: number, statusCode: number) {
        this.message = message;
        this.code = code;
        this.statusCode = statusCode; // HTTP Status Code
    }

    handle(response: Response) {
        response.status(this.statusCode).json({
            error: this.message,
            code: this.code
        })
    }

    toString() {
        return `[Code ${this.code}] - ${this.message}`;
    }
}

export const BadParams = new ApiError('Improper Parameter Structure', 1, 400)

export const InvalidInspect = new ApiError('Invalid Inspect Link Structure', 2, 400)

export const MaxRequests = new ApiError('You have too many pending requests', 3, 400)

export const TTLExceeded = new ApiError('Valve\'s servers didn\'t reply in time', 4, 500)

export const SteamOffline = new ApiError('Valve\'s servers appear to be offline, please try again later', 5, 503)

export const GenericBad = new ApiError('Something went wrong on our end, please try again', 6, 500)

export const BadBody = new ApiError('Improper body format', 7, 400)

export const BadSecret = new ApiError('Bad Secret', 8, 400)

export const NoBotsAvailable = new ApiError('No bots available to fulfill this request', 9, 500)

export const RateLimit = new ApiError('Rate limit exceeded, too many requests', 10, 429)

export const MaxQueueSize = new ApiError('Queue size is full, please try again later', 11, 500)
export const DatabaseError = new ApiError('Database error', 12, 500)
