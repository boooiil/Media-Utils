"use strict";

/**
 * Little hacky thing I made in a few hours.
 * I will improve it later (might be a lie).
 * 
 * This file is used to iterate through directories and start 'redesign.js' as a child process.
 * It will assume that the current directory is the root of the project.
 * It will assume that the redesign.js file is in a subdirectory of an unknwon name.
 * It will not traverse more than one level deep.
 * It will ask the user for any additional arguments to pass to the child process.
 * It will ask for how many child processes to run at once.
 * It will collect arguments for each process before running them.
 * 
 * [Run file] [Potential arguments: -a (amount) -d (directory) -h (help) -d (debug)]
 * [Collect all directories in current or specified directory]
 *      [Iterate through directories]
 *          [If directory contains 'redesign.js']
 *              [Ask for arguments]
 *              [Store in object]
 * [Run child processes]
 */

/**
 * You can see how well this design turned out.
 * Map:
 * {
 *      [Directory]: {
 *          directory: [Directory (this)],
 *          arguments: [Arguments]
 *      }
 *      generateCommand: function() {
 *          return 'node ' + this.directory + '/redesign.js ' + this.arguments.join(' ');
 *      }
 * }
 */

const { spawn, ChildProcessWithoutNullStreams } = require('child_process');
const { statSync, readdirSync, readFileSync, existsSync } = require('fs');
const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
const currentDirectory = process.cwd();

/**
 * @typedef {Object} DirectoryReference
 * @property {string} directory
 * @property {string[]} arguments
 * @property {string} generatedCommand
 * @property {string?} status
 * @property {number?} started
 * @property {number?} ended
 */

/**
 * @typedef {Object} ProcessingReference
 * @property {string} status
 * @property {ChildProcessWithoutNullStreams} childProcess
 * @property {number} started
 * @property {DirectoryReference} directoryReference
 */

/**
 * @type {{ 
 *      directories: DirectoryReference[], 
 *      processing: { [key: string]: ProcessingReference },
 *      amount: number 
 * }}
 */
const internal = { directories: [], processing: {}, amount: 1 };

let debug = false;

// Iterate through user arguments.
for (let index = 0; index < process.argv.length; index++) {

	let argument = process.argv[index];

	// If the argument is '-a' then the next argument should be the amount of child processes to run.
	if (argument === '-a') {

		// '-a' ' '
		let amount = process.argv[index + 1];

		// If the amount is undefined, then the user did not specify an amount.
		if (amount === undefined) {
			console.error('No amount specified for argument -a');
			process.exit(1);
		}

		// If the amount is not a number, then the user specified an amount that is not a number.
		if (isNaN(amount)) {
			console.error('Amount specified for argument -a is not a number');
			process.exit(1);
		}

		// If the amount is less than 1, then the user specified an amount that is less than 1.
		if (amount < 1) {
			console.error('Amount specified for argument -a is less than 1');
			process.exit(1);
		}

		internal.amount = parseInt(amount);
		index++;
		continue;

	}

	// If the argument is '-d', then the next argument should be the directory to start in.
	if (argument === '-d') {

		let directory = process.argv[index + 1];

		// If the directory is undefined, then the user did not specify a directory.
		if (directory === undefined) {
			console.error('No directory specified for argument -d');
			process.exit(1);
		}

		// If the directory does not exist, then the user specified a directory that does not exist.
		if (!existsSync(directory)) {
			console.error('Directory specified for argument -d does not exist');
			process.exit(1);
		}

		index++;
		continue;

	}

	// Enable debug mode.
	if (argument == 'debug') { debug = true }

}


