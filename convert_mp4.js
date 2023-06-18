const { stat, existsSync, readdirSync, renameSync, mkdirSync } = require("fs");
const child = require('child_process');
const { exit } = require("process");

/**
 * SCREEN:
 * [TIME] [AMOUNT] [TARGET ENC] [ENCODER] [DECODER] [TUNE] [RESOLUTION] [DEBUG?] [CROP?]
 * 
 * [FILE_1] [ACTIVITY (Converting)] [START_TIME] [PROGRESS] [QUALITY] [BITRATE] [SPEED] [ETA]
 * [FILE_2] [ACTIVITY (Waiting)] [START_TIME] [PROGRESS] [QUALITY] [BITRATE] [SPEED] [ETA]
 * 
 * PROCESS:
 * 
 * current: { Media, ... }
 * files: [ { Media, ... }, { Media, ... }, ... ]
 * 
 * FILE ARRAY:
 * 
 * files: [ { Media (Waiting) }, { Media (Waiting) }, { Media (Finished) }, ... ]
 */



// Color console output
let chalk = {

	red: (string) => { return "\x1b[38;2;255;128;128m" + string + "\x1b[0m" },
	blue: (string) => { return "\x1b[38;2;77;148;255m" + string + "\x1b[0m" },
	gray: (string) => { return "\x1b[38;2;191;191;191m" + string + "\x1b[0m" }

}

let o = {
	current: {},
	files: [],
	decision: {
		encoder: null,
		running_encoder: null,
		running_decoder: null,
		amount: null,
	},
	settings: {
		working: process.cwd(),
		encoders: ["h264", "hevc", "nvenc"]
	},
	debug: {
		toggle: false,
		stats: {
			data: false,
			file: false

		},
		extract: {
			data: false,
			file: false

		},
		convert: {
			data: false,
			file: false

		},
		validate: {
			data: false,
			file: false

		}
	}
}

// Parse arguments provided to the script
process.argv.forEach(arg => {

	// Set amount of transcodes to run in parallel
	if (!isNaN(arg)) o.decision.amount = Number(arg);

	// Enable debug mode
	if (arg == "debug") o.debug.toggle = true;

	// Print help message
	if (arg.includes("-help")) o.decision.help = true;

})

// Print help message and exit
if (o.decision.help) { help(); exit(); }

// Set decision values to default if not provided
if (!o.decision.encoder) o.decision.encoder = "hevc";
if (!o.decision.amount) o.decision.amount = 1;
if (!o.decision.tune) o.decision.tune = "film"

// Print debug information if debug mode is enabled
if (o.debug.toggle) {

	debug_prefix = chalk.red("[DEBUG]")

	console.log(debug_prefix, chalk.red(" -- Starting Settings -- "))
	console.log(debug_prefix, chalk.blue("CWD:"), chalk.gray(o.settings.working))
	console.log(debug_prefix, chalk.red(" -- Starting Settings -- "))
	console.log()
	console.log(debug_prefix, chalk.red(" -- Starting Decisions -- "))
	console.log(debug_prefix, chalk.blue("Encoder:"), chalk.gray(o.decision.encoder))
	console.log(debug_prefix, chalk.blue("Amount:"), chalk.gray(o.decision.amount))
	console.log(debug_prefix, chalk.blue("Working Dir:"), chalk.gray(o.settings.working))
	console.log(debug_prefix, chalk.red(" -- Starting Decisions -- "))

}

main()

