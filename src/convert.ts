import * as child from 'child_process'
import { existsSync, mkdirSync, readdirSync, renameSync } from 'fs'
import { stdout } from 'process'

let logger: Log = null
/**
 * Because we are using hardware specific encoders,
 * we will need to get whether the user wants to use these encoders.
 *
 * We will also need to get the user's hardware details.
 */

async function main() {

    logger = new Log()

    const container = new Container()

    await container.userCapabilities.findHardwareDetails()

    container.userArguments.parse(container)
    container.appEncodingDecision.validateInput()

    await container.scanWorkingDir()

    new Ticker(container).startProcess()

    console.log(container)

}

/**
 * This class runs the base of the application. The current running conversion count is checked against
 * the user's desired amount of conversions. If the current amount is less than the desired amount, a
 * new conversion is started.
 */
class Ticker {

    /** Instance of Container */
    container: Container
    /** Instance of Display */
    display: Display

    /**
     * 
     * @param container The container object that contains all of the information about the current and pending conversions.
     */
    constructor(container: Container) {

        this.container = container
        this.display = new Display(container)

    }

    /**
     * This function starts the processing of the files.
     */
    startProcess() {

        //NOTE: An item gets added every second instead of all at once due to the logic being contained in an interval.
        //CONT: We could move this to a recursive function that is called every second, but that's no fun.
        setInterval(() => {

            let current_amount = Object.keys(this.container.converting).length

            if (current_amount < this.container.appEncodingDecision.amount) {

                let media = this.container.pending[0]

                if (!media || media.activity != Process.WAITING) {

                    if (current_amount === 0) {

                        logger.flushBuffer()
                        process.exit(0)

                    }

                }
                else {

                    media.activity = Process.WAITING_STATISTICS
                    media.started = Date.now()

                    this.container.converting[media.name] = this.container.pending.shift()

                }

            }

            if (current_amount > this.container.appEncodingDecision.amount) {

                logger.send(LogColor.fgRed, 'CURRENT TRANSCODES ARE GREATER THAN THE ALLOWED AMOUNT.')
                logger.send(LogColor.fgRed, 'CURRENT ALLOWED AMOUNT: ' + this.container.appEncodingDecision.amount)
                logger.send(LogColor.fgRed, 'CURRENT QUEUE:')
                Object.keys(this.container.converting).forEach(media => console.error('CURRENT FILE: ' + this.container.converting[media].file.name_modified))
                process.exit(1)

            }

            Object.keys(this.container.converting).forEach(file => {

                let media = this.container.converting[file]

                // If the file is not being processed, spawn an instance for it.
                if (!media.isProcessing()) {

                    if (media.activity === Process.WAITING_STATISTICS) media.doStatistics(this.container)
                    //if (media.activity.includes('Extracting')) spawnExtractionInstance(media)
                    if (media.activity === Process.WAITING_CONVERT) media.doConvert()
                    if (media.activity === Process.WAITING_VALIDATE) media.doValidate()

                }

                // If the file has finished processing, add it to the completed queue.
                if (media.activity === Process.FINISHED ||
                    media.activity === Process.FAILED ||
                    media.activity === Process.FAILED_CODEC ||
                    media.activity === Process.FAILED_HARDWARE ||
                    media.activity === Process.FAILED_PERMISSIONS ||
                    media.activity === Process.FAILED_SYSTEM) {

                    media.ended = Date.now()

                    this.container.pending.push(structuredClone(media))

                    delete this.container.converting[media.name]

                }

            })

            if (this.container.debug.toggle) this.display.printDebug()
            else this.display.print()

            //console.log(this.container.converting)
            //console.log(this.container.pending)

        }, 1000)

    }

}

/**
 * This class handles the logging of messages to the console pertaining to the current
 * and pending conversions.
 */
class Display {

    /** Instance of Container */
    container: Container

    /**
     * @param container The container object that contains all of the information about the current and pending conversions.
     */
    constructor(container: Container) {

        this.container = container

    }

    /**
     * Print the current and pending conversions to the console.
     */
    print() {

        let buffer_len = Object.keys(this.container.converting).length + this.container.pending.length + 1

        let ob = LogColor.fgGray('[')
        let cb = LogColor.fgGray(']')
        let t = `${ob + LogColor.fgBlue('TIME') + cb} ${LogColor.fgGray(time(null, null))} `
        let encoder = `${ob + LogColor.fgBlue('TARGET ENC') + cb} ${LogColor.fgGray(this.container.appEncodingDecision.wantedEncoder.toUpperCase())} `
        let running_encoder = `${ob + LogColor.fgBlue('ENC') + cb} ${LogColor.fgGray(this.container.appEncodingDecision.runningEncoder.toUpperCase())} `
        let running_decoder = `${ob + LogColor.fgBlue('DEC') + cb} ${LogColor.fgGray(this.container.appEncodingDecision.runningDecoder.toUpperCase())} `
        let quality = `${ob + LogColor.fgBlue('RES') + cb} ${LogColor.fgGray(this.container.appEncodingDecision.quality.toUpperCase())} `
        let tune = this.container.appEncodingDecision.tune ? `${ob + LogColor.fgBlue('TUNE') + cb} ${LogColor.fgGray(this.container.appEncodingDecision.tune.toUpperCase())} ` : ''
        let amount = `${ob + LogColor.fgBlue('AMOUNT') + cb} ${LogColor.fgGray(this.container.appEncodingDecision.amount.toString())} `
        let constrain = this.container.appEncodingDecision.useConstrain ? ob + LogColor.fgRed('CONSTRAIN') + cb + ' ' : ''
        let debug = this.container.debug.toggle ? ob + LogColor.fgRed('DEBUG') + cb + ' ' : ''
        let crop = this.container.appEncodingDecision.crop ? ob + LogColor.fgRed('CROP') + cb + ' ' : ''

        let line = `${t}${amount}${encoder}${running_encoder}${running_decoder}${tune}${quality}${crop}${constrain}${debug}\n`

        console.clear()
        logger.sendBuffer(LogColor.none, buffer_len, line)

        Object.keys(this.container.converting).forEach(file => {

            let media = this.container.converting[file]

            let file_name = `${ob + LogColor.fgBlue('FILE') + cb} ${LogColor.fgGray(truncateString(media.file.name_modified))}`

            let total_frames = media.video.total_frames

            let completed_frames = media.working.completed_frames
            let media_fps = media.working.fps
            let bitrate = `${ob + LogColor.fgBlue('BIT') + cb} ${LogColor.fgGray(media.working.bitrate.toString())}`
            let cq = `${ob + LogColor.fgBlue('QUAL') + cb} ${LogColor.fgGray(Math.trunc((media.video.crf / media.working.quality) * 100).toString())}%`
            let speed = `${ob + LogColor.fgBlue('SPEED') + cb} ${LogColor.fgGray((Math.trunc((media_fps / media.video.fps) * 100) / 100).toString())}`
            let eta = `${ob + LogColor.fgBlue('ETA') + cb} ${LogColor.fgGray(time(Math.ceil((total_frames - completed_frames) / media_fps), true))}`

            let activity = `${ob + LogColor.fgBlue('ACT') + cb} ${LogColor.fgGray(media.activity)}`
            let started = `${ob + LogColor.fgBlue('START') + cb} ${LogColor.fgGray(time(media.started, null))}`

            let percent = `${ob + LogColor.fgBlue('PROG') + cb} ${LogColor.fgGray(Math.ceil((completed_frames / total_frames) * 100) + '%')}`

            let message = `${file_name} ${activity} ${started} ${percent} ${cq} ${bitrate} ${speed} ${eta} `

            logger.sendBuffer(LogColor.none, buffer_len, message)

        })

        this.container.pending.forEach(media => {

            let file_name = `${ob + LogColor.fgBlue('FILE') + cb} ${LogColor.fgGray(truncateString(media.file.name_modified))}`
            let activity = `${ob + LogColor.fgBlue('STATUS') + cb} ${LogColor.fgGray(media.activity)}`

            if (media.activity === Process.WAITING) {

                return logger.sendBuffer(LogColor.none, buffer_len, `${file_name} ${activity}`)

            }
            else {

                let calculated = Math.floor(((media.file.size - media.file.new_size) / media.file.size) * 100)

                let ended = `${ob + LogColor.fgBlue('COMPLETION') + cb} ${LogColor.fgGray(time(media.ended, false))}`
                let elapsed = `${ob + LogColor.fgBlue('ELAPSED') + cb} ${LogColor.fgGray(time(media.ended - media.started, true))}`
                let reduced = `${ob + LogColor.fgBlue('REDUCED') + cb} ${media.file.new_size ? LogColor.fgGray(calculated + '%') : '???'}`

                let message = `${file_name} ${activity} ${reduced} ${ended} ${elapsed}`

                logger.sendBuffer(LogColor.none, buffer_len, message)

            }

        })

    }

