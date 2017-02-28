import {AmazonSqsBroker} from "./amazonSqs/AmazonSqsBroker";
import {TvsterMessage} from "./TvsterMessage";
import {MessageType} from "./MessageType";
import {TvsterBroker} from "./TvsterBroker";

let broker = new AmazonSqsBroker();

const func = (broker: TvsterBroker) => {
    broker.receive();
}

let tvsterMessage = new TvsterMessage();
tvsterMessage.messageType = MessageType.CANCEL_DOWNLOAD;
tvsterMessage.messageContents = JSON.stringify({ id: "XXXXX", status: "COMPLETED", type: MessageType[tvsterMessage.messageType]});
broker.send(tvsterMessage);
func(broker);