function main() {

	// Get the list of files in the working directory
	let directory = readdirSync(o.settings.working)

	// Iterate through each file in the working directory
	directory.forEach(file => {

		// Get the file's stats
		stat(file, (err, stat) => {

			// If the file is a file, and it's an mkv or avi file
			if (stat.isFile() && (file.includes(".mkv") || file.includes(".avi"))) {

				// Create a new media object
				let media = new Media(file, o.settings.working + "/" + file)

				// Rename the file
				media.rename()

				// Get the file's size from its stats
				media.file.size = stat.size;

				// Set the path of the renamed file
				media.file.path_new = o.settings.working + "/" + media.file.name_new;

				// Print debug information if debug mode is enabled
				if (o.debug.toggle) {

					console.log(debug_prefix, chalk.red(" -- Media File -- "))
					console.log(debug_prefix, chalk.blue("Media File:"), chalk.gray(file))
					console.log(debug_prefix, chalk.blue("Name:"), chalk.gray(media.file.name))
					console.log(debug_prefix, chalk.blue("Modified Name:"), chalk.gray(media.file.name_mod))
					console.log(debug_prefix, chalk.blue("New Name:"), chalk.gray(media.file.name_new))
					console.log(debug_prefix, chalk.blue("Extension:"), chalk.gray(media.file.ext))
					console.log(debug_prefix, chalk.blue("Size:"), chalk.gray(media.file.size))
					console.log(debug_prefix, chalk.blue("Path:"), chalk.gray(media.file.path))
					console.log(debug_prefix, chalk.blue("New Path:"), chalk.gray(media.file.path_new))
					console.log(debug_prefix, chalk.blue("Series:"), chalk.gray(media.file.series))
					console.log(debug_prefix, chalk.blue("Episode:"), chalk.gray(media.file.episode))
					console.log(debug_prefix, chalk.red(" -- Media File -- \n"))

				}

				// If the file name is different than the new name, rename it on disk
				if (media.file.name != file) renameSync(`./${file}`, media.file.name)

				// Push the file to the media array
				o.files.push(media)

			}

			else if (stat.isDirectory() && file.toLowerCase().includes("sub")) {

				// We need to check if the directory has a video file in it.
				// This can be done later.

			}

		})
	})

	updateScreen()
	overlook()

}