    /**
     * Print the current and pending conversions to the console in debug format.
     */
    printDebug() { }

}

/**
 * This class contains the bulk of information for the current and pending conversions
 * as well as user and application decisions.
 */
class Container {

    /** Instance of Debug */
    debug: Debug

    /** Instance of ApplicationEncodingDecision */
    appEncodingDecision: ApplicationEncodingDecision
    /** Instance of Settings */
    settings: Settings

    /** List of supported formats */
    formats: { [key: string]: MediaFormat } = {
        '2160p': new MediaFormat(
            '2160p',
            24,
            30,
            30,
            40,
            3840,
            2160,
            '3840:1600',
            '3840:2160'
        ),
        '1440p': new MediaFormat(
            '1440p',
            24,
            20,
            20,
            27,
            2560,
            1440,
            '2560:1068',
            '2560:1440'
        ),
        '1080p': new MediaFormat(
            '1080p',
            24,
            2.0,
            1.6,
            2.2,
            1920,
            1080,
            '1920:800',
            '1920:1080'
        ),
        '1080pm': new MediaFormat(
            '1080pm',
            24,
            2.0,
            1.6,
            2.2,
            1920,
            1080,
            '1920:878',
            '1920:1080'
        ),
        '1080pn': new MediaFormat(
            '1080pn',
            24,
            2.0,
            1.6,
            2.2,
            1920,
            1080,
            '1920:960',
            '1920:1080'
        ),
        '720p': new MediaFormat(
            '720p',
            24,
            1.4,
            1.2,
            1.8,
            1280,
            720,
            '1280:534',
            '1280:720'
        ),
        '720pm': new MediaFormat(
            '720pm',
            24,
            1.4,
            1.2,
            1.8,
            1280,
            720,
            '1280:580',
            '1280:720'
        ),
        '720pn': new MediaFormat(
            '720pn',
            24,
            1.4,
            1.2,
            1.8,
            1280,
            720,
            '1280:640',
            '1280:720'
        ),
        '480p': new MediaFormat(
            '480p',
            24,
            0.6,
            0.4,
            0.8,
            854,
            480,
            '854:356',
            '854:480'
        ),
        '480pc': new MediaFormat(
            '480pc',
            24,
            0.6,
            0.4,
            0.8,
            1138,
            640,
            '854:640',
            '1138:640'
        )
    }

    /** Instance of UserCapabilities */
    userCapabilities: UserCapabilities

    /** List of files currently being processed */
    converting: { [key: string]: Media } = {}
    /** List of files pending processing */
    pending: Media[] = []

    /** Instance of UserArguments */
    userArguments: UserArguments

    constructor() {

        this.debug = new Debug()

        this.appEncodingDecision = new ApplicationEncodingDecision()
        this.settings = new Settings()

        this.userCapabilities = new UserCapabilities()

        this.userArguments = new UserArguments()

    }

    /**
     * This function adds a custom format to the formats object.
     * @param height The height of the custom format.
     */
    addCustomFormat(height: number) {

        const customFormat = new MediaFormat(`${height}p`, null, null, null, null, null, null, null, null)

        customFormat.crf = 24
        customFormat.height = height % 2 ? height++ : height
        customFormat.width = Math.ceil(customFormat.height * 1.777777777777778)

        if (customFormat.width % 2) customFormat.width++

        let cropHeight = Math.ceil(customFormat.width / 2.4)

        if (cropHeight % 2) cropHeight++

        customFormat.crop = `${customFormat.width}:${cropHeight}`
        customFormat.scale = `${customFormat.width}:${customFormat.height}`

        this.formats[`${height}p`] = customFormat

    }

    /**
     * This function scans the working directory for media files and adds them to the pending queue.
     */
    scanWorkingDir() {

        return new Promise((resolve, reject) => {
            readdirSync(this.settings.workingDir).forEach((file) => {

                if (file.endsWith('.mkv')) {

                    if (this.debug.toggle) logger.send(LogColor.fgRed, 'Found file: ', file)

                    let media = new Media(file, this.settings.workingDir)

                    media.rename(this)

                    this.pending.push(media)

                }

            })

            setTimeout(() => {
                resolve(null)
            }, 1000)

        })
    }

}

