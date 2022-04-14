const fs = require("fs");
const path = require("path")
const child = require('child_process');
const { exit } = require("process");

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
		quality: null,
		tune: null,
		amount: null,
		crop: null,
		start_beginning: null,
		trim: null,
		crf_override: null,
		use_bitrate: null,
		constrain_bitrate: null
	},
	settings: {
		working: process.cwd(),
		validate: "//192.168.0.12/T/",
		encoders: ["h264", "hevc", "nvenc"],
		tune_1: ["film", "grain"],
		tune_2: ["animate", "animation", "anime"],
		formats: {
			"2160p": {
				crf: 24,
				bitrate: 30,
				min: 30,
				max: 40,
				width: 3840,
				height: 2160,
				crop: "3840:1600",
				scale: "3840:2160"
			},
			"1440p": {
				crf: 24,
				bitrate: 20,
				min: 20,
				max: 27,
				width: 2560,
				height: 1440,
				crop: "2560:1068",
				scale: "2560:1440"
			},
			"1080p": {
				crf: 24,
				bitrate: 2.0,
				min: 1.6,
				max: 2.2,
				width: 1920,
				height: 1080,
				crop: "1920:800",
				scale: "1920:1080"
			},
			"1080pm": {
				crf: 24,
				bitrate: 2.0,
				min: 1.6,
				max: 2.2,
				width: 1920,
				height: 1080,
				crop: "1920:870",
				scale: "1920:1080"
			},
			"1080pn": {
				crf: 24,
				bitrate: 2.0,
				min: 1.6,
				max: 2.2,
				width: 1920,
				height: 1080,
				crop: "1920:960",
				scale: "1920:1080"
			},
			"720p": {
				crf: 22,
				bitrate: 1.4,
				min: 1.2,
				max: 1.8,
				width: 1280,
				height: 720,
				crop: "1280:534",
				scale: "1280:720"
			},
			"720pm": {
				crf: 22,
				bitrate: 1.4,
				min: 1.2,
				max: 1.8,
				width: 1280,
				height: 720,
				crop: "1280:580",
				scale: "1280:720"
			},
			"720pn": {
				crf: 22,
				bitrate: 1.4,
				min: 1.2,
				max: 1.8,
				width: 1280,
				height: 720,
				crop: "1280:640",
				scale: "1280:720"
			},
			"480p": {
				crf: 24,
				bitrate: 0.6,
				min: 0.4,
				max: 0.8,
				width: 854,
				height: 480,
				crop: "854:640",
				scale: "854:480"
			},
			"480pc": {
				crf: 24,
				bitrate: 0.6,
				min: 0.4,
				max: 0.8,
				width: 1138,
				height: 640,
				crop: "854:640",
				scale: "1138:640"
			}
		}
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
	},
	functions: {
		get_gcd: (width, height) => {

			let x = Math.abs(width);
			let y = Math.abs(height);

			while (y) { var t = y; y = x % y; x = t; }

			return x;

		},
		get_resolution: (media_height, media_width, new_width) => {

			let new_height = Math.ceil((media_height / media_width) * new_width)

			new_height = new_height % 2 == 0 ? new_height : new_height - 1

			return new_height

		}
	}
}

process.argv.forEach(arg => {

	if (/^[0-9]+p/.test(arg)) o.decision.quality = arg;

	if (o.settings.encoders.includes(arg)) o.decision.encoder = arg;
	if (o.settings.tune_1.includes(arg)) o.decision.tune = arg;
	if (o.settings.tune_2.includes(arg)) o.decision.tune = "animation";

	if (!isNaN(arg)) o.decision.amount = Number(arg);

	if (arg == "debug") o.debug.toggle = true;
	if (arg == "crop") o.decision.crop = true;

	if (arg.includes("-skip-beginning:")) o.decision.start_beginning = arg.replace("-skip-beginning:", "")
	if (arg.includes("-validate:")) o.settings.validate = arg.replace("-validate:", "")
	if (arg.includes("-crf:")) o.decision.crf_override = arg.replace("-crf:", "")
	if (arg.includes("-trim:")) o.decision.trim = arg.replace("-trim:", "")
	if (arg.includes("-bitrate")) o.decision.use_bitrate = true;
	if (arg.includes("-constrain")) o.decision.constrain_bitrate = true;
	if (arg.includes("-help")) o.decision.help = true;

})