async function main() {

	// Get all directories in the current directory.
	let directories = readdirSync(currentDirectory).filter(file => statSync(file).isDirectory());

	// Iterate through directories.
	for (let directory of directories) {

		if (debug) { console.log('directory', directory) }

		// Get all files in the subdirectory.
		let files = readdirSync(directory).filter(file => !statSync(directory + "/" + file).isDirectory());
		let mp4Warning = files.some(file => file.includes('.mp4'));

		// Iterate through files.
		for (let file of files) {

			if (debug) { console.log('file', file) }

			if (file === 'redesign.js') {

				if (mp4Warning) {

					console.log(chalk.red("This directory contains MP4 files."))
					console.log(chalk.red("This directory is either being transcoded, has been transcoded, or is partially transcoded."))

				}

				// This is being lazy, yes yes.
				// If the user does not want to transcode this directory, then skip it.
				if (/[N-n]o/.test(await ask(`Would you like to transcode the directory ${directory}: `))) { continue }

				// Get the arguments from the user.
				let args = await ask('Enter arguments for this child process: ');

				// Store the directory and arguments in the map.
				internal.directories.push({
					directory: directory,
					arguments: args,
					generatedCommand: ['./redesign.js'],
					status: "Waiting"
				})

				args.split(' ').forEach(argument => internal.directories[internal.directories.length - 1].generatedCommand.push(argument));

			}

		}

	}

	readline.close();

	overlook()
	updateScreen()

}


function overlook() {

	setInterval(() => {

		let current_amount = Object.keys(internal.processing).length

		//if (debug) 
		if (debug) { console.log(current_amount, internal.amount) }

		if (current_amount < internal.amount) {

			/**
			 * @type {ProcessingReference}
			 */
			let next = { status: null, childProcess: null, started: null, directoryReference: null };

			next.directoryReference = internal.directories.shift()
			next.status = next.directoryReference ? next.directoryReference.status : null

			if (debug) { console.log('next', next) }

			if (!next.status || next.status.includes("Failed") || next.status == "Finished") {

				if (current_amount == 0) { process.exit() }

			}
			else {

				next.status = "Processing"
				next.directoryReference.started = new Date().getTime()

				internal.processing[next.directoryReference.directory] = next

			}

		}

		if (current_amount > internal.amount) {

			console.error("CURRENT TRANSCODES ARE GREATER THAN THE ALLOWED AMOUNT.")
			console.error("CURRENT ALLOWED AMOUNT: " + internal.amount)
			console.error("CURRENT QUEUE:")

			for (_process of internal.processing) {
				console.error("CURRENT FILE: ", internal.processing[_process].directoryReference.directory)
			}

			process.exit()

		}

		Object.keys(internal.processing).forEach(proc => {

			let _process = internal.processing[proc]

			if (!_process.childProcess) {

				if (debug) { console.log('spawnChildProcess', _process) }

				if (_process.status.includes("Processing")) { spawnChildProcess(_process) }

			}

			if (_process.status === "Finished" || _process.status.includes("Failed")) {

				if (debug) { console.log('Finished', _process) }

				_process.directoryReference.ended = new Date().getTime()

				internal.directories.push(_process.directoryReference)

				delete internal.processing[_process.directoryReference.directory]

			}

			//else throw new Error('Unknown status: ' + _process.status)

		})

	}, 500);

}

// Display information related to the child processes.
function updateScreen() {

	//Attempt to hide the cursor in the console.
	console.log('\x1B[?25l');

	setInterval(() => {

		let output = []

		let ob = chalk.gray("[")
		let cb = chalk.gray("]")
		let t = `${ob + chalk.blue("TIME") + cb} ${chalk.gray(time())} `
		let amount = `${ob + chalk.blue("AMOUNT") + cb} ${chalk.gray(internal.amount)} `
		let dbg = debug ? ob + chalk.red("DEBUG") + cb + " " : ""

		if (!debug) {

			//Clear the current console output.
			console.clear();

			//Log the top line.
			console.log(`${t}${amount}${dbg}\n`)

			//Get info for currently converting _process.
			Object.keys(internal.processing).forEach((directory, index) => {

				let _process = internal.processing[directory]

				let file_name = `${ob + chalk.blue("FILE") + cb} ${chalk.gray(_process.directoryReference.directory.substring(0, 30))}`

				// TODO: Extrapolate ETA from the running process.
				//let eta = `${ob + chalk.blue("ETA") + cb} ${chalk.gray(time(Math.ceil((total_frames - completed_frames) / media_fps), 1))}`

				let activity = `${ob + chalk.blue("ACT") + cb} ${chalk.gray(_process.status)}`
				let started = `${ob + chalk.blue("START") + cb} ${chalk.gray(time(_process.started))}`

				// TODO: Get total files / completed files.
				//let percent = `${ob + chalk.blue("PROG") + cb} ${chalk.gray(Math.ceil((completed_frames / total_frames) * 100) + "%")}`

				//let message = `${file_name} ${activity} ${started} ${percent} ${cq} ${bitrate} ${speed} ${eta} `

				let message = `${file_name} ${activity} ${started} `

				output.push(message)

			})

			//Get the other files in the queue.
			internal.directories.forEach(directory => {

				let file_name = `${ob + chalk.blue("FILE") + cb} ${chalk.gray(directory.directory.substring(0, 15))}`
				let activity = `${ob + chalk.blue("STATUS") + cb} ${chalk.gray(directory.status)}`

				if (directory.status == "Waiting") {

					let message = `${file_name} ${activity}`

					return output.push(message)

				}

				if (directory.status == "Finished" || directory.status.includes("Failed")) {

					let ended = `${ob + chalk.blue("COMPLETION") + cb} ${chalk.gray(time(directory.ended))}`
					let elapsed = `${ob + chalk.blue("ELAPSED") + cb} ${chalk.gray(time(directory.ended - directory.started, 1))}`

					let message = `${file_name} ${activity} ${ended} ${elapsed}`

					return output.push(message)

				}

			})

			output.forEach(line => console.log(line))

		}

	}, 500);

}

