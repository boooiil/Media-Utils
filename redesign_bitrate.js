const fs = require("fs");
const path = require("path");
const child = require('child_process');

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
		quality: null,
		tune: null,
		amount: null,
        crop: null
	},
	settings: {
		working: process.cwd(),
		validate: "T://",
		encoders: ["h264", "hevc", "nvenc"],
		tune_1: ["film", "grain"],
		tune_2: ["animate", "animation", "anime"],
		formats: {
			"2160p": {
				bitrate: 30,
				min: 30,
				max: 40,
				width: 3840,
				height: 2160,
				crop: "3840:1600",
				scale: "3840:2160"
			},
			"1440p": {
				bitrate: 20,
				min: 20,
				max: 27,
				width: 2560,
				height: 1440,
				crop: "2560:1068",
				scale: "2560:1440"
			},
			"1080p": {
				bitrate: 2.0,
				min: 1.6,
				max: 2.2,
				width: 1920,
				height: 1080,
				crop: "1920:800",
				scale: "1920:1080"
			},
			"720p": {
				bitrate: 1.4,
				min: 1.2,
				max: 1.8,
				width: 1280,
				height: 720,
				crop: "1280:534",
				scale: "1280:720"
			},
			"480p": {
				bitrate: 0.6,
				min: 0.4,
				max: 0.8,
				width: 854,
				height: 480,
				crop: "854:356",
				scale: "854:480"
			},
			"480pc": {
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

	if (o.settings.formats[arg]) o.decision.quality = arg;
	if (o.settings.encoders.includes(arg)) o.decision.encoder = arg;
	if (o.settings.tune_1.includes(arg)) o.decision.tune = arg;
	if (o.settings.tune_2.includes(arg)) o.decision.tune = "animation";
	if (!isNaN(arg)) o.decision.amount = Number(arg);
	if (arg == "debug") o.debug.toggle = true;
	if (arg == "crop") o.decision.crop = true;
	if (arg.includes("-validate:")) o.settings.validate = arg.match(/(?<=-validate:)(.*?)(?=$)/g)

})

if (!o.decision.quality) { console.log(process.argv); return console.log(chalk.red("Quality was not found.")); }
if (!o.decision.encoder) o.decision.encoder = "hevc";
if (!o.decision.amount) o.decision.amount = 1;
if (!o.decision.tune) o.decision.tune = "film"

/*

Media Object:

{

	activity: (current activity valid: [WAITING, EXTRACTING, CONVERTING, VALIDATING, VALIDATED, FINISHED, FAILED]),
	file: {
		name: (file name with ext),
		name_mod: (file name without ext),
		ext: (file ext),
		path: (full path to file),
		series: (numerical value showing the file's intended series)
		episode: (numerical value showing the file's intended episode)
	},
	video: {
		fps: (fps of the file),
		total_frames: (total frames of the file),
		subtitle_map: (map of the file's english subtitle),
		width: (width of the video),
		height: (height of the video),
		ratio: (ratio of the video) 
		converted_width: o.settings.quality[o.decision.quality].width,
		converted_height: o.functions.get_resolution(this.video.height, this.video.width, this.video.converted_width)
		crf: o.settings.quality[o.decision.quality].crf
	},
	working: {
		fps: (fps rate of conversion),
		completed_frames: (amount of completed frames),
		quality: (current crf quality),
		bitrate: (current bitrate)
	}
	started: (epoch since start),
	ended: (epoch since end),
	ffmpeg_argument: (compiled ffmpeg argument to convert the video)

}

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

			if (stat.isFile && file.includes(".mkv")) {

				let name = rename(file)

				let object = {
					activity: "Waiting",
					file: {
						name: name.rename,
						name_mod: name.rename.replace(".mkv", ""),
						name_new: name.rename.replace(".mkv", ".mp4"),
						ext: ".mkv",
						size: stat.size,
						new_size: null,
						val_size: null,
						path: o.settings.working + "/" + name.rename,
						path_new: o.settings.working + "/" + name.rename.replace(".mkv", ".mp4"),
						series: name.series,
						episode: name.episode
					}
				}

				if (name.rename != file) fs.renameSync(`./${file}`, name.rename)

				o.files.push(object)

			}

			else if (stat.isDirectory() && file.toLowerCase().includes("sub")) {

				fs.readdirSync(o.settings.working + "/" + file).forEach(file1 => {

					if (/.idx|.sub/.test(file1)) {

						let name = rename(file1)

						fs.renameSync(o.settings.working + "/" + file + "/" + file1, o.settings.working + "/" + name.rename)

					}

					else if (/.srt/.test(file1)) {

						let name = rename(file1)

						fs.renameSync(o.settings.working + "/" + file + "/" + file1, o.settings.working + "/" + name.rename.replace(name.ext, "") + ".en" + name.ext)

					}


				})

			}

			if (path.extname(file) == ".txt" || path.extname(file) == ".nfo") fs.rmSync(file)

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

		let open_bracket = chalk.gray("[")
		let close_bracket = chalk.gray("]")
		let t = `${open_bracket + chalk.blue("TIME") + close_bracket} ${chalk.gray(time())}`
		let encoder = `${open_bracket + chalk.blue("TARGET ENC") + close_bracket} ${chalk.gray(o.decision.encoder.toUpperCase())}`
		let quality = `${open_bracket + chalk.blue("QUALITY") + close_bracket} ${chalk.gray(o.decision.quality.toUpperCase())}`
		let tune = `${open_bracket + chalk.blue("TUNE") + close_bracket} ${chalk.gray(o.decision.tune.toUpperCase())}`
		let amount = `${open_bracket + chalk.blue("AMOUNT") + close_bracket} ${chalk.gray(o.decision.amount)}`
		let debug = o.debug.toggle ? open_bracket + chalk.red("DEBUG") + close_bracket : ""
		let crop = o.decision.crop ? open_bracket + chalk.red("CROP") + close_bracket : ""

		if (!o.debug.toggle) {

			//Clear the current console output.
			console.clear();

			//Log the top line.
			console.log(`${t} ${amount} ${encoder} ${tune} ${quality} ${crop} ${debug}`)

			//Get info for currently converting media.
			Object.keys(o.current).forEach((media, index) => {

				media = o.current[media]

				let file_name = `${open_bracket + chalk.blue("FILE") + close_bracket} ${chalk.gray(media.file.name_mod)}`

				let total_frames = media.video.total_frames

				let completed_frames = media.working.completed_frames
				let fps = media.working.fps
				let bitrate = `${open_bracket + chalk.blue("BITRATE") + close_bracket} ${chalk.gray(media.working.bitrate)}`
				let cq = `${open_bracket + chalk.blue("QUALITY") + close_bracket} ${chalk.gray(media.working.quality)}`
				let eta = `${open_bracket + chalk.blue("ETA") + close_bracket} ${chalk.gray(time(Math.ceil((total_frames - completed_frames) / fps), 1))}`

				let activity = `${open_bracket + chalk.blue("ACTIVITY") + close_bracket} ${chalk.gray(media.activity)}`
				let started = `${open_bracket + chalk.blue("ISSUED") + close_bracket} ${chalk.gray(time(media.started))}`

				let percent = `${open_bracket + chalk.blue("PERCENT") + close_bracket} ${chalk.gray(Math.ceil((completed_frames / total_frames) * 100) + "%")}`

				let message = `${file_name} ${activity} ${started} ${percent} ${cq} ${bitrate} ${eta} `

				if (index == 0) {

					let a = `| ACT: ${media.activity} `
					let b = `| BIT: ${media.working.bitrate} `
					let e = `| ETA: ${time(Math.ceil((total_frames - completed_frames) / fps), 1)} `
					let f = media.file.name_mod
					let p = `| PCT: ${Math.ceil((completed_frames / total_frames) * 100)}% `
					let q = `| QLT: ${media.working.quality} `

					process.title = `${f} ${a}${q}${b}${e}`

				}

				output.push(message)

			})

			//Get the other files in the queue.
			o.files.forEach(media => {

				let file_name = `${open_bracket + chalk.blue("FILE") + close_bracket} ${chalk.gray(media.file.name_mod)}`
				let activity = `${open_bracket + chalk.blue("STATUS") + close_bracket} ${chalk.gray(media.activity)}`

				if (media.activity == "Waiting") {

					let message = `${file_name} ${activity}`

					return output.push(message)

				}

				if (media.activity == "Finished" || media.activity.includes("Failed")) {

					let calculated = Math.floor(((media.file.size - media.file.new_size) / media.file.size) * 100)

					let ended = `${open_bracket + chalk.blue("COMPLETION") + close_bracket} ${chalk.gray(time(media.ended))}`
					let elapsed = `${open_bracket + chalk.blue("ELAPSED") + close_bracket} ${chalk.gray(time(media.ended - media.started, 1))}`
					let reduced = `${open_bracket + chalk.blue("REDUCED") + close_bracket} ${media.file.new_size ? chalk.gray(calculated + "%") : "???"}`

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
			o.debug.stats.data = false;
			o.debug.stats.file = false;

			//CONVERT
			o.debug.convert.data = true;
			o.debug.convert.file = true;

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

			let next = o.files[0]

			if (next.activity == "Validated" || next.activity.includes("Failed") || next.activity == "Finished") {

				if (current_amount == 0) process.exit()

			}
			else {

				let media = {

					activity: "Statistics",

					file: {

						name: next.file.name,
						name_mod: next.file.name_mod,
						name_new: next.file.name_new,
						ext: next.file.ext,
						size: next.file.size,
						new_size: next.file.new_size,
						val_size: next.file.val_size,
						path: next.file.path,
						path_new: next.file.path_new,
						series: next.file.series,
						episode: next.file.episode

					},

					video: {

						fps: null,
						total_frames: null,
						use_subtitle: null,
						width: null,
						height: null,
						resolution: null,
						ratio: null,
						converted_width: null,
						converted_height: null,
						converted_resolution: null,
						crop: null,
						bitrate: null,
						bufsize: null,
						max: null,
						min: null

					},

					working: {

						fps: 0,
						completed_frames: 0,
						quality: 0,
						bitrate: 0

					},

					started: new Date().getTime(),
					ended: null,
					ffmpeg_argument: null,
					process: null
				}

				o.current[next.file.name_mod] = media

				o.files.shift()

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

			let media = o.current[file]

			if (!media.process) {

				if (media.activity.includes("Statistics")) spawnStatisticsInstance(media)
				//if (media.activity.includes("Extracting")) spawnExtractionInstance(media)
				if (media.activity.includes("Converting")) spawnConversionInstance(media)
				if (media.activity.includes("Validating")) spawnValidationInstance(media)

			}

			if (media.activity == "Finished" || media.activity.includes("Failed")) {

				let object = {

					activity: media.activity,

					file: {
						name: media.file.name,
						name_mod: media.file.name_mod,
						ext: media.file.ext,
						size: media.file.size,
						new_size: media.file.new_size,
						val_size: media.file.val_size,
						path: media.file.path,
						series: media.file.series,
						episode: media.file.episode
					},

					started: media.started,
					ended: new Date().getTime()
				}

				o.files.push(object)

				delete o.current[media.file.name_mod]

			}

		})

	}, 500);

}

/**
 * @param {Object} media
 * @param {String} media.activity - Current activity of the media.
 * @param {Object} media.file
 * @param {String} media.file.name - Name of the file with extension.
 * @param {String} media.file.name_mod - Name of the file without extension.
 * @param {String} media.file.ext - Extension of the file.
 * @param {String} media.file.path - Absolute path of the file.
 * @param {String} media.file.series - Series obtained from file name.
 * @param {String} media.file.episode - Episode obtained from file name.
 * @param {String} media.file.path_new - New absolute path of the file.
 * @param {Object} media.video
 * @param {Number} media.video.fps - Current media frames per second.
 * @param {Number} media.video.total_frames - Total amount of frames from the file.
 * @param {String=} media.video.subtitle_map - Subtitle map obtained from statistics.
 * @param {String} media.video.width - Current media width.
 * @param {String} media.video.height - Current media height.
 * @param {String} media.video.ratio - Aspect ratio of the current media.
 * @param {String} media.video.converted_width - Calculated width using the new resolution.
 * @param {String} media.video.converted_height - Calculated height using the new resolution.
 * @param {String} media.video.converted_resolution - Calculated resolution using the new height and width.
 * @param {String} media.video.crop - Adjusted crop based on resolution decision.
 * @param {String} media.video.crf - Quality target determined by presets.
 * @param {Object} media.working
 * @param {Number} media.working.fps - Current processed frames per second.
 * @param {Number} media.working.completed_frames - Amount of completed frames since the start of conversion.
 * @param {Number} media.working.quality - Current quality factor determined by ffmpeg.
 * @param {Number} media.working.bitrate - Average bitrate of processed frames.
 * @param {Number} media.started - Epoch of when the media started.
 * @param {Number} media.ended - Epoch of when the media ended.
 * @param {String[]} media.ffmpeg_argument - Array of ffmpeg arguments.
 */
function spawnStatisticsInstance(media) {

	media.process = true

	child.exec(`ffprobe -hide_banner -i "${media.file.path}"`, { encoding: 'UTF-8', windowsHide: true, shell: false }, (err, stdout, data) => {

		if (err) { console.log(o.current); throw err; }

		data = data.toString().trim()

		if (o.debug.stats.data) console.log(data)
		if (o.debug.stats.file) console.log(media)

		if (data.match(/(?<=, )(([0-9]+[0-9]+)|([0-9]+\.[0-9]+))(?= fps)/gm)) media.video.fps = data.match(/(?<=, )(([0-9]+[0-9]+)|([0-9]+\.[0-9]+))(?= fps)/gm)[0]
		else media.video.fps = null


		if (data.match(/(?<=NUMBER_OF_FRAMES: )(.*)(?=$)/gm) != null) media.video.total_frames = data.match(/(?<=NUMBER_OF_FRAMES: )(.*)(?=$)/gm)[0] * 1000;
		else if (data.match(/(?<=NUMBER_OF_FRAMES-eng: )(.*)(?=$)/gm) != null) media.video.total_frames = data.match(/(?<=NUMBER_OF_FRAMES-eng: )(.*)(?=$)/gm)[0] * 1000;
		else if (data.match(/(?<=Duration: )(.*?)(?=,)/gm) != null) {



			let t = data.match(/(?<=Duration: )(.*?)(?=,)/gm)[0];

			t = t.split(':'); t = (Number(t[0]) * 60 * 60) + (Number(t[1]) * 60) + Number(t[2])

			if (t && media.video.fps) media.video.total_frames = Math.ceil(t * media.video.fps) * 1000

		}

		if (data.trim().match(/(?<=, )(([0-9]+x[0-9]+))(?=)/gm) != null) {

			let resolution = data.match(/(?<=, )(([0-9]+x[0-9]+))(?=)/gm)[0].split('x')

			media.video.height = resolution[1]
			media.video.width = resolution[0]
			media.video.resolution = media.video.width + ":" + media.video.height

		} else throw new Error('Could not find resolution: \n' + data);

		if (data.match(/(?=.*\(eng\): )(.*)(?<=)/gm)) {

			data.match(/(?=.*\(eng\): )(.*)(?<=)/gm).forEach(line => {

				line = line.toLowerCase()

				if (line.includes('subtitle')) {

					if (line.includes('subrip') || line.includes("ass") || line.includes("mov_text")) media.video.use_subtitle = 'mov'
					else if (line.includes('dvd_sub')) media.video.use_subtitle = 'dvd'
					else if (line.includes('hdmv_pgs_subtitle')) {

						media.video.use_subtitle = 'hdmv'
						media.file.path_new = o.settings.working + "/Converted/" + media.file.name
						if (!fs.existsSync("./Converted")) fs.mkdirSync("./Converted")


					}
					else throw ("Unknown subtitle: " + line)
					//if (line.match(/(?<=stream #)(.*)(?=\(eng\))/gm) != undefined) media.video.subtitle_map = line.match(/(?<=stream #)(.*)(?=\(eng\))/gm)[0]
					//else throw new Error(`[ERROR] Subtitle was found but no mapping could be obtained: ${line}`)

				}
			})

		} else media.video.use_subtitle = false;

		let gcd = o.functions.get_gcd(media.video.width, media.video.height)

		media.video.ratio = `${media.video.width / gcd}:${media.video.height / gcd}`
		media.video.bitrate = String(o.settings.formats[o.decision.quality].bitrate)
		media.video.bufsize = media.video.bitrate * 2
		media.video.max = String(o.settings.formats[o.decision.quality].max)
		media.video.min = String(o.settings.formats[o.decision.quality].min)
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
 * @param {Object} media
 * @param {String} media.activity - Current activity of the media.
 * @param {Object} media.file
 * @param {String} media.file.name - Name of the file with extension.
 * @param {String} media.file.name_mod - Name of the file without extension.
 * @param {String} media.file.ext - Extension of the file.
 * @param {String} media.file.path - Absolute path of the file.
 * @param {String} media.file.series - Series obtained from file name.
 * @param {String} media.file.episode - Episode obtained from file name.
 * @param {Object} media.video
 * @param {Number} media.video.fps - Current media frames per second.
 * @param {Number} media.video.total_frames - Total amount of frames from the file.
 * @param {String=} media.video.subtitle_map - Subtitle map obtained from statistics.
 * @param {String} media.video.width - Current media width.
 * @param {String} media.video.height - Current media height.
 * @param {String} media.video.ratio - Aspect ratio of the current media.
 * @param {String} media.video.converted_width - Calculated width using the new resolution.
 * @param {String} media.video.converted_height - Calculated height using the new resolution.
 * @param {String} media.video.converted_resolution - Calculated resolution using the new height and width.
 * @param {String} media.video.crop - Adjusted crop based on resolution decision.
 * @param {String} media.video.crf - Quality target determined by presets.
 * @param {Object} media.working
 * @param {Number} media.working.fps - Current processed frames per second.
 * @param {Number} media.working.completed_frames - Amount of completed frames since the start of conversion.
 * @param {Number} media.working.quality - Current quality factor determined by ffmpeg.
 * @param {Number} media.working.bitrate - Average bitrate of processed frames.
 * @param {Number} media.started - Epoch of when the media started.
 * @param {Number} media.ended - Epoch of when the media ended.
 * @param {String[]} media.ffmpeg_argument - Array of ffmpeg arguments.
 */
function spawnConversionInstance(media) {

	media.process = true

	assemble()

	function assemble(encFallback, decFallback) {

		//Do better logging to display what encoder and decoder we are using. 
		//This will be displayed in the top bar with the time and other information. 

		let codec;

		if (!encFallback && o.decision.encoder == "nvenc") { media.activity = "Converting (GPU)"; codec = 'hevc_nvenc' }
		else if ((encFallback && o.decision.encoder == "nvenc") || o.decision.encoder == "hevc") { media.activity = "Converting (CPU)"; codec = 'libx265' }
		else { media.activity = "Converting (CPU - H264)"; codec = 'h264' }

		if (decFallback) {

			if (o.decision.tune == "film" && codec == "libx265") {

				media.ffmpeg_argument = [
					`-threads`, `4`,
					`-i`, `${media.file.path}`,
					`-map`, `0:v:0`,
					`-map`, `0:a?`,
					`-map`, `0:s?`,
					`-vcodec`, `${codec}`,
					`-preset`, `slow`,
					`-level`, `4.1`,
					`-b:v`, `${media.video.bitrate}M`,
					`-bufsize`, `${media.video.bufsize}M`,
					`-maxrate`, `${media.video.max}M`,
					`-minrate`, `${media.video.min}M`,
					`-c:a`, `aac`,
					`-b:a`, `128k`,
					`-ac`, `2`,
					`-vf`, `scale=${media.video.converted_resolution}:flags=lanczos${o.decision.crop ? ",crop=" + media.video.crop : ""}`,
				]

				if (media.video.use_subtitle) {

					media.ffmpeg_argument.push('-c:s')
					media.ffmpeg_argument.push(`${media.video.use_subtitle == 'mov' ? 'mov_text' : 'copy'}`)

				}

				media.ffmpeg_argument.push(`-y`)
				media.ffmpeg_argument.push(`${media.file.path_new}`)

			}

			else {

				media.ffmpeg_argument = [
					`-threads`, `4`,
					`-i`, `${media.file.path}`,
					`-map`, `0:v:0`,
					`-map`, `0:a?`,
					`-map`, `0:s?`,
					`-vcodec`, `${codec}`,
					`-preset`, `slow`,
					`-level`, `4.1`,
					`-b:v`, `${media.video.bitrate}M`,
					`-bufsize`, `${media.video.bufsize}M`,
					`-maxrate`, `${media.video.max}M`,
					`-minrate`, `${media.video.min}M`,
					`-c:a`, `aac`,
					`-b:a`, `128k`,
					`-ac`, `2`,
					`-tune`, `${o.decision.tune}`,
					`-vf`, `scale=${media.video.converted_resolution}:flags=lanczos${o.decision.crop ? ",crop=" + media.video.crop : ""}`,
				]

				if (media.video.use_subtitle) {

					media.ffmpeg_argument.push('-c:s')
					media.ffmpeg_argument.push(`${media.video.use_subtitle == 'mov' ? 'mov_text' : 'copy'}`)

				}

				media.ffmpeg_argument.push(`-y`)
				media.ffmpeg_argument.push(`${media.file.path_new}`)

			}

		} else {

			if (o.decision.tune == "film" && codec == "libx265") {

				media.ffmpeg_argument = [
					`-threads`, `4`,
					`-hwaccel`, `cuda`,
					`-i`, `${media.file.path}`,
					`-map`, `0:v:0`,
					`-map`, `0:a?`,
					`-map`, `0:s?`,
					`-vcodec`, `${codec}`,
					`-preset`, `slow`,
					`-level`, `4.1`,
					`-b:v`, `${media.video.bitrate}M`,
					`-bufsize`, `${media.video.bufsize}M`,
					`-maxrate`, `${media.video.max}M`,
					`-minrate`, `${media.video.min}M`,
					`-c:a`, `aac`,
					`-b:a`, `128k`,
					`-ac`, `2`,
					`-vf`, `scale=${media.video.converted_resolution}:flags=lanczos${o.decision.crop ? ",crop=" + media.video.crop : ""}`,
				]

				if (media.video.use_subtitle) {

					media.ffmpeg_argument.push('-c:s')
					media.ffmpeg_argument.push(`${media.video.use_subtitle == 'mov' ? 'mov_text' : 'copy'}`)

				}

				media.ffmpeg_argument.push(`-${encFallback ? 'y' : 'n'}`)
				media.ffmpeg_argument.push(`${media.file.path_new}`)

			}

			else {

				media.ffmpeg_argument = [
					`-threads`, `4`,
					`-hwaccel`, `cuda`,
					`-i`, `${media.file.path}`,
					`-map`, `0:v:0`,
					`-map`, `0:a?`,
					`-map`, `0:s?`,
					`-vcodec`, `${codec}`,
					`-preset`, `slow`,
					`-level`, `4.1`,
					`-b:v`, `${media.video.bitrate}M`,
					`-bufsize`, `${media.video.bufsize}M`,
					`-maxrate`, `${media.video.max}M`,
					`-minrate`, `${media.video.min}M`,
					`-c:a`, `aac`,
					`-b:a`, `128k`,
					`-ac`, `2`,
					`-tune`, `${o.decision.tune}`,
					`-vf`, `scale=${media.video.converted_resolution}:flags=lanczos${o.decision.crop ? ",crop=" + media.video.crop : ""}`,
				]

				if (media.video.use_subtitle) {

					media.ffmpeg_argument.push('-c:s')
					media.ffmpeg_argument.push(`${media.video.use_subtitle == 'mov' ? 'mov_text' : 'copy'}`)

				}

				media.ffmpeg_argument.push(`-${encFallback ? 'y' : 'n'}`)
				media.ffmpeg_argument.push(`${media.file.path_new}`)

			}
		}

		convert()

	}

	function convert() {

		let encode = child.spawn('ffmpeg', media.ffmpeg_argument, { encoding: 'UTF-8', windowsHide: true, shell: false })

		encode.on('error', function (err) { obj.convert.files[key].processing = "Failed - Ffmpeg Missing"; })

		encode.stderr.on('data', (data) => {

			data = data.toString()

			if (o.debug.convert.data) console.log(data)
			if (o.debug.convert.file) console.log(media)

			if (data.includes('OpenEncodeSessionEx failed: out of memory') || data.includes('No capable devices found')) {

				encode.kill()
				setTimeout(() => { return assemble(true) }, 500);

			}
			else if (data.includes('Cannot load nvcuda.dll') || data.includes('device type cuda needed for codec h264')) {

				encode.kill()
				setTimeout(() => { return assemble(true, true) }, 500);

			}

			else if (data.includes('already exists')) {

				media.activity = "Validating"
				media.process = false

			}

			else {
				if (data.match(/(?<=frame=)(.*)(?=fps)/g) != null) {

					let quality = data.match(/(?<=q=)(.*?)(?= )/g)
					let bitrate = data.match(/(?<=bitrate=)(.*?)(?=kbits\/s)/g)
					let size = data.match(/(?<=size=)(.*?)(?=kb)/ig)

					quality = quality ? quality[0].trim() : 0
					bitrate = bitrate ? bitrate[0].trim() : 0
					size = size ? size[0].trim() : 0

					media.working.completed_frames = data.match(/(?<=frame=)(.*)(?=fps)/g)[0].trim() * 1000
					media.working.fps = data.match(/(?<=fps=)(.*)(?= q)/g)[0]
					media.working.quality = quality
					media.working.bitrate = bitrate
					media.file.new_size = Number(size) * 1000

				}
			}
		});

		encode.on('exit', (code) => {

			if (code != null) {

				media.activity = "Validating";
				media.process = false

			}

		})

	}

}

/**
 * @param {Object} media
 * @param {String} media.activity - Current activity of the media.
 * @param {Object} media.file
 * @param {String} media.file.name - Name of the file with extension.
 * @param {String} media.file.name_mod - Name of the file without extension.
 * @param {String} media.file.ext - Extension of the file.
 * @param {String} media.file.path - Absolute path of the file.
 * @param {String} media.file.series - Series obtained from file name.
 * @param {String} media.file.episode - Episode obtained from file name.
 * @param {Object} media.video
 * @param {Number} media.video.fps - Current media frames per second.
 * @param {Number} media.video.total_frames - Total amount of frames from the file.
 * @param {String=} media.video.subtitle_map - Subtitle map obtained from statistics.
 * @param {String} media.video.width - Current media width.
 * @param {String} media.video.height - Current media height.
 * @param {String} media.video.ratio - Aspect ratio of the current media.
 * @param {String} media.video.converted_width - Calculated width using the new resolution.
 * @param {String} media.video.converted_height - Calculated height using the new resolution.
 * @param {String} media.video.converted_resolution - Calculated resolution using the new height and width.
 * @param {String} media.video.crop - Adjusted crop based on resolution decision.
 * @param {String} media.video.crf - Quality target determined by presets.
 * @param {Object} media.working
 * @param {Number} media.working.fps - Current processed frames per second.
 * @param {Number} media.working.completed_frames - Amount of completed frames since the start of conversion.
 * @param {Number} media.working.quality - Current quality factor determined by ffmpeg.
 * @param {Number} media.working.bitrate - Average bitrate of processed frames.
 * @param {Number} media.started - Epoch of when the media started.
 * @param {Number} media.ended - Epoch of when the media ended.
 * @param {String[]} media.ffmpeg_argument - Array of ffmpeg arguments.
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

		if (data.match(/(?<=frame=)(.*)(?=fps)/g) != null) {

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

		if (data.includes('corrupt') || data.includes('Invalid argument') || data.includes('Invalid data found')) {

			media.activity = "Failed - File Corrupt";

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

function rename(input) {

	//console.log(input)

	let output = {
		rename: null,
		ext: null,
		show: null,
		series: null,
		built: null,
		season: null,
		episode: []
	}

	if (input.match(/((s[0-9]+)((e[0-9]+)+|(.e[0-9]+)+))((-e[0-9]+)+)?/ig) != null) {

		output.season = input.match(/((s[0-9]+)((e[0-9]+)+|(.e[0-9]+)+))((-e[0-9]+)+)?/ig, '')[0]

		output.season = output.season.replace(/\.|-/g, '')
		output.season = output.season.replace(/s/ig, 's')
		output.season = output.season.replace(/e/ig, 'e')
		output.season = output.season.trim()

		output.series = output.season.match(/S[0-9]+(?=E)/ig)[0]

		output.season.substr(output.season.split(/e/i)[0].length + 1).split(/e/i).forEach((episode, i) => {

			output.episode.push(episode)

			if (i == 0) output.built = `${output.series}e${episode}`
			else output.built += `-e${episode}`

		})


		output.show = input.replace(/\./g, ' ').match(/(.*?)(?=[S-s][0-9])/g, '')[0].replace(/-/g, '').trim()

		output.ext = input.match(/.srt|.mkv|.idx|.sub/)[0]

		output.rename = `${output.show.replace('-', '')} - ${output.built}${output.ext}`

	} else output.rename = input

	//console.log(output)

	console.log(output)

	return output;

}

function time(value, type) {

	if (value == null) {

		let date = new Date();

		let a = date.getHours(); let b = date.getMinutes(); let c = date.getSeconds();
		let d = a == 12 ? 'PM' : a > 12 ? 'PM' : 'AM'; let h = a == 12 || (a > 9 && a < 12) ? `${a}` : a > 12 ? a - 12 > 9 ? `${a - 12}` : `0${a - 12}` : `0${a}`
		let m = String(b).length == 2 ? b : `0${b}`; let s = String(c).length == 2 ? c : `0${c}`

		return `${h}:${m}:${s}-${d} - ${date.toDateString()}`;

	}

	else if (!type) {

		let date = new Date(value)

		let a = date.getHours(); let b = date.getMinutes(); let c = date.getSeconds();
		let d = a == 12 ? 'PM' : a > 12 ? 'PM' : 'AM'; let h = a == 12 || (a > 9 && a < 12) ? `${a}` : a > 12 ? a - 12 > 9 ? `${a - 12}` : `0${a - 12}` : `0${a}`
		let m = String(b).length == 2 ? b : `0${b}`; let s = String(c).length == 2 ? c : `0${c}`

		return `${h}:${m}:${s}-${d}`;

	} else {

		let hours = 0;
		let minutes = 0;
		let seconds = Math.floor(value / 1000)

		minutes = Math.floor(seconds / 60)
		seconds -= minutes * 60

		hours = Math.floor(minutes / 60)
		minutes -= hours * 60

		return `${hours ? hours + ' Hour(s) ' : ''}${minutes ? minutes + ' Minute(s) ' : ''}${seconds ? seconds + ' Second(s) ' : ''}`

	}
}

return;