if (o.decision.help) { help(); exit(); }

if (o.decision.quality && !o.settings.formats[o.decision.quality]) {

	if (o.decision.use_bitrate) {

		throw "You can not use a variable resolution with the bitrate flag.";

	}

	o.settings.formats[o.decision.quality] = {
		crf: 24,
		width: null,
		height: Number(o.decision.quality.replace(/pc|p/, "")),
		crop: null,
		scale: null
	}

	let custom = o.settings.formats[o.decision.quality]

	if (custom.height % 2 != 0) custom.height++

	custom.width = Math.ceil(custom.height * 1.777777777777778)

	if (custom.width % 2 != 0) custom.width++

	let adjusted = Math.ceil(custom.width / 2.4)

	if (adjusted % 2 != 0) adjusted++

	custom.crop = custom.width + ":" + adjusted
	custom.scale = custom.width + ":" + custom.height

}
else if (!o.decision.quality) {

	o.decision.quality = "720p"
	//console.log(process.argv); return console.log(chalk.red("Quality was not found.")); 

}

if (o.decision.crf_override) {

	o.settings.formats[o.decision.quality].crf = o.decision.crf_override

}

if (!o.decision.encoder) o.decision.encoder = "hevc";
if (!o.decision.amount) o.decision.amount = 1;
if (!o.decision.tune) o.decision.tune = "film"

if (o.debug.toggle) {

	debug_prefix = chalk.red("[DEBUG]")

	console.log(debug_prefix, chalk.red(" -- Starting Settings -- "))
	console.log(debug_prefix, chalk.blue("CWD:"), chalk.gray(o.settings.working))
	console.log(debug_prefix, chalk.blue("Validate:"), chalk.gray(o.settings.validate))
	console.log(debug_prefix, chalk.red(" -- Starting Settings -- "))
	console.log()
	console.log(debug_prefix, chalk.red(" -- Starting Decisions -- "))
	console.log(debug_prefix, chalk.blue("Quality:"), chalk.gray(o.decision.quality))
	console.log(debug_prefix, chalk.blue("Encoder:"), chalk.gray(o.decision.encoder))
	console.log(debug_prefix, chalk.blue("Tune:"), chalk.gray(o.decision.tune))
	console.log(debug_prefix, chalk.blue("Amount:"), chalk.gray(o.decision.amount))
	console.log(debug_prefix, chalk.blue("Crop:"), chalk.gray((o.decision.crop ? "YES" : "NO")))
	console.log(debug_prefix, chalk.blue("Start Beginning:"), chalk.gray(o.decision.start_beginning))
	console.log(debug_prefix, chalk.blue("Trim:"), chalk.gray(o.decision.trim))
	console.log(debug_prefix, chalk.blue("Use Bitrate:"), chalk.gray(o.decision.use_bitrate))
	console.log(debug_prefix, chalk.blue("Modified CRF:"), chalk.gray(o.decision.crf_override))
	console.log(debug_prefix, chalk.blue("Constrain Bitrate:"), chalk.gray(o.decision.constrain_bitrate))
	console.log(debug_prefix, chalk.blue("Working Dir:"), chalk.gray(o.settings.working))
	console.log(debug_prefix, chalk.blue("Validation Dir:"), chalk.gray(o.settings.validate))
	console.log(debug_prefix, chalk.red(" -- Starting Decisions -- "))

}

/*

Notes:

	* Have the media get put back into the array and just check if the key "ended" is not null in the next object of the array.
	* If the next item has the key, end the script as we have completed the full loop.

	* We will likely have to create our own sort function.

*/

main()

