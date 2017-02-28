/**
 * Created by david on 27/02/2017.
 */
import {TvsterMessage} from "./TvsterMessage";
export interface TvsterBroker {
    send(message: TvsterMessage);
    receive() : TvsterMessage;
}