function updateScreen() {

	//Attempt to hide the cursor in the console.
	console.log('\x1B[?25l');

	setInterval(() => {

		let output = []

		let ob = chalk.gray("[")
		let cb = chalk.gray("]")
		let t = `${ob + chalk.blue("TIME") + cb} ${chalk.gray(time())} `
		let encoder = `${ob + chalk.blue("TARGET ENC") + cb} ${chalk.gray(o.decision.encoder.toUpperCase())} `
		let running_encoder = `${ob + chalk.blue("ENC") + cb} ${chalk.gray(o.decision.running_encoder)} `
		let running_decoder = `${ob + chalk.blue("DEC") + cb} ${chalk.gray(o.decision.running_decoder)} `
		let amount = `${ob + chalk.blue("AMOUNT") + cb} ${chalk.gray(o.decision.amount)} `
		let debug = o.debug.toggle ? ob + chalk.red("DEBUG") + cb + " " : ""

		// If the debug toggle is off, continue to update the console screen.
		if (!o.debug.toggle) {

			//Clear the current console output.
			console.clear();

			//Log the top line.
			console.log(`${t}${amount}${encoder}${running_encoder}${running_decoder}${debug}\n`)

			//Get info for currently converting media.
			Object.keys(o.current).forEach((media, index) => {

				// Set the media object to the current media object
				media = o.current[media]

				let file_name = `${ob + chalk.blue("FILE") + cb} ${chalk.gray(media.file.name_mod.substring(0, 15) + "...")}`

				let total_frames = media.video.total_frames

				let completed_frames = media.working.completed_frames
				let media_fps = media.working.fps
				let bitrate = `${ob + chalk.blue("BIT") + cb} ${chalk.gray(media.working.bitrate)}`
				let cq = `${ob + chalk.blue("QUAL") + cb} ${chalk.gray(Math.trunc((media.video.crf / media.working.quality) * 100))}%`
				let speed = `${ob + chalk.blue("SPEED") + cb} ${chalk.gray(Math.trunc((media_fps / media.video.fps) * 100) / 100)}`
				let eta = `${ob + chalk.blue("ETA") + cb} ${chalk.gray(time(Math.ceil((total_frames - completed_frames) / media_fps), 1))}`

				let activity = `${ob + chalk.blue("ACT") + cb} ${chalk.gray(media.activity)}`
				let started = `${ob + chalk.blue("START") + cb} ${chalk.gray(time(media.started))}`

				let percent = `${ob + chalk.blue("PROG") + cb} ${chalk.gray(Math.ceil((completed_frames / total_frames) * 100) + "%")}`

				let message = `${file_name} ${activity} ${started} ${percent} ${cq} ${bitrate} ${speed} ${eta} `

				if (index == 0) {

					let a = `| ACT: ${media.activity} `
					let b = `| BIT: ${media.working.bitrate} `
					let e = `| ETA: ${time(Math.ceil((total_frames - completed_frames) / media_fps), 1)} `
					let f = media.file.name_mod
					let p = `| PCT: ${Math.ceil((completed_frames / total_frames) * 100)}% `
					let q = `| QLT: ${media.working.quality} `

					/* The above code sets the title of the current Node.js process to a string that is constructed
					using the values of the variables `f`, `a`, `q`, `b`, and `e`. The resulting title will be
					displayed in the terminal or console window where the process is running. */
					process.title = `${f} ${a}${q}${b}${e}`

				}

				output.push(message)

			})

			//Get the other files in the queue.
			o.files.forEach(media => {

				let file_name = `${ob + chalk.blue("FILE") + cb} ${chalk.gray(media.file.name_mod.slice(0, 15) + "...")}`
				let activity = `${ob + chalk.blue("STATUS") + cb} ${chalk.gray(media.activity)}`

				if (media.activity == "Waiting") {

					let message = `${file_name} ${activity}`

					return output.push(message)

				}

				if (media.activity == "Finished" || media.activity.includes("Failed")) {

					// Calculate the percentage of the file size that was reduced.
					let calculated = Math.floor(((media.file.size - media.file.new_size) / media.file.size) * 100)

					let ended = `${ob + chalk.blue("COMPLETION") + cb} ${chalk.gray(time(media.ended))}`
					let elapsed = `${ob + chalk.blue("ELAPSED") + cb} ${chalk.gray(time(media.ended - media.started, 1))}`
					let reduced = `${ob + chalk.blue("REDUCED") + cb} ${media.file.new_size ? chalk.gray(calculated + "%") : "???"}`

					let message = `${file_name} ${activity} ${reduced} ${ended} ${elapsed}`

					return output.push(message)

				}

			})

			//Log the output array.
			output.forEach(line => console.log(line))

		} else {

			//DEBUG INFORMATION GOES HERE
			//console.log(o.current ? o.current.file : null)

			//TOGGLES

			//STATS
			o.debug.stats.data = true;
			o.debug.stats.file = false;

			//CONVERT
			o.debug.convert.data = true;
			o.debug.convert.file = false;

			//VALIDATE
			o.debug.validate.data = false;
			o.debug.validate.file = false;

		}

	}, 500);

}

/**
 * The function oversees the transcoding process by managing the queue of media files and spawning
 * instances for statistics, extraction, conversion, and validation.
 */