/**
 * This class contains internal settings for the application.
 */
class Settings {

    /** Current working directory */
    workingDir = process.cwd()
    /** Directory to store temporary files */
    validateDir: string

    /** List of supported encoders */
    supportedEncoders: [
        Encoders.AV1,
        Encoders.AV1_AMF,
        Encoders.AV1_NVENC,
        Encoders.AV1_QSV,
        Encoders.H264,
        Encoders.H264_AMF,
        Encoders.H264_NVENC,
        Encoders.H264_QSV,
        Encoders.HEVC,
        Encoders.HEVC_AMF,
        Encoders.HEVC_NVENC,
        Encoders.HEVC_QSV
    ]

    /** List of supported hardware accelerators */
    supportedHWAccel: [
        HWAccel.AMD,
        HWAccel.NVIDIA,
        HWAccel.INTEL
    ]

    /** List containing tune patterns */
    tuneRegex = [
        new RegExp('film', 'i'),
        new RegExp('anim*', 'i'),
        new RegExp('grain', 'i'),
    ]

    /** List containing tune associations */
    tuneAssociations = [
        'film',
        'animation',
        'grain',
    ]

    /**
     * 
     * @param validateDirectory The directory to store temporary files.
     */
    constructor(validateDirectory: string = '/dev/shm/') {

        this.validateDir = validateDirectory

    }

}

/**
 * This class contains various debug flags for the application.
 */
class Debug {

    /** Toggle general debugging */
    toggle: boolean

    constructor() {
        this.toggle = false
    }

}

/**
 * This class contains application settings and handles the
 * verification of the user's desired settings.
 */
class ApplicationEncodingDecision {

    /** The user's desired encoder */
    wantedEncoder: string = Encoders.HEVC
    /** The current encoder being used */
    runningEncoder: string = Encoders.HEVC
    /** The current decoder being used */
    runningDecoder: string = HWAccel.NVIDIA
    /** Defined MediaFormat quality */
    quality: string = '720p'
    /** Codec tune setting */
    tune: string = ''
    /** Amount of concurrent conversions */
    amount: number = 1
    /** CRF override */
    crfOverride: number = 0
    /** Crop the video */
    crop: boolean = false
    /** Start the video from this time */
    startBeginning: string = ''
    /** Trim the video to this time */
    trim: string = ''
    /** Use bitrate instead of CRF */
    useBitrate: boolean = false
    /** Use strict bitrate values instead of variable */
    useConstrain: boolean = false
    /** Validate the video after conversion */
    validate: boolean = true
    /** Use hardware decode */
    useHardwareDecode: boolean = true
    /** Use hardware encode */
    useHardwareEncode: boolean = false

    constructor() { }

    /**
     * This function validates the user's input and sets default values if necessary.
     */
    validateInput() {

        if (this.tune === 'film' && this.wantedEncoder.includes('hevc')) {

            this.tune = ''

        }

    }
}

/**
 * This class handles the operation of obtaining the hardware details of the user's system.
 */
class UserCapabilities {

    /** User's Platform */
    platform = process.platform

    /** List of supported encoders */
    supportedEncoders: string[] = []
    /** List of supported decoders */
    supportedDecoders: string[] = []
    /** ??? */
    supportedFormats: string[] = []

    /** User's GPU provider */
    GPUProvider: 'intel' | 'nvidia' | 'amd' | 'unknown'

    constructor() { }

    /**
     * This function obtains the hardware details of the user's system.
     */
    async findHardwareDetails() {

        return new Promise((resolve, reject) => {

            if (this.platform === 'win32') {

                const hwinfo = child.exec('wmic path win32_VideoController get name', (err, stdout, stderr) => {

                    if (err) throw err
                    if (stderr) throw stderr

                    stdout.split('\n').forEach((line) => {

                        if (/AMD/.test(line)) {

                            if (!this.GPUProvider) this.GPUProvider = 'amd'

                            this.supportedEncoders.push(Encoders.AV1_AMF)
                            this.supportedEncoders.push(Encoders.H264_AMF)
                            this.supportedEncoders.push(Encoders.HEVC_AMF)
                        }
                        else if (/NVIDIA/.test(line)) {

                            this.GPUProvider = 'nvidia'

                            this.supportedEncoders.push(Encoders.AV1_NVENC)
                            this.supportedEncoders.push(Encoders.H264_NVENC)
                            this.supportedEncoders.push(Encoders.HEVC_NVENC)

                            this.supportedDecoders.push(Decoders.AV1_CUVID)
                            this.supportedDecoders.push(Decoders.H264_CUVID)
                            this.supportedDecoders.push(Decoders.HEVC_CUVID)
                        }
                        else if (/Intel/.test(line)) {

                            this.GPUProvider = 'intel'

                            this.supportedEncoders.push(Encoders.AV1_QSV)
                            this.supportedEncoders.push(Encoders.H264_QSV)
                            this.supportedEncoders.push(Encoders.HEVC_QSV)

                            this.supportedDecoders.push(Decoders.AV1_QSV)
                            this.supportedDecoders.push(Decoders.H264_QSV)
                            this.supportedDecoders.push(Decoders.HEVC_QSV)
                        }
                        else {

                            if (!this.GPUProvider) { this.GPUProvider = 'unknown' }

                        }

                    })

                })

                this.supportedEncoders.push(Encoders.AV1)
                this.supportedEncoders.push(Encoders.H264)
                this.supportedEncoders.push(Encoders.HEVC)

                setTimeout(() => {
                    resolve(null)
                }, 1000)

            }

            else if (this.platform === 'linux') {

                const hwinfo = child.exec('lspci | grep VGA', (err, stdout, stderr) => {

                    if (err) throw err
                    if (stderr) throw stderr

                    stdout.split('\n').forEach((line) => {

                        if (/AMD/.test(line)) {

                            if (!this.GPUProvider) this.GPUProvider = 'amd'

                            this.supportedEncoders.push(Encoders.AV1_AMF)
                            this.supportedEncoders.push(Encoders.H264_AMF)
                            this.supportedEncoders.push(Encoders.HEVC_AMF)
                        }
                        else if (/NVIDIA/.test(line)) {

                            this.GPUProvider = 'nvidia'

                            this.supportedEncoders.push(Encoders.AV1_NVENC)
                            this.supportedEncoders.push(Encoders.H264_NVENC)
                            this.supportedEncoders.push(Encoders.HEVC_NVENC)

                            this.supportedDecoders.push(Decoders.AV1_CUVID)
                            this.supportedDecoders.push(Decoders.H264_CUVID)
                            this.supportedDecoders.push(Decoders.HEVC_CUVID)
                        }
                        else if (/Intel/.test(line)) {

                            this.GPUProvider = 'intel'

                            this.supportedEncoders.push(Encoders.AV1_QSV)
                            this.supportedEncoders.push(Encoders.H264_QSV)
                            this.supportedEncoders.push(Encoders.HEVC_QSV)

                            this.supportedDecoders.push(Decoders.AV1_QSV)
                            this.supportedDecoders.push(Decoders.H264_QSV)
                            this.supportedDecoders.push(Decoders.HEVC_QSV)
                        }
                        else {

                            if (!this.GPUProvider) { this.GPUProvider = 'unknown' }

                        }

                    })

                })

                setTimeout(() => {

                    this.supportedEncoders.push(Encoders.AV1)
                    this.supportedEncoders.push(Encoders.H264)
                    this.supportedEncoders.push(Encoders.HEVC)

                    resolve(null)

                }, 1000)

            }

            else reject(new Error('Unsupported platform'))

        })

    }

}