/**
 * This function spawns a child process.
 * @param {ProcessingReference} _process - The _process parameter is a ProcessingReference object that represents
 * the process that will be spawned.
 * @returns {void} This function does not return anything.
 */
function spawnChildProcess(_process) {

	if (debug) { console.log('childProcess', _process) }

	_process.childProcess = spawn('node', _process.directoryReference.generatedCommand, { cwd: _process.directoryReference.directory });

	_process.childProcess.stdout.on('data', (data) => {

		if (debug) { console.log(`stdout: ${'data:', data}`) }

	});

	_process.childProcess.stderr.on('data', (data) => {

		if (debug) { console.error(`stderr: ${'data:', data}`) }

		throw String(data)

		// _process.status = "Failed";
		// _process.directoryReference.status = "Failed";

	});

	_process.childProcess.on('close', (code) => {

		if (debug) { console.log(`child process exited with code ${code}`) }

		_process.status = "Finished";
		_process.directoryReference.status = "Finished";

	});

}

/**
 * This is an asynchronous function that prompts the user with a question and returns a promise that
 * resolves with the user's answer.
 * @param {string} question - The question parameter is a string that represents the question that will be asked
 * to the user.
 * @returns {Promise<string>} An asynchronous function that returns a Promise object.
 */
async function ask(question) {

	// Return a new Promise object.
	return new Promise((resolve, reject) => {

		// Ask the user the question and resolve the promise with the user's answer.
		readline.question(question, (answer) => {

			// Resolve the promise with the user's answer.
			resolve(answer);

		})

	})
}

/**
 * Homemade coloring library.
 */
let chalk = {

	/**
	 * Wraps a string in ANSI escape codes to color it red.
	 * @param {string} string The string to be colored red.
	 * @returns {string} The colored string.
	 */
	red: (string) => { return "\x1b[38;2;255;128;128m" + string + "\x1b[0m" },

	/**
	 * Wraps a string in ANSI escape codes to color it blue.
	 * @param {string} string The string to be colored blue.
	 * @returns {string} The colored string.
	 */
	blue: (string) => { return "\x1b[38;2;77;148;255m" + string + "\x1b[0m" },

	/**
	 * Wraps a string in ANSI escape codes to color it gray.
	 * @param {string} string The string to be colored gray.
	 * @returns {string} The colored string.
	 */
	gray: (string) => { return "\x1b[38;2;191;191;191m" + string + "\x1b[0m" }

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

main()

process.on('SIGINT', () => {

	console.log()
	console.log(chalk.red("SIGINT -- Exiting..."))
	console.log(chalk.red("Bringing back the cursor..."))
	console.log("\x1B[?25h")

})

process.on('SIGTERM', () => {

	console.log()
	console.log(chalk.red("SIGTERM -- Exiting..."))
	console.log(chalk.red("Bringing back the cursor..."))
	console.log("\x1B[?25h")

});

process.on('exit', () => {

	console.log()
	console.log(chalk.red("Exiting..."))
	console.log(chalk.red("Bringing back the cursor..."))
	console.log("\x1B[?25h")

})