function overlook() {

	setInterval(() => {

		let current_amount = Object.keys(o.current).length

		//console.log(current_amount, o.decision.amount)

		if (current_amount < o.decision.amount) {

			/**
			 * @type {Media}
			 */
			let next = o.files.shift()

			// If there are no more files to process, exit the process.
			if (!next || next.activity.includes("Failed") || next.activity == "Finished") {

				if (current_amount == 0) process.exit()

			}
			else {

				next.activity = "Statistics"
				next.started = new Date().getTime()

				// Add the file to the current queue.
				o.current[next.file.name_mod] = next

			}

		}

		// If the current amount of transcoding instances is greater than the allowed amount, exit the process.
		if (current_amount > o.decision.amount) {

			console.error("CURRENT TRANSCODES ARE GREATER THAN THE ALLOWED AMOUNT.")
			console.error("CURRENT ALLOWED AMOUNT: " + o.decision.amount)
			console.error("CURRENT QUEUE:")
			Object.keys(o.current).forEach(media => console.error("CURRENT FILE: " + o.current[media].file_mod))
			process.exit()

		}

		// Iterate through the current queue and spawn instances for each file.
		Object.keys(o.current).forEach(file => {

			/**
			 * @type {Media}
			 */
			let media = o.current[file]

			// If the file is not being processed, spawn an instance for it.
			if (!media.process) {

				if (media.activity.includes("Statistics")) spawnStatisticsInstance(media)
				//if (media.activity.includes("Extracting")) spawnExtractionInstance(media)
				if (media.activity.includes("Converting")) spawnConversionInstance(media)
			}

			// If the file has finished processing, add it to the completed queue.
			if (media.activity == "Finished" || media.activity.includes("Failed")) {

				media.ended = new Date().getTime()

				o.files.push(media)

				delete o.current[media.file.name_mod]

			}

		})

	}, 500);

}

/**
 * The function spawns an instance of FFProbe to extract statistics from a media file and assigns the
 * extracted data to properties of a media object.
 * @param {Media} media - The media object that contains information about the media file being processed, such
 * as its path, resolution, and subtitle information.
 */
function spawnStatisticsInstance(media) {

	/**
	 * This is just full of dummy regex expressions that need to be optimized.
	 * 
	 * If you can understand it all, props.
	 * I hate every second of it.
	 */

	media.process = true

	// Spawn an instance of FFProbe to get the statistics of the file.
	child.exec(`ffprobe -hide_banner -i "${media.file.path}"`, { encoding: 'UTF-8', windowsHide: true, shell: false }, (err, stdout, data) => {

		if (err) { console.log(o.current); throw err; }

		data = data.toString().trim()

		if (o.debug.stats.data) console.log(data)
		if (o.debug.stats.file) console.log(media)

		//Get FPS
		if (data.match(/(?<=, )(([0-9]+[0-9]+)|([0-9]+\.[0-9]+))(?= fps)/gm)) media.video.fps = Number(data.match(/(?<=, )(([0-9]+[0-9]+)|([0-9]+\.[0-9]+))(?= fps)/gm)[0])
		else media.video.fps = null


		//Get total frames 
		if (/(?<=NUMBER_OF_FRAMES: )(.*)(?=$)/gm.test(data)) media.video.total_frames = data.match(/(?<=NUMBER_OF_FRAMES: )(.*)(?=$)/gm)[0] * 1000;
		else if (/(?<=NUMBER_OF_FRAMES-eng: )(.*)(?=$)/gm.test(data)) media.video.total_frames = data.match(/(?<=NUMBER_OF_FRAMES-eng: )(.*)(?=$)/gm)[0] * 1000;
		else if (/(?<=Duration: )(.*?)(?=,)/gm.test(data)) {

			let t = data.match(/(?<=Duration: )(.*?)(?=,)/gm)[0];

			t = t.split(':'); t = (Number(t[0]) * 60 * 60) + (Number(t[1]) * 60) + Number(t[2])

			if (t && media.video.fps) media.video.total_frames = Math.ceil(t * media.video.fps) * 1000

		}

		//Get resolution of the video
		if (/(?<=, )(([0-9]+x[0-9]+))(?=)/gm.test(data.trim())) {

			let resolution = data.match(/(?<=, )(([0-9]+x[0-9]+))(?=)/gm)[0].split('x')

			media.video.height = resolution[1]
			media.video.width = resolution[0]
			media.video.resolution = media.video.width + ":" + media.video.height

		} else throw new Error('Could not find resolution: \n' + data);

		//Get subtitles in the video
		if (/(?=.*[S-s]ubtitle: )(.*)(?=)/gm.test(data)) {

			data.match(/(?=.*[S-s]ubtitle: )(.*)(?=)/gm).forEach(line => {

				line = line.toLowerCase()

				if (line.includes('subtitle')) {

					if (/subrip|ass|mov_text/.test(line)) media.video.use_subtitle = 'mov'
					else if (/dvd_sub/.test(line)) media.video.use_subtitle = 'dvd'
					else if (/hdmv_pgs_subtitle/.test(line)) {

						media.video.use_subtitle = 'hdmv'
						media.file.path_new = o.settings.working + `/${media.file.show} Season ${media.file.season_number}/` + media.file.name
						if (!existsSync(`./${media.file.show} Season ${media.file.season_number}`)) {

							mkdirSync(`./${media.file.show} Season ${media.file.season_number}`, { recursive: true })

						}

					}

					else throw ("Unknown subtitle: " + line)

				}
			})

		}

		// If there are no subtitles, don't use them.
		else media.video.use_subtitle = false;

		// Get the rest of the attachments in the video, generally going to be burnt-in subtitles.
		if (/(?=.*[A-a]ttachment: )(.*)(?=)/gm.test(data)) {

			throw new Error('Cannot convert media with attachments.')

			if (media.video.use_subtitle && media.video.use_subtitle == "mov") media.video.use_subtitle = "ass"

			media.file.path_new = o.settings.working + `/${media.file.show} Season ${media.file.season_number}/` + media.file.name
			if (!existsSync(`./${media.file.show} Season ${media.file.season_number}`)) {

				mkdirSync(`./${media.file.show} Season ${media.file.season_number}`, { recursive: true })

			}

		}

		//media.activity = "Extracting"
		media.activity = "Converting"
		media.process = false

	})

}

