import {Response} from "express";
import {ApiError} from "./errors"
import {InspectUrl} from "./inspect/inspect-url";
import {CsgoItem} from "./item/item";

export class Job {
    response: Response;
    url: InspectUrl

    done: boolean = false

    constructor(response: Response, url: InspectUrl) {
        this.response = response
        this.url = url
    }

    setResult(result: CsgoItem) {
        if (this.done) {
            return
        }
        this.done = true
        this.response.json(result)
    }

    setError(error: ApiError) {
        if (this.done) {
            return
        }
        this.done = true
        error.handle(this.response)
    }
}
