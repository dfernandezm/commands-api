/**
 * Created by david on 27/02/2017.
 */
import {MessageType} from "./MessageType";
export class TvsterMessage {
    messageType: MessageType;
    messageContents: string;

    constructor(type: MessageType, messageContents: string) {
        this.messageType = type;
        this.messageContents = messageContents;
    }
}