/**
 * This function spawns a new FFmpeg instance to convert a video file.
 * @param {Media} media - an object containing information about the media file being converted, including its
 * path, video and audio codecs, resolution, and other settings.
 */
function spawnConversionInstance(media) {

	media.process = true

	assemble()

	/**
	 * This function assembles FFmpeg arguments for video conversion, taking into account hardware
	 * acceleration and codec decisions.
	 * @param {boolean} encFallback - A boolean value indicating whether to use a fallback encoder if the primary
	 * encoder fails.
	 * @param {boolean} decFallback - A boolean value indicating whether to use CPU decoding as a fallback option if
	 * GPU decoding is not available.
	 */
	function assemble(encFallback, decFallback) {

		let codec;

		decFallback ? o.decision.running_decoder = "CPU" : o.decision.running_decoder = "GPU"
		!encFallback && o.decision.encoder == "nvenc" ? o.decision.running_encoder = "GPU" : o.decision.running_encoder = "CPU"

		media.activity = `Converting`

		// If the encoder is nvenc, use the hevc_nvenc codec. If the encoder is hevc, use the libx265 codec.
		// Fallback to h264 if the encoder fails.
		if (!encFallback && o.decision.encoder == "nvenc") { codec = 'hevc_nvenc' }
		else if ((encFallback && o.decision.encoder == "nvenc") || o.decision.encoder == "hevc") { codec = 'libx265' }
		else { codec = 'h264' }

		media.ffmpeg_argument = []

		media.ffmpeg_argument.push('-hide_banner')

		//Use hardware decoding
		if (!decFallback) media.ffmpeg_argument.push("-hwaccel")
		if (!decFallback) media.ffmpeg_argument.push("cuda")

		//Input
		media.ffmpeg_argument.push(`-i`)
		media.ffmpeg_argument.push(media.file.path)

		//Map out streams
		media.ffmpeg_argument.push("-map")
		media.ffmpeg_argument.push("0:v:0")
		media.ffmpeg_argument.push("-map")
		media.ffmpeg_argument.push("0:a?")
		media.ffmpeg_argument.push("-map")
		media.ffmpeg_argument.push("0:s?")
		media.ffmpeg_argument.push("-map")
		media.ffmpeg_argument.push("0:t?")

		//Copy attachments
		media.ffmpeg_argument.push("-c:t")
		media.ffmpeg_argument.push("copy")

		//Set video codec
		media.ffmpeg_argument.push("-c:v")
		media.ffmpeg_argument.push("copy")

		//Set audio codec
		media.ffmpeg_argument.push("-c:a")
		media.ffmpeg_argument.push("copy")

		//Subtitle decision
		if (media.video.use_subtitle) media.ffmpeg_argument.push('-c:s')
		if (media.video.use_subtitle) media.ffmpeg_argument.push(`${media.video.use_subtitle == 'mov' ? 'mov_text' : 'copy'}`)

		//Overwrite
		media.ffmpeg_argument.push(encFallback || decFallback ? "-y" : "-n")

		//Write
		media.ffmpeg_argument.push(media.file.path_new)

		// If debug is enabled, log the built argument as it is passed to the console
		if (o.debug.toggle) {

			let built = ""

			for (const argument of media.ffmpeg_argument) {

				built += `${argument} `;

			}

			console.log(debug_prefix, chalk.blue("Built Arguments:"), chalk.gray(built))

		}

		convert()

	}

	function convert() {

		let encode = child.spawn('ffmpeg', media.ffmpeg_argument, { encoding: 'UTF-8', windowsHide: true, shell: false })

		// Spawn ffmpeg
		encode.on('error', function (err) { obj.convert.files[key].processing = "Failed - Ffmpeg Missing"; })

		if (o.debug.convert.file) console.log(media)

		encode.stderr.on('data', (data) => {

			data = data.toString()

			if (o.debug.convert.data) console.log(data)

			// If the encoder is used already or the encoder is not found, kill the process and try again
			if (/openencodesessionex failed: out of memory/ig.test(data) || /no capable devices found/ig.test(data)) {

				encode.kill()

				setTimeout(() => { return assemble(true) }, 500);

			}

			// If there is no nvidia card, kill the process and try again using the fallback encoder
			else if (/cannot load nvcuda.dll/ig.test(data) || /device type cuda needed for codec/ig.test(data)) {

				encode.kill()

				setTimeout(() => { return assemble(true, true) }, 500);

			}

			// If the file is already encoded, set the process status to validating
			else if (/already exists/ig.test(data)) {

				media.activity = "Finished"
				media.process = false

			}

			else {

				// Get the converted frame amount and fps
				if (/(?<=frame=)(.*)(?=fps)/g.test(data)) {

					let quality = data.match(/(?<=q=)(.*?)(?= )/g)
					let bitrate = data.match(/(?<=bitrate=)(.*?)(?=kbits\/s)/g)
					let size = data.match(/(?<=size=)(.*?)(?=kb)/ig)

					quality = quality ? quality[0].trim() : 0
					bitrate = bitrate ? bitrate[0].trim() : 0
					size = size ? size[0].trim() : 0

					media.working.completed_frames = data.match(/(?<=frame=)(.*)(?=fps)/g)[0].trim() * 1000
					media.working.fps = Number(data.match(/(?<=fps=)(.*)(?= q)/g)[0])
					media.working.quality = quality
					media.working.bitrate = bitrate
					media.file.new_size = Number(size) * 1000

				}
			}
		});

		encode.on('exit', (code) => {

			if (code != null) {

				if (code != null) media.activity = "Finished";

				media.process = false


			}

		})

	}

}

