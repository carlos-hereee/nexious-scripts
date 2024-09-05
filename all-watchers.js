import fs from 'fs'
import path from 'path'

const targetPath = "./src"
const stylesPath = "./src/stylesheets"
const destinationFolder = 'dist/'


// TODO: run tsc alias + tsc + stylesheet changes when files change

fs.watch(targetPath,{recursive: true}, (eventType, filename)=> {
    if(filename&& eventType ==="change"){
        // console.log(`File ${filename} has changed. Executing ${executeFile}...`);
        const sourcePath = path.join(targetPath, filename)
        const destinationPath = path.join()
    }
} )
console.log(`Watching for changes on path ${targetPath} ...`);
