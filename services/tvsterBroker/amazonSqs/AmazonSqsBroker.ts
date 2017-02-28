/**
 * Created by david on 27/02/2017.
 */

import {TvsterBroker} from "../TvsterBroker";
import {TvsterMessage} from "../TvsterMessage";
import * as debug from "debug";

class AmazonSqsBroker implements TvsterBroker {
    private logger = debug("This class");

    send(message: TvsterMessage) {
        this.logger("Send message using Amazon SQS", message);
    }

    receive(): TvsterMessage {
        this.logger("Receive message using Amazon SQS");
        return undefined;
    }
}

export {AmazonSqsBroker}