function time(value, type) {

	if (value == null) {

		let date = new Date();

		let a = date.getHours();
		let b = date.getMinutes();
		let c = date.getSeconds();
		let d = a == 12 ? 'PM' : a > 12 ? 'PM' : 'AM';
		let h = a == 12 || (a > 9 && a < 12) ? `${a}` : a > 12 ? a - 12 > 9 ? `${a - 12}` : `0${a - 12}` : `0${a}`
		let m = String(b).length == 2 ? b : `0${b}`;
		let s = String(c).length == 2 ? c : `0${c}`

		return `${h}:${m}:${s}-${d} - ${date.toDateString()}`;

	}

	else if (!type) {

		let date = new Date(value)

		let a = date.getHours();
		let b = date.getMinutes();
		let c = date.getSeconds();
		let d = a == 12 ? 'PM' : a > 12 ? 'PM' : 'AM';
		let h = a == 12 || (a > 9 && a < 12) ? `${a}` : a > 12 ? a - 12 > 9 ? `${a - 12}` : `0${a - 12}` : `0${a}`
		let m = String(b).length == 2 ? b : `0${b}`;
		let s = String(c).length == 2 ? c : `0${c}`

		return `${h}:${m}:${s}-${d}`;

	} else {

		let h = 0;
		let m = 0;
		let s = Math.floor(value / 1000)

		m = Math.floor(s / 60)
		s -= m * 60

		h = Math.floor(m / 60)
		m -= h * 60

		//return `${h ? h + ' Hour(s) ' : ''}${m ? m + ' Minute(s) ' : ''}${s ? s + ' Second(s) ' : ''}`

		h = h > 0 ? h < 10 ? "0" + h + ":" : h + ":" : null

		//if minutes are greater than 0, check to see if they are less than 10
		//if there is an hour we need to make it not display null
		m = m > 0 || h ? m < 10 ? "0" + m + ":" : m + ":" : null

		s = s < 10 ? "0" + s : s

		return `${h ? h : ""}${m ? m : ""}${s}`;

	}
}

