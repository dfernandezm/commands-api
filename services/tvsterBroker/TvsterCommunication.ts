/**
 * Created by david on 02/03/2017.
 */
export interface TvsterCommunication {
    getStatus()
    startDownload(link: string)
    cancelDownload(hash: string)
    pauseDownload(hash: string)
    resumeDownload(hash: string)
    rename(paths: string[])
    fetchSubtitles(paths: string[])
}