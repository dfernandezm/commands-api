import {TvsterCommunication} from "./TvsterCommunication";
import {TvsterMessage} from "./TvsterMessage";
import {MessageType} from "./MessageType";
import {AmazonSqsBroker} from "./amazonSqs/AmazonSqsBroker";
/**
 * Created by david on 02/03/2017.
 */

export class TvsterBrokerCommunication implements  TvsterCommunication {
    private broker = new AmazonSqsBroker();

    getStatus() {

    }

    startDownload(link: string) {
        let messageContent = { id: "XXXX", description: "Start download", link: link };
        let message = new TvsterMessage(MessageType.START_DOWNLOAD, JSON.stringify(messageContent));
        this.broker.send(message);
    }

    cancelDownload(hash: string) {
    }

    pauseDownload(hash: string) {
    }

    resumeDownload(hash: string) {
    }

    rename(paths: string[]) {
    }

    fetchSubtitles(paths: string[]) {
    }

    publishStatus(status: string) {

    }

    communicateOperationStatus(operationType: MessageType, status: string) {

    }

    // https://github.com/Automattic/kue#creating-jobs
}