const fs = require("fs")

function main() {
    fs.readdirSync("./").forEach((file, index) => {

        if (fs.statSync(file).isDirectory()) return nextLevel("./" + file)

    })
}

function nextLevel(path) {

    console.log("Next Level", path)

    let season;
    let series_name;

    if (/(?<=Season |Season)([0-9][0-9]|[1-9])(?=)/i.test(path)) season = path.match(/(?<=Season |Season)([0-9][0-9]|[1-9])(?=)/i)[0]
    if (/(?<=\/)(.*)(?= Season)/i.test(path)) series_name = path.match(/(?<=\/)(.*)(?= Season)/i)[0]

    season = season < 10 ? "0" + season : season

    console.log(season)

    let name = {}

    fs.readdirSync(path).forEach((file, index) => {

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
        episode.number = /[0-9][0-9][0-9]|[0-9][0-9]/.test(file) ? file.match(/[0-9][0-9][0-9]|[0-9][0-9]/)[0] : null
        episode.episode = null
        episode.season = season

        if (/s[0-9]+e[0-9]+|s[0-9]+.e[0-9]+/i.test(file)) {

            console.log("Got episode from file name.")

            let string = file.match(/s[0-9]+e[0-9]+|s[0-9]+.e[0-9]+/i)[0]

            episode.episode = string.match(/(?<=e)[0-9]+/i)[0]
            episode.episode = Number(episode.episode)
            episode.episode = episode.episode < 10 ? "0" + episode.episode : episode.episode

            if (!episode.number) episode.number == Number(episode.episode)

        } else {

            console.log("Got episode from index.")
            
            episode.episode = index + 1 < 10 ? "0" + (index + 1) : index + 1

        }

        episode.n_file = file;
        episode.ext = file.match(/\.mp4|\.mkv|\.mov|\.avi|\.m4p/)[0]
        episode.n_file = file.replace(episode.ext, "")
        episode.n_file = file.replace(/\./g, " ");

        console.log(episode.n_file)

        console.log(`[Next Level] [${index}] Looking at file: ${file} with extension ${episode.ext}`)

        if (!episode.ext) return;

        episode.n_file = `${episode.show} - s${season}e${episode.episode}${episode.ext}`
        episode.n_path = episode.folder_path + "/" + episode.n_file

        fs.renameSync(episode.file_path, episode.n_path)

        console.log(`[Next Level] [${index}] New file name ${episode.n_file}`)

    })

    console.log(name)

}

main()