/**
 * This class handles parsing of user arguments.
 */
class UserArguments {

    /**
     * Parse the user's arguments and set the appropriate values.
     * @param container The container object that contains all of the information about the current and pending conversions.
     */
    parse(container: Container) {

        process.argv.forEach((argument, index) => {

            if (argument.startsWith('-')) {

                switch (argument) {

                    case '-h':
                    case '--help':
                        help()
                        process.exit(0)

                    case '-d':
                    case '--debug':
                        container.debug.toggle = true
                        break

                    case '-e':
                    case '--encoder':

                        if (container.userCapabilities.supportedEncoders.includes(process.argv[index + 1])) {
                            container.appEncodingDecision.wantedEncoder = process.argv[index + 1]
                        }
                        else {
                            this.invalid(argument)
                            process.exit(1)
                        }
                        break

                    case '-q':
                    case '--quality':

                        if (container.formats[process.argv[index + 1]]) {

                            container.appEncodingDecision.quality = process.argv[index + 1]
                            break

                        }

                        else {

                            container.addCustomFormat(parseInt(process.argv[index + 1].replace('p', '')))

                        }

                    case '-t':
                    case '--tune':

                        for (let i = 0; i < container.settings.tuneRegex.length; i++) {

                            if (container.settings.tuneRegex[i].test(process.argv[index + 1])) {

                                container.appEncodingDecision.tune = container.settings.tuneAssociations[i]
                                break

                            }

                        }

                        if (!container.appEncodingDecision.tune) container.appEncodingDecision.tune = container.settings.tuneAssociations[0]
                        break

                    case '-a':
                    case '--amount':
                        container.appEncodingDecision.amount = parseInt(process.argv[index + 1])
                        break

                    case '-c':
                    case '--crop':
                        container.appEncodingDecision.crop = true
                        break

                    case '-s':
                    case '--start':
                        container.appEncodingDecision.startBeginning = process.argv[index + 1]
                        break

                    case '-r':
                    case '--trim':
                        container.appEncodingDecision.trim = process.argv[index + 1]
                        break

                    case '-b':
                    case '--bitrate':
                        container.appEncodingDecision.useBitrate = true
                        break

                    case '-C':
                    case '--constrain':
                        container.appEncodingDecision.useConstrain = true
                        break

                    case '-V':
                    case '--validate':
                        container.appEncodingDecision.validate = true
                        break

                    case '-crf':
                    case '--crf':
                        container.appEncodingDecision.crfOverride = parseInt(process.argv[index + 1])
                        break

                    case '-hwe':
                    case '--hardwareEncode':
                        container.appEncodingDecision.useHardwareEncode = true
                        break

                    case '-hwd':
                    case '--hardwareDecode':
                        container.appEncodingDecision.useHardwareDecode = true
                        break

                    default:
                        this.invalid(argument)
                        break

                }

            }

        })

    }

    /**
     * Send an invalid argument message to the console.
     * @param argument The argument that was invalid.
     */
    invalid(argument: string): void {

        logger.send(LogColor.fgRed, 'Invalid argument: ', argument)

    }

}

/**
 * The Media class contains properties and methods for handling media files, including renaming and
 *  setting file information. 
 */
class Media {

    /** Filename */
    name: string = ''
    /** Current file activity */
    activity: Process = Process.WAITING
    /** File path */
    path: string = ''

    /** Epoch since start */
    started: number = 0
    /** Epoch since end */
    ended: number = 0

    /** FFMPEG arguments */
    ffmpeg_argument: string[] = []

    /** File information */
    file: MediaFile
    /** Video information */
    video: MediaVideoProperties
    /** Conversion information */
    working: MediaWorkingProperties

    /**
     * This is a constructor function that initializes various properties related to a file and video
     * processing.
     * @param {string} name - The name of the file being processed.
     * @param {string} path - The path of the file being processed.
     */
    constructor(name: string, path: string) {

        this.name = name
        this.path = path

        this.file = new MediaFile()

        this.video = new MediaVideoProperties()

        this.working = new MediaWorkingProperties()

        this.started = 0
        this.ended = 0
        this.ffmpeg_argument = []

    }

    /**
     * This function checks if the file is being processed.
     * @returns {boolean} - Returns true if the file is being processed, false if not.
     */
    isProcessing(): boolean {

        return this.activity === Process.STATISTICS || this.activity === Process.CONVERT || this.activity === Process.VALIDATE

    }