function main() {

	let directory = fs.readdirSync(o.settings.working)

	directory.forEach(file => {

		fs.stat(file, (err, stat) => {

			if (stat.isFile() && (file.includes(".mkv") || file.includes(".avi"))) {

				let media = new Media(file, o.settings.working + "/" + file)

				media.rename()

				media.file.size = stat.size;
				media.file.path_new = o.settings.working + "/" + media.file.name_new;

				if (o.debug.toggle) console.log(debug_prefix, chalk.red(" -- Media File -- "))
				if (o.debug.toggle) console.log(debug_prefix, chalk.blue("Media File:"), chalk.gray(file))

				if (o.debug.toggle) {

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
				if (media.file.name != file) fs.renameSync(`./${file}`, media.file.name)

				o.files.push(media)

			}

			else if (stat.isDirectory() && file.toLowerCase().includes("sub")) {


				if (o.debug.toggle) console.log(debug_prefix, chalk.blue("Subtitle:"), chalk.gray(file))

				fs.readdirSync(o.settings.working + "/" + file).forEach(subtitle => {

					if (/.idx|.sub/.test(subtitle)) {

						let media = new Media(subtitle, o.settings.working + "/" + file + "/" + subtitle)

						media.rename()

						if (o.debug.toggle) console.log(debug_prefix, chalk.blue("New Name:"), chalk.gray(media.file.name))

						fs.renameSync(o.settings.working + "/" + file + "/" + subtitle, o.settings.working + "/" + media.file.name)

					}

					else if (/.srt/.test(subtitle)) {

						let media = new Media(subtitle, o.settings.working + "/" + file + "/" + subtitle)

						media.rename()

						if (o.debug.toggle) console.log(debug_prefix, chalk.blue("New Name:"), chalk.gray(media.file.name))

						fs.renameSync(o.settings.working + "/" + file + "/" + subtitle, o.settings.working + "/" + media.file.name.replace(media.file.ext, "") + ".en" + media.file.ext)

					}


				})

			}

			if (path.extname(file) == ".txt" || path.extname(file) == ".nfo" || path.extname(file) == ".exe") fs.rmSync(file)

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
		let quality = `${ob + chalk.blue("RES") + cb} ${chalk.gray(o.decision.quality.toUpperCase())} `
		let tune = `${ob + chalk.blue("TUNE") + cb} ${chalk.gray(o.decision.tune.toUpperCase())} `
		let amount = `${ob + chalk.blue("AMOUNT") + cb} ${chalk.gray(o.decision.amount)} `
		let constrain = o.decision.constrain_bitrate ? ob + chalk.red("CONSTRAIN") + cb + " " : ""
		let debug = o.debug.toggle ? ob + chalk.red("DEBUG") + cb + " " : ""
		let crop = o.decision.crop ? ob + chalk.red("CROP") + cb + " " : ""

		if (!o.debug.toggle) {

			//Clear the current console output.
			console.clear();

			//Log the top line.
			console.log(`${t}${amount}${encoder}${running_encoder}${running_decoder}${tune}${quality}${crop}${constrain}${debug}\n`)

			//Get info for currently converting media.
			Object.keys(o.current).forEach((media, index) => {

				media = o.current[media]

				let file_name = `${ob + chalk.blue("FILE") + cb} ${chalk.gray(media.file.name_mod)}`

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

					process.title = `${f} ${a}${q}${b}${e}`

				}

				output.push(message)

			})

			//Get the other files in the queue.
			o.files.forEach(media => {

				let file_name = `${ob + chalk.blue("FILE") + cb} ${chalk.gray(media.file.name_mod)}`
				let activity = `${ob + chalk.blue("STATUS") + cb} ${chalk.gray(media.activity)}`

				if (media.activity == "Waiting") {

					let message = `${file_name} ${activity}`

					return output.push(message)

				}

				if (media.activity == "Finished" || media.activity.includes("Failed")) {

					let calculated = Math.floor(((media.file.size - media.file.new_size) / media.file.size) * 100)

					let ended = `${ob + chalk.blue("COMPLETION") + cb} ${chalk.gray(time(media.ended))}`
					let elapsed = `${ob + chalk.blue("ELAPSED") + cb} ${chalk.gray(time(media.ended - media.started, 1))}`
					let reduced = `${ob + chalk.blue("REDUCED") + cb} ${media.file.new_size ? chalk.gray(calculated + "%") : "???"}`

					let message = `${file_name} ${activity} ${reduced} ${ended} ${elapsed}`

					return output.push(message)

				}

			})

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

function overlook() {

	setInterval(() => {

		let current_amount = Object.keys(o.current).length

		//console.log(current_amount, o.decision.amount)

		if (current_amount < o.decision.amount) {

			/**
			 * @type {Media}
			 */
			let next = o.files.shift()

			if (!next || next.activity == "Validated" || next.activity.includes("Failed") || next.activity == "Finished") {

				if (current_amount == 0) process.exit()

			}
			else {

				next.activity = "Statistics"
				next.started = new Date().getTime()

				o.current[next.file.name_mod] = next

			}

		}

		if (current_amount > o.decision.amount) {

			console.error("CURRENT TRANSCODES ARE GREATER THAN THE ALLOWED AMOUNT.")
			console.error("CURRENT ALLOWED AMOUNT: " + o.decision.amount)
			console.error("CURRENT QUEUE:")
			Object.keys(o.current).forEach(media => console.error("CURRENT FILE: " + o.current[media].file_mod))
			process.exit()

		}

		Object.keys(o.current).forEach(file => {

			/**
			 * @type {Media}
			 */
			let media = o.current[file]

			if (!media.process) {

				if (media.activity.includes("Statistics")) spawnStatisticsInstance(media)
				//if (media.activity.includes("Extracting")) spawnExtractionInstance(media)
				if (media.activity.includes("Converting")) spawnConversionInstance(media)
				if (media.activity.includes("Validating")) spawnValidationInstance(media)

			}

			if (media.activity == "Finished" || media.activity.includes("Failed")) {

				media.ended = new Date().getTime()

				o.files.push(media)

				delete o.current[media.file.name_mod]

			}

		})

	}, 500);

}

/**
 * @param {Media} media
 */
function spawnStatisticsInstance(media) {

	media.process = true

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
						if (!fs.existsSync(`./${media.file.show} Season ${media.file.season_number}`)) fs.mkdirSync(`./${media.file.show} Season ${media.file.season_number}`)

					}
					else throw ("Unknown subtitle: " + line)
					//if (line.match(/(?<=stream #)(.*)(?=\(eng\))/gm) != undefined) media.video.subtitle_map = line.match(/(?<=stream #)(.*)(?=\(eng\))/gm)[0]
					//else throw new Error(`[ERROR] Subtitle was found but no mapping could be obtained: ${line}`)

				}
			})

		} else media.video.use_subtitle = false;

		if (/(?=.*[A-a]ttachment: )(.*)(?=)/gm.test(data)) {

			if (media.video.use_subtitle && media.video.use_subtitle == "mov") media.video.use_subtitle = "ass"

			media.file.path_new = o.settings.working + `/${media.file.show} Season ${media.file.season_number}/` + media.file.name
			if (!fs.existsSync(`./${media.file.show} Season ${media.file.season_number}`)) fs.mkdirSync(`./${media.file.show} Season ${media.file.season_number}`)

		}

		let gcd = o.functions.get_gcd(media.video.width, media.video.height)

		media.video.ratio = `${media.video.width / gcd}:${media.video.height / gcd}`

		media.video.crf = String(o.settings.formats[o.decision.quality].crf)
		media.video.bitrate = o.settings.formats[o.decision.quality].bitrate
		media.video.bufsize = o.settings.formats[o.decision.quality].bitrate * 2
		media.video.max = o.settings.formats[o.decision.quality].max
		media.video.min = o.settings.formats[o.decision.quality].min

		media.video.converted_width = String(o.settings.formats[o.decision.quality].width)
		media.video.converted_height = String(o.functions.get_resolution(media.video.height, media.video.width, media.video.converted_width))
		media.video.converted_resolution = media.video.converted_width + ":" + media.video.converted_height
		media.video.crop = o.settings.formats[o.decision.quality].crop

		//media.activity = "Extracting"
		media.activity = "Converting"
		media.process = false

	})

}

