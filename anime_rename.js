const fs = require("fs")

function main() {
    fs.readdirSync("./").forEach((file, index) => {

        if (fs.statSync(file).isDirectory()) return nextLevel("./" + file)

    })
}

function nextLevel(path) {

    console.log("Next Level", path)

    let season;

    if (/(?<=Season |Season)([0-9][0-9]|[1-9])(?=)/i.test(path)) season = path.match(/(?<=Season |Season)([0-9][0-9]|[1-9])(?=)/i)[0]

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
        episode.show = null
        episode.number = /[0-9][0-9][0-9]|[0-9][0-9]/.test(file) ? file.match(/[0-9][0-9][0-9]|[0-9][0-9]/)[0] : null
        episode.episode = null

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

        console.log(`[Next Level] [${index}] Looking at file: ${file} with extension ${episode.ext}`)

        if (!episode.ext) return;

        if (/\[.*?\]/.test(file)) {

            console.log(`[Next Level] [${index}] File ${file} tested positive with match ${file.match(/\[.*?\]/)[0]}`)

            episode.n_file = episode.n_file.replace(/\[.*?\]/, "")

        }

        if (/- [0-9][0-9]|[0-9][0-9] -/.test(episode.n_file)) {

            episode.n_file = episode.n_file.replace(/(?<=- [0-9][0-9]|[0-9][0-9] -)(.*)(?=$)/, "")
            episode.n_file = episode.n_file.replace(episode.n_file.match(/- [0-9][0-9]|[0-9][0-9] -/)[0], "- " + episode.n_file.match(/[0-9][0-9]/)[0])
            episode.n_file = episode.n_file.replace(/episode /i, "")
            episode.n_file = episode.n_file.replace(/\./, " ")


        }

        else if (/- [0-9][0-9][0-9]|[0-9][0-9][0-9] -/.test(episode.n_file)) {

            episode.n_file = episode.n_file.replace(/(?<=- [0-9][0-9][0-9]|[0-9][0-9][0-9] -)(.*)(?=$)/, "")
            episode.n_file = episode.n_file.replace(episode.n_file.match(/- [0-9][0-9][0-9]|[0-9][0-9][0-9] -/)[0], "- " + episode.n_file.match(/[0-9][0-9][0-9]/)[0])
            episode.n_file = episode.n_file.replace(/episode /i, "")
            episode.n_file = episode.n_file.replace(/\./, " ")

        }

        else if (/S[0-9]+E[0-9]+/.test(episode.n_file)) {

            episode.n_file = episode.n_file.replace(/(?<=- S[0-9]+E[0-9]+|S[0-9]+E[0-9]+ -)(.*)(?=$)/, "")
            episode.n_file = episode.n_file.replace(episode.n_file.match(/- S[0-9]+E[0-9]+|S[0-9]+E[0-9]+ -/)[0], "- " + episode.n_file.match(/S[0-9]+E[0-9]+/)[0])
            episode.n_file = episode.n_file.replace(/episode /i, "")
            episode.n_file = episode.n_file.replace(/\./, " ")

        }

        else throw "Unable to determine epsidoe format."
        

        episode.show = episode.n_file.match(/(?<=)(.*)(?= - [0-9][0-9]+|- S[0-9]+E[0-9]+)/)[0].trim()

        episode.n_file = `${episode.show} - S${season}E${episode.episode}${episode.ext}`
        episode.n_path = episode.folder_path + "/" + episode.n_file

        fs.renameSync(episode.file_path, episode.n_path)

        console.log(`[Next Level] [${index}] New file name ${episode.n_file}`)

    })

    console.log(name)

}

main()