    /**
     * Spawn a statistic instance for the file.
     * @returns {Promise<null>}
     */
    async doStatistics(container: Container): Promise<null> {

        this.activity = Process.STATISTICS

        return new Promise((resolve, reject) => {

            child.exec(`ffprobe -hide_banner -i ${this.file.path_rename}`, (err, stdout, stderr) => {

                if (err) throw err
                //if (stderr) throw stderr

                let data = stderr.toString()
                let sub_override = false

                data.split('\n').forEach((line) => {

                    //fps
                    if (/(\d+\.\d+|\d+).?fps/.test(line)) this.video.fps = parseFloat(line.match(/(\d+\.\d+|\d+).?fps/)[1])

                    //total frames
                    if (/(?:NUMBER_OF_FRAMES|NUMBER_OF_FRAMES-eng|DURATION).+ (\d+:\d+:\d+|\d+)/.test(line)) {

                        let match = line.match(/(?:NUMBER_OF_FRAMES|NUMBER_OF_FRAMES-eng|DURATION).+ (\d+:\d+:\d+|\d+)/)[1]

                        // if we match by duration (hh:mm:ss)
                        if (match.includes(':')) {

                            let time_match = match.split(':')
                            let time = (Number(time_match[0]) * 60 * 60) + (Number(time_match[1]) * 60) + Number(time_match[2])

                            if (time && this.video.fps) this.video.total_frames = Math.ceil(time * this.video.fps) * 1000

                        }
                        // if we match by frames
                        else this.video.total_frames = parseInt(match)

                    }

                    //resolution
                    if (/, (\d+x\d+).?/.test(line)) {

                        let match = line.match(/, (\d+x\d+).?/)[1].split('x')

                        this.video.width = parseInt(match[0])
                        this.video.height = parseInt(match[1])

                    }

                    //subtitle
                    if (/([S-s]ubtitle: .+)/.test(line)) {

                        let match = line.match(/([S-s]ubtitle: .+)/)[1]

                        if (!sub_override && /subrip|ass|mov_text/.test(match)) this.video.subtitle_provider = 'mov'
                        else if (!sub_override && /dvd_sub/.test(match)) this.video.subtitle_provider = 'dvd'
                        else if (!sub_override && /hdmv_pgs_subtitle/.test(match)) {

                            sub_override = true
                            this.video.subtitle_provider = 'hdmv'

                        }

                    }

                    //attachment
                    if (/([A-a]ttachment: .+)/.test(line)) {

                        if (this.video.subtitle_provider === 'mov') this.video.subtitle_provider = 'ass'

                    }

                })

            }).on('close', () => {

                let format = container.formats[container.appEncodingDecision.quality]

                this.video.converted_width = `${format.width}`
                this.video.converted_height = `${MediaFormat.getResolution(this.video.height, this.video.width, format.width)}`
                this.video.converted_resolution = this.video.converted_width + ':' + this.video.converted_height

                this.activity = Process.WAITING_CONVERT
                resolve(null)


            })

        })

    }

    /**
     * Spawn a conversion instance for the file.
     * @returns {Promise<null>}
     */
    async doConvert(): Promise<null> {

        return new Promise((resolve, reject) => {

            this.activity = Process.CONVERT

            setTimeout(() => {
                this.activity = Process.WAITING_VALIDATE
                resolve(null)
            }, 2000)

        })

    }

    /**
     * Spawn a validation instance for the file.
     * @returns {Promise<null>}
     */
    async doValidate(): Promise<null> {

        return new Promise((resolve, reject) => {

            this.activity = Process.VALIDATE

            setTimeout(() => {
                this.activity = Process.FINISHED
                resolve(null)
            }, 2000)

        })

    }

    /**
     * Build specific FFmpeg arguments for the encoding process.
     * @param container The container object that contains all of the information about the current and pending conversions.
     * @param overwrite If the file should be overwritten.
     */
    buildFFmpegArguments(container: Container, overwrite: boolean = false) {

        let format = container.formats[container.appEncodingDecision.quality]

        this.ffmpeg_argument = []

        this.ffmpeg_argument.push('-hide_banner')

        if (container.appEncodingDecision.useHardwareDecode) {

            switch (container.userCapabilities.GPUProvider) {

                case 'amd':
                    this.ffmpeg_argument.push('-hwaccel', HWAccel.AMD)
                    break

                case 'intel':
                    this.ffmpeg_argument.push('-hwaccel', HWAccel.INTEL)
                    break

                case 'nvidia':
                    this.ffmpeg_argument.push('-hwaccel', HWAccel.NVIDIA)
                    break

            }

        }

        this.ffmpeg_argument.push('-i', this.file.path_rename)

        /** Map video stream to index 0 */
        this.ffmpeg_argument.push('-map', '0:v:0')
        /** Map all audio streams */
        this.ffmpeg_argument.push('-map', '0:a?')
        /** Map all subtitle streams */
        this.ffmpeg_argument.push('-map', '0:s?')
        /** Map all attachment streams */
        this.ffmpeg_argument.push('-map', '0:t?')

        /** Codec attachment, Copy */
        this.ffmpeg_argument.push('-c:t', 'copy')

        /** Slow CPU preset */
        this.ffmpeg_argument.push('-preset', 'slow')

        /** Encoder level */
        this.ffmpeg_argument.push('-level', '4.1')

        if (container.appEncodingDecision.useBitrate) {

            this.ffmpeg_argument.push('-b:v', `${format.bitrate}M`)
            this.ffmpeg_argument.push('-bufsize', `${format.bitrate * 2}M`)
            this.ffmpeg_argument.push('-maxrate', `${format.max}M`)
            this.ffmpeg_argument.push('-minrate', `${format.min}M`)

        }

        else if (container.appEncodingDecision.useConstrain) {

            this.ffmpeg_argument.push('-crf', `${format.crf}`)
            this.ffmpeg_argument.push('-bufsize', `${format.bitrate * 2}M`)
            this.ffmpeg_argument.push('-maxrate', `${format.max}M`)

        }

        else {

            this.ffmpeg_argument.push('-crf', `${format.crf}`)

        }

        this.ffmpeg_argument.push('-c:a', 'copy')

        if (container.appEncodingDecision.crop) {

            this.ffmpeg_argument.push('-vf', `scale=${this.video.converted_resolution}:flags=lanczos,crop=${format.crop}`)


        }

        else this.ffmpeg_argument.push('-vf', `scale=${this.video.converted_resolution}:flags=lanczos`)

        if (container.appEncodingDecision.startBeginning) {

            this.ffmpeg_argument.push('-ss', container.appEncodingDecision.startBeginning)

        }

        if (container.appEncodingDecision.trim) {

            this.ffmpeg_argument.push('-ss', container.appEncodingDecision.trim.split(',')[0])
            this.ffmpeg_argument.push('-to', container.appEncodingDecision.trim.split(',')[1])

        }

        /** TODO: flesh out later */
        if (this.video.subtitle_provider) {

            if (this.video.subtitle_provider === 'mov') this.ffmpeg_argument.push('-c:s', 'mov_text')
            else this.ffmpeg_argument.push('-c:s', 'copy')

        }

        if (container.appEncodingDecision.tune) {

            this.ffmpeg_argument.push('-tune', container.appEncodingDecision.tune)

        }

        if (overwrite) this.ffmpeg_argument.push('-y')

        this.ffmpeg_argument.push(this.file.path_convert)

        if (container.debug.toggle) {

            logger.send(LogColor.fgRed, 'FFMPEG Arguments: ', this.ffmpeg_argument.join(' '))

        }

    }