/**
 * @param {Media} media
 */
function spawnConversionInstance(media) {

	media.process = true

	assemble()

	function assemble(encFallback, decFallback) {

		//Do better logging to display what encoder and decoder we are using. 
		//This will be displayed in the top bar with the time and other information. 

		let codec;

		decFallback ? o.decision.running_decoder = "CPU" : o.decision.running_decoder = "GPU"
		!encFallback && o.decision.encoder == "nvenc" ? o.decision.running_encoder = "GPU" : o.decision.running_encoder = "CPU"

		media.activity = `Converting`

		if (!encFallback && o.decision.encoder == "nvenc") { codec = 'hevc_nvenc' }
		else if ((encFallback && o.decision.encoder == "nvenc") || o.decision.encoder == "hevc") { codec = 'libx265' }
		else { codec = 'h264' }

		media.ffmpeg_argument = []

		media.ffmpeg_argument.push('-hide_banner')

		media.ffmpeg_argument.push("-threads")
		media.ffmpeg_argument.push("4")

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
		media.ffmpeg_argument.push("-vcodec")
		media.ffmpeg_argument.push(codec)

		media.ffmpeg_argument.push("-preset")
		media.ffmpeg_argument.push("slow")

		media.ffmpeg_argument.push("-level")
		media.ffmpeg_argument.push("4.1")

		if (o.decision.use_bitrate) {

			media.ffmpeg_argument.push("-b:v")
			media.ffmpeg_argument.push(`${media.video.bitrate}M`)
			media.ffmpeg_argument.push("-bufsize")
			media.ffmpeg_argument.push(`${media.video.bufsize}M`)
			media.ffmpeg_argument.push("-maxrate")
			media.ffmpeg_argument.push(`${media.video.max}M`)
			media.ffmpeg_argument.push("-minrate")
			media.ffmpeg_argument.push(`${media.video.min}M`)

		}

		else if (o.decision.constrain_bitrate) {

			media.ffmpeg_argument.push("-crf")
			media.ffmpeg_argument.push(media.video.crf)
			media.ffmpeg_argument.push("-bufsize")
			media.ffmpeg_argument.push(`${media.video.bufsize}M`)
			media.ffmpeg_argument.push("-maxrate")
			media.ffmpeg_argument.push(`${media.video.max}M`)

		}

		else {

			media.ffmpeg_argument.push("-crf")
			media.ffmpeg_argument.push(media.video.crf)

		}

		//Set audio codec
		media.ffmpeg_argument.push("-c:a")
		media.ffmpeg_argument.push("aac")

		media.ffmpeg_argument.push("-ac")
		media.ffmpeg_argument.push("2")

		media.ffmpeg_argument.push("-vf")
		media.ffmpeg_argument.push(`scale=${media.video.converted_resolution}:flags=lanczos${o.decision.crop ? ",crop=" + media.video.crop : ""}`)

		//Skip x from beginning
		if (o.decision.start_beginning) media.ffmpeg_argument.push("-ss")
		if (o.decision.start_beginning) media.ffmpeg_argument.push(o.decision.start_beginning)

		//Trim from x to x
		if (o.decision.trim) media.ffmpeg_argument.push("-ss")
		if (o.decision.trim) media.ffmpeg_argument.push(o.decision.trim.split(",")[0])
		if (o.decision.trim) media.ffmpeg_argument.push("-to")
		if (o.decision.trim) media.ffmpeg_argument.push(o.decision.trim.split(",")[1])

		//Subtitle decision
		if (media.video.use_subtitle) media.ffmpeg_argument.push('-c:s')
		if (media.video.use_subtitle) media.ffmpeg_argument.push(`${media.video.use_subtitle == 'mov' ? 'mov_text' : 'copy'}`)

		//Tune decision
		if (!(o.decision.tune == "film" && (codec == "libx265" || codec == "hevc_nvenc"))) media.ffmpeg_argument.push("-tune")
		if (!(o.decision.tune == "film" && (codec == "libx265" || codec == "hevc_nvenc"))) media.ffmpeg_argument.push(o.decision.tune)

		//Overwrite
		media.ffmpeg_argument.push(encFallback || decFallback ? "-y" : "-n")

		//Write
		media.ffmpeg_argument.push(media.file.path_new)

		convert()

	}

	function convert() {

		o.stopValidateOnCodecFail = false;

		let encode = child.spawn('ffmpeg', media.ffmpeg_argument, { encoding: 'UTF-8', windowsHide: true, shell: false })

		encode.on('error', function (err) { obj.convert.files[key].processing = "Failed - Ffmpeg Missing"; })

		if (o.debug.convert.file) console.log(media)

		encode.stderr.on('data', (data) => {

			data = data.toString()

			if (o.debug.convert.data) console.log(data)

			if (/openencodesessionex failed: out of memory/ig.test(data) || /no capable devices found/ig.test(data)) {

				encode.kill()

				o.stopValidateOnCodecFail = true;

				setTimeout(() => { return assemble(true) }, 500);

			}
			else if (/cannot load nvcuda.dll/ig.test(data) || /device type cuda needed for codec/ig.test(data)) {

				encode.kill()

				o.stopValidateOnCodecFail = true;

				setTimeout(() => { return assemble(true, true) }, 500);

			}
			else if (/already exists/ig.test(data)) {

				media.activity = "Validating"
				media.process = false

			}
			else {
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

				if (!o.stopValidateOnCodecFail) {

					media.activity = "Validating";

					media.process = false

				}

			}

		})

	}

}