/**
 * The function provides help documentation for a command line tool called "redesign.js".
 * @returns a console log message with instructions on how to use a command line tool called
 * "redesign.js". The message includes information on the required and optional arguments, as well as
 * special formats and overrides that can be used with the tool.
 */
function help() {

	return console.log(

		`------------- ${chalk.blue("REDESIGN HELP")} -------------\n` +
		`\n` +
		`Usage: ${chalk.blue("redesign.js")} [${chalk.blue("amount")}] [${chalk.blue("codec")}] \n` +
		`\n` +
		`Amount:\n` +
		`   Amount of media to convert at once.\n` +
		`\n`

	)

}

/* The Media class contains properties and methods for handling media files, including renaming and
setting file information. */
class Media {

	/**
	 * This is a constructor function that initializes various properties related to a file and video
	 * processing.
	 * @param {string} name - The name of the file being processed.
	 * @param {string} path - The path of the file being processed.
	 */
	constructor(name, path) {

		this.activity = "Waiting";
		this.name = name;
		this.path = path;

		this.file = {

			name: name,
			name_mod: "",
			name_new: "",
			ext: "",
			size: 0,
			new_size: 0,
			val_size: 0,
			path: path,
			path_new: "",
			show: "",
			series: "",
			season_number: 0,
			episode: []

		}

		this.video = {

			fps: 0,
			total_frames: 0,
			subtitle_map: "",
			width: "",
			height: "",
			ratio: "",
			converted_width: "",
			converted_height: "",
			converted_resolution: "",
			crop: "",
			crf: ""

		}

		this.working = {

			fps: 0,
			completed_frames: 0,
			quality: 0,
			bitrate: 0

		}

		this.started = 0;
		this.ended = 0;
		this.ffmpeg_argument = []

		this.process = false;

	}
	
	/**
	 * The function renames files based on their season and episode numbers and updates their file path
	 * and name.
	 */
	rename() {

		this.file.ext = this.file.name.match(/\.mkv|\.avi/)[0]
		this.file.name_mod = this.file.name.replace(this.file.ext, "")

		this.file.path = o.settings.working + "/" + this.file.name
		this.file.name_new = this.file.name_mod + ".mp4"

	}

}