    /**
     * This function renames the file to a standardized format.
     * @param container The container object that contains all of the information about the current and pending conversions.
     */
    rename(container: Container) {

        let mediaPattern = /(.+?)(?:[-|.| ]+)(season.?\d{1,}|s\d{1,}).?(e[e0-9-]+|x[x0-9-]+)/i
        let qualityPattern = /(1080p|720p|480p)/i
        let extensionPattern = /(\.mkv|.avi|\.srt|.idx|.sub)/i
        let extension = this.name.match(extensionPattern)[1]

        //match: (.+?)(?:[-|.| ]+)(season.?\d{1,}|s\d{1,}).?(e[e0-9-]++|x[x0-9-]++).+(1080p|720p|480p)

        if (mediaPattern.test(this.name)) {

            let media = this.name.match(mediaPattern)
            let quality = this.name.match(qualityPattern)[1]
            let episode = ''

            // series name
            this.file.series = media[1].replace(/\./, '').trim()
            // series number
            this.file.season = parseInt(media[2].replace(/season|s/i, ''))
            //episode number
            episode += media[3].toLowerCase()
            if (quality) this.file.quality = parseInt(quality.replace(/p/i, ''))

            this.file.ext = extension
            this.file.name_modified = `${this.file.series} s${this.file.season}${episode} [${this.file.quality}p]`
            this.file.name_modified_ext = this.file.name_modified + extension

        }

        else {

            this.file.ext = extension
            this.file.name_modified = this.name.replace(extension, '')
            this.file.name_modified_ext = this.name

        }

        if (extension === '.mkv' || extension === '.avi') this.file.name_convert = this.file.name_modified + '.mp4'
        else this.file.name_convert = this.file.name_modified + extension

        this.file.path = container.settings.workingDir + '/' + this.name
        this.file.path_rename = container.settings.workingDir + '/' + this.file.name_modified_ext

        // If this file includes a season, make a season folder for it
        if (this.file.season) {

            this.file.path_convert = this.path + `/${this.file.series} Season ${this.file.season}/` + this.file.name_convert

            if (!existsSync(this.path + `/${this.file.series} Season ${this.file.season}`))
                mkdirSync(this.path + `/${this.file.series} Season ${this.file.season}`)

        }
        // Otherwise, just put it in the root of the series folder
        else {
            this.file.path_convert = this.path + '/Converted/' + this.file.name_convert
            if (!existsSync(this.path + '/Converted')) mkdirSync(this.path + '/Converted')
        }

        if (extension === '.sub' || extension === '.idx') {

            //renameSync(this.path + '/' + this.file.name, this.path + '/../' + this.file.name)

        }

        renameSync(this.file.path, this.file.path_rename)

    }

}

/**
 * This class contains information regarding a file's properties.
 */
class MediaFile {

    /** Modified filename */
    name_modified: string = ''
    /** Modified filename with extension */
    name_modified_ext: string = ''
    /** Conversion filename with extension */
    name_convert: string = ''
    /** File Extension */
    ext: string = ''
    /** File size */
    size: number = 0
    /** New file size */
    new_size: number = 0
    /** Validation size */
    val_size: number = 0
    /** Original file path with file */
    path: string = ''
    /** Renamed file path with file */
    path_rename: string = ''
    /** Converted file path with file*/
    path_convert: string = ''
    /** Quality */
    quality: number = 0
    /** Series Name */
    series: string = ''
    /** Season Number */
    season: number = 0

    constructor() { }

}

/**
 * This class contains information regarding a file's video properties.
 */
class MediaVideoProperties {

    /** Video frames per second */
    fps: number = 0
    /** Total video frames */
    total_frames: number = 0
    /** Subtitle mapping within the video */
    subtitle_provider: string = ''
    /** Video width */
    width: number = 0
    /** Video height */
    height: number = 0
    /** ??? */
    ratio: string = ''
    /** Adjusted width */
    converted_width: string = ''
    /** Adjusted height */
    converted_height: string = ''
    /** Adjusted resolution */
    converted_resolution: string = ''
    /** Crop ratio */
    crop: string = ''
    /** Constant Rate Factor */
    crf: number = 0

    constructor() { }

}

/**
 * This class contains information regarding a file's properties during the conversion process.
 */
class MediaWorkingProperties {

    /** Current amount of frames being processed per second */
    fps: number = 0
    /** Total amount of frames converted */
    completed_frames: number = 0
    /** Conversion quality ratio */
    quality: number = 0
    /** Conversion bitrate */
    bitrate: number = 0

    constructor() { }

}

/**
 * This class contains information of intnernal conversion formats.
 */
class MediaFormat {

    /** Filename */
    name: string
    /** Constant Rate Factor */
    crf: number
    /** Bitrate */
    bitrate: number
    /** Minimum bitrate */
    min: number
    /** Maximum bitrate */
    max: number
    /** Width */
    width: number
    /** Height */
    height: number
    /** Crop ratio */
    crop: string
    /** Scale ratio */
    scale: string

    /**
     * 
     * @param name Filename
     * @param crf Constant Rate Factor
     * @param bitrate Bitrate
     * @param min Minimum bitrate
     * @param max Maximum bitrate
     * @param width Width
     * @param height Height
     * @param crop Crop ratio
     * @param scale Scale ratio
     */
    constructor(name: string, crf: number, bitrate: number, min: number, max: number, width: number, height: number, crop: string, scale: string) {
        this.name = name
        this.crf = crf
        this.bitrate = bitrate
        this.min = min
        this.max = max
        this.width = width
        this.height = height
        this.crop = crop
        this.scale = scale
    }

    /**
     * Calculate the greatest common denominator of the given width and height.
     * @param width Width of the media.
     * @param height Height of the media.
     * @returns {number} The calculated greatest common denominator.
     */
    static getGCD(width: number, height: number): number {

        let x = Math.abs(width)
        let y = Math.abs(height)

        while (y) { const t = y; y = x % y; x = t }

        return x
    }

    /**
     * Calculate the resolution of a custom value from base width and height.
     * @param width Width of the media.
     * @param height Height of the media.
     * @param newWidth The new width of the media.
     * @returns {number} The calculated aspect ratio.
     */
    static getResolution(width: number, height: number, newWidth: number): number {

        let new_height = Math.ceil((height / width) * newWidth)

        new_height = new_height % 2 === 0 ? new_height : new_height - 1

        return new_height

    }
}

/**
 * Class to handle logging to the console.
 */
class Log {