/**
 * @param {Media} media
 */
function spawnValidationInstance(media) {

	media.process = true

	if (!fs.existsSync(o.settings.validate + 'Testing')) fs.mkdirSync(o.settings.validate + 'Testing')

	let validate = child.spawn('ffmpeg', ['-hide_banner', '-i', `${media.file.path_new}`, '-c:v', 'copy', '-c:a', 'copy', o.settings.validate + `Testing/${media.file.name_new}`, '-y'], { encoding: 'UTF-8', windowsHide: true, shell: false })

	validate.on('error', function (err) { media.activity = "Failed - Ffmpeg Missing"; })

	validate.stderr.on('data', (data) => {

		data = data.toString()

		if (o.debug.validate.data) console.log(data)
		if (o.debug.validate.file) console.log(media)

		if (/(?<=frame=)(.*)(?=fps)/g.test(data)) {

			let quality = data.match(/(?<=q=)(.*?)(?= )/g)
			let bitrate = data.match(/(?<=bitrate=)(.*?)(?=kbits\/s)/g)
			let size = data.match(/(?<=size=)(.*?)(?=kb)/ig)

			quality = quality ? quality[0].trim() : 0
			bitrate = bitrate ? bitrate[0].trim() : 0
			size = size ? size[0].trim() : 0

			media.file.val_size = Number(size) * 1000

			media.working.completed_frames = data.match(/(?<=frame=)(.*)(?=fps)/g)[0].trim() * 1000
			media.working.fps = data.match(/(?<=fps=)(.*)(?= q)/g)[0]
			media.working.quality = quality
			media.working.bitrate = bitrate


		}

		if (/corrupt/ig.test(data) || /invalid data found/ig.test(data)) {

			media.activity = "Failed - File Corrupt";

			if (media.video.use_subtitle == 'hdmv') {
				if (fs.existsSync(o.settings.validate + `Testing/${media.file.name}`)) fs.unlinkSync(o.settings.validate + `Testing/${media.file.name}`)
			}
			else if (fs.existsSync(o.settings.validate + `Testing/${media.file.name_new}`)) fs.unlinkSync(o.settings.validate + `Testing/${media.file.name_new}`)

			validate.kill()

		}

		else if (/invalid argument/ig.test(data)) {

			media.activity = "Failed - FFmpeg Arguments Invalid";

			if (media.video.use_subtitle == 'hdmv') {
				if (fs.existsSync(o.settings.validate + `Testing/${media.file.name}`)) fs.unlinkSync(o.settings.validate + `Testing/${media.file.name}`)
			}
			else if (fs.existsSync(o.settings.validate + `Testing/${media.file.name_new}`)) fs.unlinkSync(o.settings.validate + `Testing/${media.file.name_new}`)

			validate.kill()

		}
	})

	validate.on('exit', (code) => {

		if (fs.existsSync(o.settings.validate + `Testing/${media.file.name_new}`)) fs.unlinkSync(o.settings.validate + `Testing/${media.file.name_new}`)

		if (code != null) media.activity = "Finished";

	})

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

function help() {

	return console.log(

		`------------- ${chalk.blue("REDESIGN HELP")} -------------\n` +
		`\n` +
		`Usage: ${chalk.blue("redesign.js")} [${chalk.blue("resolution")}] [${chalk.blue("amount")}] [${chalk.blue("codec")}] [${chalk.blue("tune")}] [${chalk.blue("overrides")}]\n` +
		`\n` +
		`Resolution:\n` +
		`   One of the pre-configured resolutons [` +
		`${chalk.blue("2160p")}, ${chalk.blue("1440p")}, ${chalk.blue("1080pn")}, ${chalk.blue("720p")}, ${chalk.blue("480p")}` +
		`] (must include the p)\n` +
		`\n` +
		`   Special Formats:\n` +
		`      ${chalk.blue("1080pn")} - Netflix cropping (${chalk.blue("2:1")})\n` +
		`      ${chalk.blue("720pn")}  - Netflix cropping (${chalk.blue("2:1")})\n` +
		`      ${chalk.blue("1080pm")} - Marvel cropping  (${chalk.blue("64:29")})\n` +
		`      ${chalk.blue("720pm")}  - Marvel cropping  (${chalk.blue("64:29")})\n` +
		`      ${chalk.blue("480pc")}  - NTSC cropping    (${chalk.blue("32:27")})\n` +
		`\n` +
		`Amount:\n` +
		`   Amount of media to convert at once.\n` +
		`\n` +
		`Codec:\n` +
		`   One of the pre-configured codecs [${chalk.blue("hevc")}, ${chalk.blue("nvenc")}, ${chalk.blue("h264")}]\n` +
		`\n` +
		`Tune:\n` +
		`   One of the ffmpeg tune profiles [${chalk.blue("film")}, ${chalk.blue("animaton")}, ${chalk.blue("grain")}]\n` +
		`\n` +
		`Overrides:` +
		`\n` +
		`   ${chalk.blue("-bitrate")}[${chalk.blue("mbps")}]  - Use bitrates instead of CRF. You can only use defined resolutions with this flag.\n` +
		`   ${chalk.blue("-constrain")}  - Force the encoder to use a max bitrate with CRF.\n` +
		`   ${chalk.blue("-skip-beginning:")}[${chalk.blue("hh:mm:ss")}]  - Skip the beginning by specified amount of time.\n` +
		`   ${chalk.blue("-crf:")}[${chalk.blue("crf")}]  - Override the CRF value for the current media.\n` +
		`   ${chalk.blue("-validate:")}[${chalk.blue("dir")}]  - Override the validation directory\n` +
		`   ${chalk.blue("-trim:")}[${chalk.blue("hh:mm:ss,hh:mm:ss")}]   - Trim the media.\n`

	)

}

class Media {

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

	rename() {

		if (/(s\d{2})((e|-e|.e)([0-9]+))+|\d{2}(x([0-9]+))+/ig.test(this.file.name)) {

			let season = this.file.name.match(/(s\d{2})((e|-e|.e)([0-9]+))+|\d{2}(x([0-9]+))+/ig)[0]
			let built;

			if (/\d{2}(x([0-9]+))+/.test(season)) {

				season = season.replace(/x/ig, 'e')

				season = "s" + season

			}

			season = season.replace(/\.|-/g, '')
				.replace(/s/ig, 's')
				.replace(/e/ig, 'e')
				.trim()

			this.file.series = season.match(/S[0-9]+(?=E)/ig)[0]

			this.file.season_number = Number(this.file.series.replace("s", ""))

			season.substr(season.split(/e/i)[0].length + 1).split(/e/i).forEach((episode, i) => {

				this.file.episode.push(episode)

				if (i == 0) built = `${this.file.series}e${episode}`
				else built += `-e${episode}`

			})

			this.file.show = this.file.name.replace(/\./g, ' ')
				.match(/(.*)(?=(s\d{2})((e|-e|.e)([0-9]+))+|\d{2}(x([0-9]+))+)/ig, '')[0]
				.replace(/\[/g, '').trim()
				.replace(/-/g, '').trim()

			this.file.ext = this.file.name.match(/.srt|.mkv|.avi|.idx|.sub/)[0]

			this.file.name = `${this.file.show.replace('-', '')} - ${built}${this.file.ext}`
			this.file.name_mod = `${this.file.show.replace('-', '')} - ${built}`

		} else {

			this.file.ext = this.file.name.match(/.srt|.mkv|.avi|.idx|.sub/)[0]
			this.file.name_mod = this.file.name.replace(this.file.ext, "")

		}

		this.file.path = o.settings.working + "/" + this.file.name
		this.file.name_new = this.file.name_mod + ".mp4"

	}

}