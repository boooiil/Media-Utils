const fs = require("fs")

function main() {
    fs.readdirSync("./").forEach((file, index) => {

        if (fs.statSync(file).isDirectory()) return nextLevel("./" + file)

    })
}

/**
 * The function renames TV show episode files in a given directory to follow a standardized naming
 * convention.
 * @param {string} path - The path to the directory containing the files to be renamed.
 */
function nextLevel(path) {

    console.log("Next Level", path)

    let season;
    let series_name;

    // Get the season number from a given string that is provided in the format {name} Season {number}
    if (/(?<=Season |Season)([0-9][0-9]|[1-9])(?=)/i.test(path)) season = path.match(/(?<=Season |Season)([0-9][0-9]|[1-9])(?=)/i)[0]

    // Get the series name from a given string that is provided in the format {name} Season {number}
    if (/(?<=\/)(.*)(?= Season)/i.test(path)) series_name = path.match(/(?<=\/)(.*)(?= Season)/i)[0]

    // prefix the season number with a zero if it is less than 10
    season = season < 10 ? "0" + season : season

    console.log(season)

    let name = {}

    // iterate through the second level directory
    fs.readdirSync(path).forEach((file, index) => {

        // skip if the file is a directory
        if (fs.statSync(path + "/" + file).isDirectory()) return;

        name[file] = {}

        let episode = name[file]

        episode.folder_path = path
        episode.file_path = path + "/" + file
        episode.n_path = null
        episode.ext = null
        episode.file = file
        episode.n_file = null
        episode.show = series_name

        // Get the episode number from the file name if it exists, otherwise set it to null
        episode.number = /[0-9][0-9][0-9]|[0-9][0-9]/.test(file) ? file.match(/[0-9][0-9][0-9]|[0-9][0-9]/)[0] : null

        episode.episode = null
        episode.season = season

        // Test if the string matches format s{number}e{number} or s{number}.e{number}
        if (/s[0-9]+e[0-9]+|s[0-9]+.e[0-9]+/i.test(file)) {

            console.log("Got episode from file name.")

            // Get the episode number from the file name 
            let string = file.match(/s[0-9]+e[0-9]+|s[0-9]+.e[0-9]+/i)[0]

            episode.episode = string.match(/(?<=e)[0-9]+/i)[0]
            episode.episode = Number(episode.episode)
            episode.episode = episode.episode < 10 ? "0" + episode.episode : episode.episode

            if (!episode.number) episode.number == Number(episode.episode)

        } else {

            console.log("Got episode from index.")

            // If the episode number is not in the file name, use the index of the file in the directory
            episode.episode = index + 1 < 10 ? "0" + (index + 1) : index + 1

        }

        episode.n_file = file;
        
        // Get the file extension
        episode.ext = file.match(/\.mp4|\.mkv|\.mov|\.avi|\.m4p/)[0]

        // Remove the file extension from the file name
        episode.n_file = file.replace(episode.ext, "")

        // Replace all periods with spaces
        episode.n_file = file.replace(/\./g, " ");

        console.log(episode.n_file)

        console.log(`[Next Level] [${index}] Looking at file: ${file} with extension ${episode.ext}`)

        // If we can't find the file extension, return
        if (!episode.ext) return;

        // Set the new file name
        episode.n_file = `${episode.show} - s${season}e${episode.episode}${episode.ext}`

        // Set the new file path
        episode.n_path = episode.folder_path + "/" + episode.n_file

        // Rename the file
        fs.renameSync(episode.file_path, episode.n_path)

        console.log(`[Next Level] [${index}] New file name ${episode.n_file}`)

    })

    console.log(name)

}

main()