    /** Buffer instance */
    #buffer: LogBuffer | null = null

    constructor() { }

    /**
     * Send a message to the console.
     * @param color The color of the message.
     * @param messages The message to send.
     */
    send(color: (str: string) => string, ...messages: any[]): void {

        console.log('called send')

        for (const message of messages) {

            if (typeof (message) === 'object') console.log(message)
            else stdout.write(color(message) + ' ')

        }

        stdout.write('\n')

    }

    /**
     * Send a buffered message to the console.
     * This is used to display an array or list of messages in a single line.
     * @param color The color of the message.
     * @param length The length of the buffer.
     * @param message The message to send.
     */
    sendBuffer(color: (str: string) => string, length: number, message: string): void {

        console.log('called sendbuffer, len ' + length)
        if (false) console.log('SENDING BUFFER')
        if (false) console.log('BUFFER LENGTH: ' + length)
        if (false) console.log('BUFFER MESSAGE: ' + message)

        if (!this.#buffer) {

            this.#buffer = new LogBuffer(length)
            this.#buffer.addLine(message)

        }
        else {

            this.#buffer.addLine(message)

        }

        if (this.#buffer.isFull()) {

            this.send(color, this.#buffer.output())
            this.#buffer = null

        }

    }

    /**
     * Send a plain message to the console.
     * @param messages The message to send.
     */
    sendPlain(...messages: any[]): void {

        console.log('called sendplain')

        for (const message of messages) {

            if (typeof (message) === 'object') console.log(message)
            else stdout.write(message + ' ')

        }

        stdout.write('\n')

    }

    /**
     * Check if the buffer has a message.
     * @returns {boolean} True if the buffer has a message, false if not.
     */
    hasBuffer(): boolean {

        return this.#buffer != null

    }

    /**
     * Flush the buffer to the console.
     */
    flushBuffer(): void {

        console.log('called flushbuffer')

        if (this.#buffer) {

            this.send(LogColor.fgRed, this.#buffer.output())
            this.#buffer = null

        }

    }

}

/**
 * This class handles the buffering of messages to the console.
 */
class LogBuffer {

    /** Current amount of messages in the buffer */
    current: number
    /** Maximum amount of messages in the buffer */
    max: number

    /** The line to output */
    line: string = ''

    /**
     * 
     * @param max The maximum amount of messages in the buffer.
     */
    constructor(max: number) {

        this.current = 0
        this.max = max

    }

    /**
     * Add a line to the buffer.
     * @param line The line to add to the buffer.
     */
    addLine(line: string): void {

        this.line += line + '\n'
        this.current++

    }

    /**
     * Check if the buffer is full.
     * @returns {boolean} True if the buffer is full, false if not.
     */
    isFull(): boolean {

        return this.current >= this.max

    }

    /**
     * Output the buffer.
     * @returns {string} The buffer's output.
     */
    output(): string {

        return this.line

    }

}

/**
 * This class holds various methods to apply color to console messages.
 */
class LogColor {

    static reset(str: string) { return '\x1b[0m' + str }
    static bright(str: string) { return '\x1b[1m' + str + '\x1b[0m' }
    static dim(str: string) { return '\x1b[2m' + str + '\x1b[0m' }
    static underscore(str: string) { return '\x1b[4m' + str + '\x1b[0m' }
    static blink(str: string) { return '\x1b[5m' + str + '\x1b[0m' }
    static reverse(str: string) { return '\x1b[7m' + str + '\x1b[0m' }
    static hidden(str: string) { return '\x1b[8m' + str + '\x1b[0m' }
    static none(str: string) { return str }

    static fgBlack(str: string) { return '\x1b[30m' + str + '\x1b[0m' }
    static fgRed(str: string) { return '\x1b[31m' + str + '\x1b[0m' }
    static fgGreen(str: string) { return '\x1b[32m' + str + '\x1b[0m' }
    static fgGray(str: string) { return '\x1b[38;2;191;191;191m' + str + '\x1b[0m' }
    static fgYellow(str: string) { return '\x1b[33m' + str + '\x1b[0m' }
    static fgBlue(str: string) { return '\x1b[34m' + str + '\x1b[0m' }
    static fgMagenta(str: string) { return '\x1b[35m' + str + '\x1b[0m' }
    static fgCyan(str: string) { return '\x1b[36m' + str + '\x1b[0m' }
    static fgWhite(str: string) { return '\x1b[37m' + str + '\x1b[0m' }

    static bgBlack(str: string) { return '\x1b[40m' + str + '\x1b[0m' }
    static bgRed(str: string) { return '\x1b[41m' + str + '\x1b[0m' }
    static bgGreen(str: string) { return '\x1b[42m' + str + '\x1b[0m' }
    static bgYellow(str: string) { return '\x1b[43m' + str + '\x1b[0m' }
    static bgBlue(str: string) { return '\x1b[44m' + str + '\x1b[0m' }
    static bgMagenta(str: string) { return '\x1b[45m' + str + '\x1b[0m' }
    static bgCyan(str: string) { return '\x1b[46m' + str + '\x1b[0m' }
    static bgWhite(str: string) { return '\x1b[47m' + str + '\x1b[0m' }

}

/**
 * Enum for the various encoders.
 */
const enum Encoders {
    AV1 = 'av1',
    AV1_AMF = 'av1_amf',
    AV1_NVENC = 'av1_nvenc',
    AV1_QSV = 'av1_qsv',
    H264 = 'h264',
    H264_AMF = 'h264_amf',
    H264_NVENC = 'h264_nvenc',
    H264_QSV = 'h264_qsv',
    HEVC = 'hevc',
    HEVC_AMF = 'hevc_amf',
    HEVC_NVENC = 'hevc_nvenc',
    HEVC_QSV = 'hevc_qsv'
}

/**
 * Enum for the various decoders.
 */
const enum Decoders {
    AV1_CUVID = 'av1_cuvid',
    AV1_QSV = 'av1_qsv',
    H264_CUVID = 'h264_cuvid',
    H264_QSV = 'h264_qsv',
    HEVC_CUVID = 'hevc_cuvid',
    HEVC_QSV = 'hevc_qsv'
}

/**
 * Enum for the various hardware acceleration options.
 */
const enum HWAccel {
    AMD = 'amf',
    NVIDIA = 'cuda',
    INTEL = 'qsv',
    VULKAN = 'vulkan'
}

/**
 * Enum for the various processes.
 */
const enum Process {
    CONVERT = 'convert',
    FAILED = 'failed',
    FAILED_CODEC = 'failed_codec',
    FAILED_HARDWARE = 'failed_hardware',
    FAILED_PERMISSIONS = 'failed_permissions',
    FAILED_SYSTEM = 'failed_system',
    FINISHED = 'finished',
    STATISTICS = 'statistics',
    WAITING = 'waiting',
    WAITING_CONVERT = 'waiting_convert',
    WAITING_STATISTICS = 'waiting_statistics',
    WAITING_VALIDATE = 'waiting_validate',
    VALIDATE = 'validate'
}

/**
 * Output a help message.
 */
function help(): void {

    return logger.sendPlain(`------------- ${LogColor.fgBlue('REDESIGN HELP')} -------------\n` +
        '\n' +
        `Usage: ${LogColor.fgBlue('redesign.js')} [${LogColor.fgBlue('resolution')}] [${LogColor.fgBlue('amount')}] [${LogColor.fgBlue('codec')}] [${LogColor.fgBlue('tune')}] [${LogColor.fgBlue('overrides')}]\n` +
        '\n' +
        'Resolution:\n' +
        '   One of the pre-configured resolutons [' +
        `${LogColor.fgBlue('2160p')}, ${LogColor.fgBlue('1440p')}, ${LogColor.fgBlue('1080pn')}, ${LogColor.fgBlue('720p')}, ${LogColor.fgBlue('480p')}` +
        '] (must include the p)\n' +
        '\n' +
        '   Special Formats:\n' +
        `      ${LogColor.fgBlue('1080pn')} - Netflix cropping (${LogColor.fgBlue('2:1')})\n` +
        `      ${LogColor.fgBlue('720pn')}  - Netflix cropping (${LogColor.fgBlue('2:1')})\n` +
        `      ${LogColor.fgBlue('1080pm')} - Marvel cropping  (${LogColor.fgBlue('64:29')})\n` +
        `      ${LogColor.fgBlue('720pm')}  - Marvel cropping  (${LogColor.fgBlue('64:29')})\n` +
        `      ${LogColor.fgBlue('480pc')}  - NTSC cropping    (${LogColor.fgBlue('32:27')})\n` +
        '\n' +
        'Amount:\n' +
        '   Amount of media to convert at once.\n' +
        '\n' +
        'Codec:\n' +
        `   One of the pre-configured codecs [${LogColor.fgBlue('hevc')}, ${LogColor.fgBlue('nvenc')}, ${LogColor.fgBlue('h264')}]\n` +
        '\n' +
        'Tune:\n' +
        `   One of the ffmpeg tune profiles [${LogColor.fgBlue('film')}, ${LogColor.fgBlue('animaton')}, ${LogColor.fgBlue('grain')}]\n` +
        '\n' +
        'Overrides:' +
        '\n' +
        `   ${LogColor.fgBlue('-bitrate')}[${LogColor.fgBlue('mbps')}]  - Use bitrates instead of CRF. You can only use defined resolutions with this flag.\n` +
        `   ${LogColor.fgBlue('-constrain')}  - Force the encoder to use a max bitrate with CRF.\n` +
        `   ${LogColor.fgBlue('-skip-beginning:')}[${LogColor.fgBlue('hh:mm:ss')}]  - Skip the beginning by specified amount of time.\n` +
        `   ${LogColor.fgBlue('-crf:')}[${LogColor.fgBlue('crf')}]  - Override the CRF value for the current media.\n` +
        `   ${LogColor.fgBlue('-validate:')}[${LogColor.fgBlue('dir')}]  - Override the validation directory\n` +
        `   ${LogColor.fgBlue('-trim:')}[${LogColor.fgBlue('hh:mm:ss,hh:mm:ss')}]   - Trim the media.\n` +
        `   ${LogColor.fgBlue('-novalidate:')}  - Skip validation .\n`)

}

/**
 * Time conversion.
 * @param value MS value to convert
 * @param type Should elapsed time be returned?
 */
function time(value: number | null, type: boolean | null) {

    if (value == null) {

        let date = new Date()

        let a = date.getHours()
        let b = date.getMinutes()
        let c = date.getSeconds()
        let d = a == 12 ? 'PM' : a > 12 ? 'PM' : 'AM'
        let h = a == 12 || (a > 9 && a < 12) ? `${a}` : a > 12 ? a - 12 > 9 ? `${a - 12}` : `0${a - 12}` : `0${a}`
        let m = String(b).length == 2 ? b : `0${b}`
        let s = String(c).length == 2 ? c : `0${c}`

        return `${h}:${m}:${s}-${d} - ${date.toDateString()}`

    }

    else if (!type) {

        let date = new Date(value)

        let a = date.getHours()
        let b = date.getMinutes()
        let c = date.getSeconds()
        let d = a == 12 ? 'PM' : a > 12 ? 'PM' : 'AM'
        let h = a == 12 || (a > 9 && a < 12) ? `${a}` : a > 12 ? a - 12 > 9 ? `${a - 12}` : `0${a - 12}` : `0${a}`
        let m = String(b).length == 2 ? b : `0${b}`
        let s = String(c).length == 2 ? c : `0${c}`

        return `${h}:${m}:${s}-${d}`

    } else {

        let h: string | number = 0
        let m: string | number = 0
        let s: string | number = Math.floor(value / 1000)

        m = Math.floor(s / 60)
        s -= m * 60

        h = Math.floor(m / 60)
        m -= h * 60

        //return `${h ? h + ' Hour(s) ' : ''}${m ? m + ' Minute(s) ' : ''}${s ? s + ' Second(s) ' : ''}`

        h = h > 0 ? h < 10 ? '0' + h + ':' : h + ':' : null

        //if minutes are greater than 0, check to see if they are less than 10
        //if there is an hour we need to make it not display null
        m = m > 0 || h ? m < 10 ? '0' + m + ':' : m + ':' : null

        s = s < 10 ? '0' + s : s

        return `${h ? h : ''}${m ? m : ''}${s}`

    }
}

/**
 * Truncate a string to a specified length.
 * @param str String to truncate
 * @returns Truncated string
 */
function truncateString(str: string): string {
    const maxLength = 25
    if (str.length <= maxLength) {
        return str
    }
    const ellipsis = '... '
    const leftHalfLength = Math.ceil((maxLength - ellipsis.length) / 2)
    const rightHalfLength = Math.floor((maxLength - ellipsis.length) / 2)
    const leftHalf = str.slice(0, leftHalfLength)
    const rightHalf = str.slice(str.length - rightHalfLength)
    return leftHalf + ellipsis + rightHalf
}

main()